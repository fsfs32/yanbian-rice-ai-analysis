// 当前数据集提示条（展示组件）：上传 CSV 后常驻在输入区上方，避免不知道自己看的是哪份数据
import { X } from 'lucide-react';
import type { CsvDataset } from '../types';

interface DatasetBannerProps {
  dataset: CsvDataset;
  onClear: () => void;
}

export default function DatasetBanner({ dataset, onClear }: DatasetBannerProps) {
  return (
    <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-border bg-soft px-3 py-1.5">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <span className="min-w-0 truncate text-[12px] text-text-muted">
        当前分析：{dataset.fileName}
        <span className="text-text-faint">
          （{dataset.rowCount} 行 × {dataset.columnCount} 列）
        </span>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="恢复内置水稻数据"
        title="恢复内置数据"
        className="ml-auto flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-text-faint transition-colors duration-150 hover:bg-surface hover:text-text-primary"
      >
        <X size={12} aria-hidden="true" />
        恢复内置
      </button>
    </div>
  );
}
