// 最近提问（展示组件）：宽屏左栏，读取本机浏览器保存的提问历史，点击即重新提问
// 只在 ≥1280px 显示，窄屏收起以保持单栏极简阅读体验
import { Clock3, MessageSquarePlus } from 'lucide-react';
import type { HistoryEntry } from '../types';
import { relativeTime } from '../utils/history';

interface HistoryRailProps {
  history: HistoryEntry[];
  onPick: (question: string) => void;
  onNew: () => void;
  /** 是否展示内置数据口径说明；上传 CSV 后由右栏接管说明，此处隐藏避免与用户数据冲突 */
  showDataNote: boolean;
}

export default function HistoryRail({ history, onPick, onNew, showDataNote }: HistoryRailProps) {
  return (
    <aside
      aria-label="最近提问"
      className="hidden w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border/70 bg-rail px-4 py-7 min-[1280px]:flex"
    >
      <h2 className="px-2.5 text-[12px] font-medium uppercase tracking-[0.14em] text-text-faint">
        最近提问
      </h2>

      <button
        type="button"
        onClick={onNew}
        className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] text-text-body transition-colors duration-150 hover:bg-primary-soft"
      >
        <MessageSquarePlus size={16} aria-hidden="true" />
        开始新对话
      </button>

      <div className="mt-5 flex flex-col gap-0.5">
        {history.length === 0 ? (
          <p className="px-2.5 text-[12.5px] leading-relaxed text-text-faint">
            提问后会在这里留下记录，最多保留 5 条。
          </p>
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.question)}
              className="group flex flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-primary-soft"
            >
              <span className="line-clamp-2 text-[13.5px] leading-[1.55] text-text-body group-hover:text-text-primary">
                {item.question}
              </span>
              <span className="flex items-center gap-1 text-[11.5px] text-text-faint">
                <Clock3 size={11} aria-hidden="true" />
                {relativeTime(item.time)}
              </span>
            </button>
          ))
        )}
      </div>

      {showDataNote && (
        <div className="mt-auto rounded-xl border border-border/70 bg-surface px-3.5 py-3">
          <p className="text-[11.5px] leading-[1.7] text-text-faint">
            数据口径：稻谷产量（万吨），产值 = 产量 × 粳稻均价约 2.6 元/公斤（估算）。
          </p>
        </div>
      )}
    </aside>
  );
}
