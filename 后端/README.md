# 延边大米 · AI 数据分析服务（后端）

> 前端「延边大米长势与产量 AI 数据分析平台」的接入层。
> 对外只暴露一个接口 `POST /api/ask`，承载普通问答、CSV 文件分析与流式输出。

## 接口

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/ask` |
| 请求 | `{ question, history?, session_id?, csv? }`；`question` ≤500 字，`history` 最多 6 轮 |
| 响应 | 标准 `AskResponse`：`chart_config / labels / values / values2? / summary / source / followups / demo` |
| 响应方式 | `Accept: text/event-stream` 走 SSE，否则返回 JSON |
| 错误 | 统一 `{ error: { code, message } }`；422 参数不合法、502 模型不可用、504 超时、500 内部错误 |

SSE 事件序列：

```
step    → 执行轨迹（understanding / querying / computing / rendering）
delta   → 正文增量（模型边生成边下发）
result  → 完整 AskResponse（含 usage，用于成本观测）
[DONE]  → 结束
```

## 技术栈

| 层 | 技术 |
|---|---|
| Web 框架 | FastAPI + Uvicorn |
| 数据校验 | Pydantic v2 + pydantic-settings |
| 大模型 | httpx 直连 OpenAI 兼容协议（默认 DeepSeek） |
| RAG 检索 | BM25 稀疏检索（纯标准库，零依赖）+ 13 篇知识库 |
| 工具协议 | Function Calling + 独立 MCP Server（stdio / JSON-RPC 2.0） |
| 输出方式 | JSON / SSE（`text/event-stream`） |

## 目录结构

```
后端/
├── app/
│   ├── main.py              # 装配：CORS、中间件、异常处理、路由
│   ├── schemas.py           # 数据契约（前后端唯一权威定义）
│   ├── tools.py             # Function Calling 工具注册表（5 个工具）
│   ├── api/routes/ask.py    # POST /api/ask（JSON / SSE）
│   ├── core/                # 配置、异常与错误码、日志、请求上下文
│   └── services/
│       ├── agent.py         # Agent 编排：多轮工具调用 + 校验 + 兜底
│       ├── demo.py          # 演示模式应答器（无密钥时的本地作答）
│       ├── llm.py           # 模型客户端（工具调用 / 流式 / 超时 / 重试）
│       ├── data_source.py   # 数据源抽象 + 内置实现（2016–2025 + 八市州）
│       ├── stream_extract.py# 从流式 JSON 中增量抠出 summary
│       └── rag/             # BM25 检索器 + 知识库
├── mcp_server.py            # MCP Server：同一批工具的 stdio 入口
├── tests/                   # 48 项测试（Agent / 工具 / RAG / Schema / 安全 / 演示 / MCP）
├── tools/                   # rag_eval.py（检索评测）、stream_check.py（流式实测）
├── .env.example
└── requirements.txt
```

## 快速启动

```bash
cd 后端
python -m venv .venv
.venv\Scripts\activate                 # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
Copy-Item .env.example .env            # 填 LLM_API_KEY 即接入真实模型

uvicorn app.main:app --reload --port 8000
```

- 健康检查：<http://127.0.0.1:8000/health>（返回 `model` 与 `demo` 标记）
- 接口文档：<http://127.0.0.1:8000/docs>

## 演示模式

`.env` 里 `LLM_API_KEY` 留空时，`DemoAnswerer` 接管请求，**不调用大模型**：

| 问题类型 | 处理方式 |
|---|---|
| 产量趋势 / 极值 / 均值 / 波动 / 市州对比 / 产值口径 | 查内置数据源，按真实数值组图表与结论 |
| 病虫害 / 栽培 / 施肥 / 农时 / 政策 | BM25 检索知识库，按原文摘录作答并标来源 |
| 寒暄 / 范围外问题 | 说明能力边界，给出可问方向 |

这样做的原因：早期版本在无密钥时统一返回一张产量趋势图，导致「问稻瘟病答产量趋势」。演示模式必须保证**回答与问题对应**，同时响应里带 `demo: true`，前端据此标注「演示模式」。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI 兼容端点 |
| `LLM_API_KEY` | 空 | 留空即演示模式；严禁硬编码或入库 |
| `LLM_MODEL` | `deepseek-chat` | 模型名 |
| `LLM_TEMPERATURE` | `0.2` | 采样温度 |
| `LLM_MAX_TOKENS` | `2048` | 单次回答上限 |
| `LLM_TIMEOUT_SECONDS` | `20` | 单次调用超时 |
| `LLM_MAX_RETRIES` | `2` | 失败重试次数 |
| `CORS_ORIGINS` | 本地 5173 | 放行的前端来源（线上演示改成实际域名） |

## 核心设计

1. **不裸调大模型**：真实数字只来自工具对数据源的查询，模型负责组织结论；回答中的吨位数字再做一次核对，必须能追溯到工具返回。
2. **结构化输出**：模型必须通过 `submit_answer` 提交，字段与枚举受 Pydantic 白名单约束；校验失败自动纠错重试，仍失败降级为纯文字。
3. **多轮工具调用**：允许「先查产量、再查知识库」这类组合，最多 3 轮，防止无限循环。
4. **可替换数据源**：`DataSource` 抽象基类 + 内置实现，接入真实数据库 / 统计局 API 无需改工具层。
5. **可解释轨迹**：每步下发 `AgentStep`，包含工具名与真实参数。
6. **安全**：CSV 内容按「数据区/指令区」隔离防注入；入参限长；错误不泄露堆栈。

## MCP Server

`mcp_server.py` 用纯标准库实现 MCP over stdio（每行一条 JSON-RPC 消息），暴露 `query_yield` / `query_statistics` / `query_cities` / `search_knowledge`：

```bash
# 手工验证
echo {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}} | .venv\Scripts\python.exe mcp_server.py

# 在 Claude Desktop 的配置里加入
"yanbian-rice": {
  "command": "C:/path/to/后端/.venv/Scripts/python.exe",
  "args": ["C:/path/to/后端/mcp_server.py"]
}
```

## 测试与自检

```bash
pip install -r requirements-dev.txt
pytest                                   # 48 项：Agent / 工具 / RAG / Schema / 安全 / 演示 / MCP

.venv\Scripts\python.exe tools/rag_eval.py     # 检索评测：Recall@1、Recall@3、改写对照
.venv\Scripts\python.exe tools/stream_check.py # 流式实测（需后端已启动）
```

当前基线：`pytest` 48 passed；`rag_eval` Recall@1 = 30/30、Recall@3 = 30/30；关闭查询改写后 Recall@1 下降 6.7 个百分点。

## 联调示例

```bash
# 普通 JSON
curl -X POST http://127.0.0.1:8000/api/ask ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"2016 到 2025 年产量趋势\"}"

# 流式
curl -N -X POST http://127.0.0.1:8000/api/ask ^
  -H "Content-Type: application/json" ^
  -H "Accept: text/event-stream" ^
  -d "{\"question\":\"稻瘟病怎么防治\"}"
```

（macOS / Linux 把 `^` 换成 `\` 续行即可。）
