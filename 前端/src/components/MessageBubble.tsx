// 单条消息气泡（展示组件）：用户消息右对齐气泡，AI 回答左对齐（结论 + KPI + 图表 + 表格），纯展示
import { memo } from 'react';
import type { ChatMessage } from '../types';
import { calcKpi, formatNumber, formatWan } from '../utils/calcKpi';
import ChartCard from './ChartCard';
import KpiCard from './KpiCard';
import DataTable from './DataTable';
import ReasoningSteps from './ReasoningSteps';
import CopyButton from './CopyButton';
import FollowupList from './FollowupList';

interface MessageBubbleProps {
  message: ChatMessage;
  /** 点击推荐追问时继续提问 */
  onFollowup?: (question: string) => void;
}

/** AI 身份标识：黑白稻穗图标 */
function AiBadge() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary">
      <svg
        width="17"
        height="17"
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

const MessageBubble = memo(function MessageBubble({ message, onFollowup }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-user-bubble px-4.5 py-3 text-[15.5px] leading-[1.75] text-user-text">
          {message.content}
        </div>
      </div>
    );
  }

  const isCsv = Boolean(message.table);
  // 市州对比图的 X 轴是地名，「最高年份」这类标签会读起来别扭
  const isCity = message.chart?.config.x_field === 'city';
  const kpi = message.chart ? calcKpi(message.chart.labels, message.chart.values) : null;

  return (
    <div className="msg-enter flex items-start gap-3">
      <AiBadge />
      <div className="min-w-0 flex-1">
        {/* 推理过程（后端下发真实轨迹时） */}
        {message.steps && message.steps.length > 0 && (
          <ReasoningSteps steps={message.steps} />
        )}

        {/* 结论文字 */}
        {message.content && (
          <p className="whitespace-pre-wrap text-[16.5px] leading-[1.85] text-text-primary">
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

        {/* KPI 指标（有图表数据时）：内置数据用产量口径，上传 CSV 用通用统计 */}
        {kpi && (
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {isCsv ? (
              <>
                <KpiCard label="数据合计" labelEn="Total" value={formatNumber(kpi.total)} />
                <KpiCard label="最大值" labelEn="Peak" value={formatNumber(kpi.maxValue)} />
                <KpiCard label="平均值" labelEn="Avg." value={formatNumber(kpi.avg)} />
              </>
            ) : (
              <>
                <KpiCard label="总产量" labelEn="Total" value={formatNumber(kpi.total)} unit="万吨" />
                <KpiCard label={isCity ? '产量最高' : '最高年份'} labelEn="Peak" value={String(kpi.maxYear)} />
                <KpiCard label={isCity ? '平均产量' : '年均产量'} labelEn="Avg." value={formatWan(kpi.avg)} />
              </>
            )}
          </div>
        )}

        {/* 图表 */}
        {message.chart && (
          <div className="mt-4">
            <ChartCard
          data={message.chart}
          onPointClick={(label, value) => {
            // 年份与市州名的追问措辞不同，这里按 label 形态分一下
            const isYear = /^\d{4}$/.test(String(label));
            const question = isYear
              ? `${label} 年为什么是 ${value} 万吨？`
              : `${label} 为什么是 ${value} 万吨？`;
            onFollowup?.(question);
          }}
        />
          </div>
        )}

        {/* 表格预览（上传数据） */}
        {message.table && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <DataTable
              headers={message.table.headers}
              rows={message.table.rows}
              rowCount={message.table.rows.length}
              columnCount={message.table.headers.length}
            />
          </div>
        )}

        {/* 数据来源与演示标注（纯文字回答的来源挂在消息上，图表回答挂在 chart 上） */}
        <div className="mt-2.5 flex items-center gap-2">
          {(message.chart?.source || message.source) && (
            <p className="text-[12px] text-text-faint">
              数据来源 · {message.chart?.source || message.source}
            </p>
          )}
          {message.isDemo && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
              演示模式
            </span>
          )}
          {message.content && (
            <span className="ml-auto">
              <CopyButton text={message.content} />
            </span>
          )}
        </div>
        {message.kind === 'normal' && message.role === 'assistant' && message.content && (
          <p className="mt-1.5 text-[11.5px] text-text-faint">AI 生成内容仅供参考</p>
        )}

        {/* 推荐追问：点击即继续提问 */}
        {message.followups && message.followups.length > 0 && onFollowup && (
          <FollowupList items={message.followups} onPick={onFollowup} />
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
