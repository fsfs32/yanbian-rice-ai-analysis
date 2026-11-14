# 延边大米 · 长势与产量 AI 数据分析平台

> 全国高校 AI Web 开发挑战赛参赛作品 —— 基于**大模型 Agent + RAG + Function Calling** 的自然语言农业数据分析平台。
> 面向「AI 数据分析与可视化」方向：用户用中文提问，即可自动查询真实统计数据、生成趋势图表与关键指标，并支持上传 CSV 让 AI 解读任意数据。

---

## 项目简介

平台以延边州稻谷产量 / 产值数据为核心场景，构建了一个 **AI 原生（AI Native）** 的数据问答应用：

- 用自然语言提问（如「画出 2016—2025 年产量趋势」「哪一年产量最高」），系统自动识别意图、调用工具查询真实数据，并以图表 + 指标卡 + 文字结论的形式回答。
- 内置延边水稻**专业知识库（RAG）**，可回答产量之外的栽培、病虫害、施肥、补贴政策等专业问题。
- 支持上传 CSV，AI 自动完成数据清洗、统计与可视化解读。
- 全程**流式输出（SSE）**，并可视化展示 AI 的推理执行轨迹（可解释性）。

数据口径：稻谷产量单位「万吨」（来源：延边州历年《国民经济和社会发展统计公报》）；产值 = 产量 × 粳稻均价约 2.6 元/公斤（估算）。

---

## 技术架构

| 层 | 技术栈 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + ECharts（echarts-for-react） |
| 后端 | FastAPI + Uvicorn + Pydantic v2 |
| 大模型 | httpx 直连 OpenAI 兼容协议（默认 DeepSeek），Function Calling / 工具调用 |
| Agent | 意图识别 → 工具调用取真实数据 → 结构化输出 → 校验纠错 → 纯文字兜底 |
| RAG | BM25 稀疏检索（纯标准库，中文单字 + 双字 bigram 分词）+ 延边水稻专业知识库 |
| 输出 | SSE（Server-Sent Events）流式返回 `step / done / error` 事件 |

**核心链路**：前端 `POST /api/ask` → 后端 Agent 编排 → 工具查询 `DataSource` 真实数据 / `search_knowledge` RAG 检索 → LLM 通过 `submit_answer` 结构化输出 → Pydantic 校验（失败纠错重试）→ SSE 流式回传 → 前端渲染图表与指标。

---

## 目录结构（Monorepo）

```
比赛项目/
├── 前端/                    # React + TS 前端应用
│   ├── src/
│   │   ├── components/      # 消息气泡、输入栏、图表卡、KPI 卡、数据表、推理轨迹面板
│   │   ├── hooks/           # useChat 流式问答状态机
│   │   ├── utils/           # KPI 计算、CSV 解析、响应校验、mock 降级数据
│   │   └── types.ts         # 前端类型定义
│   └── package.json
├── 后端/                    # FastAPI 后端服务
│   ├── app/
│   │   ├── api/routes/      # POST /api/ask（JSON / SSE）
│   │   ├── core/            # 配置、异常、日志、中间件
│   │   ├── services/        # data_source、llm、agent、rag/
│   │   ├── schemas.py       # 接口契约（Pydantic 唯一权威定义）
│   │   └── tools.py         # Function Calling 工具注册表
│   ├── tests/               # 契约、工具、Agent 单元测试
│   └── requirements.txt
└── README.md
```

---

## 快速启动

> 需要先启动后端，再启动前端（前端请求 `http://127.0.0.1:8000/api/ask`）。

### 1. 启动后端

```bash
cd 后端

# 安装依赖（推荐使用虚拟环境）
python -m venv .venv
# Windows（PowerShell）
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt

# 配置环境变量（复制模板并填入真实 LLM_API_KEY）
Copy-Item .env.example .env   # 然后编辑 .env

# 启动服务
uvicorn app.main:app --port 8000
```

- 健康检查：http://127.0.0.1:8000/health
- 接口文档：http://127.0.0.1:8000/docs

### 2. 启动前端

```bash
cd 前端
npm install
npm run dev
```

浏览器打开 Vite 输出的地址（默认 http://localhost:5173）。

---

## 环境变量（后端）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI 兼容端点 |
| `LLM_API_KEY` | 空 | **必须填入真实 Key**（严禁硬编码 / 提交入库） |
| `LLM_MODEL` | `deepseek-chat` | 模型名 |
| `LLM_TEMPERATURE` | `0.2` | 采样温度 |
| `LLM_TIMEOUT_SECONDS` | `20` | 单次调用超时 |
| `LLM_MAX_RETRIES` | `2` | 失败重试次数 |
| `CORS_ORIGINS` | 本地 5173 两个来源 | 放行的前端来源 |

> `.env` 已被 `.gitignore` 排除，仓库中只保留 `.env.example` 模板，符合「敏感信息不得入库」的提交规范。

---

## 核心设计（对应「AI 技术深度」评分）

1. **不裸调大模型**：真实数字来自工具对数据源的查询，LLM 只负责组织结论，杜绝编造数据。
2. **Function Calling 结构化输出**：通过 `submit_answer` 工具强制返回标准 `AskResponse` 契约。
3. **可替换数据源**：`DataSource` 抽象基类 + 内置实现，接入真实数据库 / 统计局 API 无需改动工具层。
4. **返回前校验 + 失败兜底**：Pydantic 校验白名单与等长约束，失败自动纠错重试，仍失败降级为纯文字回答，避免请求 500。
5. **可解释执行轨迹**：SSE 下发 `step` 事件（`AgentStep`），驱动前端「AI 分析流程」面板展示真实推理步骤。
6. **RAG 检索增强**：内置延边水稻专业知识库（栽培技术、病虫害防治、施肥、稻谷补贴政策），Agent 通过 `search_knowledge` 工具按 BM25 检索并标注来源。

---

## 团队信息

| 项 | 内容 |
|---|---|
| 学校 | _[待填]_ |
| 队名 | _[待填]_ |
| 成员 | _[待填]_ |
| 指导老师 | _[待填]_ |

---

## 许可

本作品为竞赛参赛项目，代码仅供评审与学习交流使用。
