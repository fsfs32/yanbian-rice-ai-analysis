"""LLM 客户端封装。

通过 OpenAI 兼容的 `/chat/completions` 协议访问大模型，支持：
- Function Calling（工具调用）
- 普通调用（一次性返回）与流式调用（逐块返回）
- 超时与有限次数重试
- 异常归一化

默认指向 DeepSeek 端点，可通过 `LLM_BASE_URL` 切换到其它兼容服务，
无需改动业务代码。
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator

import httpx

from ..core.config import settings
from ..core.exceptions import LlmError, LlmTimeoutError


class LlmClient:
    """OpenAI 兼容协议客户端。"""

    def __init__(self) -> None:
        self._base_url = settings.llm_base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }

    def _base_payload(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None,
        temperature: float | None,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            raise LlmError("未配置 LLM_API_KEY：请在后端目录的 .env 文件中填写（参考 .env.example）")
        payload: dict[str, Any] = {
            "model": settings.llm_model,
            "messages": messages,
            "temperature": settings.llm_temperature if temperature is None else temperature,
            "max_tokens": settings.llm_max_tokens,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        return payload

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        """发起一次对话补全，返回原始响应体（含 message / tool_calls）。"""
        payload = self._base_payload(messages, tools, temperature)
        headers = self._headers()

        last_error: Exception | None = None
        for attempt in range(settings.llm_max_retries + 1):
            try:
                return await self._post(payload, headers)
            except (LlmTimeoutError, httpx.HTTPError) as exc:  # noqa: PERF203
                last_error = exc
                if attempt < settings.llm_max_retries:
                    await asyncio.sleep(0.6 * (attempt + 1))
        raise LlmError(f"大模型调用失败：{last_error}") from last_error

    async def _post(self, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            try:
                resp = await client.post(f"{self._base_url}/chat/completions", json=payload, headers=headers)
            except httpx.TimeoutException as exc:
                raise LlmTimeoutError() from exc

        if resp.status_code >= 400:
            raise LlmError(f"LLM 返回错误 {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    # ------------------------------------------------------------------
    # 流式调用
    # ------------------------------------------------------------------
    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式对话。

        逐块产出结构化事件，调用方据此边收边处理：
        - ``{"type": "text", "text": ...}``        正文增量（模型自由文本）
        - ``{"type": "tool_start", "index": i, "id": ..., "name": ...}``  某个工具调用开始
        - ``{"type": "tool_args", "index": i, "chunk": "..."}``          工具参数 JSON 的增量片段
        - ``{"type": "done", "tool_calls": [...]}`` 流结束，附带累积好的完整工具调用

        流式只做一次网络请求，不重试：一旦开始吐字，重试会导致内容重复。
        """
        payload = self._base_payload(messages, tools, temperature)
        payload["stream"] = True
        headers = self._headers()

        # 按 index 累积工具调用（OpenAI 协议里流式 tool_calls 是分片的）
        slots: dict[int, dict[str, str]] = {}
        started: set[int] = set()

        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            try:
                async with client.stream(
                    "POST", f"{self._base_url}/chat/completions", json=payload, headers=headers
                ) as response:
                    if response.status_code >= 400:
                        body = (await response.aread()).decode("utf-8", "ignore")
                        raise LlmError(f"LLM 返回错误 {response.status_code}: {body[:300]}")

                    async for raw_line in response.aiter_lines():
                        line = raw_line.strip()
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue

                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta") or {}

                        text = delta.get("content")
                        if isinstance(text, str) and text:
                            yield {"type": "text", "text": text}

                        for call in delta.get("tool_calls") or []:
                            index = int(call.get("index", 0))
                            slot = slots.setdefault(index, {"id": "", "name": "", "arguments": ""})
                            if call.get("id"):
                                slot["id"] = str(call["id"])
                            function = call.get("function") or {}
                            name_piece = function.get("name")
                            if isinstance(name_piece, str) and name_piece:
                                slot["name"] += name_piece
                            # 名字先到，args 后到；名字一旦确定就通知调用方
                            if index not in started and slot["name"]:
                                started.add(index)
                                yield {
                                    "type": "tool_start",
                                    "index": index,
                                    "id": slot["id"],
                                    "name": slot["name"],
                                }
                            args_piece = function.get("arguments")
                            if isinstance(args_piece, str) and args_piece:
                                slot["arguments"] += args_piece
                                yield {"type": "tool_args", "index": index, "chunk": args_piece}
            except httpx.TimeoutException as exc:
                raise LlmTimeoutError() from exc

        calls = [
            {"id": slot["id"], "type": "function", "function": {"name": slot["name"], "arguments": slot["arguments"]}}
            for _, slot in sorted(slots.items())
            if slot["name"]
        ]
        yield {"type": "done", "tool_calls": calls}
