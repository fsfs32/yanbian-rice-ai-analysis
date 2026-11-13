"""Function Calling 工具定义。

本项目「不裸调大模型」的关键落点：
- 产量 / 销售额等真实数字来自工具对数据源的查询，而非让 LLM 凭空编造；
- 最终答案通过 submit_answer 工具以结构化参数返回，强制 LLM 输出标准 AskResponse。

数据源通过 DataSource 接口注入，默认使用内置示例数据；正式环境替换为真实数据库 /
统计局 API 时，只需提供新的 DataSource 实现，工具定义与调用流程保持不变。
"""
from __future__ import annotations

from typing import Any, Callable

from .core.exceptions import ToolExecutionError
from .services.data_source import DataSource

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


def _make_query_yield(datasource: DataSource) -> ToolHandler:
    def handler(args: dict[str, Any]) -> dict[str, Any]:
        start = int(args.get("start_year", 2016))
        end = int(args.get("end_year", 2025))
        return datasource.query_yield(start, end)

    return handler


def _make_query_statistics(datasource: DataSource) -> ToolHandler:
    def handler(args: dict[str, Any]) -> dict[str, Any]:
        field = args.get("field", "yield")
        if field not in {"yield", "revenue"}:
            raise ToolExecutionError(f"不支持的统计字段：{field}")
        return datasource.query_statistics(field)

    return handler


def _submit_answer(args: dict[str, Any]) -> dict[str, Any]:
    """结构化提交最终答案，参数即标准 AskResponse。"""
    return args


def build_tool_registry(datasource: DataSource) -> ToolRegistry:
    """构建工具注册表。"""
    registry = ToolRegistry()

    registry.register(
        "query_yield",
        {
            "name": "query_yield",
            "description": "查询延边州指定年份区间的稻谷产量（万吨）与产值估算（亿元），返回逐年明细。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_year": {"type": "integer", "description": "起始年份"},
                    "end_year": {"type": "integer", "description": "结束年份"},
                },
                "required": ["start_year", "end_year"],
            },
        },
        _make_query_yield(datasource),
    )

    registry.register(
        "query_statistics",
        {
            "name": "query_statistics",
            "description": "对产量或产值做描述性统计，返回最小值、最大值、均值与趋势。",
            "parameters": {
                "type": "object",
                "properties": {
                    "field": {
                        "type": "string",
                        "enum": ["yield", "revenue"],
                        "description": "统计字段：yield=产量，revenue=产值估算",
                    }
                },
                "required": ["field"],
            },
        },
        _make_query_statistics(datasource),
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
