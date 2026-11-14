// 输入栏（展示组件）：问答式输入框，Enter 发送 / Shift+Enter 换行，支持上传 CSV，生成中可停止
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { parseCsv } from '../utils/parseCsv';
import type { SendQuestion } from '../types';

interface InputBarProps {
  isLoading: boolean;
  onSend: SendQuestion;
  onStop: () => void;
  onIngest: (input: { fileName: string; headers: string[]; rows: string[][] }) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError('仅支持 .csv 文件');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('文件大小不能超过 5MB');
      return;
    }
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseCsv(text);
      if ('message' in parsed) {
        setError(parsed.message);
      } else {
        onIngest({ fileName: file.name, headers: parsed.headers, rows: parsed.rows });
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-float transition-colors duration-200 focus-within:border-primary/50">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="输入关于延边水稻的问题"
        placeholder="问一个关于产量的问题，或上传 CSV 让我分析…"
        className="max-h-40 w-full resize-none overflow-hidden border-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-[1.6] text-text-primary placeholder:text-text-faint focus:outline-none"
      />
      <div className="flex items-center justify-between px-2.5 pb-2.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="上传 CSV 文件"
          title="上传 CSV"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-soft hover:text-text-primary"
        >
          <Paperclip size={17} aria-hidden="true" />
        </button>
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors duration-150 hover:bg-soft"
          >
            <Square size={13} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="发送问题"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-soft disabled:text-text-faint"
          >
            <ArrowUp size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      {error && (
        <p className="px-4 pb-2 text-[12px] text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
