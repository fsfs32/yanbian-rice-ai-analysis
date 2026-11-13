"""Pydantic 数据模型。

本文件是「前端 ↔ 后端」契约在服务端的唯一权威定义，字段名、枚举取值
必须与前端 `src/types/index.ts` 与 `src/utils/validateAskResponse.ts`
保持严格一致。任何字段改动都可能导致前端运行时校验失败。
"""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# 枚举白名单（与前端 CHART_TYPES / FIELDS 一一对应，禁止增减）
# ---------------------------------------------------------------------------
class ChartType(str, Enum):
    """图表类型：折线 / 柱状 / 散点 / 组合（柱+折线双轴）。"""

    LINE = "line"
    BAR = "bar"
    SCATTER = "scatter"
    COMBO = "combo"


class Field(str, Enum):
    """坐标轴字段：年份 / 产量 / 销售额。"""

    YEAR = "year"
    YIELD = "yield"
    REVENUE = "revenue"


# ---------------------------------------------------------------------------
# 请求体
# ---------------------------------------------------------------------------
class ChatTurn(BaseModel):
    """多轮对话中的一轮，供指代消解使用。"""

    role: Literal["user", "assistant"]
    content: str


class CsvAttachment(BaseModel):
    """上传的 CSV 附件（前端已解析为结构化数据）。"""

    model_config = ConfigDict(extra="forbid")

    file_name: str
    headers: list[str]
    rows: list[list[str]]


class AskRequest(BaseModel):
    """POST /api/ask 请求体。

    「是否携带 csv 字段」决定后端走「文件分析」还是「普通问答」分支。
    """

    model_config = ConfigDict(extra="forbid")

    question: str = Field(..., min_length=1, description="用户问题")
    history: list[ChatTurn] = Field(default_factory=list, description="多轮上下文")
    session_id: str | None = Field(default=None, description="会话标识")
    csv: CsvAttachment | None = Field(default=None, description="上传的 CSV，存在即文件分析场景")


# ---------------------------------------------------------------------------
# 响应体
# ---------------------------------------------------------------------------
class ChartConfig(BaseModel):
    """图表配置，枚举取值受前端白名单约束。"""

    model_config = ConfigDict(extra="forbid")

    chart_type: ChartType
    x_field: Field
    y_field: Field
    y2_field: Field | None = Field(default=None, description="组合图第二序列字段")
    title: str = Field(..., max_length=80)


class AskResponse(BaseModel):
    """POST /api/ask 标准响应。"""

    model_config = ConfigDict(extra="forbid")

    chart_config: ChartConfig
    labels: list[str | int]
    values: list[float]
    values2: list[float] | None = Field(default=None, description="组合图第二序列，须与 values 等长")
    summary: str = Field(..., max_length=300)
    source: str | None = Field(default=None, description="数据来源，展示于图表底部")

    @model_validator(mode="after")
    def _validate_series(self) -> "AskResponse":
        """跨字段校验：labels 与 values 等长；values2 若存在须与 values 等长。"""
        if len(self.labels) != len(self.values):
            raise ValueError("labels 与 values 长度必须一致")

        if self.values2 is not None and len(self.values2) != len(self.values):
            raise ValueError("values2 若存在，长度必须与 values 一致")

        # 组合图必须有第二序列
        if self.chart_config.chart_type is ChartType.COMBO:
            if self.values2 is None or self.chart_config.y2_field is None:
                raise ValueError("chart_type=combo 时必须提供 values2 与 y2_field")

        return self

    @classmethod
    def text_only(cls, summary: str, source: str | None = "AI 分析") -> "AskResponse":
        """构造「纯文字回答」：labels/values 为空数组，前端据此只渲染文字不出图。"""
        return cls(
            chart_config=ChartConfig(
                chart_type=ChartType.LINE,
                x_field=Field.YEAR,
                y_field=Field.YIELD,
                title="分析",
            ),
            labels=[],
            values=[],
            summary=summary,
            source=source,
        )


# ---------------------------------------------------------------------------
# SSE 事件
# ---------------------------------------------------------------------------
class SseDelta(BaseModel):
    """流式增量事件：前端收到后逐字渲染。"""

    delta: str


class SseDone(BaseModel):
    """流结束标记（实际以字面量 `[DONE]` 发送，此处仅作文档化声明）。"""

    pass
