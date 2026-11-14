"""LLM 客户端封装。

通过 OpenAI 兼容的 `/chat/completions` 协议访问大模型，支持：
- Function Calling（工具调用）
- 超时与有限次数重试
- 异常归一化

默认指向 DeepSeek 端点，可通过 `LLM_BASE_URL` 切换到其它兼容服务，
无需改动业务代码。
"""
from __future__ import annotations

import asyncio
from typing import Any

import httpx

from ..core.config import settings
from ..core.exceptions import LlmError, LlmTimeoutError


class LlmClient:
    """OpenAI 兼容协议客户端。"""

    def __init__(self) -> None:
        self._base_url = settings.llm_base_url.rstrip("/")

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        """发起一次对话补全，返回原始响应体（含 message / tool_calls）。"""
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

        headers = {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }

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
