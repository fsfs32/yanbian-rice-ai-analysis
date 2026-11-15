// 推荐追问（展示组件）：把后端给的 followups 渲染成可点的继续提问入口
// 点击等价于重新发问，省掉手动输入的步骤 —— 成熟 AI 产品的常见做法
import { CornerDownRight } from 'lucide-react';
import { useI18n } from '../i18n';

interface FollowupListProps {
  items: string[];
  onPick: (question: string) => void;
}

export default function FollowupList({ items, onPick }: FollowupListProps) {
  const { t } = useI18n();
  if (items.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-[11.5px] text-text-faint">
        <CornerDownRight size={12} aria-hidden="true" />
        {t('ai.followup')}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-left text-[12.5px] text-text-body transition-colors duration-150 hover:border-border-strong hover:bg-primary-soft/50 hover:text-primary"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
