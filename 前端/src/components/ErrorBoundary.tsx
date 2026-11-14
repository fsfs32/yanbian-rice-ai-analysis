// 错误边界（容器组件）：捕获渲染期异常，避免白屏，提供友好提示与重试按钮
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 仅记录日志，不向用户暴露堆栈
    console.error('渲染发生错误：', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card">
            <h1 className="text-[16px] font-semibold text-text-primary">页面暂时无法显示</h1>
            <p className="mt-2 text-[14px] leading-[1.6] text-text-muted">
              发生了预期之外的错误，请重试。
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="gradient-primary mt-4 rounded-md px-4 py-2 text-[13px] text-white transition-colors duration-150 hover:brightness-110"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
