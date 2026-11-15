"""轻量 RAG 检索器：BM25 稀疏检索，纯标准库实现，无第三方依赖。

选型理由：
- DeepSeek 不提供 embedding 接口，本地向量模型又受部署环境（Python 版本、
  依赖安装）限制；
- BM25 是经典、可解释的稀疏检索算法，零依赖、可离线，足以支撑「专业问答」
  的检索增强场景，且能返回每个命中片段的得分，便于向评审解释检索策略。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from math import log
from typing import Any

_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_LATIN_RE = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class Chunk:
    """知识库切片。"""

    title: str
    source: str
    content: str


@dataclass(frozen=True)
class RetrievalHit:
    """单条检索命中。"""

    title: str
    source: str
    content: str
    score: float


# 口语化说法 → 知识库里的术语。
# 农户很少说「稻瘟病防治」，更多是「打药」「治虫」「收成咋样」。
# BM25 是逐词匹配，不先做这一步，口语问法很容易召不回来。
_SYNONYMS: dict[str, str] = {
    "收成": "产量",
    "打的粮": "产量 稻谷",
    "打药": "防治 药剂",
    "喷药": "防治 药剂",
    "上肥": "施肥",
    "追肥": "施肥",
    "治虫": "病虫害 防治",
    "虫子": "病虫害",
    "病斑": "病害 防治",
    "烂根": "纹枯病 立枯病",
    "卷叶": "稻纵卷叶螟 防治",
    "育苗": "育秧 播种",
    "下种": "播种",
    "泡田": "整地 水层",
    "水深": "水层",
    "多深": "水层 厘米",
    "亩产": "亩产 单产",
}


def _rewrite_query(query: str) -> str:
    """把口语词替换成知识库术语，保留原词与术语两路检索的机会。"""
    text = query
    for spoken, term in _SYNONYMS.items():
        if spoken in text:
            text = text.replace(spoken, f" {term} ")
    return text


def _tokenize(text: str) -> list[str]:
    """中文用「单字 + 相邻双字」切分，英文/数字整体切分，避免依赖分词库。"""
    text = text.lower()
    tokens: list[str] = list(_LATIN_RE.findall(text))
    cjk = _CJK_RE.findall(text)
    tokens.extend(cjk)
    tokens.extend(cjk[i] + cjk[i + 1] for i in range(len(cjk) - 1))
    return tokens


def _chunk_text(content: str, size: int = 160, overlap: int = 40) -> list[str]:
    """按字符滑动窗口切块，保留 overlap 保证语义连续。"""
    content = content.strip()
    if not content:
        return []
    if len(content) <= size:
        return [content]
    chunks: list[str] = []
    step = size - overlap
    start = 0
    while start < len(content):
        chunks.append(content[start : start + size])
        start += step
    return chunks


class RagRetriever:
    """基于 BM25 的知识库检索器。"""

    def __init__(
        self,
        documents: list[dict[str, str]],
        *,
        k1: float = 1.5,
        b: float = 0.75,
    ) -> None:
        self._k1 = k1
        self._b = b
        self._chunks: list[Chunk] = []
        self._docs: list[list[str]] = []
        self._df: dict[str, int] = {}
        self._doc_len: list[int] = []
        self._avgdl = 0.0
        self._build(documents)

    def _build(self, documents: list[dict[str, str]]) -> None:
        for doc in documents:
            for piece in _chunk_text(doc.get("content", "")):
                tokens = _tokenize(piece)
                if not tokens:
                    continue
                self._chunks.append(
                    Chunk(
                        title=doc.get("title", ""),
                        source=doc.get("source", ""),
                        content=piece,
                    )
                )
                self._docs.append(tokens)
                for term in set(tokens):
                    self._df[term] = self._df.get(term, 0) + 1
        self._doc_len = [len(t) for t in self._docs]
        self._avgdl = sum(self._doc_len) / len(self._docs) if self._docs else 0.0

    @property
    def chunk_count(self) -> int:
        """知识库切片总数。"""
        return len(self._chunks)

    def search(self, query: str, top_k: int = 3) -> list[RetrievalHit]:
        """按 BM25 相关性检索 top_k 个最相关片段。"""
        if not self._docs or not query.strip():
            return []
        # 原问题与改写后的问题各切一次词，取并集：
        # 「打药」这种口语词靠改写补回「防治/药剂」，原词也不丢
        q_terms = {t for t in _tokenize(query) if t in self._df}
        q_terms |= {t for t in _tokenize(_rewrite_query(query)) if t in self._df}
        q_terms = list(q_terms)
        if not q_terms:
            return []

        n = len(self._docs)
        ranked: list[tuple[float, int]] = []
        for idx, doc_tokens in enumerate(self._docs):
            term_freq: dict[str, int] = {}
            for token in doc_tokens:
                if token in q_terms:
                    term_freq[token] = term_freq.get(token, 0) + 1
            if not term_freq:
                continue
            dl = self._doc_len[idx]
            score = 0.0
            for term, freq in term_freq.items():
                df = self._df[term]
                idf = log((n - df + 0.5) / (df + 0.5) + 1.0)
                denom = freq + self._k1 * (1 - self._b + self._b * dl / self._avgdl)
                score += idf * (freq * (self._k1 + 1)) / denom
            if score > 0:
                ranked.append((score, idx))

        ranked.sort(key=lambda pair: pair[0], reverse=True)
        return [
            RetrievalHit(
                title=self._chunks[idx].title,
                source=self._chunks[idx].source,
                content=self._chunks[idx].content,
                score=round(score, 4),
            )
            for score, idx in ranked[:top_k]
        ]

    def search_as_tool(self, query: str, top_k: int = 3) -> list[dict[str, Any]]:
        """供 search_knowledge 工具调用，返回字典形态便于序列化。"""
        return [
            {"title": h.title, "source": h.source, "content": h.content, "score": h.score}
            for h in self.search(query, top_k)
        ]
