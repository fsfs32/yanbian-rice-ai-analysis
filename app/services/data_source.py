"""数据源抽象与内置实现。

真实数字只能来自数据源查询，禁止让 LLM 编造。这里用「抽象基类 + 内置示例实现」，
后续接入真实数据库 / 统计局 API 时，只需新增一个 DataSource 实现并注入，
工具层无需任何改动。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..core.exceptions import ToolExecutionError


class DataSource(ABC):
    """数据源接口：负责提供延边州水稻产量与销售额的真实数据。"""

    @abstractmethod
    def query_yield(self, start_year: int, end_year: int) -> dict[str, Any]:
        """查询年份区间的逐年产量与销售额。"""

    @abstractmethod
    def query_statistics(self, field: str) -> dict[str, Any]:
        """对指定字段（yield / revenue）做描述性统计。"""


class InMemoryRiceDataSource(DataSource):
    """内置示例数据源（延边州水稻 1994—2016）。

    仅用于联调演示，正式环境请替换为真实数据库 / 统计局 API。
    """

    _RICE_DATASET: list[dict[str, int | float]] = [
        {"year": 1994, "yield": 172000, "revenue": 8.6},
        {"year": 1995, "yield": 178000, "revenue": 8.9},
        {"year": 1996, "yield": 185000, "revenue": 9.2},
        {"year": 1997, "yield": 180000, "revenue": 9.0},
        {"year": 1998, "yield": 192000, "revenue": 9.6},
        {"year": 1999, "yield": 198000, "revenue": 9.9},
        {"year": 2000, "yield": 205000, "revenue": 10.2},
        {"year": 2001, "yield": 210000, "revenue": 10.5},
        {"year": 2002, "yield": 208000, "revenue": 10.4},
        {"year": 2003, "yield": 215000, "revenue": 10.8},
        {"year": 2004, "yield": 222000, "revenue": 11.1},
        {"year": 2005, "yield": 230000, "revenue": 11.5},
        {"year": 2006, "yield": 228000, "revenue": 11.4},
        {"year": 2007, "yield": 235000, "revenue": 11.8},
        {"year": 2008, "yield": 242000, "revenue": 12.1},
        {"year": 2009, "yield": 250000, "revenue": 12.5},
        {"year": 2010, "yield": 248000, "revenue": 12.4},
        {"year": 2011, "yield": 258000, "revenue": 12.9},
        {"year": 2012, "yield": 265000, "revenue": 13.3},
        {"year": 2013, "yield": 272000, "revenue": 13.6},
        {"year": 2014, "yield": 268000, "revenue": 13.4},
        {"year": 2015, "yield": 278000, "revenue": 13.9},
        {"year": 2016, "yield": 286000, "revenue": 14.3},
    ]

    def query_yield(self, start_year: int, end_year: int) -> dict[str, Any]:
        rows = [
            row
            for row in self._RICE_DATASET
            if start_year <= int(row["year"]) <= end_year
        ]
        if not rows:
            return {"rows": [], "message": f"区间 {start_year}—{end_year} 内无数据"}
        return {"rows": rows}

    def query_statistics(self, field: str) -> dict[str, Any]:
        if field not in {"yield", "revenue"}:
            raise ToolExecutionError(f"不支持的统计字段：{field}")
        series = [float(row[field]) for row in self._RICE_DATASET]
        n = len(series)
        return {
            "field": field,
            "count": n,
            "min": min(series),
            "max": max(series),
            "mean": round(sum(series) / n, 2),
            "trend": "上升" if series[-1] > series[0] else "下降",
        }
