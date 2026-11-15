// 错误归一化：定义四类可识别错误，统一提供面向用户的友好提示、是否可重试、是否可降级

/** 后端明确指出「能力未就绪」时的降级判定（如没配 API Key） */
const DEGRADABLE_HINT = /未配置|LLM_API_KEY|not configured|no api key/i;

/** HTTP 状态错误（非 2xx） */
export class HttpError extends Error {
  readonly userMessage = '服务器返回了异常状态，请稍后重试';
  readonly retryable = false;
  /**
   * 是否可用本地演示数据兜底。
   * 只针对「后端能力未就绪」这类确定性问题（典型是没填 LLM_API_KEY），
   * 让第一次下载的人即使没有密钥也能看到完整界面与图表，而不是一片报错。
   */
  readonly degradable: boolean;

  constructor(
    public readonly status: number,
    detail?: string,
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
    this.degradable = typeof detail === 'string' && DEGRADABLE_HINT.test(detail);
  }
}

/** JSON 解析失败（可选携带后端透传的具体原因） */
export class ParseError extends Error {
  readonly retryable = false;
  /**
   * 流式请求下后端返回 200 + 错误文本时走这里，
   * 所以「未配置密钥」这类提示同样要能触发降级。
   */
  readonly degradable: boolean;
  readonly userMessage: string;

  constructor(customMessage?: string) {
    super('Response parse failed');
    this.name = 'ParseError';
    this.userMessage = customMessage ?? '返回数据解析失败，请重试';
    this.degradable = typeof customMessage === 'string' && DEGRADABLE_HINT.test(customMessage);
  }
}

/** 网络请求失败（后端不可达等） */
export class NetworkError extends Error {
  readonly userMessage = '网络连接失败，请检查网络后重试';
  readonly retryable = true;
  readonly degradable = false;

  constructor() {
    super('Network error');
    this.name = 'NetworkError';
  }
}

/** 请求超时 */
export class TimeoutError extends Error {
  readonly userMessage = '请求超时，请重试';
  readonly retryable = true;
  readonly degradable = false;

  constructor() {
    super('Request timeout');
    this.name = 'TimeoutError';
  }
}

/** 归一化后的错误信息 */
export interface NormalizedError {
  userMessage: string;
  retryable: boolean;
  /** true 时用本地演示数据回答，并在界面标注「演示数据」 */
  degradable: boolean;
}

/** 将任意错误归一化为面向用户的友好提示，绝不暴露原始堆栈 */
export function normalizeError(error: unknown): NormalizedError {
  if (
    error instanceof HttpError ||
    error instanceof ParseError ||
    error instanceof NetworkError ||
    error instanceof TimeoutError
  ) {
    return {
      userMessage: error.userMessage,
      retryable: error.retryable,
      degradable: error.degradable,
    };
  }
  return { userMessage: '请求失败，请重试', retryable: false, degradable: false };
}
