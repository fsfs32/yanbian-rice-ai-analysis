// 应用根组件：三栏外壳（最近提问 / 对话 / 数据速览），数据流 App → useChat → askApi → 后端 → 组件 props
// 两个侧栏只在大屏出现，窄屏自动收起，对话区始终是视觉主体
import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import TopBar from './components/TopBar';
import ChatPanel from './components/ChatPanel';
import HistoryRail from './components/HistoryRail';
import InfoRail from './components/InfoRail';
import { useChat } from './hooks/useChat';
import { useI18n } from './i18n';

export default function App() {
  const {
    messages,
    status,
    isLoading,
    history,
    dataset,
    latencyMs,
    usage,
    clearDataset,
    sendQuestion,
    stop,
    retry,
    reset,
    ingestCsv,
    translateAll,
  } = useChat();

  // 页面加载或语言变化后，把与当前语言不一致的回答翻译过来。
  // 覆盖两种情况：刷新页面后历史停在旧语言；以及切换后新生成的回答。
  const { lang } = useI18n();
  useEffect(() => {
    if (messages.length === 0) return;
    void translateAll(lang);
    // 只在语言变化时触发，不跟随 messages 变化，避免翻译完又触发的循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);


  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col bg-canvas">
        <TopBar
          onNewChat={reset}
          latencyMs={latencyMs}
          usage={usage}
          onLanguageChanged={(next) => {
            // 切语言时把已有回答逐条翻译，而不是清空或重新作答：
            // 清空会让用户白问一遍，重新作答会重新查数据、贵且慢；
            // 翻译只需要一次纯文本调用，历史对话也就能跟着换语言。
            void translateAll(next);
          }}
        />
        <div className="flex min-h-0 flex-1">
          <HistoryRail
            history={history}
            onPick={sendQuestion}
            onNew={reset}
            showDataNote={dataset === null}
          />
          <ChatPanel
            messages={messages}
            status={status}
            isLoading={isLoading}
            dataset={dataset}
            onSend={sendQuestion}
            onStop={stop}
            onRetry={retry}
            onIngest={ingestCsv}
            onClearDataset={clearDataset}
          />
          <InfoRail dataset={dataset} onClearDataset={clearDataset} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
