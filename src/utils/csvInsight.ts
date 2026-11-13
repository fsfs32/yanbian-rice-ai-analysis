// 数据画像纯函数：识别数值列、提取可绘制序列、计算基础统计
// 用于「上传 CSV → 即时数据画像 + 可视化」的端侧分析能力

export interface CsvSeries {
  /** X 轴标签（通常取第一列，或回退为行号） */
  labels: (string | number)[];
  /** Y 轴数值 */
  values: number[];
  /** 数值列名 */
  valueLabel: string;
  /** X 轴列名 */
  labelName: string;
}

export interface CsvInsight {
  series: CsvSeries | null;
  /** 数值列数量 */
  numericColumnCount: number;
  /** 可绘制与否（至少存在一个数值列） */
  plottable: boolean;
}

/** 将单元格文本转数字：去除千分位逗号，空串/非法返回 null */
function toNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** 判断某列是否为数值列（非空值中 >= 80% 可转数字，且至少一个数值） */
function isNumericColumn(rows: string[][], colIndex: number): boolean {
  let numeric = 0;
  let nonEmpty = 0;
  for (const row of rows) {
    const raw = row[colIndex] ?? '';
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    nonEmpty += 1;
    if (toNumber(raw) !== null) numeric += 1;
  }
  if (nonEmpty === 0 || numeric === 0) return false;
  return numeric / nonEmpty >= 0.8;
}

/** 识别所有数值列索引 */
function numericColumns(headers: string[], rows: string[][]): number[] {
  return headers.map((_, index) => (isNumericColumn(rows, index) ? index : -1)).filter((i) => i >= 0);
}

/** 提取可绘制序列：labels 取第一列，values 取第一个数值列（优先跳过首列） */
function extractSeries(headers: string[], rows: string[][]): CsvSeries | null {
  const numeric = numericColumns(headers, rows);
  if (numeric.length === 0) return null;

  // 优先用「非首列」的数值列作为 Y；若只有首列是数值，则用首列并以行号为 X
  const valueCol = numeric.find((i) => i > 0) ?? numeric[0];

  let labels: (string | number)[] = [];
  let labelName = headers[0];
  if (valueCol > 0) {
    labels = rows.map((row) => {
      const raw = (row[0] ?? '').trim();
      const num = toNumber(raw);
      return num !== null ? num : raw;
    });
  } else {
    labels = rows.map((_, index) => index + 1);
    labelName = '行号';
  }

  const values: number[] = [];
  const labelsOut: (string | number)[] = [];
  rows.forEach((row, index) => {
    const num = toNumber(row[valueCol] ?? '');
    if (num !== null) {
      values.push(num);
      labelsOut.push(labels[index]);
    }
  });

  if (values.length === 0) return null;

  return {
    labels: labelsOut,
    values,
    valueLabel: headers[valueCol],
    labelName,
  };
}

export function analyzeCsv(headers: string[], rows: string[][]): CsvInsight {
  const numeric = numericColumns(headers, rows);
  const series = extractSeries(headers, rows);
  return {
    series,
    numericColumnCount: numeric.length,
    plottable: series !== null,
  };
}

/** 计算序列的基础统计 */
export function summarizeSeries(values: number[]): {
  total: number;
  avg: number;
  max: number;
  maxIndex: number;
} {
  if (values.length === 0) return { total: 0, avg: 0, max: 0, maxIndex: -1 };
  const total = values.reduce((sum, v) => sum + v, 0);
  let max = values[0];
  let maxIndex = 0;
  values.forEach((v, i) => {
    if (v > max) {
      max = v;
      maxIndex = i;
    }
  });
  return { total, avg: total / values.length, max, maxIndex };
}
