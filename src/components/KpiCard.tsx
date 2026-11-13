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
    <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-text-faint">{labelEn}</p>
      <p className="mt-1 text-[19px] font-semibold leading-none tabular-nums text-text-primary">
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-text-muted">{unit}</span>}
      </p>
      <p className="mt-1.5 text-[11.5px] text-text-muted">{label}</p>
    </div>
  );
});

export default KpiCard;
