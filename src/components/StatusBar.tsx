// AI 状态条（展示组件）：真实事件驱动的 Agent 工作流可视化
// 「理解问题 → 查询数据 → 计算分析 → 生成图表 → 完成」，可点开查看完整步骤与说明
import { useEffect, useState } from 'react';
import type { ChatStatus } from '../types';

const STEPS = [
  { key: 'understanding', zh: '理解问题', en: 'Parse', detail: '解析问题意图与指标' },
  { key: 'querying', zh: '查询数据', en: 'Query', detail: '调用工具检索数据记录' },
  { key: 'computing', zh: '计算分析', en: 'Compute', detail: '计算趋势与统计指标' },
  { key: 'rendering', zh: '生成图表', en: 'Render', detail: '渲染可视化图表' },
  { key: 'done', zh: '完成', en: 'Done', detail: '组织分析结论' },
] as const;

const STAGE_TEXT: Record<'understanding' | 'querying' | 'computing' | 'rendering', string> = {
  understanding: '正在理解问题…',
  querying: '正在查询数据…',
  computing: '正在计算分析…',
  rendering: '正在生成图表…',
};

const ACTIVE_INDEX: Record<ChatStatus, number> = {
  idle: -1,
  understanding: 0,
  querying: 1,
  computing: 2,
  rendering: 3,
  done: 4,
};

interface StatusBarProps {
  status: ChatStatus;
}

export default function StatusBar({ status }: StatusBarProps) {
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (status === 'done') {
      setShowDone(true);
      const timer = setTimeout(() => setShowDone(false), 2000);
      return () => clearTimeout(timer);
    }
    setShowDone(false);
  }, [status]);

  const loading =
    status === 'understanding' || status === 'querying' || status === 'computing' || status === 'rendering';
  const activeIndex = ACTIVE_INDEX[status];
  const text =
    loading ? STAGE_TEXT[status]
    : status === 'done' && showDone ? '分析完成'
    : '按 Enter 发送 · 试试问「产量趋势」';

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11.5px] text-text-muted" aria-live="polite">
          {loading ? (
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          )}
          {text}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label="查看分析流程"
          className="flex items-center gap-1 text-[11px] text-text-faint transition-colors duration-150 hover:text-primary"
        >
          AI 分析流程
          <span
            className={`text-[9px] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            ▲
          </span>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2.5 rounded-sm border border-border bg-canvas p-3.5">
          {STEPS.map((step, index) => {
            const done = activeIndex > index || (status === 'done' && index === 4);
            const active = activeIndex === index && status !== 'done';
            return (
              <div key={step.key} className="flex items-center gap-2.5">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                    done
                      ? 'border-primary bg-primary text-canvas'
                      : active
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border text-text-faint'
                  }`}
                  aria-hidden="true"
                >
                  {done ? '✓' : index + 1}
                </span>
                <span className={`text-[12px] ${done || active ? 'text-text-body' : 'text-text-faint'}`}>
                  {step.zh}
                </span>
                <span className={`text-[10.5px] ${done || active ? 'text-text-muted' : 'text-text-faint'}`}>
                  {step.detail}
                </span>
                <span className="ml-auto text-[9px] uppercase tracking-[0.1em] text-text-faint">
                  {step.en}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
