// @ts-nocheck
/**
 * Audit Logger - Tracks destructive operations with user attribution
 * Logs to audit_logs table in PostgreSQL.
 */
import { run, query } from '@/lib/db';
import { logger } from './logger';

export type AuditAction = 
  | 'file_create' | 'file_edit' | 'file_delete'
  | 'command_exec' | 'ssh_exec' | 'ssh_write'
  | 'deploy' | 'build'
  | 'db_query' | 'db_write'
  | 'model_switch' | 'config_change'
  | 'sub_agent_delegate' | 'sub_agent_message';

export interface AuditEntry {
  conversation_id?: string;
  user_id?: string;
  action: AuditAction;
  target: string;       // What was affected (file path, command, etc.)
  detail?: string;      // Additional context
  model_id?: string;    // Which model performed the action
  success: boolean;
  duration_ms?: number;
}

// Buffer for batch inserts
let buffer: AuditEntry[] = [];
let flushTimer: any = null;
const FLUSH_INTERVAL = 5000; // Flush every 5 seconds
const MAX_BUFFER = 50;       // Or when buffer reaches 50

async function flush() {
  if (buffer.length === 0) return;
  const entries = buffer.splice(0);
  try {
    for (const e of entries) {
      await run(
        `INSERT INTO audit_logs (conversation_id, user_id, action, target, detail, model_id, success, duration_ms, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [e.conversation_id, e.user_id, e.action, e.target, e.detail?.slice(0, 2000), e.model_id, e.success, e.duration_ms]
      );
    }
    logger.info(`[Audit] Flushed ${entries.length} entries`);
  } catch (e: any) {
    logger.warn(`[Audit] Flush failed: ${e.message}`);
    // Put entries back (up to 100 max to avoid memory leak)
    if (buffer.length < 100) buffer.unshift(...entries.slice(0, 20));
  }
}

export async function auditLog(entry: AuditEntry) {
  buffer.push(entry);
  if (buffer.length >= MAX_BUFFER) {
    await flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_INTERVAL);
  }
}

// Convenience: auto-detect if action is destructive
export function isDestructiveAction(action: AuditAction): boolean {
  return ['file_delete', 'command_exec', 'ssh_exec', 'ssh_write', 'deploy', 'db_write'].includes(action);
}

// Query audit logs (for admin panel)
export async function getAuditLogs(options: { 
  conversation_id?: string; 
  user_id?: string; 
  action?: AuditAction; 
  limit?: number;
  hours?: number;
}): Promise<any[]> {
  const { conversation_id, user_id, action, limit = 100, hours = 24 } = options;
  let sql = `SELECT * FROM audit_logs WHERE created_at > NOW() - INTERVAL '${hours} hours'`;
  const params: any[] = [];
  let idx = 1;
  if (conversation_id) { sql += ` AND conversation_id = $${idx}`; params.push(conversation_id); idx++; }
  if (user_id) { sql += ` AND user_id = $${idx}`; params.push(user_id); idx++; }
  if (action) { sql += ` AND action = $${idx}`; params.push(action); idx++; }
  sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
  params.push(limit);
  try {
    return await query(sql, params);
  } catch {
    return [];
  }
}
