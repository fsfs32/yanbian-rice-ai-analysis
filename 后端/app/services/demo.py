"""离线演示模式应答器。

背景：`.env` 里没有填 `LLM_API_KEY` 时，系统进入演示模式。早期实现里，
前端在接口降级后统一返回一张「2016—2025 年产量趋势」图，导致问「稻瘟病
怎么防治」也会得到产量趋势回答——回答与问题完全对不上。

这个模块只做一件事：没有大模型时，仍然按问题意图给出**对得上**的回答。

- 数据类问题（产量趋势 / 峰值 / 年均 / 波动 / 市州对比）→ 直接查内置数据源，
  按真实数值组图表与结论；
- 知识类问题（病虫害 / 栽培 / 施肥 / 农时 / 政策）→ 用内置 BM25 知识库检索，
  抽取最相关的原文句子作答，并标注来源；
- 寒暄、范围外的问题 → 说明能力边界并给出可问方向，绝不硬套一张产量图。

全程不调用大模型、不联网，因此输出是确定性的、可复现的。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from ..schemas import (
    AgentStep,
    AskRequest,
    AskResponse,
    ChartConfig,
    ChartType,
    Field,
    StepPhase,
)
from .data_source import DataSource
from .rag import KNOWLEDGE_DOCUMENTS, RagRetriever

_CJK = re.compile(r"[\u4e00-\u9fff]")
_SENTENCE_SPLIT = re.compile(r"(?<=[。！？])")

# 纯寒暄：整句匹配，避免「你好，稻瘟病怎么防治」被误判
_GREETING = re.compile(
    r"^(你好|您好|哈喽|hello|hi|嗨|在吗|有人吗|谢谢|多谢|感谢|再见|早上好|晚上好|下午好)"
    r"[!！。.~～,，\s]*$",
    re.IGNORECASE,
)

# 数据类提问的「对象词」与「问法词」，两个都命中才算数据问题
_DATA_SUBJECT = re.compile(r"产量|产值|万吨|吨|销售额|数据|统计|年产量|单产|亩产")
_DATA_MODE = re.compile(
    r"趋势|统计|最高|最低|最大|最小|平均|均值|波动|峰值|对比|排名|多少|增长|下降|"
    r"变化|占比|各市|市州|全省|哪一年|哪年|近几年|历年|排第几|第几|估算|怎么算|计算方法"
)

# 农技/政策类关键词，配合检索得分兜底判断
_KNOWLEDGE_WORDS = re.compile(
    r"病|虫|防治|防病|农药|药剂|用药|施肥|追肥|底肥|栽|插秧|育秧|育苗|播种|泡田|"
    r"除草|稗草|补贴|政策|品种|选种|水层|灌溉|低温|冷害|稻瘟|纹枯|稻飞虱|螟|"
    r"增产|提高产量|种植|农时|管理"
)

# 检索得分低于该值视为「没有命中」，避免用不相关片段硬答
_KNOWLEDGE_SCORE_FLOOR = 5.5
# 知识类回答总字数上限
_MAX_KNOWLEDGE_CHARS = 520


@dataclass
class DemoAnswer:
    """演示模式的一次回答：标准响应 + 执行轨迹。"""

    response: AskResponse
    steps: list[AgentStep] = field(default_factory=list)


def _bigrams(text: str) -> set[str]:
    """中文按单字 + 相邻双字取特征，与检索器保持一致的口径。"""
    cjk = "".join(_CJK.findall(text))
    return set(cjk) | {cjk[i : i + 2] for i in range(len(cjk) - 1)}


def _focus_term(question: str, content: str, *, min_len: int = 3, max_len: int = 6) -> str | None:
    """取问题里在文档中出现的最长中文片段（3—6 字），作为回答的聚焦词。

    「稻瘟病怎么防治」→「稻瘟病」；只有具体名词才配得上聚焦，
    「怎么」「防治」这类泛词不会满足 3 字且出现在文档里的条件。
    """
    chars = "".join(_CJK.findall(question))
    for size in range(max_len, min_len - 1, -1):
        for start in range(len(chars) - size + 1):
            term = chars[start : start + size]
            if term in content:
                return term
    return None


class DemoAnswerer:
    """不依赖大模型的确定性应答器。"""

    def __init__(self, data_source: DataSource, retriever: RagRetriever) -> None:
        self._data = data_source
        self._retriever = retriever
        # 检索只返回切片，取回完整文档才能按句摘录
        self._docs = {doc["title"]: doc for doc in KNOWLEDGE_DOCUMENTS}

    # ------------------------------------------------------------------
    # 对外入口
    # ------------------------------------------------------------------
    def answer(self, request: AskRequest) -> DemoAnswer:
        question = request.question.strip()
        steps: list[AgentStep] = [
            AgentStep(
                phase=StepPhase.UNDERSTANDING,
                title="理解问题",
                detail="演示模式（未配置 LLM_API_KEY）：改用内置数据与知识库作答",
            )
        ]

        if _GREETING.match(question):
            return DemoAnswer(
                response=self._text(
                    "你好！我是延边大米数据分析助手。可以查 2016—2025 年延边州稻谷产量趋势、"
                    "峰值、年均值和各市州对比，也能回答稻瘟病防治、施肥、插秧农时、稻谷补贴等知识库问题。"
                    "试试问「2016—2025 年产量趋势」。",
                ),
                steps=steps,
            )

        if self._is_data_question(question):
            answer, query_title, query_detail = self._answer_data(question)
        else:
            answer, query_title, query_detail = self._answer_knowledge(question)

        steps.append(
            AgentStep(
                phase=StepPhase.QUERYING,
                title=query_title,
                detail=query_detail,
            )
        )
        steps.append(
            AgentStep(
                phase=StepPhase.COMPUTING,
                title="计算分析",
                detail="基于内置数据的真实数值 / 知识库原文组织结论，未调用大模型",
            )
        )
        if answer.labels:
            steps.append(
                AgentStep(
                    phase=StepPhase.RENDERING,
                    title="生成图表",
                    detail=f"选择「{answer.chart_config.chart_type.value}」图表并组织可视化数据",
                )
            )
        return DemoAnswer(response=answer, steps=steps)

    # ------------------------------------------------------------------
    # 意图判断
    # ------------------------------------------------------------------
    @staticmethod
    def _is_data_question(question: str) -> bool:
        if _DATA_SUBJECT.search(question) and _DATA_MODE.search(question):
            return True
        # 「2021 年为什么回落」这类带年份的追问，显然是在问内置数据
        if re.search(r"\d{4}\s*年", question) and re.search(
            r"为什么|为何|原因|回落|下降|上升|增长|减产|增产", question
        ):
            return True
        # 「各市州 / 全省 哪个最高」这类没写「产量」二字，但对象显然是数据
        return bool(re.search(r"市州|各市|全省", question)) and bool(
            re.search(r"产量|稻谷|水稻|对比|排名|最高", question)
        )

    # ------------------------------------------------------------------
    # 数据类回答
    # ------------------------------------------------------------------
    def _answer_data(self, question: str) -> tuple[AskResponse, str, str]:
        if re.search(r"产值|销售额|收入", question) and re.search(
            r"估算|计算|折算|怎么算|口径|多少|来源", question
        ):
            return self._answer_revenue()

        if re.search(r"市州|各市|全省|排名|排第几|第几", question):
            return self._answer_cities()

        rows = self._data.query_yield(2016, 2025)["rows"]
        labels = [int(row["year"]) for row in rows]
        values = [round(float(row["yield"]), 2) for row in rows]
        revenue = [round(float(row["revenue"]), 2) for row in rows]
        stats = self._data.query_statistics("yield")

        peak_value = max(values)
        peak_index = values.index(peak_value)
        peak_year = labels[peak_index]
        low_value = min(values)
        low_year = labels[values.index(low_value)]

        if re.search(r"最高|最大|峰值|哪年|哪一年", question):
            summary = (
                f"2016—2025 年间，延边州稻谷产量最高的是 {peak_year} 年，为 {peak_value:.2f} 万吨；"
                f"最低的是 {low_year} 年，为 {low_value:.2f} 万吨。"
            )
            chart_type = ChartType.BAR
        elif re.search(r"平均|均值|年均", question):
            summary = (
                f"2016—2025 年延边州稻谷年均产量为 {stats['mean']:.2f} 万吨；"
                f"产量最高年份为 {peak_year} 年（{peak_value:.2f} 万吨）。"
            )
            chart_type = ChartType.LINE
        elif re.search(r"波动|变化最大|起伏", question):
            deltas = [
                (labels[i], values[i] - values[i - 1]) for i in range(1, len(values))
            ]
            year, delta = max(deltas, key=lambda item: abs(item[1]))
            direction = "上升" if delta > 0 else "下降"
            summary = (
                f"2016—2025 年间产量波动最大的是 {year} 年，"
                f"较上一年{direction} {abs(delta):.2f} 万吨。"
            )
            chart_type = ChartType.LINE
        else:
            first, last = values[0], values[-1]
            summary = (
                f"2016—2025 年延边州稻谷产量从 {first:.2f} 万吨增至 {peak_value:.2f} 万吨"
                f"（{peak_year} 年），随后回落至 {last:.2f} 万吨，整体呈先升后降的倒 U 型走势。"
            )
            chart_type = ChartType.COMBO

        # 问「为什么」时，数据本身给不出成因，如实说明而不是编一个理由
        if re.search(r"为什么|为何|原因|怎么回事", question):
            summary += (
                "公开数据只提供年度产量，具体成因（气象、面积、政策等）"
                "需要结合当年统计公报与农情信息判断，这里不做推测。"
            )

        config = ChartConfig(
            chart_type=chart_type,
            x_field=Field.YEAR,
            y_field=Field.YIELD,
            # 只有组合图才给第二序列，其它图保持单序列避免前端校验歧义
            y2_field=Field.REVENUE if chart_type is ChartType.COMBO else None,
            title="2016—2025 年延边州稻谷产量",
        )
        response = AskResponse(
            chart_config=config,
            labels=labels,
            values=values,
            values2=revenue if chart_type is ChartType.COMBO else None,
            summary=summary,
            source="延边州历年《国民经济和社会发展统计公报》",
            followups=self._data_followups(),
            demo=True,
        )
        return response, "查询数据", "查询内置数据源：延边州稻谷产量 2016—2025（10 个年度）"

    def _answer_revenue(self) -> tuple[AskResponse, str, str]:
        rows = self._data.query_yield(2016, 2025)["rows"]
        labels = [int(row["year"]) for row in rows]
        revenue = [round(float(row["revenue"]), 2) for row in rows]
        peak = max(revenue)
        peak_year = labels[revenue.index(peak)]
        summary = (
            "产值是估算口径：产量 × 粳稻均价约 2.6 元/公斤，不是官方公布的「销售额」。"
            f"2016—2025 年产值从 {revenue[0]:.2f} 亿元增至 {peak:.2f} 亿元（{peak_year} 年），"
            f"2025 年为 {revenue[-1]:.2f} 亿元。"
        )
        response = AskResponse(
            chart_config=ChartConfig(
                chart_type=ChartType.LINE,
                x_field=Field.YEAR,
                y_field=Field.REVENUE,
                title="2016—2025 年延边州稻谷产值估算",
            ),
            labels=labels,
            values=revenue,
            summary=summary,
            source="按延边州稻谷产量 × 粳稻均价约 2.6 元/公斤估算",
            followups=["2025 年产值是多少", "各市州产量对比", "2016—2025 年产量趋势"],
            demo=True,
        )
        return response, "查询数据", "查询内置数据源：稻谷产值估算 2016—2025"

    def _answer_cities(self) -> tuple[AskResponse, str, str]:
        payload = self._data.query_cities(2025)
        cities = payload.get("cities") or []
        labels = [item["name"] for item in cities]
        values = [round(float(item["yield"]), 2) for item in cities]
        if not cities:
            return (
                self._text("分市州数据目前只收录 2025 年，其它年份没有官方公布的分市产量。"),
                "查询数据",
                "查询内置数据源：分市州产量（无数据）",
            )

        top_name = labels[0]
        top_value = values[0]
        yanbian_rank = labels.index("延边州") + 1 if "延边州" in labels else None
        tail = (
            f"延边州为 {values[labels.index('延边州')]:.2f} 万吨，排在第 {yanbian_rank} 位。"
            if yanbian_rank
            else ""
        )
        summary = (
            f"2025 年吉林省各市州稻谷产量中，{top_name}最高，为 {top_value:.2f} 万吨；"
            f"{tail}"
            "白山市公报只公布谷物合计、未单列稻谷，因此未纳入对比。"
        )
        response = AskResponse(
            chart_config=ChartConfig(
                chart_type=ChartType.BAR,
                x_field=Field.CITY,
                y_field=Field.YIELD,
                title="2025 年吉林省各市州稻谷产量对比",
            ),
            labels=labels,
            values=values,
            summary=summary,
            source="吉林省统计局：各市州《2025年国民经济和社会发展统计公报》",
            followups=["2025 年延边州产量排第几", "各市州产量差距有多大", "延边州历年产量趋势"],
            demo=True,
        )
        return response, "查询数据", f"查询内置数据源：2025 年 {len(cities)} 个市州产量"

    # ------------------------------------------------------------------
    # 知识类回答
    # ------------------------------------------------------------------
    def _best_hit(self, question: str) -> Any:
        """检索 + 标题再排。

        BM25 只看正文：问「稻田安全用药」时，正文里反复出现的是各种药名，
        真正对口的《稻田安全用药注意事项》反而可能排不到第一。
        标题与问题的词面重合度高时，优先信标题。
        """
        hits = self._retriever.search(question, 5)
        if not hits or hits[0].score < _KNOWLEDGE_SCORE_FLOOR:
            return None
        query_terms = _bigrams(question)
        ranked = sorted(
            (
                (len(_bigrams(hit.title) & query_terms), hit)
                for hit in hits
                if hit.score >= _KNOWLEDGE_SCORE_FLOOR
            ),
            key=lambda item: (item[0], item[1].score),
            reverse=True,
        )
        title_score, best = ranked[0]
        # 标题命中足够强时才改写 BM25 排序，避免把正文更相关的条目挤掉
        return best if title_score >= 2 else hits[0]

    def _answer_knowledge(self, question: str) -> tuple[AskResponse, str, str]:
        top = self._best_hit(question)
        if top is None:
            return self._boundary(), "检索知识库", "未命中相关条目，如实说明能力边界"

        doc = self._docs.get(top.title)
        content = (doc or {}).get("content") or top.content
        source = (doc or {}).get("source") or top.source
        excerpt = self._extract(question, content)

        summary = excerpt
        response = AskResponse(
            chart_config=ChartConfig(
                chart_type=ChartType.LINE,
                x_field=Field.YEAR,
                y_field=Field.YIELD,
                title="",
            ),
            labels=[],
            values=[],
            summary=summary,
            source=source,
            followups=self._knowledge_followups(question),
            demo=True,
        )
        return (
            response,
            "检索知识库",
            f"命中「{top.title}」（相关度 {top.score:.1f}）",
        )

    @staticmethod
    def _extract(question: str, content: str) -> str:
        """从命中文档里挑出回答段落。

        两种情形：
        - 问题里有 3 字以上的具体名词（「稻瘟病」「低温冷害」「稻曲病」）且文档里出现：
          只保留含该名词的句子，避免问稻瘟病却把纹枯病、稻飞虱一起搬出来；
        - 没有这种「聚焦词」（如「稻田安全用药要注意什么」「稻谷补贴怎么申请」）：
          说明整篇文档都在讲这件事，按句摘录到字数上限为止。
        """
        sentences = [s.strip() for s in _SENTENCE_SPLIT.split(content) if s.strip()]
        focus = _focus_term(question, content)
        # 只有两三句的短文档本身就在讲一件事，整篇给出比截一句更完整
        if focus and len(sentences) > 3:
            picked = [sentence for sentence in sentences if focus in sentence]
            text = "".join(picked)
            return text[:_MAX_KNOWLEDGE_CHARS] or content[:_MAX_KNOWLEDGE_CHARS]

        text = ""
        for sentence in sentences:
            if len(text) + len(sentence) > _MAX_KNOWLEDGE_CHARS:
                break
            text += sentence
        return text or content[:_MAX_KNOWLEDGE_CHARS]

    def _knowledge_followups(self, question: str) -> list[str]:
        if re.search(r"稻瘟", question):
            return ["稻瘟病什么时候打药最有效", "纹枯病怎么防治", "稻田安全用药要注意什么"]
        if re.search(r"施肥|肥", question):
            return ["氮肥分几次施", "冷凉山区施肥量多少", "测土配方施肥怎么做"]
        if re.search(r"补贴|政策", question):
            return ["稻谷补贴怎么申报", "补贴范围包括哪些耕地", "延边州有哪些惠农政策"]
        if re.search(r"除草|稗草", question):
            return ["插前封闭用什么药", "稗草几叶期打药最好", "除草剂怎么轮换"]
        if re.search(r"插秧|农时|育秧|播种", question):
            return ["延边什么时候插秧", "插秧后水层多深", "低温冷害怎么防"]
        return ["稻瘟病怎么防治", "2016—2025 年产量趋势", "稻谷补贴怎么申请"]

    # ------------------------------------------------------------------
    # 兜底
    # ------------------------------------------------------------------
    @staticmethod
    def _data_followups() -> list[str]:
        return ["2021 年为什么回落", "各市州产量对比", "稻谷产值怎么估算的"]

    @staticmethod
    def _boundary() -> AskResponse:
        return DemoAnswerer._text(
            "这个问题不在我的资料范围内。我目前能回答两类问题："
            "一是延边州稻谷产量数据（2016—2025 年趋势、峰值、年均值、各市州对比）；"
            "二是栽培、病虫害防治、施肥、插秧农时和稻谷补贴等知识库问题。"
            "可以试试问「2016—2025 年产量趋势」或「稻瘟病怎么防治」。",
        )

    @staticmethod
    def _text(summary: str) -> AskResponse:
        return AskResponse(
            chart_config=ChartConfig(
                chart_type=ChartType.LINE,
                x_field=Field.YEAR,
                y_field=Field.YIELD,
                title="",
            ),
            labels=[],
            values=[],
            summary=summary,
            # 寒暄 / 边界说明没有数据出处，来源留空，只靠「演示模式」标记
            source=None,
            demo=True,
        )
