// 错误归一化：定义四类可识别错误，统一提供面向用户的友好提示与是否可重试标记

/** HTTP 状态错误（非 2xx） */
export class HttpError extends Error {
  readonly userMessage = '服务器返回了异常状态，请稍后重试';
  readonly retryable = false;

  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

/** JSON 解析失败 */
export class ParseError extends Error {
  readonly userMessage = '返回数据解析失败，请重试';
  readonly retryable = false;

  constructor() {
    super('Response parse failed');
    this.name = 'ParseError';
  }
}

/** 网络请求失败（后端不可达等） */
export class NetworkError extends Error {
  readonly userMessage = '网络连接失败，请检查网络后重试';
  readonly retryable = true;

  constructor() {
    super('Network error');
    this.name = 'NetworkError';
  }
}

/** 请求超时 */
export class TimeoutError extends Error {
  readonly userMessage = '请求超时，请重试';
  readonly retryable = true;

  constructor() {
    super('Request timeout');
    this.name = 'TimeoutError';
  }
}

/** 归一化后的错误信息 */
export interface NormalizedError {
  userMessage: string;
  retryable: boolean;
}

/** 将任意错误归一化为面向用户的友好提示，绝不暴露原始堆栈 */
export function normalizeError(error: unknown): NormalizedError {
  if (
    error instanceof HttpError ||
    error instanceof ParseError ||
    error instanceof NetworkError ||
    error instanceof TimeoutError
  ) {
    return { userMessage: error.userMessage, retryable: error.retryable };
  }
  return { userMessage: '请求失败，请重试', retryable: false };
}
