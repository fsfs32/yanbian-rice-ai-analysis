// 右栏「数据速览」的数据整理：把统计口径与数据集描述从组件里拆出来
// 组件只负责渲染，这里负责「内置水稻数据 / 用户上传 CSV」两种情况的展示数据

import type { CsvDataset } from '../types';
import { calcKpi, formatWan } from './calcKpi';
import { LABELS, VALUES } from './mockData';

/** 内置数据集名称 */
export const BUILTIN_NAME = '延边州稻谷产量';

/** 内置数据集的统计指标 */
export const BUILTIN_KPI = calcKpi(LABELS, VALUES);

/** 内置数据集的趋势序列 */
export const BUILTIN_VALUES = VALUES;

/** 能力范围：说明「能问什么」，与中间示例卡不重复 */
export const ABILITIES = ['产量 / 产值趋势图', '极值、均值等统计', '栽培与病虫害知识', '上传 CSV 做画像'];

export interface StatRow {
  label: string;
  value: string;
}

/** 数字格式化：千分位分隔，小数最多两位 */
function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
  return String(Number(value.toFixed(2)));
}

/** 内置数据集的四条统计 */
export function builtinStats(): StatRow[] {
  return [
    { label: '数据区间', value: `${LABELS[0]}—${LABELS[LABELS.length - 1]}` },
    { label: '最新产量', value: formatWan(VALUES[VALUES.length - 1]) },
    { label: '最高产量', value: formatWan(BUILTIN_KPI.maxValue) },
    { label: '平均产量', value: formatWan(BUILTIN_KPI.avg) },
  ];
}

/** 上传 CSV 的四条统计：指标名取自识别到的数值列 */
export function csvStats(dataset: CsvDataset): StatRow[] {
  const { labels, values, rowCount, columnCount } = dataset;

  if (!dataset.plottable || values.length === 0) {
    return [
      { label: '数据规模', value: `${rowCount} 行 × ${columnCount} 列` },
      { label: '数值列', value: '未识别到' },
    ];
  }

  const metric = dataset.metricLabel || '数值';
  const kpi = calcKpi(labels, values);
  const first = labels[0];
  const last = labels[labels.length - 1];
  // 首列是年份时展示区间，否则退化为行数
  const range =
    typeof first === 'number' && typeof last === 'number' ? `${first}—${last}` : `${values.length} 行`;

  return [
    { label: '数据区间', value: range },
    { label: `最新${metric}`, value: formatValue(values[values.length - 1]) },
    { label: `最高${metric}`, value: formatValue(kpi.maxValue) },
    { label: `平均${metric}`, value: formatValue(kpi.avg) },
  ];
}

/** 当前数据集的趋势序列：内置用产量，CSV 用识别到的数值列 */
export function trendValues(dataset: CsvDataset | null): number[] {
  if (dataset === null) return BUILTIN_VALUES;
  return dataset.plottable ? dataset.values : [];
}

/** 数据来源说明文案 */
export function sourceText(dataset: CsvDataset | null): string {
  if (dataset === null) {
    return '延边州历年《国民经济和社会发展统计公报》。产值按粳稻均价 2.6 元/公斤估算，非官方口径。';
  }
  if (dataset.plottable) {
    return `用户上传的「${dataset.fileName}」，共 ${dataset.rowCount} 行 × ${dataset.columnCount} 列，统计口径为「${dataset.metricLabel || '首个数值列'}」。`;
  }
  return `用户上传的「${dataset.fileName}」，共 ${dataset.rowCount} 行 × ${dataset.columnCount} 列；未识别到数值列，暂不做统计。`;
}
