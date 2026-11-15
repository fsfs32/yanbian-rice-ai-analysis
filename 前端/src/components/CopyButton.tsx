// 复制按钮（展示组件）：把 AI 回答的正文复制到剪贴板，成功后短暂反馈
import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  /** 无障碍标签，说明复制的是什么 */
  label?: string;
}

const FEEDBACK_MS = 1500;

export default function CopyButton({ text, label = '复制回答' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 剪贴板不可用（非安全上下文 / 权限被拒）时静默失败，不打扰阅读
      return;
    }
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={copied ? '已复制' : label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint transition-colors duration-150 hover:bg-primary-soft hover:text-text-primary"
    >
      {copied ? (
        <Check size={14} aria-hidden="true" />
      ) : (
        <Copy size={14} aria-hidden="true" />
      )}
    </button>
  );
}
