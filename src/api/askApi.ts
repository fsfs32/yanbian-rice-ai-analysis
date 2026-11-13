// API 层统一出口：封装 fetch、AbortController 超时、错误归一化
// 前端绝不直接调用任何大模型，只请求后端 VITE_API_BASE_URL + "/api/ask"

import type { AskResponse, ChatTurn, CsvAttachment } from '../types';
import { HttpError, NetworkError, ParseError, TimeoutError } from '../utils/normalizeError';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';
const TIMEOUT_MS = 15000;

/** 构造带外部 signal 透传的 AbortController */
function buildController(signal?: AbortSignal): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);
  return { controller, cleanup: () => signal?.removeEventListener('abort', onExternalAbort) };
}

/** 解析 JSON 响应，失败抛 ParseError */
async function parseJsonResponse(response: Response): Promise<AskResponse> {
  try {
    return (await response.json()) as AskResponse;
  } catch {
    throw new ParseError();
  }
}

/**
 * 向后端提问，返回标准 AskResponse。
 * 内部使用 AbortController 设置 15s 超时，并检查 response.ok。
 */
export async function askQuestion(question: string, signal?: AbortSignal): Promise<AskResponse> {
  const { controller, cleanup } = buildController(signal);
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw new TimeoutError();
      throw new NetworkError();
    }

    if (!response.ok) throw new HttpError(response.status);
    return await parseJsonResponse(response);
  } finally {
    clearTimeout(timeoutId);
    cleanup();
  }
}

/** 多轮上下文：历史对话与本次会话标识，供后端做指代消解 */
export interface AskContext {
  history: ChatTurn[];
  sessionId: string;
}

/**
 * 流式提问（原生 fetch + ReadableStream 实现，未使用 Vercel AI SDK）。
 * 后端返回 text/event-stream 时逐块读取并回调 onDelta 逐字渲染；否则回退为普通 JSON。
 * 选择原生实现是为了理解流式原理，这是本项目的一个加分叙事点。
 */
export async function streamQuestion(
  question: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  context?: AskContext,
  csv?: CsvAttachment,
): Promise<AskResponse> {
  const { controller, cleanup } = buildController(signal);
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
        body: JSON.stringify({
          question,
          history: context?.history ?? [],
          session_id: context?.sessionId,
          ...(csv ? { csv } : {}),
        }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw new TimeoutError();
      throw new NetworkError();
    }

    if (!response.ok) throw new HttpError(response.status);

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream') && response.body) {
      return await readSse(response.body, onDelta);
    }
    return await parseJsonResponse(response);
  } finally {
    clearTimeout(timeoutId);
    cleanup();
  }
}

/** 解析 SSE 流：逐行读取 data 字段，支持增量 delta 与最终完整载荷 */
async function readSse(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<AskResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastPayload: AskResponse | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const raw = trimmed.slice(5).trim();
      if (raw === '[DONE]') continue;
      try {
        const payload = JSON.parse(raw) as Partial<AskResponse> & { delta?: string };
        if (typeof payload.delta === 'string') onDelta(payload.delta);
        if (typeof payload.summary === 'string' && payload.chart_config) {
          lastPayload = payload as AskResponse;
        }
      } catch {
        // 忽略无法解析的分片，等待下一个完整事件
      }
    }
  }

  if (!lastPayload) throw new ParseError();
  return lastPayload;
}
