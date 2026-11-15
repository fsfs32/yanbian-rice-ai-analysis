// 图表配置构造：把 ECharts option 的拼装从组件里拆出来，组件只负责渲染
// 颜色来自 utils/chartTheme（设计 Token），双序列用农业语义色区分
import type { EChartsOption } from 'echarts';
import type { ChartType, Field } from '../types';
import { buildThemeColors } from './chartTheme';

/** 农业主题双序列配色（ECharts 配置允许字面量色值） */
const COLOR_YIELD = '#5b8c3e'; // 禾苗绿：产量（柱）
const COLOR_REVENUE = '#d9a441'; // 稻田金：销售额（折线）

/** 字段中文标签 */
export const FIELD_LABEL: Record<Field, string> = {
  year: '年份',
  yield: '产量（万吨）',
  revenue: '销售额（亿元）',
  city: '市州',
};

/** 组合图：左轴产量（柱）+ 右轴销售额（折线） */
function buildComboOption(
  values: number[],
  values2: number[],
  tooltip: Record<string, unknown>,
  xAxis: Record<string, unknown>,
): EChartsOption {
  const c = buildThemeColors();
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
      textStyle: { color: c.body, fontSize: 12 },
    },
    xAxis,
    yAxis: [
      {
        type: 'value',
        axisLabel: { color: c.faint, fontSize: 12 },
        splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
      },
      {
        type: 'value',
        axisLabel: { color: c.faint, fontSize: 12 },
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

/**
 * 构造图表配置。
 * - 单序列：折线 / 柱状（散点由折线兜底，不暴露切换入口）
 * - 数据点过多时去掉白色描边与圆角，避免细柱被覆盖成空白
 */
export function buildOption(
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
    padding: [10, 14],
    textStyle: { color: c.body, fontSize: 13 },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.06); border-radius: 8px;',
  };

  const xAxis = {
    type: 'category' as const,
    data: labels,
    axisLabel: { color: c.faint, fontSize: 12 },
    axisLine: { lineStyle: { color: c.border } },
    axisTick: { show: false },
  };

  if (isCombo && values2) {
    return buildComboOption(values, values2, tooltip, xAxis);
  }

  const isBar = chartType === 'bar';
  const isDenseBar = isBar && values.length > 60;
  return {
    backgroundColor: 'transparent',
    grid: { left: 12, right: 16, top: 18, bottom: 24, containLabel: true },
    tooltip,
    xAxis,
    yAxis: {
      type: 'value',
      axisLabel: { color: c.faint, fontSize: 12 },
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
