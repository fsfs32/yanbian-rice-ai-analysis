"""Agent 编排层。

一次请求的完整流水线：
1. 组装 System Prompt（立人设 + 数据纪律）与多轮历史；
2. 首轮 LLM 调用（携带工具）→ 判断是否需要查数据；
3. 若有工具调用 → 执行工具取真实数据 → 回填后二次调用；
4. 通过 `submit_answer` 工具拿到结构化结果 → Pydantic 校验 → 返回 AskResponse。

这套「工具调用取真实数据 + 结构化输出」的组合，就是本项目避免
「裸调大模型」这一红线的核心机制。
"""
from __future__ import annotations

import json
from typing import Any

from ..core.exceptions import ResponseValidationError
from ..schemas import AskRequest, AskResponse
from ..tools import ToolRegistry
from .llm import LlmClient

# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """你是「延边大米长势与产量」数据分析专家。

你的职责是：基于数据回答用户关于延边州水稻产量、销售额、长势趋势的问题，
并输出可视化的图表数据。

纪律（必须严格遵守）：
1. 产量、销售额等数字**只能来自 query_yield / query_statistics 工具的真实返回**，
   严禁凭空编造任何数值；
2. 如果用户上传了 CSV 数据，优先基于 CSV 数据作答，工具查不到时用 CSV；
3. 无法 / 无需画图的问题（如「怎么提高产量」），labels 与 values 传空数组，
   只输出文字结论；
4. 最终答案必须通过 submit_answer 工具提交，不要输出自由文本；
5. 图表类型选择：逐年对比用 bar 或 line，两者关系用 combo（双轴），
   分布关系用 scatter。
"""


class AnalysisAgent:
    """意图识别 → 工具调用 → 结构化生成的编排器。"""

    def __init__(self, llm: LlmClient, tools: ToolRegistry) -> None:
        self._llm = llm
        self._tools = tools

    async def analyze(self, request: AskRequest) -> AskResponse:
        # 1. 组装消息
        messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in request.history:
            messages.append({"role": turn.role, "content": turn.content})

        # CSV 场景：把结构化数据拼进用户消息，作为分析依据
        user_content = request.question
        if request.csv is not None:
            user_content = self._render_csv_context(request.csv, user_content)
        messages.append({"role": "user", "content": user_content})

        # 2. 首轮：允许模型查数据
        first = await self._llm.chat(messages, tools=self._tools.schemas())
        tool_calls = first["choices"][0]["message"].get("tool_calls", [])

        # 3. 执行工具并把结果回填（最多一轮，防止死循环）
        if tool_calls:
            messages.append(first["choices"][0]["message"])
            for call in tool_calls:
                result = self._execute_call(call)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )

        # 4. 最终轮：拿到结构化答案
        final = await self._llm.chat(messages, tools=self._tools.schemas())
        answer_args = self._extract_submit_answer(final)

        # 5. 契约校验
        try:
            return AskResponse.model_validate(answer_args)
        except Exception as exc:  # noqa: BLE001
            raise ResponseValidationError(f"模型输出未通过契约校验：{exc}") from exc

    # ------------------------------------------------------------------
    def _render_csv_context(self, csv: Any, question: str) -> str:
        headers = "、".join(csv.headers)
        rows_preview = "\n".join(
            "、".join(row) for row in csv.rows[:200]
        )
        return (
            f"用户上传了文件「{csv.file_name}」。\n"
            f"表头：{headers}\n"
            f"数据（最多展示 200 行）：\n{rows_preview}\n\n"
            f"请基于以上数据回答：{question}"
        )

    def _execute_call(self, call: dict[str, Any]) -> dict[str, Any]:
        name = call["function"]["name"]
        try:
            arguments = json.loads(call["function"].get("arguments") or "{}")
        except json.JSONDecodeError:
            arguments = {}
        return self._tools.execute(name, arguments)

    @staticmethod
    def _extract_submit_answer(final: dict[str, Any]) -> dict[str, Any]:
        """从最终回复中提取 submit_answer 工具的参数。"""
        message = final["choices"][0]["message"]
        tool_calls = message.get("tool_calls", [])
        for call in tool_calls:
            if call["function"]["name"] == "submit_answer":
                try:
                    return json.loads(call["function"].get("arguments") or "{}")
                except json.JSONDecodeError as exc:
                    raise ResponseValidationError("submit_answer 参数解析失败") from exc
        # 兜底：个别模型会把结构化结果直接放在 content 里
        content = message.get("content") or ""
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise ResponseValidationError("模型未通过 submit_answer 提交结果") from exc
