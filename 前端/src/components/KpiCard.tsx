// KPI 小卡（展示组件）：嵌于 AI 回答中的指标卡，衬线数字 + 中英标签，用 React.memo
import { memo } from 'react';

interface KpiCardProps {
  label: string;
  labelEn: string;
  value: string;
  unit?: string;
}

const KpiCard = memo(function KpiCard({ label, labelEn, value, unit }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-faint">{labelEn}</p>
      <p className="mt-1.5 text-[24px] font-semibold leading-none tabular-nums text-text-primary">
        {value}
        {unit && <span className="ml-1 text-[12px] font-normal text-text-muted">{unit}</span>}
      </p>
      <p className="mt-2 text-[12.5px] text-text-muted">{label}</p>
    </div>
  );
});

export default KpiCard;
