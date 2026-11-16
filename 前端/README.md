# 延边大米种植长势与产量 AI 数据分析可视化平台

<!-- ⚠️ 请替换为真实信息：下方「团队信息」一节中的成员姓名、学校、分工、指导教师均为示例占位。 -->

> 赛项方向：**AI 数据分析与可视化**（全国高校 AI Web 开发挑战赛 · 选题方向 8）

一个基于 React + Vite + TypeScript + Tailwind CSS + ECharts 的单页 Web 应用。以「自然语言驱动数据分析」为核心，让用户通过对话方式完成延边州水稻产量数据的查询、分析与可视化，并结合本地 CSV 上传实现「上传即画像、对话即图表」，降低农业数据分析门槛。

## 核心功能

- **自然语言分析**：示例问题点击即问，Enter 发送 / Shift+Enter 换行，对话式完成数据查询与分析
- **文件上传与数据画像**：拖拽/点击上传 CSV，浏览器本地解析（数据不上传），自动识别数值列，即时生成数据画像（行数/列数/数值列/峰值）、自动图表与表格预览
- **AI 交互三件套**：流式输出（或打字机降级）、思考状态可视化、错误边界优雅降级
- **图表展示**：折线图 / 柱状图本地切换，不重新请求，单色系与整体视觉统一
- **KPI 指标**：总产量 / 最高产量年份 / 年均产量，由数据实时计算，不写死
- **AI 安全与可控**：返回数据运行时校验、字段截断、演示模式明确标注、错误友好提示与重试
- 响应式布局与 WCAG 2.2 AA 可访问性

## 技术栈与版本

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| React / react-dom | ^18 | UI 框架 |
| TypeScript | ^5 | 类型安全（严格模式） |
| Vite | ^5 | 构建与开发服务器 |
| Tailwind CSS | ^4 | 设计 Token 驱动样式 |
| ECharts / echarts-for-react | ^5 / ^3 | 图表（按需引入） |
| lucide-react | ^0 | 图标 |

## 架构概述

前端**不直接调用任何大模型 API**，存在两条数据流：

```
① 本地数据智能（端侧）：CSV 文件 → parseCsv → csvInsight 数据画像 → 自动图表（浏览器内完成，零请求）
② AI 分析（端云协同）：组件 → useChat → api/askApi.ts → 后端 (VITE_API_BASE_URL + /api/ask) → 流式 → 组件 props
```

- `api/` 只封装请求函数（fetch + AbortController 15s 超时 + 错误归一化）
- `hooks/useChat.ts` 是唯一的数据编排入口（useReducer 管理 messages/status/error/isLoading）
- `utils/` 只放纯函数（CSV 解析 / 数据画像 / 运行时校验 / KPI 计算 / 错误归一化）
- 组件分容器与展示两类，展示组件用 `React.memo`，图表用 `React.lazy` 懒加载

流式输出采用**原生 fetch + ReadableStream** 实现（未使用 Vercel AI SDK），是为了理解流式原理而选择原生实现；后端返回普通 JSON 时以打字机效果逐字渲染作为降级。

## AI 技术方案与创新点

**技术方案（对应「AI 技术深度」评分维度）**

- **Agent 工作流可视化**：将一次分析拆解为「理解问题 → 校验字段 → 生成图表 → 完成」四阶段状态机，由真实事件驱动、可展开查看步骤，直观呈现 AI 思考过程
- **大模型集成质量**：流式输出逐字渲染、思考状态与加载态分离、超时/网络错误自动重试，保证输出稳定可控
- **端侧数据智能**：CSV 在浏览器本地解析并自动完成数据画像与可视化（不依赖后端），体现「端云协同」的前瞻技术路径
- **AI 安全与可控性**：返回数据运行时白名单校验、title/summary 截断、错误不暴露堆栈、Mock 降级明确标注「演示模式」且只回答数据类问题，形成完整兜底机制

**创新点**

- **选题创新**：聚焦农业数据场景，用自然语言降低数据分析门槛，服务真实需求
- **交互创新**：上传即画像、对话即图表，两条数据链路无缝衔接
- **技术方案创新**：原生流式实现 + 端侧数据智能的组合，兼顾工程理解与性能

## 目录结构

```
src/
  main.tsx / App.tsx         # 单页滚动布局编排
  styles/globals.css         # @theme 设计 Token 与全局样式
  types/index.ts             # 共享类型
  api/askApi.ts              # 请求封装（askQuestion / streamQuestion）
  hooks/useChat.ts           # 数据编排入口
  utils/                     # parseCsv / csvInsight / validateAskResponse / calcKpi / normalizeError / mockData / history
  components/                # TopBar / Hero / About / KpiSection / FileUploadPanel / ChatPanel / ChartSection / ...
```

## 安装运行

```bash
npm install
npm run dev        # 开发
npm run build      # 构建（先 tsc --noEmit 再 vite build）
npm run typecheck  # 仅类型检查
```

## 环境变量

复制 `.env.example` 为 `.env`，仅需一个变量：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

前端只读取该变量，**不存储任何 API Key**。后端不可用时自动降级为 Mock：只对产量/趋势类问题出图，知识类问题如实说明服务不可用，界面明确标注「演示模式」。

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | ESLint（含 jsx-a11y） |
| `npm run typecheck` | TypeScript 严格模式检查 |

## Git 提交规范

采用 Conventional Commits：`type(scope): description`，type 取 `feat/fix/refactor/docs/style/test/chore`，subject 小写、不以句号结尾。提交历史分多次提交，体现真实开发过程。

## 第三方资源来源与许可证声明

- [ECharts](https://echarts.apache.org/) — Apache License 2.0
- [echarts-for-react](https://github.com/hustcc/echarts-for-react) — MIT License
- [lucide-react](https://lucide.dev/) — ISC License
- [React](https://react.dev/) — MIT License
- [Tailwind CSS](https://tailwindcss.com/) — MIT License
- 视觉风格参考故宫博物院、荷兰国立博物馆等官网的留白与排版气质，未直接照搬任何开源项目完整页面。

## AI 工具使用声明

本作品 UI 初版由 v0.dev 生成，逻辑部分由 Trae 辅助实现；随后进行了主题化、组件拆分、运行时安全校验与错误处理改造，最终代码由团队成员逐行核对并可在评审中完整解释。

## 原创与参考说明

本项目为原创实现，未直接照搬任何开源项目的完整页面；仅参考通用布局范式、设计 Token 实践与官方文档示例。

## 性能优化说明

- 图表使用 `React.lazy + Suspense` 懒加载，fallback 为骨架占位，不阻塞首屏
- ECharts 按需引入（echarts/core + 必要 chart/component/renderer），不全量打包
- ECharts option 使用 `useMemo` 缓存，依赖 `labels/values/chartType`
- `KpiCard` 使用 `React.memo`，数据画像用 `useMemo` 缓存；避免无差别 memoization
- 对话列表使用稳定 id 作为 key

## Lighthouse 自测说明

使用 Chrome DevTools → Lighthouse 生成报告（Performance / Accessibility / Best Practices / SEO）并截图放入技术文档。建议在 `npm run build && npm run preview` 的产物上测试。

## 隐私声明

本作品不收集用户个人信息，所有对话仅在本地会话中处理；上传的 CSV 文件仅在浏览器本地解析，不上传服务器。

## 提交前安全检查清单

- [ ] `grep -R "sk-" src` 无结果
- [ ] `grep -R "api.deepseek.com" src` 无结果
- [ ] `.env` 未被提交
- [ ] 页面信息区无学校 / 团队 / 成员姓名
- [ ] `npm run build` 通过
- [ ] `tsc --noEmit` 通过
- [ ] 1280 / 768 宽度无布局崩坏
- [ ] 仓库已设为 Public 或已添加评审专用访问权限

## 团队信息

> 以下为示例占位，请替换为真实信息。

| 成员 | 学校 | 分工 |
| --- | --- | --- |
| 张三 | XX 大学 | 前端架构与数据编排 |
| 李四 | XX 大学 | UI 与可访问性 |
| 王五 | XX 大学 | 图表与性能优化 |

- 指导教师：某某老师
