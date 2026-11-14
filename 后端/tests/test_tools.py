"""工具与数据源单元测试。"""
from __future__ import annotations

import pytest

from app.core.exceptions import ToolExecutionError
from app.services.data_source import InMemoryRiceDataSource
from app.tools import ToolRegistry, build_tool_registry


@pytest.fixture()
def registry() -> ToolRegistry:
    return build_tool_registry(InMemoryRiceDataSource())


def test_query_yield_range(registry: ToolRegistry) -> None:
    result = registry.execute("query_yield", {"start_year": 2020, "end_year": 2021})
    assert [row["year"] for row in result["rows"]] == [2020, 2021]


def test_query_yield_empty_range(registry: ToolRegistry) -> None:
    result = registry.execute("query_yield", {"start_year": 1800, "end_year": 1801})
    assert result["rows"] == []
    assert "无数据" in result["message"]


def test_query_statistics(registry: ToolRegistry) -> None:
    result = registry.execute("query_statistics", {"field": "yield"})
    assert result["count"] == 10
    assert result["min"] < result["max"]
    assert result["trend"] == "上升"


def test_query_statistics_bad_field(registry: ToolRegistry) -> None:
    with pytest.raises(ToolExecutionError):
        registry.execute("query_statistics", {"field": "unknown"})


def test_unknown_tool(registry: ToolRegistry) -> None:
    with pytest.raises(ToolExecutionError):
        registry.execute("no_such_tool", {})
