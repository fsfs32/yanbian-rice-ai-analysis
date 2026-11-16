// 全局共享类型定义：所有 API 请求/响应、组件 Props、Hook 返回值统一在此声明

/** 图表类型白名单：折线图 / 柱状图 / 散点图 / 组合图（柱+折线双轴） */
export type ChartType = 'line' | 'bar' | 'scatter' | 'combo';

/** 图表坐标轴字段白名单：年份 / 产量 / 销售额 */
export type Field = 'year' | 'yield' | 'revenue' | 'city';

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
  /** 本次问答的模型用量 */
  usage?: UsageInfo | null;
  chart_config: ChartConfig;
  labels: (string | number)[];
  values: number[];
  /** 组合图第二序列（如销售额），与 values 等长 */
  values2?: number[];
  summary: string;
  source?: string;
  /** 是否为演示模式回答（未配置 LLM_API_KEY 时由后端内置数据/知识库生成） */
  demo?: boolean;
}

/** 通过运行时校验、可直接用于渲染的图表数据 */
/** 单次问答的模型用量（后端返回，用于成本观测） */
export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  calls: number;
  estimated_cost_cny?: number | null;
}

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

/**
 * 当前数据集摘要：右侧「数据速览」据此渲染统计。
 * 未上传文件时为 null（回退到内置水稻数据），上传后即为该 CSV 的数值列序列。
 */
export interface CsvDataset {
  fileName: string;
  rowCount: number;
  columnCount: number;
  /** 数值列名（作为指标名展示，如「亩产」） */
  metricLabel: string;
  /** X 轴标签（CSV 首列，通常为年份） */
  labels: (string | number)[];
  values: number[];
  /** 是否识别到可统计的数值列 */
  plottable: boolean;
}

/** Agent 推理步骤：后端通过 SSE step 事件下发，反映 AI 真实执行轨迹 */
export type StepPhase = 'understanding' | 'querying' | 'computing' | 'rendering';

export interface AgentStep {
  phase: StepPhase;
  title: string;
  detail: string;
}

/** 对话消息：kind=normal 为普通问答，kind=error 为边界提示 / 错误卡 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind: 'normal' | 'error';
  chart?: ChartData;
  table?: CsvPreview;
  /** AI 推理步骤（可解释分析），后端未下发时为空 */
  steps?: AgentStep[];
  /** 推荐追问（最多 3 条），点击即可继续提问 */
  followups?: string[];
  /** 数据来源（纯文字回答没有图表，来源单独挂在消息上） */
  source?: string;
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
