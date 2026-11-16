// 空状态（展示组件）：欢迎语 + 主题图位 + 数据概览 KPI 卡 + 分组示例问题，首条消息后消失
// 图片位：把你要的图命名为 hero.jpg，放进 public/ 目录即可（原色显示，未放置时自动隐藏）
// 显示尺寸：宽最多 660px × 高 208px（约 3:1 横图），object-cover 会自动裁剪填满
import { useState } from 'react';
import { LineChart, Trophy, Calculator, MapPin, Bug, FlaskConical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { calcKpi, formatWan } from '../utils/calcKpi';
import { LABELS, VALUES } from '../utils/mockData';

interface Suggestion {
  icon: LucideIcon;
  text: string;
  desc: string;
}

interface SuggestionGroup {
  title: string;
  items: Suggestion[];
}

/** 示例问题按能力分组，让首次进入的人知道「这平台能干什么」 */
const SUGGESTION_GROUPS: SuggestionGroup[] = [
  {
    title: '查数据',
    items: [
      { icon: LineChart, text: '画出 2016—2025 年产量趋势', desc: '折线图 · 趋势对比' },
      { icon: Trophy, text: '产量最高的是哪一年？', desc: '柱状图 · 极值定位' },
      { icon: Calculator, text: '平均产量是多少？', desc: '关键指标 · 统计汇总' },
      { icon: MapPin, text: '吉林省各市州产量对比', desc: '市州对比 · 全省范围' },
    ],
  },
  {
    title: '问知识',
    items: [
      { icon: Bug, text: '稻瘟病怎么防治？', desc: '知识库 · 病虫害防治' },
      { icon: FlaskConical, text: '水稻施肥要注意什么？', desc: '知识库 · 施肥技术' },
    ],
  },
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
    <div className="my-auto flex w-full max-w-[760px] flex-col items-center text-center">
      {heroOk && (
        <img
          src="/hero.jpg"
          alt="延边稻田"
          className="mb-4 h-36 w-full max-w-[720px] rounded-2xl object-cover shadow-card [@media(max-height:900px)]:h-24"
          onError={() => setHeroOk(false)}
        />
      )}

      <h1 className="max-w-[660px] text-balance text-[27px] font-semibold leading-[1.35] tracking-tight text-text-primary md:text-[32px]">
        你好，我是延边大米长势与产量分析助手
      </h1>
      <p className="mt-3 max-w-[640px] text-[15.5px] leading-[1.85] text-text-muted">
        用自然语言提问，即刻生成延边州水稻产量的趋势图表与关键指标。也可以上传 CSV，我帮你解读数据。
      </p>

      {/* 数据概览：三张 KPI 数字卡（数值实时计算） */}
      <div className="mt-4 grid w-full max-w-[760px] grid-cols-3 gap-3.5 [@media(max-height:820px)]:hidden">
        {OVERVIEW.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-surface px-4 py-2">
            <div className="text-[25px] font-semibold leading-none tracking-tight tabular-nums text-text-primary">
              {item.value}
            </div>
            <div className="mt-2 text-[12.5px] text-text-faint">{item.label}</div>
          </div>
        ))}
      </div>

      {SUGGESTION_GROUPS.map((group) => (
        <div key={group.title} className="mt-3.5 w-full max-w-[760px]">
          <p className="mb-2 text-left text-[11.5px] font-medium uppercase tracking-[0.14em] text-text-faint">
            {group.title}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [@media(max-height:820px)]:gap-2.5">
            {group.items.map((suggestion) => (
              <button
                key={suggestion.text}
                type="button"
                onClick={() => onSend(suggestion.text)}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2.5 text-left transition-all duration-150 hover:border-border-strong hover:bg-primary-soft/50 [@media(max-height:820px)]:py-2.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <suggestion.icon size={19} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[14.5px] leading-[1.5] text-text-body group-hover:text-primary">
                    {suggestion.text}
                  </span>
                  <span className="text-[12.5px] leading-[1.4] text-text-faint [@media(max-height:820px)]:hidden">
                    {suggestion.desc}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
