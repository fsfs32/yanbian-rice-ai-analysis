// AI 推理过程（展示组件）：展示后端 SSE 下发的真实 Agent 执行轨迹
// 默认展开 —— 这是本作品「可解释 AI」的核心卖点，折叠起来就等于没做
import { useState } from 'react';
import type { AgentStep } from '../types';

interface ReasoningStepsProps {
  steps: AgentStep[];
}

export default function ReasoningSteps({ steps }: ReasoningStepsProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-2.5 rounded-xl border border-border bg-soft/60">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] text-text-muted transition-colors duration-150 hover:text-primary"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <span>AI 分析过程</span>
        <span className="text-[11.5px] text-text-faint">{steps.length} 步</span>
        <span
          className={`ml-auto text-[10px] text-text-faint transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {open && (
        <ol className="relative ml-[19px] flex flex-col gap-2.5 border-l border-border pb-3 pl-4 pr-3.5 pt-1">
          {steps.map((step, index) => (
            <li key={`${step.phase}-${index}`} className="relative flex items-start gap-2">
              <span
                className="absolute -left-[21px] top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-border-strong"
                aria-hidden="true"
              />
              <p className="text-[12.5px] leading-[1.7] text-text-body">
                <span className="font-medium text-text-muted">{step.title}</span>
                <span className="mx-1.5 text-text-faint">·</span>
                <span className="text-text-muted">{step.detail}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
