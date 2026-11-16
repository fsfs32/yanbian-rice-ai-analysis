# 延边大米 · 长势与产量（前端）

> 赛项方向：AI 数据分析与可视化（全国高校 AI Web 开发挑战赛）
> 技术栈：React 18 + TypeScript + Vite + Tailwind CSS v4 + ECharts

以「自然语言驱动数据分析」为核心的对话式 Web 应用：问一句话，得到延边州水稻产量的趋势图、统计指标和农技答案；也可以上传 CSV，由 AI 解读或由浏览器本地完成数据画像。

## 核心功能

- **对话式分析**：Enter 发送 / Shift+Enter 换行，支持停止生成、重新提问、示例问题一键发送
- **流式渲染**：原生 `fetch + ReadableStream` 解析 SSE，边生成边显示；后端返回普通 JSON 时降级为打字机效果
- **可解释轨迹**：后端下发的真实执行步骤（理解 → 查询 → 计算 → 生成图表）展示在气泡里，底部状态条同步
- **图表**：折线 / 柱状 / 组合图本地切换（不重新请求）；点击数据点可直接追问；PNG 导出带数据来源水印，CSV 导出带注释行与 BOM
- **KPI**：总产量 / 峰值年份 / 年均值由数据实时计算；市州对比与产值图会自动切换单位与标签
- **CSV 分析**：拖拽或选择文件（≤5MB），浏览器本地解析并画像；后端可用时把前 2000 行交给 AI 解读，不可用时退回本地画像
- **演示模式**：未配置密钥时明确标注「演示模式」，回答仍按问题类型从内置数据与知识库生成
- **响应式**：≥1440 三栏，≥1280 两栏，窄屏单栏；移动端无横向溢出

## 技术栈

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| React / react-dom | ^18 | UI 框架 |
| TypeScript | ^5 | 类型安全（严格模式） |
| Vite | ^5 | 开发服务器与构建 |
| Tailwind CSS | ^4 | `@theme` 设计 Token |
| ECharts / echarts-for-react | ^5 / ^3 | 图表（按需引入、懒加载） |
| lucide-react | ^0 | 图标 |

## 数据流

```
① 本地画像（纯浏览器）：CSV → parseCsv → csvInsight → 图表 / 表格（零请求）
② AI 分析（前后端协同）：组件 → useChat → api/askApi → 后端 /api/ask（SSE）→ 组件 props
```

- `api/` 只放请求函数：`fetch` + `AbortController` 超时 + 错误类型归一化（网络 / 超时 / HTTP / 解析）
- `hooks/useChat.ts` 是唯一的数据编排入口，`useReducer` 管理消息、状态、流式片段与错误
- `utils/` 只放纯函数：CSV 解析、数据画像、响应校验、KPI、图表配置、导出、错误归一化
- 组件分容器与展示两类；展示组件 `memo`，`ChartView` 用 `React.lazy` 懒加载

**关于 CSV 的边界**：解析与画图都在浏览器完成；只有「把数据交给 AI 解读」这一步会把前 2000 行发往**本机后端**（后端再按需转发给所配置的大模型）。不写数据库，访问日志只记录路径与状态码。

## 运行时安全

- `validateAskResponse` 对后端返回做白名单校验：`chart_type` 限 line/bar/scatter/combo，`x_field` 限 year/yield/revenue/city，`labels` 与 `values` 必须等长
- `summary` 截断到 800 字、`title` 80 字、追问 40 字且最多 3 条；全部按纯文本渲染，不使用 `dangerouslySetInnerHTML`
- 错误只展示归一化后的友好文案，不暴露堆栈、原始响应或任何密钥
- 输入框限 500 字（与后端 `max_length` 对齐），避免提交后才被 422 打回
- 大文件保护：图表抽稀到 500 点，请求体只带前 2000 行

## 状态与错误兜底

| 场景 | 表现 |
|---|---|
| 网络中断 | 提示 + 自动重试 1 次；仍失败时对数据类问题降级为内置数据，知识类问题如实说明服务不可用 |
| 请求超时 | 同上，且不阻塞输入 |
| 返回结构非法 | 显示「返回数据格式异常」，不渲染半成品 |
| 渲染异常 | `ErrorBoundary` 兜底，提供重试，不白屏 |
| 用户主动停止 | 静默结束，保留已生成内容 |

## 性能优化

- 图表 `React.lazy + Suspense`，fallback 为骨架卡片，不阻塞首屏
- ECharts 按需注册（core + line/bar/scatter + grid/tooltip/legend + canvas），单独分包（gzip 约 183KB）
- `buildOption` 用 `useMemo`，依赖 `labels/values/chartType/yLabel`
- `KpiCard`、`MessageBubble` 等展示组件 `memo`；消息用稳定 id 作为 key
- 大 CSV 抽稀后再绘图，避免上千个点拖慢渲染

## 可访问性

- 交互元素均有 `aria-label` 或可见文本；状态条 `aria-live="polite"`
- 图表容器 `role="img"` 并提供描述；装饰性图标 `aria-hidden`
- 语音按钮在不支持的浏览器上直接不渲染，不制造死角
- 键盘可用：输入框 Enter 发送、菜单 Esc 关闭、问题类别可键盘选择

## 目录结构

```
src/
├── main.tsx / App.tsx        # 入口与三栏布局
├── styles/globals.css        # @theme 设计 Token
├── types/index.ts            # 共享类型
├── api/
│   ├── askApi.ts             # /api/ask 请求封装 + SSE 解析
│   └── health.ts             # /health：模型名与演示模式
├── hooks/useChat.ts          # 数据编排（消息、流式、CSV、错误）
├── utils/                    # 纯函数：解析、校验、图表配置、导出、KPI、历史
├── components/               # TopBar / ChatPanel / MessageBubble / ChartCard /
│                             # ChartView / InputBar / StatusBar / HistoryRail /
│                             # InfoRail / QuestionMenu / EmptyState / ...
└── utils/__tests__/          # Vitest 单元测试（18 项）
```

## 本地运行

```bash
npm install
npm run dev        # 开发服务器（默认 5173）
npm run build      # tsc --noEmit + vite build
npm run preview    # 预览构建产物
npm run test       # Vitest
npm run lint       # ESLint（含 jsx-a11y）
npm run typecheck  # 仅类型检查
```

环境变量（`.env`，可选）：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

前端不存储任何 API Key，也不直接请求大模型域名。

## 浏览器支持

Chrome / Edge 最新版（语音输入依赖 Web Speech API）；Firefox 可用但无语音按钮；Safari 未实测。

## 提交前自查

- [ ] `npm run build`、`npm run typecheck`、`npm run lint`、`npm run test` 全部通过
- [ ] `grep -R "sk-" src` 无结果；`grep -R "api.deepseek.com" src` 无结果
- [ ] `.env` 未被提交
- [ ] 1440 / 1280 / 768 / 390 宽度无布局崩坏
- [ ] 演示模式与真实模式各走一遍完整问答

## 第三方资源与许可

- [ECharts](https://echarts.apache.org/) — Apache License 2.0
- [echarts-for-react](https://github.com/hustcc/echarts-for-react) — MIT License
- [lucide-react](https://lucide.dev/) — ISC License
- [React](https://react.dev/) — MIT License
- [Tailwind CSS](https://tailwindcss.com/) — MIT License

## AI 工具使用说明

UI 初版借助 AI 生成工具出稿，随后进行了主题化、组件拆分、运行时校验与错误兜底改造；最终代码由团队成员逐行核对，评审中可完整解释。

## 团队信息

| 项 | 内容 |
| --- | --- |
| 学校 | 延边职业技术学院 |
| 组别 | C 组（高职高专院校） |
| 成员 | 李梓帅、刘桐、静禹臣 |
| 指导教师 | 宋峻宇 |
| GitHub | [fsfs32](https://github.com/fsfs32)（提交记录显示名 TL） |
