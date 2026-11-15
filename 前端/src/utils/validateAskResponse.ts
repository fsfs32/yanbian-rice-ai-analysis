// 运行时安全校验：对后端返回的数据做白名单与字段校验，校验失败返回友好提示而不崩溃

import type { ChartData, ChartType, Field } from '../types';

const CHART_TYPES: readonly ChartType[] = ['line', 'bar', 'scatter', 'combo'];
const FIELDS: readonly Field[] = ['year', 'yield', 'revenue', 'city'];
const TITLE_MAX = 80;
const SUMMARY_MAX = 800;
const FOLLOWUP_MAX = 40;
const FOLLOWUP_COUNT = 3;

/** 校验结果：成功时携带可渲染的图表数据、已截断的摘要与推荐追问 */
export type ValidationResult =
  | { ok: true; chart: ChartData; summary: string; followups: string[] }
  | { ok: false; message: string };

function isChartType(value: unknown): value is ChartType {
  return typeof value === 'string' && (CHART_TYPES as readonly string[]).includes(value);
}

function isField(value: unknown): value is Field {
  return typeof value === 'string' && (FIELDS as readonly string[]).includes(value);
}

/** 纯文本截断，避免超长字段撑破布局 */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 清洗追问：只保留字符串、去空、去重、限长、最多 3 条；异常值直接忽略 */
function normalizeFollowups(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const text = item.trim();
    if (!text || cleaned.includes(text)) continue;
    cleaned.push(truncate(text, FOLLOWUP_MAX));
    if (cleaned.length >= FOLLOWUP_COUNT) break;
  }
  return cleaned;
}

export function validateAskResponse(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }
  const res = payload as Partial<{
    chart_config: Partial<{
      chart_type: unknown;
      x_field: unknown;
      y_field: unknown;
      y2_field: unknown;
      title: unknown;
    }>;
    labels: unknown;
    values: unknown;
    values2: unknown;
    summary: unknown;
    source: unknown;
    followups: unknown;
  }>;

  const config = res.chart_config;
  if (typeof config !== 'object' || config === null) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }
  if (!isChartType(config.chart_type)) return { ok: false, message: '返回数据格式异常，请重试' };
  if (!isField(config.x_field) || !isField(config.y_field)) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }
  if (config.y2_field !== undefined && !isField(config.y2_field)) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }
  if (typeof config.title !== 'string') return { ok: false, message: '返回数据格式异常，请重试' };
  if (typeof res.summary !== 'string') return { ok: false, message: '返回数据格式异常，请重试' };
  if (!Array.isArray(res.labels) || !Array.isArray(res.values)) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }
  if (res.labels.length !== res.values.length) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }
  if (!res.values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }
  if (!res.labels.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return { ok: false, message: '返回数据格式异常，请重试' };
  }

  // 组合图第二序列字段（可选）
  const y2Field: Field | undefined =
    config.y2_field !== undefined && isField(config.y2_field) ? config.y2_field : undefined;

  // 组合图第二序列（可选）：存在则必须与 values 等长且为有限数字数组
  let values2: number[] | undefined;
  if (res.values2 !== undefined) {
    if (!Array.isArray(res.values2) || res.values2.length !== res.values.length) {
      return { ok: false, message: '返回数据格式异常，请重试' };
    }
    if (!res.values2.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return { ok: false, message: '返回数据格式异常，请重试' };
    }
    values2 = res.values2;
  }

  const source = typeof res.source === 'string' ? res.source : undefined;

  return {
    ok: true,
    chart: {
      config: {
        chart_type: config.chart_type,
        x_field: config.x_field,
        y_field: config.y_field,
        ...(y2Field !== undefined ? { y2_field: y2Field } : {}),
        title: truncate(config.title, TITLE_MAX),
      },
      labels: res.labels,
      values: res.values,
      ...(values2 ? { values2 } : {}),
      source,
    },
    summary: truncate(res.summary, SUMMARY_MAX),
    followups: normalizeFollowups(res.followups),
  };
}
