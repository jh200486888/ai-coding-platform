import { query, run } from './db';

// ============ 遥测记录接口 ============

export interface TelemetryRecord {
  functionId: string;
  model: string;
  mode?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs: number;
  status?: 'success' | 'error';
  errorMessage?: string;
}

export interface TelemetryStats {
  period: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgDurationMs: number;
  errorCount: number;
  errorRate: number;
  byModel: Record<string, {
    requests: number;
    tokens: number;
    avgDurationMs: number;
    errors: number;
  }>;
  byMode: Record<string, {
    requests: number;
    tokens: number;
    avgDurationMs: number;
  }>;
}

// ============ 记录遥测数据 ============

export async function recordTelemetry(data: TelemetryRecord): Promise<void> {
  try {
    await run(
      `INSERT INTO telemetry_events (function_id, model, mode, input_tokens, output_tokens, total_tokens, duration_ms, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.functionId,
        data.model,
        data.mode || null,
        data.inputTokens || 0,
        data.outputTokens || 0,
        data.totalTokens || 0,
        data.durationMs,
        data.status || 'success',
        data.errorMessage || null,
      ]
    );
  } catch (err) {
    console.error('[telemetry] Failed to record:', err);
  }
}

// ============ 查询遥测统计 ============

export async function getTelemetryStats(hours: number = 24): Promise<TelemetryStats> {
  const rows: any[] = await query(
    `SELECT
       model,
       mode,
       COUNT(*) as request_count,
       SUM(input_tokens) as total_input_tokens,
       SUM(output_tokens) as total_output_tokens,
       SUM(total_tokens) as total_tokens,
       AVG(duration_ms)::int as avg_duration_ms,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
     FROM telemetry_events
     WHERE created_at >= NOW() - INTERVAL '${hours} hours'
     GROUP BY model, mode`
  );

  const stats: TelemetryStats = {
    period: `last_${hours}_hours`,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    avgDurationMs: 0,
    errorCount: 0,
    errorRate: 0,
    byModel: {},
    byMode: {},
  };

  let weightedDuration = 0;

  for (const row of rows) {
    const count = Number(row.request_count);
    const tokens = Number(row.total_tokens);
    const avgDur = Number(row.avg_duration_ms);
    const errors = Number(row.error_count);

    stats.totalRequests += count;
    stats.totalInputTokens += Number(row.total_input_tokens);
    stats.totalOutputTokens += Number(row.total_output_tokens);
    stats.totalTokens += tokens;
    stats.errorCount += errors;
    weightedDuration += avgDur * count;

    // By model
    if (!stats.byModel[row.model]) {
      stats.byModel[row.model] = { requests: 0, tokens: 0, avgDurationMs: 0, errors: 0 };
    }
    stats.byModel[row.model].requests += count;
    stats.byModel[row.model].tokens += tokens;
    stats.byModel[row.model].errors += errors;

    // By mode
    if (row.mode) {
      if (!stats.byMode[row.mode]) {
        stats.byMode[row.mode] = { requests: 0, tokens: 0, avgDurationMs: 0 };
      }
      stats.byMode[row.mode].requests += count;
      stats.byMode[row.mode].tokens += tokens;
    }
  }

  if (stats.totalRequests > 0) {
    stats.avgDurationMs = Math.round(weightedDuration / stats.totalRequests);
    stats.errorRate = Math.round((stats.errorCount / stats.totalRequests) * 10000) / 100;
  }

  // Recalculate per-model avg duration
  const modelRows: any[] = await query(
    `SELECT model, AVG(duration_ms)::int as avg_duration_ms
     FROM telemetry_events
     WHERE created_at >= NOW() - INTERVAL '${hours} hours'
     GROUP BY model`
  );
  for (const row of modelRows) {
    if (stats.byModel[row.model]) {
      stats.byModel[row.model].avgDurationMs = Number(row.avg_duration_ms);
    }
  }

  const modeRows: any[] = await query(
    `SELECT mode, AVG(duration_ms)::int as avg_duration_ms
     FROM telemetry_events
     WHERE created_at >= NOW() - INTERVAL '${hours} hours'
     GROUP BY mode`
  );
  for (const row of modeRows) {
    if (row.mode && stats.byMode[row.mode]) {
      stats.byMode[row.mode].avgDurationMs = Number(row.avg_duration_ms);
    }
  }

  return stats;
}

// ============ 清理过期遥测数据 ============

export async function cleanupTelemetryEvents(daysOld: number = 30): Promise<number> {
  const result: any = await run(
    `DELETE FROM telemetry_events WHERE created_at < NOW() - INTERVAL '${daysOld} days'`
  );
  return result?.rowCount || 0;
}
