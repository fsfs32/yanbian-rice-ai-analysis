// 对话面板（容器组件）：居中消息流 + 底部固定输入区，市面高级问答产品的布局范式
// 额外能力：整块对话区支持拖拽 CSV；上传后输入区上方常驻「当前分析数据集」提示条
import { useState, type DragEvent } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { ChatMessage, ChatStatus, CsvDataset, RetryHandler, SendQuestion } from '../types';
import { readCsvFile } from '../utils/readCsvFile';
import MessageBubble from './MessageBubble';
import ErrorBubble from './ErrorBubble';
import EmptyState from './EmptyState';
import StatusBar from './StatusBar';
import InputBar from './InputBar';
import DatasetBanner from './DatasetBanner';

interface ChatPanelProps {
  messages: ChatMessage[];
  status: ChatStatus;
  isLoading: boolean;
  /** 当前数据集；null 表示内置水稻数据 */
  dataset: CsvDataset | null;
  onSend: SendQuestion;
  onStop: () => void;
  onRetry: RetryHandler;
  onIngest: (input: { fileName: string; headers: string[]; rows: string[][] }) => void;
  onClearDataset: () => void;
}

export default function ChatPanel({
  messages,
  status,
  isLoading,
  dataset,
  onSend,
  onStop,
  onRetry,
  onIngest,
  onClearDataset,
}: ChatPanelProps) {
  // 取最后一条 AI 消息的真实推理步骤，驱动底部状态条展示
  const lastSteps = [...messages].reverse().find((m) => m.role === 'assistant')?.steps;

  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState('');

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    // 必须阻止默认行为，否则浏览器会用文件替换整个页面
    event.preventDefault();
    if (!dragging) setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    // 只在真正离开面板时收起提示，避免掠过子元素时闪烁
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const result = await readCsvFile(file);
    if (!result.ok) {
      setDropError(result.message);
      return;
    }
    setDropError('');
    onIngest(result.data);
  };

  return (
    // 左栏 248 比右栏 288 窄 40，两栏同时存在时中间栏会偏左 20（≥1440 才出现右栏，
    // 所以补偿也只在 ≥1440 生效）；内容收到 880 让右侧留白不变，中线正好落在屏幕正中
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col min-[1440px]:pl-10"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽态：整块对话区可放下 */}
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-strong bg-surface/85">
          <FileSpreadsheet size={26} className="text-text-muted" aria-hidden="true" />
          <p className="text-[14px] text-text-body">松开即可分析这份 CSV</p>
          <p className="text-[12px] text-text-faint">支持 .csv，单个文件不超过 5MB</p>
        </div>
      )}

      {/* 消息区（居中，滚动） */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center px-5 py-6 [@media(max-height:820px)]:py-2">
            <EmptyState onSend={onSend} />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7 px-5 py-9 md:px-8">
            {messages.map((message) =>
              message.kind === 'error' ? (
                <ErrorBubble key={message.id} message={message} onRetry={onRetry} />
              ) : (
                <MessageBubble key={message.id} message={message} onFollowup={onSend} />
              ),
            )}
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      <div className="border-t border-border bg-canvas">
        <div className="mx-auto w-full max-w-[880px] px-5 pb-5 pt-3.5 md:px-8">
          {dataset && <DatasetBanner dataset={dataset} onClear={onClearDataset} />}

          {dropError && (
            <p className="mb-2 text-[12px] text-danger" role="alert">
              {dropError}
            </p>
          )}

          <StatusBar status={status} steps={lastSteps} />
          <div className="mt-3">
            <InputBar
              isLoading={isLoading}
              onSend={onSend}
              onStop={onStop}
              onIngest={onIngest}
            />
          </div>
          <p className="mt-2.5 text-center text-[12px] text-text-faint">
            AI 生成内容仅供参考，不构成预测
          </p>
        </div>
      </div>
    </div>
  );
}
