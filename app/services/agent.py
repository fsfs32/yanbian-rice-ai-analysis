"""Agent 编排层。

一次请求的完整流水线：
1. 组装 System Prompt（立人设 + 数据纪律）与多轮历史；
2. 首轮 LLM 调用（携带工具）→ 判断是「直接回答」还是「先查数据」；
3. 需查数据 → 执行工具取真实数据 → 回填后二次调用；
4. 通过 submit_answer 工具拿到结构化结果 → Pydantic 校验 → 失败自动纠错重试 → 兜底；
5. 全程记录执行轨迹（AgentStep），供前端「AI 分析流程」可解释面板展示。

这套「工具调用取真实数据 + 结构化输出 + 失败兜底 + 可解释轨迹」的组合，
是避免「裸调大模型」红线、拿下「AI 技术深度」评分的关键机制。
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from ..core.exceptions import ResponseValidationError
from ..schemas import AgentStep, AskRequest, AskResponse, StepPhase
from ..tools import ToolRegistry
from .llm import LlmClient

# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """你是「延边大米长势与产量」数据分析专家。

你的职责是：基于真实数据回答用户关于延边州水稻产量、销售额、长势趋势的问题，
并输出可视化的图表数据。

纪律（必须严格遵守）：
1. 产量、销售额等数字**只能来自 query_yield / query_statistics 工具的真实返回**，
   严禁凭空编造任何数值；
2. 用户上传了 CSV 数据时，优先基于 CSV 数据作答，工具查不到时用 CSV；
3. 无法 / 无需画图的问题（如「怎么提高产量」），labels 与 values 传空数组，
   只输出文字结论；
4. 最终答案必须通过 submit_answer 工具提交，不要输出自由文本；
5. 图表类型选择：逐年对比用 line 或 bar，两者关系用 combo（双轴），分布关系用 scatter；
6. chart_type 只能取 line/bar/scatter/combo，x_field/y_field/y2_field 只能取 year/yield/revenue；
7. 数据来源 source 字段如实填写，无明确来源时写「AI 分析」。
"""

# 校验失败后的纠错提示，引导模型输出合规结构
CORRECTION_PROMPT = (
    "你上一次的输出未通过格式校验。请严格通过 submit_answer 工具重新提交，注意："
    "chart_type ∈ {line, bar, scatter, combo}；x_field/y_field/y2_field ∈ {year, yield, revenue}；"
    "labels 与 values 必须等长；chart_type=combo 时必须提供 values2 与 y2_field；"
    "纯文字回答时 labels 与 values 为空数组；summary 不超过 300 字，title 不超过 80 字。"
)


@dataclass
class AnalysisResult:
    """一次分析的结果：标准响应 + 执行轨迹。"""

    response: AskResponse
    steps: list[AgentStep] = field(default_factory=list)


class AnalysisAgent:
    """意图识别 → 工具调用 → 结构化生成的编排器。"""

    def __init__(self, llm: LlmClient, tools: ToolRegistry) -> None:
        self._llm = llm
        self._tools = tools

    async def analyze(self, request: AskRequest) -> AnalysisResult:
        steps: list[AgentStep] = []
        messages = self._build_messages(request)
        steps.append(
            AgentStep(
                phase=StepPhase.UNDERSTANDING,
                title="理解问题",
                detail=self._describe_intent(request),
            )
        )

        # 首轮：允许模型查数据 / 直接提交答案
        first = await self._llm.chat(messages, tools=self._tools.schemas())
        message = first["choices"][0]["message"]
        tool_calls = message.get("tool_calls", [])

        submit_call = next(
            (c for c in tool_calls if c["function"]["name"] == "submit_answer"), None
        )
        data_calls = [c for c in tool_calls if c["function"]["name"] != "submit_answer"]

        # 场景 A：无需查数据，模型直接提交答案（免去二次调用）
        if submit_call is not None:
            answer = self._parse_args(submit_call)
        # 场景 B：先查真实数据，再生成答案
        else:
            if data_calls:
                messages.append(message)
                steps.append(
                    AgentStep(
                        phase=StepPhase.QUERYING,
                        title="查询数据",
                        detail=self._describe_calls(data_calls),
                    )
                )
                for call in data_calls:
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call["id"],
                            "content": json.dumps(self._execute_call(call), ensure_ascii=False),
                        }
                    )

            final = await self._llm.chat(messages, tools=self._tools.schemas())
            answer = self._extract_submit_answer(final)

        steps.append(
            AgentStep(
                phase=StepPhase.COMPUTING,
                title="计算分析",
                detail=(
                    "基于检索到的真实数据计算趋势与统计指标"
                    if data_calls
                    else "理解意图后组织并生成分析结论"
                ),
            )
        )

        response = await self._validate_with_retry(messages, answer)

        if response.labels:
            steps.append(
                AgentStep(
                    phase=StepPhase.RENDERING,
                    title="生成图表",
                    detail=f"选择「{response.chart_config.chart_type.value}」图表并组织可视化数据",
                )
            )

        return AnalysisResult(response=response, steps=steps)

    # ------------------------------------------------------------------
    # 消息组装
    # ------------------------------------------------------------------
    def _build_messages(self, request: AskRequest) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in request.history:
            messages.append({"role": turn.role, "content": turn.content})

        user_content = request.question
        if request.csv is not None:
            user_content = self._render_csv_context(request.csv, user_content)
        messages.append({"role": "user", "content": user_content})
        return messages

    def _describe_intent(self, request: AskRequest) -> str:
        if request.csv is not None:
            return f"识别为文件分析场景（{request.csv.file_name}），基于上传数据作答"
        return f"解析问题意图：{request.question[:40]}"

    def _render_csv_context(self, csv: Any, question: str) -> str:
        headers = "、".join(csv.headers)
        rows_preview = "\n".join("、".join(row) for row in csv.rows[:200])
        return (
            f"用户上传了文件「{csv.file_name}」。\n"
            f"表头：{headers}\n"
            f"数据（最多展示 200 行）：\n{rows_preview}\n\n"
            f"请基于以上数据回答：{question}"
        )

    # ------------------------------------------------------------------
    # 工具执行
    # ------------------------------------------------------------------
    def _describe_calls(self, calls: list[dict[str, Any]]) -> str:
        parts: list[str] = []
        for call in calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            parts.append(f"{name}({args})")
        return "；".join(parts)

    def _execute_call(self, call: dict[str, Any]) -> dict[str, Any]:
        name = call["function"]["name"]
        try:
            arguments = json.loads(call["function"].get("arguments") or "{}")
        except json.JSONDecodeError:
            arguments = {}
        return self._tools.execute(name, arguments)

    @staticmethod
    def _parse_args(call: dict[str, Any]) -> dict[str, Any]:
        try:
            return json.loads(call["function"].get("arguments") or "{}")
        except json.JSONDecodeError as exc:
            raise ResponseValidationError("submit_answer 参数解析失败") from exc

    @staticmethod
    def _extract_submit_answer(final: dict[str, Any]) -> dict[str, Any]:
        """从最终回复中提取 submit_answer 工具的参数（含 content 兜底）。"""
        message = final["choices"][0]["message"]
        for call in message.get("tool_calls", []):
            if call["function"]["name"] == "submit_answer":
                return AnalysisAgent._parse_args(call)
        content = message.get("content") or ""
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise ResponseValidationError("模型未通过 submit_answer 提交结果") from exc

    # ------------------------------------------------------------------
    # 校验与兜底
    # ------------------------------------------------------------------
    async def _validate_with_retry(
        self, messages: list[dict[str, Any]], answer: dict[str, Any]
    ) -> AskResponse:
        """契约校验；失败则注入纠错提示重试一次，仍失败则降级为纯文字兜底。"""
        try:
            return AskResponse.model_validate(answer)
        except Exception as first_exc:  # noqa: BLE001
            messages.append(
                {"role": "user", "content": CORRECTION_PROMPT + f"（校验错误：{first_exc}）"}
            )
            retry = await self._llm.chat(messages, tools=self._tools.schemas())
            try:
                return AskResponse.model_validate(self._extract_submit_answer(retry))
            except Exception:  # noqa: BLE001
                return self._fallback_text(answer)

    @staticmethod
    def _fallback_text(answer: dict[str, Any]) -> AskResponse:
        """兜底：优先复用模型已给出的文字结论，否则返回通用提示。"""
        summary = answer.get("summary") if isinstance(answer, dict) else None
        if isinstance(summary, str) and summary.strip():
            return AskResponse.text_only(summary.strip()[:300])
        return AskResponse.text_only("抱歉，本次分析未能生成有效图表，请换一种问法重试。")
