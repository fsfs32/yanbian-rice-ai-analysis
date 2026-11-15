// 导出工具：把分析结果带出页面
// - PNG：图表画布 + 数据来源水印，便于写进报告或答辩 PPT
// - CSV：带 BOM 与来源注释行，Excel 直接打开不乱码
// 两个函数都是纯浏览器 API，不引入额外依赖。

/** 导出所需的最小元信息 */
export interface ExportMeta {
  /** 图表标题，同时作为文件名 */
  title: string;
  /** 数据来源，为空时回退为「AI 分析」 */
  source?: string;
}

const FALLBACK_SOURCE = 'AI 分析';
const FONT_STACK = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

/** 把标题变成安全的文件名 */
function safeFileName(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || '分析结果';
  return `${base}.${ext}`;
}

/** 触发浏览器下载 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 给浏览器留出读取时间再释放
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 加载 dataURL 为图片元素 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图表画布读取失败'));
    image.src = dataUrl;
  });
}

/**
 * 导出图表 PNG。
 * 在图表下方留出一条白边，写入「数据来源 · 生成时间」，避免图离开页面后失去口径。
 */
export async function exportChartPng(dataUrl: string, meta: ExportMeta): Promise<void> {
  const image = await loadImage(dataUrl);

  const footerHeight = Math.max(40, Math.round(image.height * 0.07));
  const padding = Math.round(image.width * 0.02);

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height + footerHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持画布导出');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  // 分隔线 + 脚注
  const lineY = image.height + 0.5;
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(canvas.width, lineY);
  ctx.stroke();

  const source = meta.source?.trim() || FALLBACK_SOURCE;
  const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
  ctx.fillStyle = '#6b7280';
  ctx.font = `${Math.max(12, Math.round(image.width / 70))}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`数据来源：${source} · 生成于 ${stamp}`, padding, image.height + footerHeight / 2);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG 生成失败');
  downloadBlob(blob, safeFileName(meta.title, 'png'));
}

/** CSV 单元格转义：含逗号、引号、换行时用双引号包裹 */
function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvExportPayload extends ExportMeta {
  labels: (string | number)[];
  values: number[];
  values2?: number[];
  /** 列名，与 labels / values / values2 对应 */
  xLabel: string;
  yLabel: string;
  y2Label?: string;
}

/**
 * 导出图表数据为 CSV。
 * 前两行是 `#` 开头的注释（来源与生成时间），Excel 会原样保留，读起来有据可查。
 */
export function exportChartCsv(payload: CsvExportPayload): void {
  const { labels, values, values2, xLabel, yLabel, y2Label, title, source } = payload;
  const hasSecond = Boolean(y2Label && values2 && values2.length === values.length);

  const header = hasSecond ? [xLabel, yLabel, y2Label as string] : [xLabel, yLabel];
  const body = labels.map((label, index) => {
    const row: (string | number)[] = [label, values[index] ?? ''];
    if (hasSecond) row.push(values2?.[index] ?? '');
    return row;
  });

  const lines = [
    `# 数据来源：${source?.trim() || FALLBACK_SOURCE}`,
    `# 生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    header.map(escapeCell).join(','),
    ...body.map((row) => row.map(escapeCell).join(',')),
  ];

  // BOM 让 Excel 正确识别 UTF-8 中文
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(blob, safeFileName(title, 'csv'));
}
