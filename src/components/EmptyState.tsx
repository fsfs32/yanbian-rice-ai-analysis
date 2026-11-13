// 空状态（展示组件）：欢迎语 + 主题图位 + 数据概览 KPI 卡 + 示例问题卡片，首条消息后消失
// 图片位：把你要的图命名为 hero.jpg，放进 public/ 目录即可（原色显示，未放置时自动隐藏）
// 显示尺寸：宽最多 540px × 高 176px（约 3:1 横图），object-cover 会自动裁剪填满
import { useState } from 'react';
import { LineChart, Trophy, Calculator, Activity } from 'lucide-react';
import { calcKpi, formatWan } from '../utils/calcKpi';
import { LABELS, VALUES } from '../utils/mockData';

const SUGGESTIONS = [
  { icon: LineChart, text: '画出 1994—2016 年产量趋势', desc: '折线图' },
  { icon: Trophy, text: '产量最高的是哪一年？', desc: '柱状图' },
  { icon: Calculator, text: '平均产量是多少吨？', desc: '关键指标' },
  { icon: Activity, text: '产量波动最大的年份', desc: '波动分析' },
];

// 数据概览：由 mock 数据实时计算（不写死），首屏即展示核心 KPI
const kpi = calcKpi(LABELS, VALUES);
const OVERVIEW = [
  { value: `${LABELS.length} 年`, label: '数据跨度' },
  { value: formatWan(kpi.maxValue), label: '历史最高' },
  { value: formatWan(kpi.avg), label: '年均产量' },
];

interface EmptyStateProps {
  onSend: (question: string) => void;
}

export default function EmptyState({ onSend }: EmptyStateProps) {
  const [heroOk, setHeroOk] = useState(true);

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center text-center">
      {heroOk && (
        <img
          src="/hero.jpg"
          alt="延边稻田"
          className="mb-6 h-44 w-full max-w-[540px] rounded-2xl object-cover shadow-card"
          onError={() => setHeroOk(false)}
        />
      )}

      <h1 className="text-[24px] font-semibold tracking-tight text-text-primary md:text-[28px]">
        你好，我是延边大米长势与产量分析助手
      </h1>
      <p className="mt-2.5 max-w-[520px] text-[14px] leading-[1.7] text-text-muted">
        用自然语言提问，即刻生成延边州水稻产量的趋势图表与关键指标。也可以上传 CSV，我帮你解读数据。
      </p>

      {/* 数据概览：三张 KPI 数字卡（数值实时计算） */}
      <div className="mt-6 grid w-full max-w-[560px] grid-cols-3 gap-3">
        {OVERVIEW.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-surface px-3 py-3.5">
            <div className="text-[22px] font-semibold leading-none tracking-tight text-text-primary">
              {item.value}
            </div>
            <div className="mt-1.5 text-[11.5px] text-text-faint">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid w-full max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.text}
            type="button"
            onClick={() => onSend(suggestion.text)}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left transition-all duration-150 hover:border-primary/40 hover:bg-primary-soft/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <suggestion.icon size={18} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13.5px] leading-[1.5] text-text-body group-hover:text-primary">
                {suggestion.text}
              </span>
              <span className="text-[11.5px] leading-[1.4] text-text-faint">{suggestion.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
