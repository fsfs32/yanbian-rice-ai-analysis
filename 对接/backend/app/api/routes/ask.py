"""唯一对外接口：POST /api/ask。

支持两种响应方式（依据请求头 Accept 自动协商）：
- `text/event-stream` → SSE 流式（先发若干 delta 增量，再发完整 AskResponse，最后 [DONE]）
- 其它 → 普通 JSON

两种方式返回的数据结构一致，均为标准 `AskResponse`。
"""
from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ...schemas import AskRequest
from ...services.agent import AnalysisAgent
from ...services.llm import LlmClient
from ...tools import build_tool_registry

router = APIRouter(prefix="/api", tags=["ask"])

# 进程级单例（真实环境可注入依赖容器 / 连接池）
_tools = build_tool_registry()
_llm = LlmClient()
_agent = AnalysisAgent(_llm, _tools)


@router.post("/ask")
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
    return JSONResponse(content=result.model_dump(exclude_none=True))


async def _stream(request: AskRequest) -> AsyncIterator[str]:
    """生成 SSE 事件流。"""
    try:
        result = await _agent.analyze(request)
    except Exception:  # noqa: BLE001
        # 流式场景无法再返回错误状态码，降级为一条文本提示
        payload = {"delta": "抱歉，AI 分析暂时不可用，请稍后重试。"}
        yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
        return

    payload = result.model_dump(exclude_none=True)

    # 1) 先流式发送 summary 文本增量
    summary: str = payload["summary"]
    chunk = 24
    for i in range(0, len(summary), chunk):
        delta = summary[i : i + chunk]
        yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"

    # 2) 再发送完整 AskResponse（前端据此落地图表）
    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    # 3) 结束标记
    yield "data: [DONE]\n\n"
