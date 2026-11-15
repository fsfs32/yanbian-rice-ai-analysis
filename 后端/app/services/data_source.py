"""数据源抽象与内置实现。

真实数字只能来自数据源查询，禁止让 LLM 编造。这里用「抽象基类 + 内置示例实现」，
后续接入真实数据库 / 统计局 API 时，只需新增一个 DataSource 实现并注入，
工具层无需任何改动。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..core.exceptions import ToolExecutionError


# 2025 年吉林省各市州稻谷（水稻）产量，单位：万吨。
# 来源：吉林省统计局统一发布的各市州《2025 年国民经济和社会发展统计公报》。
# 白山市的公报只公布谷物合计（24.94 万吨），未单列稻谷，故不纳入，避免用估算值充数。
# 其余八市州合计 661.31 万吨，与全省 682.65 万吨的差额即白山等未单列部分，口径自洽。
CITY_YIELD_2025: dict[str, float] = {
    "长春市": 141.68,
    "白城市": 189.18,
    "松原市": 123.16,
    "吉林市": 99.50,
    "通化市": 38.20,
    "四平市": 33.40,
    "延边州": 21.85,
    "辽源市": 14.34,
}


class DataSource(ABC):
    """数据源接口：负责提供延边州水稻产量与产值的真实数据。"""

    @abstractmethod
    def query_yield(self, start_year: int, end_year: int) -> dict[str, Any]:
        """查询年份区间的逐年产量与产值。"""

    @abstractmethod
    def query_statistics(self, field: str) -> dict[str, Any]:
        """对指定字段（yield / revenue）做描述性统计。"""

    @abstractmethod
    def query_cities(self, year: int = 2025) -> dict[str, Any]:
        """按市州查询吉林省稻谷产量（目前仅 2025 年有官方分市数据）。"""


class InMemoryRiceDataSource(DataSource):
    """内置数据源（延边州稻谷产量 2016—2025，单位：万吨）。

    产量数据来自延边州历年《国民经济和社会发展统计公报》（官方口径）。
    revenue 字段为「稻谷产值估算」（亿元）= 产量 × 粳稻均价约 2.6 元/公斤；
    官方公报无「销售额」口径，此处为估算值，已在数据来源中如实标注。
    后续接入真实数据库 / 统计局 API 时，替换本实现即可。
    """

    _RICE_DATASET: list[dict[str, int | float]] = [
        {"year": 2016, "yield": 17.40, "revenue": 4.52},
        {"year": 2017, "yield": 19.70, "revenue": 5.12},
        {"year": 2018, "yield": 21.91, "revenue": 5.70},
        {"year": 2019, "yield": 24.09, "revenue": 6.26},
        {"year": 2020, "yield": 24.22, "revenue": 6.30},
        {"year": 2021, "yield": 25.22, "revenue": 6.56},
        {"year": 2022, "yield": 22.78, "revenue": 5.92},
        {"year": 2023, "yield": 22.62, "revenue": 5.88},
        {"year": 2024, "yield": 21.93, "revenue": 5.70},
        {"year": 2025, "yield": 21.85, "revenue": 5.68},
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


    def query_cities(self, year: int = 2025) -> dict[str, Any]:
        """返回按产量降序排列的各市州稻谷产量。"""
        if int(year) != 2025:
            return {
                "year": int(year),
                "unit": "万吨",
                "cities": [],
                "note": "分市州数据目前只收录 2025 年，其它年份没有官方公布的分市产量",
                "source": "吉林省统计局：各市州《2025年国民经济和社会发展统计公报》",
            }

        items = sorted(CITY_YIELD_2025.items(), key=lambda kv: kv[1], reverse=True)
        return {
            "year": 2025,
            "unit": "万吨",
            "cities": [{"name": name, "yield": value} for name, value in items],
            "note": (
                "白山市的公报只公布谷物合计、未单列稻谷，因此未纳入；"
                "其余八市州合计 661.31 万吨"
            ),
            "source": "吉林省统计局：各市州《2025年国民经济和社会发展统计公报》",
        }
