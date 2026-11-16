// 顶栏（展示组件）：极简问答产品导航，品牌标识（支持图片位）+ 运行状态角标 + 新对话按钮
// 图片位：public/logo.png（96×96 透明底），缺失时回退为黑白色麦穗 SVG 标识
// 状态角标：显示当前模型与上次响应耗时；未配置密钥时显示「演示模式」，不误导为真调模型
import { useEffect, useState } from 'react';
import { Plus, Wheat } from 'lucide-react';
import { fetchServiceInfo } from '../api/health';

interface TopBarProps {
  onNewChat: () => void;
  /** 最近一次问答耗时（毫秒）；null 表示本轮还没问过 */
  latencyMs?: number | null;
  /** 最近一次问答的 token 用量，用于让成本可见 */
  usage?: { total_tokens: number; estimated_cost_cny?: number | null } | null;
}

export default function TopBar({ onNewChat, latencyMs, usage }: TopBarProps) {
  const [logoOk, setLogoOk] = useState(true);
  const [service, setService] = useState<{ model: string | null; demo: boolean }>({
    model: null,
    demo: false,
  });

  useEffect(() => {
    let alive = true;
    void fetchServiceInfo().then((info) => {
      if (alive) setService(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  const latencyText =
    typeof latencyMs === 'number' && latencyMs > 0 ? `${(latencyMs / 1000).toFixed(1)}s` : null;

  // token 用量：超过一千按 k 显示；成本按后端折算值显示到分位
  const usageText =
    usage && usage.total_tokens > 0
      ? usage.total_tokens >= 1000
        ? `${(usage.total_tokens / 1000).toFixed(1)}k tokens`
        : `${usage.total_tokens} tokens`
      : null;
  const costText = usage?.estimated_cost_cny ? `约 ¥${usage.estimated_cost_cny.toFixed(3)}` : null;

  // 演示模式下不显示模型名：没调模型却挂一个模型名，属于误导
  const modelText = service.demo ? '演示模式' : service.model;

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-canvas px-5 md:px-8">
      <div className="flex items-center gap-3">
        {logoOk ? (
          <img
            src="/logo.png"
            alt="延边大米长势与产量分析"
            className="h-9 w-9 rounded-lg object-cover"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft text-text-primary">
            <Wheat size={19} aria-hidden="true" />
          </span>
        )}
        <span className="text-[16.5px] font-semibold tracking-tight text-text-primary">
          延边大米 · 长势与产量
        </span>
        <span className="hidden text-[13px] text-text-muted sm:inline">AI 分析</span>
      </div>

      <div className="flex items-center gap-3">
        {/* 运行状态角标：模型名（演示模式时替换）+ 上次响应耗时 + token 用量 */}
        {(modelText || latencyText || usageText) && (
          <span
            className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-text-faint md:inline-flex"
            title={
              service.demo
                ? '未配置 LLM_API_KEY：回答由内置数据与知识库生成'
                : costText
                  ? `当前模型、最近一次响应耗时与 token 用量（${costText}）`
                  : '当前模型、最近一次响应耗时与 token 用量'
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {modelText}
            {modelText && (latencyText || usageText) && <span className="text-border-strong">·</span>}
            {latencyText}
            {latencyText && usageText && <span className="text-border-strong">·</span>}
            {usageText}
          </span>
        )}

        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13.5px] text-text-muted transition-colors duration-150 hover:bg-soft hover:text-text-primary"
        >
          <Plus size={16} aria-hidden="true" />
          新对话
        </button>
      </div>
    </header>
  );
}
