import { logger } from './logger';

// AI 调用错误类型
export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public provider?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// 错误分类
export enum AIErrorCode {
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  AUTH_ERROR = 'AUTH_ERROR',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// 统一的 AI 错误处理包装器
export async function withAIErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    provider?: string;
    model?: string;
    operationType: string;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const errorCode = classifyAIError(error);
    const statusCode = extractStatusCode(error);

    logger.error(
      'AI ' + context.operationType + ' failed',
      {
        provider: context.provider,
        model: context.model,
        errorCode,
        errorMessage,
        statusCode,
      }
    );

    throw new AIError(
      formatErrorMessage(errorCode, errorMessage, context),
      errorCode,
      statusCode,
      context.provider,
      error
    );
  }
}

// 错误分类
function classifyAIError(error: any): AIErrorCode {
  const message = error?.message?.toLowerCase() || '';
  const status = error?.statusCode || error?.status;

  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return AIErrorCode.RATE_LIMIT;
  }
  if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('forbidden')) {
    return AIErrorCode.AUTH_ERROR;
  }
  if (status === 404 || message.includes('not found') || message.includes('model not found')) {
    return AIErrorCode.MODEL_NOT_FOUND;
  }
  if (status === 400 || message.includes('invalid') || message.includes('bad request')) {
    return AIErrorCode.INVALID_REQUEST;
  }
  if (message.includes('timeout') || message.includes('aborted')) {
    return AIErrorCode.TIMEOUT;
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return AIErrorCode.NETWORK_ERROR;
  }
  if (status >= 500) {
    return AIErrorCode.PROVIDER_ERROR;
  }

  return AIErrorCode.UNKNOWN;
}

// 提取状态码
function extractStatusCode(error: any): number | undefined {
  return error?.statusCode || error?.status || undefined;
}

// 格式化错误消息
function formatErrorMessage(
  code: AIErrorCode,
  originalMessage: string,
  context: { provider?: string; model?: string; operationType: string }
): string {
  const providerStr = context.provider ? ' [' + context.provider + ']' : '';
  const modelStr = context.model ? ' (model: ' + context.model + ')' : '';

  switch (code) {
    case AIErrorCode.RATE_LIMIT:
      return '请求频率过高，请稍后再试' + providerStr;
    case AIErrorCode.TIMEOUT:
      return 'AI 响应超时' + providerStr + modelStr + '，请稍后重试';
    case AIErrorCode.AUTH_ERROR:
      return 'API 认证失败，请检查 API Key' + providerStr;
    case AIErrorCode.MODEL_NOT_FOUND:
      return '模型不可用' + providerStr + modelStr;
    case AIErrorCode.INVALID_REQUEST:
      return '请求参数错误' + providerStr + ': ' + originalMessage;
    case AIErrorCode.PROVIDER_ERROR:
      return 'AI 服务商错误' + providerStr + ': ' + originalMessage;
    case AIErrorCode.NETWORK_ERROR:
      return '网络连接错误' + providerStr + '，请检查网络';
    default:
      return 'AI 调用失败' + providerStr + modelStr + ': ' + originalMessage;
  }
}

// 为 API 路由提供标准错误响应
export function createErrorResponse(error: unknown): Response {
  if (error instanceof AIError) {
    const statusCode = error.statusCode || 500;
    return Response.json(
      {
        error: error.message,
        code: error.code,
        provider: error.provider,
      },
      { status: statusCode }
    );
  }

  return Response.json(
    {
      error: '服务内部错误',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}
