// 提问历史：localStorage 持久化 + 相对时间格式化
import type { HistoryEntry } from '../types';

const STORAGE_KEY = 'yanbian-rice-history';
const MAX_ITEMS = 5;

/** 读取历史，损坏或不可用时返回空数组 */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is HistoryEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as HistoryEntry).question === 'string' &&
          typeof (item as HistoryEntry).time === 'number',
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

/** 写入一条历史，同问题去重并置顶，返回最新列表 */
export function pushHistory(question: string): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    question,
    time: Date.now(),
  };
  const next = [entry, ...loadHistory().filter((item) => item.question !== question)].slice(
    0,
    MAX_ITEMS,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 隐私模式或空间不足时静默失败，不影响主流程
  }
  return next;
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / MM-DD */
export function relativeTime(time: number): string {
  const diff = Date.now() - time;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const date = new Date(time);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
