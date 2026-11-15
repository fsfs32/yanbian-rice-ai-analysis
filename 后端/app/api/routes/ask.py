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
from ...schemas import AskRequest, TranslateRequest, TranslateResponse
from ...services.agent import AnalysisAgent
from ...services.data_source import InMemoryRiceDataSource
from ...services.llm import LlmClient
from ...services.rag import KNOWLEDGE_DOCUMENTS, RagRetriever
from ...tools import build_tool_registry

router = APIRouter(prefix="/api", tags=["ask"])

# 进程级单例（真实环境可注入依赖容器 / 连接池）
_data_source = InMemoryRiceDataSource()
_retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
_tools = build_tool_registry(_data_source, _retriever)
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
    """生成 SSE 事件流：执行轨迹 → 正文增量 → 最终结构化结果。"""
    try:
        async for event in _agent.analyze_stream(request):
            event_type = event.get("type")
            if event_type == "step":
                step = event["step"]
                yield f"data: {json.dumps({'step': step.model_dump()}, ensure_ascii=False)}\n\n"
            elif event_type == "delta":
                yield f"data: {json.dumps({'delta': event['text']}, ensure_ascii=False)}\n\n"
            elif event_type == "result":
                payload = event["response"].model_dump(exclude_none=True)
                usage = event.get("usage") or {}
                if usage.get("total_tokens"):
                    # 单价按 DeepSeek 公开定价折算，仅作量级参考
                    cost = (usage.get("prompt_tokens", 0) * 2 + usage.get("completion_tokens", 0) * 8) / 1_000_000
                    payload["usage"] = {**usage, "estimated_cost_cny": round(cost, 5)}
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    except AppError as exc:
        # 业务错误（如未配置 API Key）：把具体原因透传给前端
        yield f"data: {json.dumps({'delta': exc.message}, ensure_ascii=False)}\n\n"
    except Exception:  # noqa: BLE001
        # 流式场景无法再返回错误状态码，降级为一条文本提示
        yield f"data: {json.dumps({'delta': '抱歉，AI 分析暂时不可用，请稍后重试。'}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"


# ----------------------------------------------------------------------
# 翻译：切换语言时把已有回答翻成目标语言
# ----------------------------------------------------------------------
_TRANSLATE_PROMPT = {
    "zh": "把下面的内容翻译成中文。只输出译文，不要解释，不要加引号。",
    "en": (
        "Translate the following into English. Convert 「万吨」into plain tonnes by multiplying "
        "by 10,000 (21.85 万吨 → 218,500 tonnes). Output only the translation."
    ),
    "ko": "다음 내용을 한국어로 번역하십시오. 번역문만 출력하고 설명은 붙이지 마십시오.",
}


@router.post("/translate", response_model=TranslateResponse)
async def translate(request: TranslateRequest) -> TranslateResponse:
    """把一段已生成的回答翻译成目标语言。

    与 /api/ask 的区别：这里不查数据、不调工具，只做一次纯文本翻译，
    因此成本与延迟都远低于重新作答。
    """
    target = request.target
    # 源语言与目标语言一致时直接返回，省一次调用
    system_prompt = _TRANSLATE_PROMPT.get(target, _TRANSLATE_PROMPT["en"])

    messages = [
        {
            "role": "system",
            "content": (
                system_prompt
                + " 保留原文中的百分比与年份；单位按目标语言习惯处理（英文换算成吨，朝鲜语用「만 톤」）。"
                + " 保留原有的段落与序号结构。"
            )
        },
        {"role": "user", "content": request.text},
    ]

    try:
        response = await _llm.chat(messages, temperature=0.1)
        translated = (response["choices"][0]["message"].get("content") or "").strip()
    except AppError:
        # 翻译失败不阻断：前端保留原文即可
        return TranslateResponse(text=request.text, target=target, translated=False)
    except Exception:  # noqa: BLE001
        return TranslateResponse(text=request.text, target=target, translated=False)

    if not translated:
        return TranslateResponse(text=request.text, target=target, translated=False)
    return TranslateResponse(text=translated, target=target, translated=True)
