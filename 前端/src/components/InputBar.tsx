// 输入栏（展示组件）：问答式输入框，Enter 发送 / Shift+Enter 换行，支持上传 CSV，生成中可停止
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { readCsvFile } from '../utils/readCsvFile';
import QuestionMenu from './QuestionMenu';
import MicButton from './MicButton';
import type { SendQuestion } from '../types';

interface InputBarProps {
  isLoading: boolean;
  onSend: SendQuestion;
  onStop: () => void;
  onIngest: (input: { fileName: string; headers: string[]; rows: string[][] }) => void;
}

export default function InputBar({ isLoading, onSend, onStop, onIngest }: InputBarProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const question = value.trim();
    if (!question || isLoading) return;
    onSend(question);
    setValue('');
  };

  /** 语音识别结果追加到输入框，用户确认后再发送 */
  const handleSpeech = (text: string) => {
    setValue((prev) => (prev ? `${prev}${text}` : text));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const result = await readCsvFile(file);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    onIngest(result.data);
  };

  return (
    <div className="rounded-[20px] border border-border bg-surface shadow-float transition-colors duration-200 focus-within:border-border-strong">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="输入关于延边水稻的问题"
        placeholder="问一个关于产量的问题，或上传 CSV 让我分析…"
        className="max-h-44 w-full resize-none overflow-hidden border-none bg-transparent px-4.5 pb-1.5 pt-4 text-[16.5px] leading-[1.65] text-text-primary placeholder:text-text-faint focus:outline-none"
      />
      <div className="flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="上传 CSV 文件"
            title="上传 CSV"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-soft hover:text-text-primary"
          >
            <Paperclip size={18} aria-hidden="true" />
          </button>
          {/* 不知道问什么时的入口：点开向上展开分类 */}
          <QuestionMenu onPick={onSend} />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
          aria-hidden="true"
        />

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="停止生成"
            title="停止生成"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors duration-150 hover:bg-soft"
          >
            <Square size={14} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <MicButton onResult={handleSpeech} disabled={isLoading} />
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="发送问题"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-soft disabled:text-text-faint"
            >
              <ArrowUp size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="px-4 pb-2 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
