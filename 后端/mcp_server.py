#!/usr/bin/env python
"""MCP Server：把本项目的三个数据工具通过 Model Context Protocol 暴露出去。

为什么要单独做一层：
- 比赛评分里「MCP 协议或 Function Calling」二选一，项目主链路走的是 Function Calling，
  已经可跑；但把同一批工具再以 MCP 暴露一遍，意味着这些能力可以被任何支持 MCP 的
  客户端（Claude Desktop、IDE 插件等）直接复用，而不是绑死在这个 Web 应用里。

实现方式：
- 不引入 MCP SDK，纯标准库实现 JSON-RPC 2.0 over stdio（每行一条消息），
  避免为演示环境增加安装负担；
- 工具实现直接复用 app 层的数据源与检索器，保证 MCP 与 Web 两条链路的数据口径一致。

用法（管道方式测试）：
    echo {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}} | python mcp_server.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable

# 允许以脚本方式直接运行（把后端目录加入 import 路径）
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.data_source import InMemoryRiceDataSource  # noqa: E402
from app.services.rag import KNOWLEDGE_DOCUMENTS, RagRetriever  # noqa: E402

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "yanbian-rice-tools", "version": "1.0.0"}

_datasource = InMemoryRiceDataSource()
_retriever = RagRetriever(KNOWLEDGE_DOCUMENTS)


# ----------------------------------------------------------------------
# 工具实现（与 Web 端工具注册表共用同一数据口径）
# ----------------------------------------------------------------------
def tool_query_yield(start_year: int = 2016, end_year: int = 2025) -> dict[str, Any]:
    """查询延边州稻谷逐年的产量与产值估算。"""
    return _datasource.query_yield(int(start_year), int(end_year))


def tool_query_statistics(field: str = "yield") -> dict[str, Any]:
    """对产量或产值做描述性统计（极值、均值、峰谷差等）。"""
    if field not in ("yield", "revenue"):
        raise ValueError("field 只能是 yield 或 revenue")
    return _datasource.query_statistics(field)


def tool_search_knowledge(query: str, top_k: int = 3) -> dict[str, Any]:
    """检索延边水稻农技知识库（栽培、施肥、病虫害、政策等）。"""
    results = _retriever.search(query, top_k=int(top_k))
    return {
        "query": query,
        "results": [
            {
                "title": item.title,
                "source": item.source,
                "content": item.content,
                "score": round(float(item.score), 3),
            }
            for item in results
        ],
    }


TOOLS: list[dict[str, Any]] = [
    {
        "name": "query_yield",
        "description": "查询延边州稻谷逐年的产量（万吨）与产值估算（亿元）",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start_year": {"type": "integer", "description": "起始年份，如 2016"},
                "end_year": {"type": "integer", "description": "结束年份，如 2025"},
            },
        },
    },
    {
        "name": "query_statistics",
        "description": "对延边州稻谷产量或产值做描述性统计，返回最大值、最小值、均值与峰谷差",
        "inputSchema": {
            "type": "object",
            "properties": {
                "field": {
                    "type": "string",
                    "enum": ["yield", "revenue"],
                    "description": "yield 表示产量，revenue 表示产值估算",
                }
            },
            "required": ["field"],
        },
    },
    {
        "name": "search_knowledge",
        "description": "检索延边水稻农技知识库，覆盖栽培、施肥、病虫害防治、补贴政策、农时与品种",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "检索语句，如「稻瘟病怎么防治」"},
                "top_k": {"type": "integer", "description": "返回条数，默认 3"},
            },
            "required": ["query"],
        },
    },
]

HANDLERS: dict[str, Callable[..., dict[str, Any]]] = {
    "query_yield": tool_query_yield,
    "query_statistics": tool_query_statistics,
    "search_knowledge": tool_search_knowledge,
}


# ----------------------------------------------------------------------
# JSON-RPC 处理
# ----------------------------------------------------------------------
def handle_request(message: dict[str, Any]) -> dict[str, Any] | None:
    """处理一条 JSON-RPC 消息，返回响应；通知类消息返回 None。"""
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params") or {}

    # 通知（没有 id）不需要响应
    if request_id is None and method and method.startswith("notifications/"):
        return None

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": SERVER_INFO,
            },
        }

    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}

    if method == "tools/call":
        name = params.get("name")
        arguments = params.get("arguments") or {}
        handler = HANDLERS.get(name or "")
        if handler is None:
            return _error(request_id, -32602, f"未知工具：{name}")
        try:
            result = handler(**arguments)
        except Exception as exc:  # noqa: BLE001
            # 工具执行失败按 MCP 约定返回 isError，而不是协议错误
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [{"type": "text", "text": f"工具执行失败：{exc}"}],
                    "isError": True,
                },
            }
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "content": [
                    {"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}
                ],
                "isError": False,
            },
        }

    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}

    return _error(request_id, -32601, f"不支持的方法：{method}")


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    }


def main() -> None:
    """从 stdin 逐行读消息，把响应写到 stdout（每行一条 JSON）。

    MCP 传输约定使用 UTF-8；Windows 控制台默认是 GBK，这里显式固定，
    避免中文工具结果在客户端侧变成乱码。
    """
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            sys.stdout.write(json.dumps(_error(None, -32700, "消息不是合法 JSON")) + "\n")
            sys.stdout.flush()
            continue

        response = handle_request(message)
        if response is not None:
            sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
