// 语音输入按钮（展示组件）：调用浏览器原生 Web Speech API，把说的话转成文字填进输入框
// 不支持该能力的浏览器（如 Firefox）直接不渲染，不占位置也不报错
import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

interface MicButtonProps {
  /** 识别到一段完整话后回调，由父组件决定填进输入框还是直接发送 */
  onResult: (text: string) => void;
  disabled?: boolean;
}

export default function MicButton({ onResult, disabled = false }: MicButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // 用 ref 保存最新回调，避免把 onResult 放进初始化依赖里反复重建识别器
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onResultRef.current(transcript);
    };
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // 未启动时 abort 可能抛错，忽略
      }
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch {
      // 连续点击时可能已在监听，忽略重复启动
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? '停止语音输入' : '语音输入'}
      aria-pressed={listening}
      title={listening ? '正在听，再点一次结束' : '语音输入（需要麦克风权限）'}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
        listening
          ? 'bg-primary-soft text-primary'
          : 'text-text-muted hover:bg-soft hover:text-text-primary'
      }`}
    >
      <Mic size={18} className={listening ? 'animate-pulse' : undefined} aria-hidden="true" />
    </button>
  );
}
