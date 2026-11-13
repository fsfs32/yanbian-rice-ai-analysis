// 图表卡片（容器组件）：懒加载 ChartView，管理本地图表类型切换（仅切换 series type，不重新请求）
import { Suspense, lazy, useState } from 'react';
import type { ChartData, ChartType, Field } from '../types';
import SkeletonCard from './SkeletonCard';

const ChartView = lazy(() => import('./ChartView'));

const FIELD_LABEL: Record<Field, string> = {
  year: '年份',
  yield: '产量（吨）',
  revenue: '销售额（亿元）',
};

interface ChartCardProps {
  data: ChartData;
}

export default function ChartCard({ data }: ChartCardProps) {
  const { config, labels, values, values2 } = data;
  // 组合图仅在第二序列存在且长度一致时可用
  const hasCombo = Boolean(values2 && values2.length === values.length);

  // 初始类型尊重后端配置；散点图暂不作为默认切换项，落入折线图
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (config.chart_type === 'combo' && hasCombo) return 'combo';
    if (config.chart_type === 'scatter') return 'line';
    return config.chart_type;
  });

  const toggleType = () =>
    setChartType((prev) => {
      if (!hasCombo) return prev === 'bar' ? 'line' : 'bar';
      if (prev === 'combo') return 'line';
      if (prev === 'line') return 'bar';
      return 'combo';
    });

  const toggleLabel = !hasCombo
    ? chartType === 'line'
      ? '切换柱状图'
      : '切换折线图'
    : chartType === 'combo'
      ? '切换折线图'
      : chartType === 'line'
        ? '切换柱状图'
        : '切换组合图';

  const yDesc = config.y2_field
    ? `${FIELD_LABEL[config.y_field]} / ${FIELD_LABEL[config.y2_field]}`
    : FIELD_LABEL[config.y_field];

  return (
    <div className="rounded-lg border border-border bg-soft/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-[13px] font-medium text-text-body">{config.title}</h3>
        <button
          type="button"
          onClick={toggleType}
          aria-label="切换图表类型"
          className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] text-text-muted transition-colors duration-150 hover:border-primary/40 hover:text-primary"
        >
          {toggleLabel}
        </button>
      </div>
      <div className="mt-2">
        <Suspense fallback={<SkeletonCard />}>
          <ChartView labels={labels} values={values} chartType={chartType} values2={values2} />
        </Suspense>
      </div>
      <p className="mt-1.5 text-[10.5px] text-text-faint">
        X：{FIELD_LABEL[config.x_field]} · Y：{yDesc}
      </p>
    </div>
  );
}
