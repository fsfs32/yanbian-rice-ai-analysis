// 问题类别菜单（展示组件）：给「不知道问什么」的人一个入口
// 点击按钮向上展开分类浮层，每类下列出可直接发送的示例问题
import { useEffect, useRef, useState } from 'react';
import { ListTree } from 'lucide-react';

interface QuestionCategory {
  label: string;
  items: string[];
}

/** 问题分类：按平台实际能力组织，点一条即直接提问 */
const CATEGORIES: QuestionCategory[] = [
  {
    label: '查产量数据',
    items: [
      '2016—2025 年产量趋势',
      '哪一年产量最高？',
      '平均产量是多少？',
      '产量波动最大的年份',
    ],
  },
  {
    label: '病虫害防治',
    items: ['稻瘟病怎么防治？', '纹枯病什么时候防？', '稻飞虱用什么药？', '二化螟怎么处理？'],
  },
  {
    label: '栽培与农事',
    items: [
      '我们这边什么时候插秧合适？',
      '插完秧水要放多深？',
      '插秧后怎么施肥？',
      '稗草怎么除？',
      '种什么品种合适？',
    ],
  },
  {
    label: '政策补贴',
    items: ['稻谷补贴范围包括哪些耕地？', '补贴怎么申报？'],
  },
];

interface QuestionMenuProps {
  onPick: (question: string) => void;
}

export default function QuestionMenu({ onPick }: QuestionMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 点击外部或按 Esc 关闭浮层
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handlePick = (question: string) => {
    setOpen(false);
    onPick(question);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="打开问题类别"
        title="不知道问什么？看看这些"
        className={`flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] transition-colors duration-150 ${
          open ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-soft hover:text-text-primary'
        }`}
      >
        <ListTree size={17} aria-hidden="true" />
        <span className="hidden sm:inline">问题类别</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="问题类别"
          className="absolute bottom-full left-0 z-30 mb-2 max-h-[340px] w-[320px] overflow-y-auto rounded-xl border border-border bg-canvas p-2 shadow-float"
        >
          {CATEGORIES.map((category) => (
            <div key={category.label} className="py-1">
              <p className="px-2 py-1 text-[11.5px] font-medium uppercase tracking-[0.1em] text-text-faint">
                {category.label}
              </p>
              {category.items.map((question) => (
                <button
                  key={question}
                  type="button"
                  role="menuitem"
                  onClick={() => handlePick(question)}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] text-text-body transition-colors duration-150 hover:bg-primary-soft/60 hover:text-primary"
                >
                  {question}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
