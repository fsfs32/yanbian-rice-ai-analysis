// 边界提示 / 错误卡（展示组件）：展示友好提示并提供重试，绝不暴露堆栈或原始响应
import type { ChatMessage, RetryHandler } from '../types';

interface ErrorBubbleProps {
  message: ChatMessage;
  onRetry: RetryHandler;
}

export default function ErrorBubble({ message, onRetry }: ErrorBubbleProps) {
  return (
    <div className="msg-enter w-full rounded-lg border border-border bg-surface px-5 py-4 shadow-card">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        <p className="text-[14px] leading-[1.6] text-text-body">{message.content}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md border border-border bg-canvas px-3.5 py-1.5 text-[12.5px] text-text-body transition-colors duration-150 hover:border-primary/40 hover:text-primary"
      >
        重试
      </button>
    </div>
  );
}
