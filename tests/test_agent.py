"""Agent 编排单元测试（用假 LLM 验证完整流水线，不依赖真实 API）。"""
from __future__ import annotations

import asyncio
import json

from app.schemas import AskRequest
from app.services.agent import AnalysisAgent
from app.services.data_source import InMemoryRiceDataSource
from app.tools import build_tool_registry


class FakeLlm:
    """按调用顺序返回预设响应，记录调用次数。"""

    def __init__(self, responses: list[dict]) -> None:
        self._responses = responses
        self.calls = 0

    async def chat(self, messages, *, tools=None, temperature=None) -> dict:
        response = self._responses[self.calls]
        self.calls += 1
        return response


def _submit(content: dict) -> dict:
    return {
        "choices": [
            {
                "message": {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {
                                "name": "submit_answer",
                                "arguments": json.dumps(content, ensure_ascii=False),
                            },
                        }
                    ],
                }
            }
        ]
    }


def _run(request: AskRequest, llm: FakeLlm):
    agent = AnalysisAgent(llm, build_tool_registry(InMemoryRiceDataSource()))
    return asyncio.run(agent.analyze(request))


def test_text_only_direct_submit_single_call() -> None:
    llm = FakeLlm(
        [
            _submit(
                {
                    "chart_config": {
                        "chart_type": "line",
                        "x_field": "year",
                        "y_field": "yield",
                        "title": "分析",
                    },
                    "labels": [],
                    "values": [],
                    "summary": "提高产量的建议……",
                    "source": "AI 分析",
                }
            )
        ]
    )
    result = _run(AskRequest(question="怎么提高产量？"), llm)

    assert result.response.labels == []
    assert llm.calls == 1
    assert [s.phase.value for s in result.steps] == ["understanding", "computing"]


def test_data_query_then_answer_two_calls() -> None:
    first = {
        "choices": [
            {
                "message": {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {
                                "name": "query_yield",
                                "arguments": json.dumps(
                                    {"start_year": 2000, "end_year": 2001}
                                ),
                            },
                        }
                    ],
                }
            }
        ]
    }
    second = _submit(
        {
            "chart_config": {
                "chart_type": "line",
                "x_field": "year",
                "y_field": "yield",
                "title": "趋势",
            },
            "labels": [2000, 2001],
            "values": [205000, 210000],
            "summary": "上升",
            "source": "统计局",
        }
    )
    llm = FakeLlm([first, second])
    result = _run(AskRequest(question="2000 到 2001 年产量"), llm)

    assert llm.calls == 2
    assert result.response.labels == [2000, 2001]
    assert [s.phase.value for s in result.steps] == [
        "understanding",
        "querying",
        "computing",
        "rendering",
    ]
