// 应用根组件：极简问答界面，数据流 App → useChat → askApi → 后端 → 组件 props
import { ErrorBoundary } from './components/ErrorBoundary';
import TopBar from './components/TopBar';
import ChatPanel from './components/ChatPanel';
import { useChat } from './hooks/useChat';

export default function App() {
  const { messages, status, isLoading, sendQuestion, stop, retry, reset, ingestCsv } = useChat();

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col">
        <TopBar onNewChat={reset} />
        <ChatPanel
          messages={messages}
          status={status}
          isLoading={isLoading}
          onSend={sendQuestion}
          onStop={stop}
          onRetry={retry}
          onIngest={ingestCsv}
        />
      </div>
    </ErrorBoundary>
  );
}
