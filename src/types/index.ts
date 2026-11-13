// 全局共享类型定义：所有 API 请求/响应、组件 Props、Hook 返回值统一在此声明

/** 图表类型白名单：折线图 / 柱状图 / 散点图 / 组合图（柱+折线双轴） */
export type ChartType = 'line' | 'bar' | 'scatter' | 'combo';

/** 图表坐标轴字段白名单：年份 / 产量 / 销售额 */
export type Field = 'year' | 'yield' | 'revenue';

/** 后端返回的图表配置 */
export interface ChartConfig {
  chart_type: ChartType;
  x_field: Field;
  y_field: Field;
  /** 组合图第二序列字段（如销售额），仅在 chart_type=combo 时存在 */
  y2_field?: Field;
  title: string;
}

/** 后端 /api/ask 的标准响应结构 */
export interface AskResponse {
  chart_config: ChartConfig;
  labels: (string | number)[];
  values: number[];
  /** 组合图第二序列（如销售额），与 values 等长 */
  values2?: number[];
  summary: string;
  source?: string;
}

/** 通过运行时校验、可直接用于渲染的图表数据 */
export interface ChartData {
  config: ChartConfig;
  labels: (string | number)[];
  values: number[];
  values2?: number[];
  source?: string;
}

/** 上传 CSV 的表格预览数据（表头 + 数据行） */
export interface CsvPreview {
  headers: string[];
  rows: string[][];
}

/** 上传 CSV 附件的结构化数据，随问题一并交给后端做 AI 分析 */
export interface CsvAttachment {
  file_name: string;
  headers: string[];
  rows: string[][];
}

/** 对话消息：kind=normal 为普通问答，kind=error 为边界提示 / 错误卡 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind: 'normal' | 'error';
  chart?: ChartData;
  table?: CsvPreview;
  isDemo?: boolean;
  pending?: boolean;
}

/** AI 状态条展示的阶段：理解问题 → 查询数据 → 计算分析 → 生成图表 → 完成 */
export type ChatStatus =
  | 'idle'
  | 'understanding'
  | 'querying'
  | 'computing'
  | 'rendering'
  | 'done';

/** 发送问题的回调 */
export type SendQuestion = (question: string) => void;

/** 重试回调 */
export type RetryHandler = () => void;

/** 发给后端的一轮对话上下文 */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** 本地保存的提问历史 */
export interface HistoryEntry {
  id: string;
  question: string;
  time: number;
}
