# 延边大米 · AI 数据分析服务（后端）

> 前端「延边大米长势与产量 AI 数据分析可视化平台」的后端接入层。
> 对外只暴露一个接口 `POST /api/ask`，承载普通问答、CSV 文件分析与流式输出。

## 技术栈

| 层 | 技术 |
|---|---|
| Web 框架 | FastAPI + Uvicorn |
| 数据校验 | Pydantic v2 + pydantic-settings |
| 大模型 | httpx 直连 OpenAI 兼容协议（默认 DeepSeek） |
| 输出方式 | JSON / SSE（`text/event-stream`） |

## 目录结构

```
app/
├── main.py                 # 入口：装配路由、CORS、中间件、异常处理
├── schemas.py              # Pydantic 模型（契约唯一权威定义）
├── tools.py                # Function Calling 工具注册表
├── core/
│   ├── config.py           # 配置（环境变量，DeepSeek 默认）
│   ├── exceptions.py       # 统一异常与错误码
│   ├── logging.py          # 结构化日志（JSON 行）
│   └── middleware.py       # 请求上下文中间件（request_id + 访问日志）
├── services/
│   ├── data_source.py      # 数据源抽象 + 内置示例实现
│   ├── llm.py              # LLM 客户端（工具调用 / 重试 / 超时）
│   └── agent.py            # Agent 编排（意图 → 工具 → 结构化生成 + 兜底）
└── api/routes/ask.py       # POST /api/ask（JSON / SSE）
```

## 快速启动

```bash
cd 后端
python -m venv .venv

# Windows（PowerShell）
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
Copy-Item .env.example .env   # 编辑 .env，填入 LLM_API_KEY

uvicorn app.main:app --reload --port 8000
```

- 健康检查：http://127.0.0.1:8000/health
- 接口文档：http://127.0.0.1:8000/docs

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI 兼容端点 |
| `LLM_API_KEY` | 空 | 必须填入真实 Key（严禁硬编码 / 入库） |
| `LLM_MODEL` | `deepseek-chat` | 模型名 |
| `LLM_TEMPERATURE` | `0.2` | 采样温度 |
| `LLM_TIMEOUT_SECONDS` | `20` | 单次调用超时 |
| `LLM_MAX_RETRIES` | `2` | 失败重试次数 |
| `CORS_ORIGINS` | 本地 5173 两个来源 | 放行的前端来源 |

## 核心设计（对应「AI 技术深度」评分）

1. **不裸调大模型**：真实数字来自工具对数据源的查询，LLM 只负责组织结论。
2. **Function Calling 结构化输出**：通过 `submit_answer` 工具强制返回标准 `AskResponse`。
3. **可替换数据源**：`DataSource` 抽象基类 + 内置示例实现，接入真实数据库/统计局 API 无需改工具层。
4. **返回前校验 + 失败兜底**：Pydantic 校验白名单与等长约束，失败自动纠错重试，仍失败降级为纯文字回答。
5. **可解释执行轨迹**：SSE 下发 `step` 事件（`AgentStep`），驱动前端「AI 分析流程」面板展示真实推理步骤。

## 测试

```bash
pip install -r requirements-dev.txt
pytest
```

## 联调自检

```bash
curl -X POST http://127.0.0.1:8000/api/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"延边 2001 年产量怎么样？\"}"

curl -N -X POST http://127.0.0.1:8000/api/ask \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d "{\"question\":\"延边 1994 到 2016 年产量趋势？\"}"
```
