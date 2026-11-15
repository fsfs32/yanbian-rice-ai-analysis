// 图表主题色：从设计 Token（CSS 变量）读取，保证图表与界面同一套配色
// 单独成文件，避免 option 构造逻辑被颜色读取淹没

/** 图表主题色集合 */
export interface ChartThemeColors {
  faint: string;
  border: string;
  body: string;
}

/** 读取设计 Token，取不到时回退到字面量 */
function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** 构造图表主题色（每次调用重新读取，兼容主题切换） */
export function buildThemeColors(): ChartThemeColors {
  return {
    faint: readToken('--color-text-faint', '#9ca3af'),
    border: readToken('--color-border', '#e5e7eb'),
    body: readToken('--color-text-body', '#374151'),
  };
}
