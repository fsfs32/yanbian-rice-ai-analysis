// 迷你趋势图（展示组件）：纯 SVG 折线，用于右栏「数据速览」在首屏就能看见走势形状
// 不引入图表库，颜色继承 currentColor，跟随主题 Token

interface SparklineProps {
  values: number[];
}

/** 画布逻辑宽高，配合 preserveAspectRatio="none" 自适应容器宽度 */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 34;
const PADDING = 3;

export default function Sparkline({ values }: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const toY = (value: number): number =>
    VIEW_HEIGHT - PADDING - ((value - min) / span) * (VIEW_HEIGHT - PADDING * 2);

  const points = values
    .map((value, index) => `${((index / (values.length - 1)) * VIEW_WIDTH).toFixed(2)},${toY(value).toFixed(2)}`)
    .join(' ');

  const lastY = toY(values[values.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className="mt-2 h-9 w-full text-primary"
      role="img"
      aria-label={`趋势迷你图，共 ${values.length} 个数据点`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.85"
      />
      <circle
        cx={VIEW_WIDTH - 1}
        cy={lastY}
        r="2.2"
        fill="currentColor"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
