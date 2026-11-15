// 图表视图（展示组件）：只负责把 option 交给 ECharts，配置构造在 utils/chartOption
// 对外暴露 exportPng()，供卡片上的「导出图片」按钮取画布
import { forwardRef, memo, useImperativeHandle, useMemo, useRef, type ComponentRef } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ChartType } from '../types';
import { buildOption } from '../utils/chartOption';
import { exportChartPng } from '../utils/exportData';

// 按需注册，避免全量引入
echarts.use([LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface ChartViewProps {
  labels: (string | number)[];
  values: number[];
  chartType: ChartType;
  /** 组合图第二序列（销售额），与 values 等长 */
  values2?: number[];
  /** 导出图片时用作文件名的标题 */
  title: string;
  /** 导出图片时写入水印的数据来源 */
  source?: string;
  /** 点击某个数据点时回调，用于把图表变成追问入口 */
  onPointClick?: (label: string | number, value: number) => void;
}

/** 暴露给父组件的导出能力 */
export interface ChartViewHandle {
  exportPng: () => Promise<void>;
}

const ChartView = memo(
  forwardRef<ChartViewHandle, ChartViewProps>(function ChartView(
    { labels, values, chartType, values2, title, source, onPointClick },
    ref,
  ) {
    const chartRef = useRef<ComponentRef<typeof ReactEChartsCore> | null>(null);

    const option = useMemo(
      () => buildOption(labels, values, chartType, values2),
      [labels, values, chartType, values2],
    );

    // 把 ECharts 画布能力暴露给卡片上的导出按钮
    useImperativeHandle(
      ref,
      () => ({
        async exportPng() {
          const instance = chartRef.current?.getEchartsInstance();
          if (!instance) throw new Error('图表尚未就绪，请稍后重试');
          const dataUrl = instance.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#ffffff',
          });
          await exportChartPng(dataUrl, { title, source });
        },
      }),
      [title, source],
    );

    return (
      <div role="img" aria-label="数据分析图表" className="h-[320px] w-full">
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={option}
          notMerge
          lazyUpdate
          onEvents={
            onPointClick
              ? {
                  click: (params: { name?: string | number; value?: unknown; dataIndex?: number }) => {
                    const index = typeof params.dataIndex === 'number' ? params.dataIndex : -1;
                    if (index < 0 || index >= labels.length) return;
                    const rawValue = Array.isArray(params.value)
                      ? Number(params.value[params.value.length - 1])
                      : Number(params.value);
                    if (!Number.isFinite(rawValue)) return;
                    onPointClick(labels[index], rawValue);
                  },
                }
              : undefined
          }
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    );
  }),
);

export default ChartView;
