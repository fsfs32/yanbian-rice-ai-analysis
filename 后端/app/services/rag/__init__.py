"""RAG 检索增强模块。

提供基于 BM25 的轻量检索器与延边水稻专业知识库，供 Agent 通过
`search_knowledge` 工具在回答内置数据之外的专业问题时检索增强。
"""
from .knowledge import KNOWLEDGE_DOCUMENTS
from .retriever import RagRetriever

__all__ = ["KNOWLEDGE_DOCUMENTS", "RagRetriever"]
