// 图表导出按钮组（展示组件）：PNG 存图 / CSV 存数据，状态与回调由 ChartCard 管理
import { ImageDown, Table2 } from 'lucide-react';

interface ExportButtonsProps {
  /** 有导出进行中时禁用，避免重复触发 */
  busy: boolean;
  onExportPng: () => void;
  onExportCsv: () => void;
}

const BUTTON_CLASS =
  'flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors duration-150 hover:border-border-strong hover:text-primary disabled:opacity-50';

export default function ExportButtons({ busy, onExportPng, onExportCsv }: ExportButtonsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onExportPng}
        disabled={busy}
        aria-label="导出图表为图片"
        title="导出图片（PNG）"
        className={BUTTON_CLASS}
      >
        <ImageDown size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onExportCsv}
        disabled={busy}
        aria-label="导出图表数据为 CSV"
        title="导出数据（CSV）"
        className={BUTTON_CLASS}
      >
        <Table2 size={16} aria-hidden="true" />
      </button>
    </>
  );
}
