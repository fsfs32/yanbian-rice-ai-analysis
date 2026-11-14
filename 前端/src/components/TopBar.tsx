// 顶栏（展示组件）：极简问答产品导航，品牌标识（支持图片位）+ 新对话按钮
// 图片位：public/logo.png（建议 96×96 透明底、黑白色麦穗图），未放置时回退为黑白色麦穗 SVG 标识
import { useState } from 'react';
import { Plus, Wheat } from 'lucide-react';

interface TopBarProps {
  onNewChat: () => void;
}

export default function TopBar({ onNewChat }: TopBarProps) {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-canvas px-4 md:px-6">
      <div className="flex items-center gap-2.5">
        {logoOk ? (
          <img
            src="/logo.png"
            alt="延边大米长势与产量分析"
            className="h-8 w-8 rounded-md object-cover"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-soft text-text-primary">
            <Wheat size={18} aria-hidden="true" />
          </span>
        )}
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">
          延边大米 · 长势与产量
        </span>
        <span className="hidden text-[12.5px] text-text-muted sm:inline">AI 分析</span>
      </div>

      <button
        type="button"
        onClick={onNewChat}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] text-text-muted transition-colors duration-150 hover:bg-soft hover:text-text-primary"
      >
        <Plus size={15} aria-hidden="true" />
        新对话
      </button>
    </header>
  );
}
