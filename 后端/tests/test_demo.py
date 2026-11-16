"""演示模式（未配置 LLM_API_KEY）应答测试。

核心断言：问题与回答必须对得上——不能再用一张固定的产量趋势图回答病虫害问题。
"""
from __future__ import annotations

import asyncio

from app.schemas import AskRequest
from app.services.agent import AnalysisAgent
from app.services.data_source import InMemoryRiceDataSource
from app.services.demo import DemoAnswerer
from app.services.rag import KNOWLEDGE_DOCUMENTS, RagRetriever
from app.tools import build_tool_registry


class _NoLlm:
    """演示模式下不允许触碰大模型，被调用即失败。"""

    async def chat(self, *args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("演示模式不应调用大模型")


def _agent() -> AnalysisAgent:
    data = InMemoryRiceDataSource()
    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    return AnalysisAgent(
        _NoLlm(),  # type: ignore[arg-type]
        build_tool_registry(data, retriever),
        demo=DemoAnswerer(data, retriever),
    )


def _answer(question: str):
    return asyncio.run(_agent().analyze(AskRequest(question=question)))


def test_knowledge_question_gets_knowledge_answer() -> None:
    result = _answer("稻瘟病怎么防治?")

    assert result.response.demo is True
    assert result.response.labels == []  # 知识问答不出图
    assert "稻瘟病" in result.response.summary
    assert "施药" in result.response.summary
    assert "病虫害" in (result.response.source or "")
    # 绝不能把产量趋势当成答案
    assert "倒 U 型" not in result.response.summary
    assert "万吨" not in result.response.summary


def test_trend_question_returns_chart_from_builtin_data() -> None:
    result = _answer("2016 到 2025 年产量趋势")

    assert result.response.labels == [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
    assert len(result.response.values) == 10
    assert max(result.response.values) == 25.22
    assert "25.22" in result.response.summary
    assert result.response.chart_config.chart_type.value in {"combo", "line", "bar"}


def test_city_question_uses_city_axis() -> None:
    result = _answer("各市州产量对比")

    assert result.response.chart_config.x_field.value == "city"
    assert "延边州" in result.response.labels
    assert len(result.response.labels) == 8
    assert "白城" in result.response.summary


def test_greeting_gets_text_only() -> None:
    result = _answer("你好")

    assert result.response.labels == []
    assert "助手" in result.response.summary


def test_out_of_scope_question_states_boundary() -> None:
    result = _answer("今天天气怎么样")

    assert result.response.labels == []
    assert "不在我的资料范围内" in result.response.summary


def test_subsidy_question_keeps_application_details() -> None:
    result = _answer("稻谷补贴怎么申请")

    assert result.response.labels == []
    assert "补贴" in result.response.summary
    assert "申报" in result.response.summary


def test_revenue_question_uses_revenue_axis() -> None:
    result = _answer("稻谷产值怎么估算的")

    assert result.response.chart_config.y_field.value == "revenue"
    assert "2.6" in result.response.summary


def test_stream_emits_steps_deltas_and_result() -> None:
    async def collect():
        events = []
        async for event in _agent().analyze_stream(AskRequest(question="稻瘟病怎么防治?")):
            events.append(event)
        return events

    events = asyncio.run(collect())

    assert events[0]["type"] == "step"
    assert any(event["type"] == "delta" for event in events)
    assert events[-1]["type"] == "result"
    assert events[-1]["response"].demo is True
    joined = "".join(event["text"] for event in events if event["type"] == "delta")
    assert "稻瘟病" in joined
