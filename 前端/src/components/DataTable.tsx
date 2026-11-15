// 表格预览（展示组件）：展示 CSV 表头与前若干行，附行列统计
const PREVIEW_ROWS = 10;

interface DataTableProps {
  headers: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
}

export default function DataTable({ headers, rows, rowCount, columnCount }: DataTableProps) {
  const preview = rows.slice(0, PREVIEW_ROWS);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  scope="col"
                  className="whitespace-nowrap px-3.5 py-3 font-medium text-text-body"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-0">
                {headers.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className="whitespace-nowrap px-3.5 py-2.5 tabular-nums text-text-muted"
                  >
                    {row[colIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3.5 text-[12px] text-text-faint">
        共 {rowCount} 行 · {columnCount} 列
        {rowCount > PREVIEW_ROWS && ` · 仅预览前 ${PREVIEW_ROWS} 行`}
      </p>
    </div>
  );
}
