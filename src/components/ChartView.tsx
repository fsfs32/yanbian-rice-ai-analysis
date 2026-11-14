// 图表视图（展示组件）：ECharts 按需引入，option 用 useMemo 缓存
// 支持单序列（折线/柱状）与双轴组合图（柱=产量 + 折线=销售额）
import { memo, useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import type { ChartType, Field } from '../types';

// 按需注册，避免全量引入
echarts.use([LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// 农业主题双序列配色（ECharts 配置允许字面量色值）
const COLOR_YIELD = '#5b8c3e'; // 禾苗绿：产量（柱）
const COLOR_REVENUE = '#d9a441'; // 稻田金：销售额（折线）

/** 字段中文标签 */
const FIELD_LABEL: Record<Field, string> = {
  year: '年份',
  yield: '产量（吨）',
  revenue: '销售额（亿元）',
};

/** 读取设计 Token（CSS 变量）转译为图表字面量颜色，保证与界面主题一致 */
function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildThemeColors() {
  return {
    faint: readToken('--color-text-faint', '#9ca3af'),
    border: readToken('--color-border', '#e5e7eb'),
    body: readToken('--color-text-body', '#374151'),
  };
}

interface ChartViewProps {
  labels: (string | number)[];
  values: number[];
  chartType: ChartType;
  /** 组合图第二序列（销售额），与 values 等长 */
  values2?: number[];
}

function buildOption(
  labels: (string | number)[],
  values: number[],
  chartType: ChartType,
  values2?: number[],
): EChartsOption {
  const c = buildThemeColors();
  const isCombo = chartType === 'combo' && Array.isArray(values2) && values2.length === values.length;

  const tooltip = {
    trigger: 'axis' as const,
    backgroundColor: '#ffffff',
    borderColor: c.border,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: c.body, fontSize: 12 },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.06); border-radius: 8px;',
  };

  const xAxis = {
    type: 'category' as const,
    data: labels,
    axisLabel: { color: c.faint, fontSize: 11 },
    axisLine: { lineStyle: { color: c.border } },
    axisTick: { show: false },
  };

  // 组合图：左轴产量（柱），右轴销售额（折线），双色区分
  if (isCombo) {
    return {
      backgroundColor: 'transparent',
      color: [COLOR_YIELD, COLOR_REVENUE],
      grid: { left: 12, right: 16, top: 34, bottom: 24, containLabel: true },
      tooltip,
      legend: {
        data: [FIELD_LABEL.yield, FIELD_LABEL.revenue],
        top: 0,
        right: 0,
        itemWidth: 14,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { color: c.body, fontSize: 11 },
      },
      xAxis,
      yAxis: [
        {
          type: 'value',
          axisLabel: { color: c.faint, fontSize: 11 },
          splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
        },
        {
          type: 'value',
          axisLabel: { color: c.faint, fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: FIELD_LABEL.yield,
          type: 'bar',
          data: values,
          barMaxWidth: 22,
          itemStyle: { color: COLOR_YIELD, borderRadius: [3, 3, 0, 0] },
        },
        {
          name: FIELD_LABEL.revenue,
          type: 'line',
          yAxisIndex: 1,
          data: values2,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: COLOR_REVENUE, borderColor: '#ffffff', borderWidth: 1.5 },
          lineStyle: { width: 2.5, color: COLOR_REVENUE },
        },
      ],
    } as EChartsOption;
  }

  // 单序列：折线 / 柱状（散点由折线兜底，不暴露切换入口）
  const isBar = chartType === 'bar';
  // 柱子过多时（如上传大 CSV），细柱会被白色描边与圆角覆盖成「空白」，去掉描边/圆角以保证可见
  const isDenseBar = isBar && values.length > 60;
  return {
    backgroundColor: 'transparent',
    grid: { left: 12, right: 16, top: 18, bottom: 24, containLabel: true },
    tooltip,
    xAxis,
    yAxis: {
      type: 'value',
      axisLabel: { color: c.faint, fontSize: 11 },
      splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
    },
    series: [
      {
        name: '产量',
        type: isBar ? 'bar' : 'line',
        data: values,
        smooth: !isBar,
        symbol: 'circle',
        symbolSize: 6,
        // 数据点多时不画圆点标记，避免密集圆点糊成一条粗线
        showSymbol: isBar ? undefined : values.length <= 60,
        barMaxWidth: 22,
        itemStyle: {
          color: COLOR_YIELD,
          ...(isDenseBar ? {} : { borderColor: '#ffffff', borderWidth: 1.5 }),
          ...(isBar && !isDenseBar ? { borderRadius: [3, 3, 0, 0] } : {}),
        },
        lineStyle: isBar ? undefined : { width: 2, color: COLOR_YIELD },
        areaStyle: isBar
          ? undefined
          : {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(91, 140, 62, 0.16)' },
                  { offset: 1, color: 'rgba(91, 140, 62, 0)' },
                ],
              },
            },
      },
    ],
  } as EChartsOption;
}

const ChartView = memo(function ChartView({ labels, values, chartType, values2 }: ChartViewProps) {
  const option = useMemo(
    () => buildOption(labels, values, chartType, values2),
    [labels, values, chartType, values2],
  );

  return (
    <div role="img" aria-label="数据分析图表" className="h-[300px] w-full">
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        notMerge
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
});

export default ChartView;
