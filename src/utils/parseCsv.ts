// CSV 解析纯函数：支持引号包裹、逗号/换行转义，返回表头与二维数据行

export interface ParsedCsv {
  /** 表头（列名） */
  headers: string[];
  /** 数据行（不含表头），与 headers 对齐 */
  rows: string[][];
  /** 总行数（不含表头） */
  rowCount: number;
  /** 列数 */
  columnCount: number;
}

export interface ParseError {
  message: string;
}

/** 解析一行：处理引号包裹与内嵌逗号 */
function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * 解析 CSV 文本。
 * 按换行拆分时需处理「引号内换行」：先用状态机把记录切分为完整行。
 */
export function parseCsv(text: string): ParsedCsv | ParseError {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return { message: '文件内容为空，请选择包含数据的 CSV 文件' };
  }

  // 按「不在引号内的换行」切分完整记录
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) lines.push(current);

  if (lines.length === 0) {
    return { message: '未识别到有效数据行' };
  }

  const headers = parseLine(lines[0]).map((h) => h.trim()).filter((h) => h.length > 0);
  if (headers.length === 0) {
    return { message: '未识别到表头，请确认首行为列名' };
  }

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every((c) => c.trim() === '')) continue; // 跳过空行
    rows.push(cells);
  }

  if (rows.length === 0) {
    return { message: '仅识别到表头，未发现数据行' };
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}
