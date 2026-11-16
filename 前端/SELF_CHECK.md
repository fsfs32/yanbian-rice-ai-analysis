# SELF_CHECK.md

提交前逐条打勾的自查清单（合规与雷点）。

## 安全红线

- [ ] 前端代码中不出现 `api.deepseek.com` / `api.openai.com` / `anthropic` 等大模型域名
- [ ] 前端只请求 `import.meta.env.VITE_API_BASE_URL + "/api/ask"`，不直接调模型
- [ ] 代码、README、.env.example 中不出现任何以 `sk-` 开头的字符串或真实 API Key
- [ ] 前端只读取 `VITE_API_BASE_URL`，不存储任何 Key
- [ ] 页面信息区（对话 / 图表 / KPI）不出现学校名称、团队名称、成员姓名

## 运行时安全

- [ ] `validateAskResponse` 做白名单校验（chart_type 限 line/bar/scatter/combo，x/y_field 限 year/yield/revenue）
- [ ] title/summary 纯文本渲染并截断（title 80 / summary 800）
- [ ] 禁止 `dangerouslySetInnerHTML` 渲染 AI 返回内容
- [ ] 错误不向用户暴露堆栈 / 原始响应 / Key
- [ ] Mock 降级时界面明确标注「演示模式」，且降级回答不与问题冲突

## 错误边界与兜底

- [ ] 请求失败 / 超时 / JSON 解析失败 / 字段缺失 / 图表渲染失败不白屏
- [ ] 友好提示卡 + 重试按钮（重试仅对 NetworkError / TimeoutError 生效，最多 1 次）
- [ ] 请求使用 AbortController 15s 超时

## AI 交互体验

- [ ] 流式输出（原生 fetch + ReadableStream）或打字机降级
- [ ] AI 思考状态可视化（理解 → 校验 → 生成 → 完成）
- [ ] 错误边界优雅、重试机制完整

## 工程规范

- [ ] TypeScript 严格模式（strict / noImplicitAny / noUnusedLocals / noUnusedParameters / noFallthroughCasesInSwitch）
- [ ] 组件 Props / Hook 返回值 / API 入参出参均有显式类型，无 `any`
- [ ] 数据流：App → useChat → askApi → 后端 → useChat → 组件 props（组件不直接 fetch）
- [ ] 单个组件 ≤150 行，文件名 PascalCase，关键逻辑有中文注释
- [ ] 颜色 / 圆角 / 阴影走 @theme Token，组件中无十六进制色值 / bg-[#...]

## 性能与可访问性

- [ ] ChartCard 使用 React.lazy + Suspense，fallback 为 SkeletonCard
- [ ] ECharts 按需引入；option 用 useMemo；KpiCard 用 React.memo
- [ ] 交互元素有 aria-label / label；状态条 aria-live="polite"；装饰 SVG aria-hidden
- [ ] 响应式：≥1280 三栏 / 1100–1280 右栏 260 / 768–1100 隐藏右栏 / <768 隐藏两侧

## 构建与文档

- [ ] `npm run build` 通过
- [ ] `tsc --noEmit` 通过
- [ ] `.env` 未提交（在 .gitignore 中）
- [ ] README 含团队信息真实占位与「请替换为真实信息」提示
- [ ] README 含第三方许可证声明与 AI 工具使用声明
- [ ] 1280 / 768 宽度无布局崩坏
- [ ] 仓库已设为 Public 或已添加评审专用访问权限
