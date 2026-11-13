// 骨架卡（展示组件）：图表懒加载（Suspense）期间的占位，避免布局跳动
export default function SkeletonCard() {
  return <div className="h-[300px] w-full animate-pulse rounded-md bg-border/60" aria-hidden="true" />;
}
