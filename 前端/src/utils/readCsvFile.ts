// CSV 文件读取：把「选择文件」和「拖拽文件」两条入口收敛到一处
// 校验（扩展名 / 体积）与解析（复用 parseCsv）都在这里，组件只负责触发和展示错误。

import { parseCsv } from './parseCsv';

/** 单个 CSV 的体积上限（字节） */
export const MAX_CSV_SIZE = 5 * 1024 * 1024;

/** 读取成功后的结构化数据，与后端 CsvAttachment 对齐 */
export interface CsvFileData {
  fileName: string;
  headers: string[];
  rows: string[][];
}

export type CsvFileResult = { ok: true; data: CsvFileData } | { ok: false; message: string };

/**
 * 读取用户选择的 CSV 文件。
 * 不抛异常：校验失败、解析失败都以 `{ ok: false, message }` 返回，由调用方决定怎么提示。
 */
export async function readCsvFile(file: File): Promise<CsvFileResult> {
  if (!/\.csv$/i.test(file.name)) {
    return { ok: false, message: '仅支持 .csv 文件' };
  }
  if (file.size > MAX_CSV_SIZE) {
    return { ok: false, message: '文件大小不能超过 5MB' };
  }

  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  }).catch(() => '');

  if (!text.trim()) {
    return { ok: false, message: '文件内容为空，或不是 UTF-8 编码的 CSV' };
  }

  const parsed = parseCsv(text);
  if ('message' in parsed) {
    return { ok: false, message: parsed.message };
  }

  return {
    ok: true,
    data: { fileName: file.name, headers: parsed.headers, rows: parsed.rows },
  };
}
