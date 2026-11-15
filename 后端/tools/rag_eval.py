#!/usr/bin/env python
"""RAG 检索质量评测：用固定 query 集算 Recall@1 / Recall@3。

为什么要有这个：
比赛评分里写「生成质量是否因检索增强而显著提升」，但「用了 RAG」和「RAG 有用」
是两件事。这个脚本提供一个可复现的数字：给定二十条真实问法，
检索器的前三条结果里有没有命中该答的那篇文档。

用法（在后端目录下）：
    .venv\\Scripts\\python.exe tools/rag_eval.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.rag import KNOWLEDGE_DOCUMENTS, RagRetriever  # noqa: E402

# (用户问法, 期望命中的文档标题关键词)
# 关键词取自知识库标题，命中即视为检索正确
EVAL_SET: list[tuple[str, str]] = [
    ("什么时候插秧", "农时"),
    ("插完秧水要放多深", "水层"),
    ("稻瘟病怎么防治", "病虫害"),
    ("稗草怎么除", "稗草"),
    ("种什么品种好", "品种"),
    ("稻谷补贴怎么申请", "补贴"),
    ("氮肥怎么施", "施肥"),
    ("低温冷害怎么防", "水层"),
    ("2025年产量多少", "2025"),
    ("整地有什么要求", "栽培"),
    ("稻飞虱用什么药", "病虫害"),
    ("纹枯病什么时候防", "病虫害"),
    ("秧龄多长合适", "栽培"),
    ("山区的插秧时间", "农时"),
    ("吉粳830 是什么品种", "品种"),
    ("两封一杀是什么意思", "稗草"),
    ("分蘖肥什么时候施", "施肥"),
    ("稻谷补贴给谁", "补贴"),
    ("亩产多少", "2025"),
    ("育秧注意什么", "栽培"),
    # 以下 5 条对应新补的病虫害与用药文档
    ("稻曲病什么时候防", "稻曲病"),
    ("潜叶蝇怎么治", "潜叶蝇"),
    ("负泥虫怎么办", "负泥虫"),
    ("二化螟什么时候打药", "防治指标"),
    ("稻田能用菊酯类农药吗", "安全用药"),
    # 以下 5 条是纯口语问法，用来验证查询改写有没有起作用
    ("今年收成咋样", "2025"),
    ("打药治稻瘟病", "病虫害"),
    ("上肥怎么弄", "施肥"),
    ("稗草多咋办", "稗草"),
    ("插完水放多深", "水层"),
]


def _run_eval(retriever: RagRetriever, quiet: bool = False) -> tuple[int, int, list[str]]:
    """跑一遍评测集，返回 (Recall@1 命中数, Recall@3 命中数, 未命中列表)。"""
    hit1 = hit3 = 0
    failures: list[str] = []
    for query, expected in EVAL_SET:
        hits = retriever.search(query, top_k=3)
        titles = [h.title for h in hits]
        in_top1 = bool(titles) and expected in titles[0]
        in_top3 = any(expected in t for t in titles)
        hit1 += int(in_top1)
        hit3 += int(in_top3)
        if not in_top3:
            failures.append(f"{query} → 期望「{expected}」，实际 {titles[:3]}")
        if not quiet:
            mark = "OK " if in_top3 else "MISS"
            print(f"{mark} {query:<18} 期望「{expected}」 → 实际：{' / '.join(titles[:3])}")
    return hit1, hit3, failures


def main() -> int:
    from app.services.rag import retriever as retriever_module

    retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)
    hit1 = hit3 = 0
    failures: list[str] = []

    print(f"知识库：{len(KNOWLEDGE_DOCUMENTS)} 篇文档")
    print(f"评测集：{len(EVAL_SET)} 条问法")
    print("-" * 78)

    hit1, hit3, failures = _run_eval(retriever)
    total = len(EVAL_SET)
    recall1 = hit1 / total * 100
    recall3 = hit3 / total * 100

    print("-" * 78)
    print(f"Recall@1 = {hit1}/{total} = {recall1:.1f}%")
    print(f"Recall@3 = {hit3}/{total} = {recall3:.1f}%")

    if failures:
        print("\n未命中：")
        for item in failures:
            print("  -", item)

    # 对照实验：临时关掉查询改写，看口语问法会掉多少
    original = retriever_module._rewrite_query
    try:
        retriever_module._rewrite_query = lambda q: q  # type: ignore[assignment]
        base1, base3, _ = _run_eval(retriever, quiet=True)
    finally:
        retriever_module._rewrite_query = original  # type: ignore[assignment]

    print()
    print("对照实验（关闭查询改写）：")
    print(f"  Recall@1 = {base1}/{total} = {base1 / total * 100:.1f}%")
    print(f"  Recall@3 = {base3}/{total} = {base3 / total * 100:.1f}%")
    print(f"  改写带来的 Recall@1 提升：{(hit1 - base1) / total * 100:.1f} 个百分点")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
