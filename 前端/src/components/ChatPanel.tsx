// 对话面板（容器组件）：居中消息流 + 底部固定输入区，市面高级问答产品的布局范式
import type { ChatMessage, ChatStatus, RetryHandler, SendQuestion } from '../types';
import MessageBubble from './MessageBubble';
import ErrorBubble from './ErrorBubble';
import EmptyState from './EmptyState';
import StatusBar from './StatusBar';
import InputBar from './InputBar';

interface ChatPanelProps {
  messages: ChatMessage[];
  status: ChatStatus;
  isLoading: boolean;
  onSend: SendQuestion;
  onStop: () => void;
  onRetry: RetryHandler;
  onIngest: (input: { fileName: string; headers: string[]; rows: string[][] }) => void;
}

export default function ChatPanel({
  messages,
  status,
  isLoading,
  onSend,
  onStop,
  onRetry,
  onIngest,
}: ChatPanelProps) {
  // 取最后一条 AI 消息的真实推理步骤，驱动底部状态条展示
  const lastSteps = [...messages].reverse().find((m) => m.role === 'assistant')?.steps;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 消息区（居中，滚动） */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <EmptyState onSend={onSend} />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[768px] flex-col gap-6 px-4 py-10">
            {messages.map((message) =>
              message.kind === 'error' ? (
                <ErrorBubble key={message.id} message={message} onRetry={onRetry} />
              ) : (
                <MessageBubble key={message.id} message={message} />
              ),
            )}
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      <div className="border-t border-border bg-canvas">
        <div className="mx-auto w-full max-w-[768px] px-4 pb-4 pt-3">
          <StatusBar status={status} steps={lastSteps} />
          <div className="mt-2.5">
            <InputBar
              isLoading={isLoading}
              onSend={onSend}
              onStop={onStop}
              onIngest={onIngest}
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-text-faint">
            AI 生成内容仅供参考，不构成预测
          </p>
        </div>
      </div>
    </div>
  );
}
