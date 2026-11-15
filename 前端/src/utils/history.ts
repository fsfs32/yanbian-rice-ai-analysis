// 提问历史：localStorage 持久化 + 相对时间格式化
//
// 为什么用 localStorage 而不是文件或 sessionStorage：
// - 存在浏览器本地，跟着"这台机器的这个浏览器"走。把项目文件夹打包发给别人，
//   对方浏览器里没有这份数据，打开必然是空的；他自己用起来后会生成属于他的那份。
// - 跨标签页、跨重启都保留，自己随时打开都能看到之前的提问。
// - 若改成把历史写进项目里的 json 文件，文件会跟着压缩包一起发出去，
//   等于把上一台机器的记录带给下一个人，反而做不到隔离。
//
// 会丢失的少数情况：清理浏览器数据、换浏览器、使用无痕模式。这属于浏览器自身边界。

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
