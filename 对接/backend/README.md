# 后端骨架运行与改造说明

> 本目录是「延边大米 AI 数据分析服务」的 **FastAPI 后端骨架**。
> 架构已按企业级分层搭好，你只需补上大模型 API Key，并按需替换数据源，
> 即可与前端完成联调。

---

## 一、技术栈

| 层 | 技术 |
|---|---|
| Web 框架 | FastAPI + Uvicorn |
| 数据校验 | Pydantic v2 + pydantic-settings |
| 大模型 | httpx 直连 OpenAI 兼容协议（可接 DeepSeek / Moonshot / 通义） |
| 输出方式 | JSON / SSE（`text/event-stream`） |

---

## 二、目录结构

```
backend/
├── app/
│   ├── main.py              # 入口：装配路由、CORS、异常处理
│   ├── schemas.py           # Pydantic 模型（请求/响应/SSE），契约唯一权威定义
│   ├── tools.py             # Function Calling 工具 + 数据源
│   ├── core/
│   │   ├── config.py        # 配置（环境变量）
│   │   └── exceptions.py    # 统一异常与错误码
│   ├── services/
│   │   ├── llm.py           # LLM 客户端（工具调用 / 重试 / 超时）
│   │   └── agent.py         # Agent 编排（意图→工具→结构化生成）
│   └── api/
│       └── routes/
│           └── ask.py       # POST /api/ask（JSON / SSE）
├── requirements.txt
├── .env.example
└── README.md
```

---

## 三、快速启动

### 1. 创建虚拟环境并安装依赖

```bash
cd backend
python -m venv .venv

# Windows（PowerShell）
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# Windows（PowerShell）
Copy-Item .env.example .env

# 编辑 .env，填入 LLM_API_KEY 与 LLM_MODEL
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

启动后访问：

- 健康检查：http://127.0.0.1:8000/health
- 接口文档：http://127.0.0.1:8000/docs（FastAPI 自动生成，可直接在页面里调试接口）

---

## 四、改造清单（正式上线前必做）

| 优先级 | 事项 | 位置 |
|---|---|---|
| P0 | 填入真实 `LLM_API_KEY` | `.env` |
| P0 | 替换内置示例数据源为真实数据库 / 统计局 API | `app/tools.py` 的 `_RICE_DATASET` 与查询函数 |
| P1 | 关闭 `DEBUG`（`APP_ENV=production`） | `.env` |
| P1 | 收紧 `CORS_ORIGINS` 为正式域名 | `.env` |
| P2 | 增加日志、限流、鉴权 | `main.py` / 中间件 |

---

## 五、验证（联调自检）

```bash
# 普通 JSON 请求
curl -X POST http://127.0.0.1:8000/api/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"延边 2001 年产量怎么样？\"}"

# SSE 流式请求
curl -N -X POST http://127.0.0.1:8000/api/ask \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d "{\"question\":\"延边 1994 到 2016 年产量趋势？\"}"
```

返回体应包含 `chart_config` + `labels` + `values` + `summary`，
且 `labels.length === values.length`、枚举取值在白名单内。
