"""Function Calling 工具定义与数据源。

本项目「不裸调大模型」的关键落点：
- 产量 / 销售额等**真实数字**来自本工具对数据源的查询，而非让 LLM 凭空编造；
- 最终答案通过 `submit_answer` 工具以结构化参数返回，强制 LLM 输出标准 `AskResponse`。

数据源这里用内置示例数据演示；正式环境应替换为真实数据库 / 统计局 API，
但工具签名与调用流程保持不变。
"""
from __future__ import annotations

from typing import Any, Callable, Literal

from .core.exceptions import ToolExecutionError

# ---------------------------------------------------------------------------
# 内置示例数据（延边州水稻，1994—2016）
# 注意：仅用于联调演示，正式环境务必替换为真实数据源
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# 工具处理函数
# ---------------------------------------------------------------------------
def _query_yield(args: dict[str, Any]) -> dict[str, Any]:
    """按年份区间查询产量与销售额。"""
    start = int(args.get("start_year", 1994))
    end = int(args.get("end_year", 2016))
    rows = [row for row in _RICE_DATASET if start <= int(row["year"]) <= end]
    if not rows:
        return {"rows": [], "message": f"区间 {start}—{end} 内无数据"}
    return {"rows": rows}


def _query_statistics(args: dict[str, Any]) -> dict[str, Any]:
    """对指定字段做描述性统计。"""
    field = args.get("field", "yield")
    if field not in {"yield", "revenue"}:
        raise ToolExecutionError(f"不支持的统计字段：{field}")
    series = [float(row[field]) for row in _RICE_DATASET]
    n = len(series)
    mean = sum(series) / n
    trend = "上升" if series[-1] > series[0] else "下降"
    return {
        "field": field,
        "count": n,
        "min": min(series),
        "max": max(series),
        "mean": round(mean, 2),
        "trend": trend,
    }


def _submit_answer(args: dict[str, Any]) -> dict[str, Any]:
    """结构化提交最终答案，参数即标准 AskResponse。"""
    return args


# ---------------------------------------------------------------------------
# 工具注册表
# ---------------------------------------------------------------------------
ToolHandler = Callable[[dict[str, Any]], dict[str, Any]]


class ToolRegistry:
    """统一管理工具名 → {JSON Schema, 处理函数} 的映射。"""

    def __init__(self) -> None:
        self._tools: dict[str, dict[str, Any]] = {}

    def register(self, name: str, schema: dict[str, Any], handler: ToolHandler) -> None:
        self._tools[name] = {"schema": schema, "handler": handler}

    def schemas(self) -> list[dict[str, Any]]:
        """导出 OpenAI function calling 格式的工具列表。"""
        return [
            {"type": "function", "function": spec["schema"]}
            for spec in self._tools.values()
        ]

    def execute(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """执行指定工具并返回结构化结果。"""
        spec = self._tools.get(name)
        if spec is None:
            raise ToolExecutionError(f"未知工具：{name}")
        return spec["handler"](arguments)


def build_tool_registry() -> ToolRegistry:
    """构建工具注册表。"""
    registry = ToolRegistry()

    registry.register(
        "query_yield",
        {
            "name": "query_yield",
            "description": "查询延边州指定年份区间的水稻产量（吨）与销售额（亿元），返回逐年明细。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_year": {"type": "integer", "description": "起始年份"},
                    "end_year": {"type": "integer", "description": "结束年份"},
                },
                "required": ["start_year", "end_year"],
            },
        },
        _query_yield,
    )

    registry.register(
        "query_statistics",
        {
            "name": "query_statistics",
            "description": "对产量或销售额做描述性统计，返回最小值、最大值、均值与趋势。",
            "parameters": {
                "type": "object",
                "properties": {
                    "field": {
                        "type": "string",
                        "enum": ["yield", "revenue"],
                        "description": "统计字段：yield=产量，revenue=销售额",
                    }
                },
                "required": ["field"],
            },
        },
        _query_statistics,
    )

    registry.register(
        "submit_answer",
        {
            "name": "submit_answer",
            "description": (
                "提交最终回答。必须严格遵循 chart_config / labels / values / summary 结构，"
                "chart_type 取值 line/bar/scatter/combo，字段取值 year/yield/revenue；"
                "纯文字回答时 labels 与 values 传空数组。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_config": {
                        "type": "object",
                        "properties": {
                            "chart_type": {"type": "string", "enum": ["line", "bar", "scatter", "combo"]},
                            "x_field": {"type": "string", "enum": ["year", "yield", "revenue"]},
                            "y_field": {"type": "string", "enum": ["year", "yield", "revenue"]},
                            "y2_field": {"type": "string", "enum": ["year", "yield", "revenue"]},
                            "title": {"type": "string"},
                        },
                        "required": ["chart_type", "x_field", "y_field", "title"],
                    },
                    "labels": {"type": "array", "items": {"type": ["string", "integer"]}},
                    "values": {"type": "array", "items": {"type": "number"}},
                    "values2": {"type": "array", "items": {"type": "number"}},
                    "summary": {"type": "string"},
                    "source": {"type": "string"},
                },
                "required": ["chart_config", "labels", "values", "summary"],
            },
        },
        _submit_answer,
    )

    return registry
