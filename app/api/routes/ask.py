"""唯一对外接口：POST /api/ask。

支持两种响应方式（依据请求头 Accept 自动协商）：
- `text/event-stream` → SSE 流式（先发 step 执行轨迹，再发 summary 增量，最后完整 AskResponse + [DONE]）
- 其它 → 普通 JSON

两种方式返回的数据结构一致，均为标准 `AskResponse`。
"""
from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ...core.exceptions import AppError
from ...schemas import AskRequest
from ...services.agent import AnalysisAgent
from ...services.data_source import InMemoryRiceDataSource
from ...services.llm import LlmClient
from ...tools import build_tool_registry

router = APIRouter(prefix="/api", tags=["ask"])

# 进程级单例（真实环境可注入依赖容器 / 连接池）
_data_source = InMemoryRiceDataSource()
_tools = build_tool_registry(_data_source)
_llm = LlmClient()
_agent = AnalysisAgent(_llm, _tools)


@router.post("/ask", response_model=None)
async def ask(request: AskRequest, raw: Request) -> JSONResponse | StreamingResponse:
    """核心接口：普通问答 / CSV 文件分析 / 流式输出三合一。"""
    accept = raw.headers.get("accept", "")

    if "text/event-stream" in accept:
        return StreamingResponse(
            _stream(request),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    result = await _agent.analyze(request)
    return JSONResponse(content=result.response.model_dump(exclude_none=True))


async def _stream(request: AskRequest) -> AsyncIterator[str]:
    """生成 SSE 事件流。"""
    try:
        result = await _agent.analyze(request)
    except AppError as exc:
        # 业务错误（如未配置 API Key）：把具体原因透传给前端
        yield f"data: {json.dumps({'delta': exc.message}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
        return
    except Exception:  # noqa: BLE001
        # 流式场景无法再返回错误状态码，降级为一条文本提示
        yield f"data: {json.dumps({'delta': '抱歉，AI 分析暂时不可用，请稍后重试。'}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
        return

    # 1) 执行轨迹（驱动前端「AI 分析流程」五步状态条与可解释面板）
    for step in result.steps:
        event = {"step": step.model_dump()}
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    payload = result.response.model_dump(exclude_none=True)

    # 2) 流式发送 summary 文本增量
    summary: str = payload["summary"]
    chunk = 24
    for i in range(0, len(summary), chunk):
        yield f"data: {json.dumps({'delta': summary[i : i + chunk]}, ensure_ascii=False)}\n\n"

    # 3) 完整 AskResponse（前端据此落地图表）
    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    # 4) 结束标记
    yield "data: [DONE]\n\n"
