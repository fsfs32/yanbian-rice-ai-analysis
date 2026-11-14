// AI 推理过程（展示组件）：展示后端 SSE 下发的真实 Agent 执行轨迹，可折叠
// 默认收起，避免抢占结论；点击展开后按步骤展示「阶段 → 具体做了什么」
import { useState } from 'react';
import type { AgentStep } from '../types';

interface ReasoningStepsProps {
  steps: AgentStep[];
}

export default function ReasoningSteps({ steps }: ReasoningStepsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-text-muted transition-colors duration-150 hover:text-primary"
      >
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[9px] text-accent"
          aria-hidden="true"
        >
          析
        </span>
        <span>分析过程</span>
        <span
          className={`ml-auto text-[9px] text-text-faint transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {open && (
        <ol className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
          {steps.map((step, index) => (
            <li key={`${step.phase}-${index}`} className="flex items-start gap-2">
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[9px] text-accent"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <p className="text-[11.5px] leading-relaxed text-text-body">
                <span className="text-text-muted">{step.title} · </span>
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
