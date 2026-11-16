# 提交前自查清单

逐条打勾，避免评审现场踩雷。条目与当前代码一一对应，改代码后请同步更新。

## 安全红线

- [ ] 前端源码不出现 `api.deepseek.com` / `api.openai.com` 等大模型域名
- [ ] 前端只请求 `VITE_API_BASE_URL` 下的 `/api/ask` 与 `/health`
- [ ] 代码、README、`.env.example` 中没有任何真实 API Key（`sk-` 仅为占位符）
- [ ] 前端不读取、不存储任何 Key
- [ ] 页面信息区（对话、图表、KPI）不出现学校 / 团队 / 成员姓名

## 运行时安全

- [ ] `validateAskResponse` 白名单校验：`chart_type` 限 4 种，`x_field`/`y_field` 限 year/yield/revenue/city
- [ ] `labels` 与 `values` 等长、`values2` 若存在必须等长且为有限数字
- [ ] `summary` 截断 800 字、`title` 80 字、追问 40 字且最多 3 条
- [ ] 不使用 `dangerouslySetInnerHTML`，AI 返回内容按纯文本渲染
- [ ] 错误提示不包含堆栈、原始响应或密钥
- [ ] 输入框限 500 字，与后端 `max_length` 一致

## 错误边界与兜底

- [ ] 网络 / 超时 / HTTP / JSON 解析失败都有友好提示，不白屏
- [ ] 网络与超时自动重试 1 次；仍失败时数据类问题降级内置数据、知识类问题如实说明
- [ ] 普通请求 15s 超时；流式在收到响应头后取消超时（避免长回答被掐断）
- [ ] 渲染异常由 `ErrorBoundary` 兜底并提供重试
- [ ] 演示模式明确标注「演示模式」，且降级回答与问题对应

## AI 交互体验

- [ ] SSE 流式（`fetch + ReadableStream`），后端返回 JSON 时降级为打字机
- [ ] 状态条覆盖 5 个阶段：理解问题 → 查询数据 → 计算分析 → 生成图表 → 完成
- [ ] 支持停止生成，已生成内容保留
- [ ] 图表点击可追问、推荐追问可点击

## 工程规范

- [ ] TypeScript 严格模式：`strict` / `noImplicitAny` / `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch`
- [ ] 组件 Props、Hook 返回值、接口入参出参均有显式类型，无 `any`
- [ ] 数据流单向：组件 → `useChat` → `askApi` → 后端 → `useChat` → 组件 props，组件不直接 fetch
- [ ] 展示组件基本控制在 150 行内（最大的 `MessageBubble` 约 180 行，已拆出 KPI/图表/追问子组件）
- [ ] 颜色 / 圆角 / 阴影走 `@theme` Token；组件层无十六进制色值（图表与导出的色值集中在 `chartOption` / `chartTheme` / `exportData`）

## 性能与可访问性

- [ ] `ChartCard` 用 `React.lazy + Suspense`，fallback 为骨架卡片
- [ ] ECharts 按需注册；`buildOption` 用 `useMemo`；`KpiCard` 用 `memo`
- [ ] 大 CSV 抽稀到 500 点后再绘图
- [ ] 交互元素有 `aria-label`；状态条 `aria-live="polite"`；装饰图标 `aria-hidden`
- [ ] 响应式：≥1440 三栏、1280–1440 两栏（隐藏右栏）、<1280 单栏（隐藏左栏）；390 宽无横向溢出

## 构建与文档

- [ ] `npm run build`、`npm run typecheck`、`npm run lint`、`npm test` 全部通过
- [ ] 后端 `pytest` 48 项通过
- [ ] `.env` 未被提交（在 `.gitignore` 中）
- [x] README 的团队信息已填写（李梓帅、刘桐、静禹臣；指导教师 宋峻宇）
- [ ] README 含环境变量、依赖清单、运行方式、第三方许可证与 AI 工具使用说明
- [ ] 1440 / 1280 / 768 / 390 四个宽度无布局崩坏
- [ ] 仓库已设为 Public 或已为评委开通访问权限
