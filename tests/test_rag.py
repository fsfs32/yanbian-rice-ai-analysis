"""RAG 检索器与 search_knowledge 工具的单测。"""
from __future__ import annotations

from app.services.data_source import InMemoryRiceDataSource
from app.services.rag import KNOWLEDGE_DOCUMENTS, RagRetriever
from app.services.rag.retriever import _chunk_text, _tokenize
from app.tools import build_tool_registry


def test_tokenize_generates_unigram_and_bigram():
    tokens = _tokenize("稻瘟病")
    assert "稻" in tokens
    assert "稻瘟" in tokens
    assert "瘟病" in tokens


def test_chunk_text_splits_long_content():
    long_text = "水稻" * 200  # 400 字
    chunks = _chunk_text(long_text, size=160, overlap=40)
    assert len(chunks) > 1
    assert all(len(c) <= 160 for c in chunks)


def test_retriever_builds_chunks():
    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    assert retriever.chunk_count > 0


def test_search_hits_pest_control_document():
    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    hits = retriever.search("稻瘟病怎么防治", top_k=3)
    assert hits
    assert hits[0].title == "水稻主要病虫害及防治"
    assert hits[0].score > 0


def test_search_hits_subsidy_document():
    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    hits = retriever.search("稻谷生产者补贴政策", top_k=3)
    assert hits
    assert hits[0].title == "吉林省稻谷生产者补贴政策"


def test_search_empty_query_returns_empty():
    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    assert retriever.search("") == []


def test_search_as_tool_returns_dicts():
    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    results = retriever.search_as_tool("水稻施肥", top_k=2)
    assert isinstance(results, list)
    assert results
    assert all("content" in r and "source" in r for r in results)


def test_registry_includes_search_knowledge_when_retriever_provided():
    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    registry = build_tool_registry(InMemoryRiceDataSource(), retriever)
    names = [s["function"]["name"] for s in registry.schemas()]
    assert "search_knowledge" in names
    result = registry.execute("search_knowledge", {"query": "稻瘟病"})
    assert result["results"]


def test_registry_omits_search_knowledge_without_retriever():
    registry = build_tool_registry(InMemoryRiceDataSource())
    names = [s["function"]["name"] for s in registry.schemas()]
    assert "search_knowledge" not in names
