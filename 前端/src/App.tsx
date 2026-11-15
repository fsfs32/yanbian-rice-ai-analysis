// 应用根组件：三栏外壳（最近提问 / 对话 / 数据速览），数据流 App → useChat → askApi → 后端 → 组件 props
// 两个侧栏只在大屏出现，窄屏自动收起，对话区始终是视觉主体
import { ErrorBoundary } from './components/ErrorBoundary';
import TopBar from './components/TopBar';
import ChatPanel from './components/ChatPanel';
import HistoryRail from './components/HistoryRail';
import InfoRail from './components/InfoRail';
import { useChat } from './hooks/useChat';

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
  } = useChat();




  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col bg-canvas">
        <TopBar
          onNewChat={reset}
          latencyMs={latencyMs}
          usage={usage}
          onLanguageChanged={() => {
            // 只切界面文字。历史回答逐条翻译要串行调用，条数一多就明显卡顿，
            // 体验反而更差；回答保持原样，用户接着提问就是新语言。
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
