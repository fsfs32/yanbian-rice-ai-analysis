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
            // 切换语言时清空当前对话。
            // 之前试过「自动用新语言重答最后一轮」，但那会形成请求循环
            // （重答完成后又触发一次重答），日志里能连续看到五六次调用。
            // 清空更干净：用户看到的是新语言的首屏，重新提问即可得到新语言的回答。
            reset();
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
