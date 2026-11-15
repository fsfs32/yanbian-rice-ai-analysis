// 图表卡片（容器组件）：懒加载 ChartView，管理本地图表类型切换与导出
// 「切换类型」只切 series type，不重新请求；「导出」把当前图表带出页面（PNG 带来源水印 / CSV 带注释行）
import { Suspense, lazy, useRef, useState } from 'react';
import type { ChartData, ChartType } from '../types';
import { FIELD_LABEL } from '../utils/chartOption';
import { exportChartCsv } from '../utils/exportData';
import ExportButtons from './ExportButtons';
import SkeletonCard from './SkeletonCard';
import type { ChartViewHandle } from './ChartView';

const ChartView = lazy(() => import('./ChartView'));

/** 导出提示的展示时长 */
const TIP_DURATION_MS = 4000;

interface ChartCardProps {
  data: ChartData;
}

export default function ChartCard({ data }: ChartCardProps) {
  const { config, labels, values, values2, source } = data;
  // 组合图仅在第二序列存在且长度一致时可用
  const hasCombo = Boolean(values2 && values2.length === values.length);

  // 初始类型尊重后端配置；散点图暂不作为默认切换项，落入折线图
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (config.chart_type === 'combo' && hasCombo) return 'combo';
    if (config.chart_type === 'scatter') return 'line';
    // 数据点过多时柱状图会因柱子过细而不可读，默认降级为折线图（用户仍可手动切回柱状图）
    if (config.chart_type === 'bar' && values.length > 60) return 'line';
    return config.chart_type;
  });

  const chartRef = useRef<ChartViewHandle>(null);
  const [exporting, setExporting] = useState<'png' | 'csv' | null>(null);
  const [tip, setTip] = useState('');
  const tipTimer = useRef<number | null>(null);

  const showTip = (text: string) => {
    setTip(text);
    if (tipTimer.current !== null) window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => setTip(''), TIP_DURATION_MS);
  };

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

  const handleExportPng = async () => {
    if (exporting) return;
    setExporting('png');
    try {
      await chartRef.current?.exportPng();
      showTip('图片已导出');
    } catch (error) {
      showTip(error instanceof Error ? error.message : '图片导出失败');
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = () => {
    exportChartCsv({
      title: config.title,
      source,
      labels,
      values,
      values2: hasCombo ? values2 : undefined,
      xLabel: FIELD_LABEL[config.x_field],
      yLabel: FIELD_LABEL[config.y_field],
      y2Label: hasCombo && config.y2_field ? FIELD_LABEL[config.y2_field] : undefined,
    });
    showTip('数据已导出');
  };

  const yDesc = config.y2_field
    ? `${FIELD_LABEL[config.y_field]} / ${FIELD_LABEL[config.y2_field]}`
    : FIELD_LABEL[config.y_field];

  return (
    <div className="rounded-xl border border-border bg-soft/60 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="truncate text-[15px] font-medium text-text-body">{config.title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleType}
            aria-label="切换图表类型"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-muted transition-colors duration-150 hover:border-border-strong hover:text-primary"
          >
            {toggleLabel}
          </button>
          <ExportButtons
            busy={exporting !== null}
            onExportPng={handleExportPng}
            onExportCsv={handleExportCsv}
          />
        </div>
      </div>

      <div className="mt-3">
        <Suspense fallback={<SkeletonCard />}>
          <ChartView
            ref={chartRef}
            labels={labels}
            values={values}
            chartType={chartType}
            values2={values2}
            title={config.title}
            source={source}
          />
        </Suspense>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[12px] text-text-faint">
          X：{FIELD_LABEL[config.x_field]} · Y：{yDesc}
        </p>
        {exporting === 'png' && <p className="text-[12px] text-text-faint">正在生成图片…</p>}
        {tip && (
          <p className="text-[12px] text-text-muted" role="status">
            {tip}
          </p>
        )}
      </div>
    </div>
  );
}
