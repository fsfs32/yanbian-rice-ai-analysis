// KPI 纯函数计算：总产量、最高产量年份、年均产量，全部由 labels / values 实时计算，不写死

export interface KpiResult {
  /** 总产量（万吨） */
  total: number;
  /** 最高产量对应年份 */
  maxYear: string | number;
  /** 最高产量（万吨） */
  maxValue: number;
  /** 年均产量（万吨） */
  avg: number;
}

export function calcKpi(labels: (string | number)[], values: number[]): KpiResult {
  const total = values.reduce((sum, v) => sum + v, 0);

  let maxValue = Number.NEGATIVE_INFINITY;
  let maxIndex = 0;
  values.forEach((v, i) => {
    if (v > maxValue) {
      maxValue = v;
      maxIndex = i;
    }
  });

  const avg = values.length > 0 ? total / values.length : 0;

  return { total, maxYear: labels[maxIndex], maxValue, avg };
}

/** 千分位格式化数字 */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}

/** 万吨数值格式化，保留一位小数 */
export function formatWan(wanTons: number): string {
  return `${wanTons.toFixed(1)} 万吨`;
}
