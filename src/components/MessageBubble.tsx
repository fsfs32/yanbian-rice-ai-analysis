// 单条消息气泡（展示组件）：用户消息右对齐气泡，AI 回答左对齐（结论 + KPI + 图表 + 表格），纯展示
import { memo } from 'react';
import type { ChatMessage } from '../types';
import { calcKpi, formatNumber, formatWan } from '../utils/calcKpi';
import ChartCard from './ChartCard';
import KpiCard from './KpiCard';
import DataTable from './DataTable';

interface MessageBubbleProps {
  message: ChatMessage;
}

/** AI 身份标识：黑白稻穗图标 */
function AiBadge() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 21c0-5.5-2.2-9.5-4.8-12.8" />
        <path d="M12 21c0-5.5 2.2-9.5 4.8-12.8" />
        <path d="M7.2 8.2C5.8 6.2 5.8 3.6 7.2 2.4" />
        <path d="M16.8 8.2c1.4-2 1.4-4.6 0-5.8" />
      </svg>
    </span>
  );
}

const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-user-bubble px-4 py-2.5 text-[14px] leading-[1.7] text-user-text">
          {message.content}
        </div>
      </div>
    );
  }

  const kpi = message.chart ? calcKpi(message.chart.labels, message.chart.values) : null;

  return (
    <div className="msg-enter flex items-start gap-3">
      <AiBadge />
      <div className="min-w-0 flex-1">
        {/* 结论文字 */}
        {message.content && (
          <p className="whitespace-pre-wrap text-[15px] leading-[1.8] text-text-primary">
            {message.content}
          </p>
        )}
        {message.pending && !message.content && (
          <div className="flex items-center gap-1 py-1" role="status" aria-label="正在思考">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint" />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
        )}

        {/* KPI 指标（有图表数据时） */}
        {kpi && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <KpiCard label="总产量" labelEn="Total" value={formatNumber(kpi.total)} unit="吨" />
            <KpiCard label="最高年份" labelEn="Peak" value={String(kpi.maxYear)} />
            <KpiCard label="年均产量" labelEn="Avg." value={formatWan(kpi.avg)} />
          </div>
        )}

        {/* 图表 */}
        {message.chart && (
          <div className="mt-3">
            <ChartCard data={message.chart} />
          </div>
        )}

        {/* 表格预览（上传数据） */}
        {message.table && (
          <div className="mt-3 rounded-lg border border-border bg-surface p-3">
            <DataTable
              headers={message.table.headers}
              rows={message.table.rows}
              rowCount={message.table.rows.length}
              columnCount={message.table.headers.length}
            />
          </div>
        )}

        {/* 数据来源与演示标注 */}
        <div className="mt-2 flex items-center gap-2">
          {message.chart?.source && (
            <p className="text-[11px] text-text-faint">数据来源 · {message.chart.source}</p>
          )}
          {message.isDemo && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">
              演示数据
            </span>
          )}
        </div>
        {message.kind === 'normal' && message.role === 'assistant' && message.content && (
          <p className="mt-1 text-[10.5px] text-text-faint">AI 生成内容仅供参考</p>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
