// 数据编排入口：useChat 是唯一负责数据获取与状态编排的 Hook
// 数据流：组件 → useChat → askApi → 后端 → useChat → 组件 props

import { useCallback, useReducer, useRef, useState } from 'react';
import type { AgentStep, AskResponse, ChatMessage, ChatStatus, ChatTurn, ChartData, CsvAttachment, CsvPreview, CsvDataset, HistoryEntry } from '../types';
import { streamQuestion } from '../api/askApi';
import { normalizeError } from '../utils/normalizeError';
import { validateAskResponse } from '../utils/validateAskResponse';
import { analyzeCsv, summarizeSeries } from '../utils/csvInsight';
import { getMockResponse } from '../utils/mockData';
import { loadHistory, pushHistory } from '../utils/history';

const TYPE_CHAR_DELAY_MS = 16;
const HISTORY_WINDOW = 6;

const genId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  isLoading: boolean;
}

const initialState: ChatState = { messages: [], status: 'idle', isLoading: false };

type Action =
  | { type: 'SEND'; userMsgId: string; aiMsgId: string; question: string }
  | { type: 'STATUS'; status: ChatStatus }
  | { type: 'STEP'; id: string; step: AgentStep }
  | { type: 'APPEND'; id: string; text: string }
  | { type: 'RESULT'; id: string; chart: ChartData; isDemo: boolean; table?: CsvPreview; followups?: string[]; summary?: string }
  | { type: 'INGEST_START'; id: string }
  | { type: 'INGEST_RESULT'; id: string; content: string; chart?: ChartData; table?: CsvPreview }
  | { type: 'TEXT_RESULT'; id: string; content: string; followups?: string[] }
  | { type: 'ERROR'; id: string; message: string }
  | { type: 'STOP' }
  | { type: 'RESET' };

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'SEND': {
      const userMsg: ChatMessage = {
        id: action.userMsgId,
        role: 'user',
        content: action.question,
        kind: 'normal',
      };
      const aiMsg: ChatMessage = {
        id: action.aiMsgId,
        role: 'assistant',
        content: '',
        kind: 'normal',
        pending: true,
      };
      return {
        messages: [...state.messages, userMsg, aiMsg],
        status: 'understanding',
        isLoading: true,
      };
    }
    case 'STATUS':
      return { ...state, status: action.status };
    case 'STEP':
      return {
        ...state,
        status: action.step.phase,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, steps: [...(m.steps ?? []), action.step] } : m,
        ),
      };
    case 'APPEND':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.text, pending: false } : m,
        ),
      };
    case 'RESULT':
      return {
        ...state,
        status: 'done',
        isLoading: false,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? {
                ...m,
                chart: action.chart,
                isDemo: action.isDemo,
                table: action.table,
                followups: action.followups,
                // 流式期间已边生成边显示；这里用最终全文对齐，避免分片与终稿不一致
                ...(action.summary ? { content: action.summary } : {}),
                pending: false,
              }
            : m,
        ),
      };
    case 'INGEST_START': {
      const msg: ChatMessage = {
        id: action.id,
        role: 'assistant',
        content: '',
        kind: 'normal',
        pending: true,
      };
      return { ...state, messages: [...state.messages, msg], status: 'querying', isLoading: true };
    }
    case 'INGEST_RESULT':
      return {
        ...state,
        status: 'done',
        isLoading: false,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? { ...m, content: action.content, chart: action.chart, table: action.table, pending: false }
            : m,
        ),
      };
    case 'TEXT_RESULT':
      // 纯文字回答（知识问答、寒暄等）：当作正常消息渲染，不套错误卡、不显示「重试」
      return {
        ...state,
        status: 'done',
        isLoading: false,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? {
                ...m,
                kind: 'normal',
                content: action.content,
                followups: action.followups,
                pending: false,
              }
            : m,
        ),
      };
    case 'ERROR':
      return {
        ...state,
        status: 'done',
        isLoading: false,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, kind: 'error', content: action.message, pending: false } : m,
        ),
      };
    case 'STOP':
      return {
        ...state,
        status: 'idle',
        isLoading: false,
        messages: state.messages.map((m) =>
          m.pending ? { ...m, pending: false, content: m.content || '已停止生成' } : m,
        ),
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

/** 请求结果：成功携带数据与是否演示数据，失败携带友好提示，主动停止则静默结束 */
type RequestOutcome =
  | { kind: 'ok'; data: AskResponse; isDemo: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'aborted' };

/** 发起请求，网络/超时错误重试一次；仍失败则降级为演示数据 */
async function requestWithRetry(
  question: string,
  signal: AbortSignal,
  isStale: () => boolean,
  isStopped: () => boolean,
  onDelta: (text: string) => void,
  onStep: (step: AgentStep) => void,
  context: { history: ChatTurn[]; sessionId: string },
): Promise<RequestOutcome> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    if (isStopped()) return { kind: 'aborted' };
    try {
      const data = await streamQuestion(question, onDelta, signal, context, undefined, onStep);
      return { kind: 'ok', data, isDemo: false };
    } catch (error) {
      if (isStopped()) return { kind: 'aborted' };
      const normalized = normalizeError(error);
      if (normalized.retryable && attempt === 0) {
        await sleep(400);
        if (isStale()) return { kind: 'error', message: normalized.userMessage };
        continue;
      }
      // 可重试的重试用尽、或后端能力未就绪（如没配密钥）时，降级为本地演示数据
      if (normalized.retryable || normalized.degradable) {
        return { kind: 'ok', data: getMockResponse(question), isDemo: true };
      }
      return { kind: 'error', message: normalized.userMessage };
    }
  }
  return { kind: 'error', message: '请求失败，请重试' };
}

/** 打字机逐字渲染（JSON 响应时的降级方案） */
async function typewrite(
  aiMsgId: string,
  text: string,
  shouldStop: () => boolean,
  append: (id: string, text: string) => void,
): Promise<void> {
  for (const ch of Array.from(text)) {
    if (shouldStop()) return;
    append(aiMsgId, ch);
    await sleep(TYPE_CHAR_DELAY_MS);
  }
}

export interface UseChatResult {
  messages: ChatMessage[];
  status: ChatStatus;
  isLoading: boolean;
  history: HistoryEntry[];
  /** 当前数据集：null 表示内置水稻数据，非空表示用户上传的 CSV */
  dataset: CsvDataset | null;
  /** 最近一次问答从发出到出图的耗时（毫秒），用于顶栏状态角标 */
  latencyMs: number | null;
  clearDataset: () => void;
  sendQuestion: (question: string) => void;
  ingestCsv: (input: { fileName: string; headers: string[]; rows: string[][] }) => void;
  stop: () => void;
  retry: () => void;
  reset: () => void;
}

export function useChat(): UseChatResult {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [dataset, setDataset] = useState<CsvDataset | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const sessionIdRef = useRef<string>(genId());

  const sendQuestion = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question) return;

      const startedAt = Date.now();
      const runId = ++runIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      stoppedRef.current = false;

      const userMsgId = genId();
      const aiMsgId = genId();
      const isStale = () => runIdRef.current !== runId;
      const isStopped = () => stoppedRef.current;

      // 发送即进入真实阶段：理解问题 → 查询数据（请求发出）→ 计算分析（首个增量到达）
      dispatch({ type: 'SEND', userMsgId, aiMsgId, question });
      dispatch({ type: 'STATUS', status: 'querying' });
      setHistory(pushHistory(question));

      // 多轮上下文：只带最近的正常消息，避免把错误卡和空占位带进 Prompt
      const turns: ChatTurn[] = state.messages
        .filter((m) => m.kind === 'normal' && m.content.trim().length > 0)
        .slice(-HISTORY_WINDOW)
        .map((m) => ({ role: m.role, content: m.content }));

      // SSE 流式：首个增量到达即切到「计算分析」；否则走打字机降级
      let streamed = false;
      let sawStep = false;
      const onDelta = (text: string) => {
        if (!streamed) {
          streamed = true;
          // 已通过 step 事件推进到更靠后的阶段时，不再回退到「计算分析」
          if (!sawStep) dispatch({ type: 'STATUS', status: 'computing' });
        }
        if (!isStale()) dispatch({ type: 'APPEND', id: aiMsgId, text });
      };

      // 可解释推理：后端 SSE 下发 step 事件时，记录真实执行轨迹并驱动状态条
      const onStep = (step: AgentStep) => {
        sawStep = true;
        if (!isStale()) dispatch({ type: 'STEP', id: aiMsgId, step });
      };

      const outcome = await requestWithRetry(
        question,
        controller.signal,
        isStale,
        isStopped,
        onDelta,
        onStep,
        { history: turns, sessionId: sessionIdRef.current },
      );
      if (isStale() || outcome.kind === 'aborted') return;

      if (outcome.kind === 'error') {
        dispatch({ type: 'ERROR', id: aiMsgId, message: outcome.message });
        return;
      }

      const validation = validateAskResponse(outcome.data);
      if (isStale()) return;
      if (!validation.ok) {
        dispatch({ type: 'ERROR', id: aiMsgId, message: validation.message });
        return;
      }

      const append = (id: string, text: string) => dispatch({ type: 'APPEND', id, text });
      const shouldStop = () => isStale() || isStopped();

      // 纯文字回答（知识问答、寒暄等）：labels/values 为空，不画图，按正常消息展示
      if (validation.chart.labels.length === 0) {
        if (!streamed) await typewrite(aiMsgId, validation.summary, shouldStop, append);
        if (isStale() || isStopped()) return;
        dispatch({
          type: 'TEXT_RESULT',
          id: aiMsgId,
          content: validation.summary,
          followups: validation.followups,
        });
        return;
      }

      // 普通 JSON 响应：打字机逐字渲染摘要
      if (!streamed) {
        dispatch({ type: 'STATUS', status: 'computing' });
        await typewrite(aiMsgId, validation.summary, shouldStop, append);
      }
      if (isStale() || isStopped()) return;

      // 生成图表阶段：给状态条一个可见的「生成图表」过渡，再落地最终结果
      dispatch({ type: 'STATUS', status: 'rendering' });
      await sleep(260);
      if (isStale() || isStopped()) return;
      setLatencyMs(Date.now() - startedAt);
      dispatch({
        type: 'RESULT',
        id: aiMsgId,
        chart: validation.chart,
        isDemo: outcome.isDemo,
        followups: validation.followups,
        summary: validation.summary,
      });
    },
    [state.messages],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    abortRef.current?.abort();
    dispatch({ type: 'STOP' });
  }, []);

  /**
   * 摄入上传的 CSV：优先把结构化数据交给后端 AI 分析（复用 /api/ask，body 附带 csv 字段），
   * 后端返回标准 AskResponse 后按「文字 + 图表 + 表格」展示；
   * 后端不可用或未返回有效图表时，降级为浏览器本地数据画像，保证上传后始终有反馈。
   */
  const ingestCsv = useCallback(
    async (input: { fileName: string; headers: string[]; rows: string[][] }) => {
      // 本地画像：作为后端不可用 / 未返回有效图表时的兜底
      const insight = analyzeCsv(input.headers, input.rows);
      const stats = insight.series ? summarizeSeries(insight.series.values) : null;

      // 右侧「数据速览」切到本次上传的数据集；再次上传会整体替换
      setDataset({
        fileName: input.fileName,
        rowCount: input.rows.length,
        columnCount: input.headers.length,
        metricLabel: insight.series?.valueLabel ?? '',
        labels: insight.series?.labels ?? [],
        values: insight.series?.values ?? [],
        plottable: Boolean(insight.series),
      });

      let fallbackContent: string;
      let fallbackChart: ChartData | undefined;

      if (insight.plottable && insight.series && stats) {
        fallbackContent =
          `已解析「${input.fileName}」：共 ${input.rows.length} 行、${input.headers.length} 列，` +
          `识别到 ${insight.numericColumnCount} 个数值列。` +
          `其中「${insight.series.valueLabel}」的峰值为 ${stats.max.toLocaleString('zh-CN')}，` +
          `均值约为 ${Math.round(stats.avg).toLocaleString('zh-CN')}。`;
        // 数据点较多时柱状图会因柱子过细（边框/圆角覆盖）而空白，改用折线图保证可读
        const pointCount = insight.series.values.length;
        fallbackChart = {
          config: {
            chart_type: pointCount > 30 ? 'line' : 'bar',
            x_field: 'year',
            y_field: 'yield',
            title: `${insight.series.valueLabel} · 数据预览`,
          },
          labels: insight.series.labels,
          values: insight.series.values,
          source: input.fileName,
        };
      } else {
        fallbackContent = `已解析「${input.fileName}」：共 ${input.rows.length} 行、${input.headers.length} 列，未识别到可绘制的数值列。`;
      }

      const table: CsvPreview = { headers: input.headers, rows: input.rows };
      const csv: CsvAttachment = {
        file_name: input.fileName,
        headers: input.headers,
        rows: input.rows,
      };

      const runId = ++runIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      stoppedRef.current = false;
      const aiMsgId = genId();
      const isStale = () => runIdRef.current !== runId;
      const isStopped = () => stoppedRef.current;

      dispatch({ type: 'INGEST_START', id: aiMsgId });

      let streamed = false;
      let sawStep = false;
      const onDelta = (text: string) => {
        if (!streamed) {
          streamed = true;
          if (!sawStep) dispatch({ type: 'STATUS', status: 'computing' });
        }
        if (!isStale()) dispatch({ type: 'APPEND', id: aiMsgId, text });
      };

      const onStep = (step: AgentStep) => {
        sawStep = true;
        if (!isStale()) dispatch({ type: 'STEP', id: aiMsgId, step });
      };

      const append = (id: string, text: string) => dispatch({ type: 'APPEND', id, text });
      const shouldStop = () => isStale() || isStopped();

      try {
        const data = await streamQuestion(
          `请分析我上传的数据文件「${input.fileName}」`,
          onDelta,
          controller.signal,
          { history: [], sessionId: sessionIdRef.current },
          csv,
          onStep,
        );

        if (isStale() || isStopped()) return;

        const validation = validateAskResponse(data);
        if (!validation.ok || validation.chart.labels.length === 0) {
          dispatch({ type: 'INGEST_RESULT', id: aiMsgId, content: fallbackContent, chart: fallbackChart, table });
          return;
        }

        if (!streamed) {
          dispatch({ type: 'STATUS', status: 'computing' });
          await typewrite(aiMsgId, validation.summary, shouldStop, append);
        }
        if (isStale() || isStopped()) return;

        dispatch({ type: 'STATUS', status: 'rendering' });
        await sleep(260);
        if (isStale() || isStopped()) return;
        dispatch({
          type: 'RESULT',
          id: aiMsgId,
          chart: validation.chart,
          isDemo: false,
          table,
          followups: validation.followups,
          summary: validation.summary,
        });
      } catch {
        // 后端不可用（网络 / 超时）时降级为本地端侧画像
        if (isStale() || isStopped()) return;
        dispatch({ type: 'INGEST_RESULT', id: aiMsgId, content: fallbackContent, chart: fallbackChart, table });
      }
    },
    [],
  );

  const retry = useCallback(() => {
    const lastUser = [...state.messages].reverse().find((m) => m.role === 'user');
    if (lastUser) void sendQuestion(lastUser.content);
  }, [state.messages, sendQuestion]);

  /** 恢复内置数据集：右侧「数据速览」回到延边水稻数据 */
  const clearDataset = useCallback(() => setDataset(null), []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    stoppedRef.current = true;
    abortRef.current?.abort();
    sessionIdRef.current = genId();
    setDataset(null);
    dispatch({ type: 'RESET' });
  }, []);

  return {
    messages: state.messages,
    status: state.status,
    isLoading: state.isLoading,
    history,
    dataset,
    latencyMs,
    clearDataset,
    sendQuestion,
    ingestCsv,
    stop,
    retry,
    reset,
  };
}
