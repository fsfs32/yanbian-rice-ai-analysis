"""契约模型单元测试：字段白名单、跨字段校验、纯文字兜底。"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import AgentStep, AskResponse, ChartConfig, ChartType, Field, StepPhase


def _combo_response() -> AskResponse:
    return AskResponse(
        chart_config=ChartConfig(
            chart_type=ChartType.COMBO,
            x_field=Field.YEAR,
            y_field=Field.YIELD,
            y2_field=Field.REVENUE,
            title="趋势",
        ),
        labels=[1994, 1995],
        values=[172000.0, 178000.0],
        values2=[8.6, 8.9],
        summary="上升",
        source="统计局",
    )


def test_valid_combo_roundtrip() -> None:
    r = _combo_response()
    assert r.chart_config.chart_type is ChartType.COMBO
    assert r.labels == [1994, 1995]
    assert r.values2 == [8.6, 8.9]


def test_labels_values_length_mismatch_fails() -> None:
    with pytest.raises(ValidationError):
        AskResponse(
            chart_config=ChartConfig(
                chart_type=ChartType.LINE, x_field=Field.YEAR, y_field=Field.YIELD, title="t"
            ),
            labels=[1994, 1995],
            values=[1.0],
            summary="x",
        )


def test_combo_without_values2_fails() -> None:
    with pytest.raises(ValidationError):
        AskResponse(
            chart_config=ChartConfig(
                chart_type=ChartType.COMBO, x_field=Field.YEAR, y_field=Field.YIELD, title="t"
            ),
            labels=[1994],
            values=[1.0],
            summary="x",
        )


def test_invalid_chart_type_fails() -> None:
    with pytest.raises(ValidationError):
        AskResponse.model_validate(
            {
                "chart_config": {
                    "chart_type": "pie",
                    "x_field": "year",
                    "y_field": "yield",
                    "title": "t",
                },
                "labels": [],
                "values": [],
                "summary": "x",
            }
        )


def test_text_only_returns_empty_series() -> None:
    r = AskResponse.text_only("建议")
    assert r.labels == []
    assert r.values == []
    assert r.chart_config.chart_type is ChartType.LINE


def test_agent_step_phase_whitelist() -> None:
    s = AgentStep(phase=StepPhase.QUERYING, title="查询数据", detail="query_yield")
    assert s.phase is StepPhase.QUERYING
    assert s.model_dump()["phase"] == "querying"
