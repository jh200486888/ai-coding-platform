// @ts-nocheck
/**
 * Persistent Job Queue - PostgreSQL-backed
 * Provides durable background job execution independent of HTTP connections.
 * Jobs survive server restarts and are processed by the heartbeat worker.
 */
import { query, queryOne, run } from '@/lib/db';
import { logger } from './logger';

export interface JobPayload {
  conversationId?: string;
  message?: string;
  model?: string;
  mode?: string;
  [key: string]: any;
}

export interface Job {
  id: string;
  job_type: string;
  title: string;
  payload: JobPayload;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  result?: string;
  error?: string;
  progress: number;
  max_retries: number;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// Enqueue a new background job
export async function enqueueJob(jobType: string, title: string, payload: JobPayload, priority = 0): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO background_jobs (job_type, title, payload, priority) VALUES ($1, $2, $3, $4) RETURNING id`,
    [jobType, title, JSON.stringify(payload), priority]
  );
  return row?.id || '';
}

// Get job by ID
export async function getJob(id: string): Promise<Job | null> {
  return queryOne<Job>('SELECT * FROM background_jobs WHERE id = $1', [id]);
}

// List recent jobs
export async function listJobs(limit = 50, status?: string): Promise<Job[]> {
  if (status) {
    return query<Job>('SELECT * FROM background_jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2', [status, limit]);
  }
  return query<Job>('SELECT * FROM background_jobs ORDER BY created_at DESC LIMIT $1', [limit]);
}

// Get next pending job (for worker)
export async function getNextPendingJob(): Promise<Job | null> {
  // Atomically claim the highest-priority pending job
  const row = await queryOne<Job>(`
    UPDATE background_jobs 
    SET status = 'running', started_at = NOW(), updated_at = NOW() 
    WHERE id = (
      SELECT id FROM background_jobs 
      WHERE status = 'pending' 
      ORDER BY priority DESC, created_at ASC 
      LIMIT 1 
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return row;
}

// Mark job as completed
export async function completeJob(id: string, result: string): Promise<void> {
  await run(
    `UPDATE background_jobs SET status = 'completed', result = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [result, id]
  );
}

// Mark job as failed (with retry logic)
export async function failJob(id: string, error: string): Promise<void> {
  const job = await getJob(id);
  if (job && job.retry_count < job.max_retries) {
    // Retry: reset to pending with incremented retry count
    await run(
      `UPDATE background_jobs SET status = 'pending', error = $1, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $2`,
      [error, id]
    );
    logger.info(`[JobQueue] Job ${id} failed, retrying (${job.retry_count + 1}/${job.max_retries}): ${error.slice(0, 100)}`);
  } else {
    // Max retries exceeded: mark as failed
    await run(
      `UPDATE background_jobs SET status = 'failed', error = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [error, id]
    );
    logger.info(`[JobQueue] Job ${id} failed permanently: ${error.slice(0, 100)}`);
  }
}

// Update job progress (0-100)
export async function updateJobProgress(id: string, progress: number): Promise<void> {
  await run(`UPDATE background_jobs SET progress = $1, updated_at = NOW() WHERE id = $2`, [Math.min(100, Math.max(0, progress)), id]);
}

// Cancel a job
export async function cancelJob(id: string): Promise<void> {
  await run(`UPDATE background_jobs SET status = 'cancelled', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'running')`, [id]);
}

// Process one job (called by heartbeat worker)
export async function processNextJob(): Promise<boolean> {
  const job = await getNextPendingJob();
  if (!job) return false;

  try {
    const { emitNotification } = await import('@/lib/notification-emitter');
    await emitNotification('job_started', { jobId: job.id, title: job.title, type: job.job_type });

    // Execute job based on type
    if (job.job_type === 'chat_task') {
      // Run as internal chat API call
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://127.0.0.1:5000';
      const payload = job.payload || {};
      
      await updateJobProgress(job.id, 10);
      
      const res = await fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: payload.message || '' }],
          model: payload.model || 'deepseek-chat',
          mode: payload.mode || 'coding',
        }),
      });

      if (!res.ok) throw new Error(`Chat API returned ${res.status}`);

      // Read SSE stream
      const reader = res.body?.getReader();
      let result = '';
      if (reader) {
        const decoder = new TextDecoder();
        let chunks = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          chunks++;
          if (chunks % 20 === 0) {
            await updateJobProgress(job.id, Math.min(90, 10 + chunks));
          }
        }
      }

      await completeJob(job.id, result.slice(-5000)); // Keep last 5000 chars
      await emitNotification('job_complete', { jobId: job.id, title: job.title });
    } else {
      // Unknown job type
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    return true;
  } catch (e: any) {
    await failJob(job.id, e.message || 'Unknown error');
    
    try {
      const { emitNotification } = await import('@/lib/notification-emitter');
      await emitNotification('job_failed', { jobId: job.id, title: job.title, error: e.message });
    } catch {}
    
    return true;
  }
}

// Cleanup old completed jobs (keep last 7 days)
export async function cleanupOldJobs(): Promise<number> {
  const result = await run(
    `DELETE FROM background_jobs WHERE status IN ('completed', 'failed', 'cancelled') AND completed_at < NOW() - INTERVAL '7 days'`
  );
  return 0; // run() doesn't return row count
}
