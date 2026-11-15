// 数据速览（展示组件）：宽屏右栏，展示「当前数据集」的趋势迷你图、统计概览、能力范围与数据来源
// 统计口径与文案由 utils/infoRailData 统一整理，组件只做渲染
import { RotateCcw } from 'lucide-react';
import type { CsvDataset } from '../types';
import {
  ABILITIES,
  BUILTIN_NAME,
  builtinStats,
  csvStats,
  sourceText,
  trendValues,
} from '../utils/infoRailData';
import Sparkline from './Sparkline';

interface InfoRailProps {
  /** 当前数据集；null 表示内置水稻数据 */
  dataset: CsvDataset | null;
  onClearDataset: () => void;
}

export default function InfoRail({ dataset, onClearDataset }: InfoRailProps) {
  const isCsv = dataset !== null;
  const stats = dataset === null ? builtinStats() : csvStats(dataset);
  const datasetName = dataset === null ? BUILTIN_NAME : dataset.fileName;

  return (
    <aside
      aria-label="数据速览"
      className="hidden w-[288px] shrink-0 flex-col gap-8 overflow-y-auto border-l border-border/70 bg-rail px-5 py-7 min-[1440px]:flex"
    >
      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-text-faint">
            数据速览
          </h2>
          {isCsv && (
            <button
              type="button"
              onClick={onClearDataset}
              aria-label="恢复内置数据"
              title="恢复内置水稻数据"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] text-text-faint transition-colors duration-150 hover:bg-primary-soft hover:text-text-primary"
            >
              <RotateCcw size={12} aria-hidden="true" />
              内置
            </button>
          )}
        </div>

        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-text-muted">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCsv ? 'bg-accent' : 'bg-primary'}`}
            aria-hidden="true"
          />
          <span className="truncate">{datasetName}</span>
        </p>

        <Sparkline values={trendValues(dataset)} />

        <dl className="mt-3 flex flex-col">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex items-baseline justify-between gap-3 py-2.5 ${
                index === 0 ? '' : 'border-t border-border/70'
              }`}
            >
              <dt className="min-w-0 truncate text-[12.5px] text-text-muted">{stat.label}</dt>
              <dd className="shrink-0 text-[14px] font-medium tabular-nums text-text-primary">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-text-faint">
          能力范围
        </h2>
        <ul className="mt-3.5 flex flex-col gap-2.5">
          {ABILITIES.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-[13px] text-text-body">
              <span className="h-1 w-1 shrink-0 rounded-full bg-text-faint" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-auto">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-text-faint">
          数据来源
        </h2>
        <p className="mt-2.5 text-[12px] leading-[1.75] text-text-faint">{sourceText(dataset)}</p>
      </section>
    </aside>
  );
}
