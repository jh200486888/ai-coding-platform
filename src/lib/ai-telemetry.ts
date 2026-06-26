import { logger } from './logger';
import { saveTelemetry, cleanupTelemetry } from './db';

// 遥测数据类型
export interface TelemetryData {
  timestamp: string;
  provider: string;
  model: string;
  operation: string;
  durationMs: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  userId?: string;
}

// 配置
const CLEANUP_INTERVAL = 3600000; // 每小时检查一次清理
const RETENTION_DAYS = 30; // 保留 30 天

// 遥测管理器
class TelemetryManager {
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startAutoCleanup();
  }

  // 记录 AI 调用（直接写入数据库）
  recordAICall(data: Omit<TelemetryData, 'timestamp'>): void {
    const telemetry: TelemetryData = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    // 异步写入数据库，不阻塞主流程
    saveTelemetry({
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      duration_ms: data.durationMs,
      success: data.success,
      error_code: data.errorCode,
      error_message: data.errorMessage,
      prompt_tokens: data.tokensUsed?.prompt || 0,
      completion_tokens: data.tokensUsed?.completion || 0,
      total_tokens: data.tokensUsed?.total || 0,
      user_id: data.userId,
    }).catch(err => {
      logger.error('Failed to save telemetry:', err);
    });

    // 开发环境实时打印
    if (process.env.NODE_ENV === 'development') {
      logger.debug('AI Telemetry', telemetry);
    }
  }

  // 包装 AI 调用并自动记录遥测
  async trackAICall<T>(
    operation: () => Promise<T>,
    context: {
      provider: string;
      model: string;
      operationType: string;
      userId?: string;
    }
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let tokensUsed: TelemetryData['tokensUsed'];

    try {
      const result = await operation();

      // 尝试从结果中提取 token 使用情况
      if (result && typeof result === 'object') {
        const usage = (result as any).usage;
        if (usage) {
          tokensUsed = {
            prompt: usage.promptTokens || 0,
            completion: usage.completionTokens || 0,
            total: usage.totalTokens || (usage.promptTokens || 0) + (usage.completionTokens || 0),
          };
        }
      }

      return result;
    } catch (error: any) {
      success = false;
      errorCode = error?.code || 'UNKNOWN';
      errorMessage = error?.message || 'Unknown error';
      throw error;
    } finally {
      const durationMs = Date.now() - startTime;

      this.recordAICall({
        provider: context.provider,
        model: context.model,
        operation: context.operationType,
        durationMs,
        tokensUsed,
        success,
        errorCode,
        errorMessage,
        userId: context.userId,
      });
    }
  }

  // 启动自动清理
  private startAutoCleanup(): void {
    if (this.cleanupTimer) return;

    // 启动后延迟 5 分钟执行第一次清理
    setTimeout(() => {
      this.runCleanup();
      
      // 然后每小时执行一次
      this.cleanupTimer = setInterval(() => {
        this.runCleanup();
      }, CLEANUP_INTERVAL);
    }, 300000);
  }

  // 执行清理
  private async runCleanup(): Promise<void> {
    try {
      await cleanupTelemetry(RETENTION_DAYS);
      logger.info(`Telemetry cleanup: removed records older than ${RETENTION_DAYS} days`);
    } catch (error) {
      logger.error('Failed to cleanup telemetry:', error);
    }
  }

  // 停止自动清理
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// 导出单例
export const telemetry = new TelemetryManager();

// 导出便捷函数
export function trackAI<T>(
  operation: () => Promise<T>,
  context: {
    provider: string;
    model: string;
    operationType: string;
    userId?: string;
  }
): Promise<T> {
  return telemetry.trackAICall(operation, context);
}
