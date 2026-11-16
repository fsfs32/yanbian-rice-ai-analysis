"""MCP Server 协议测试：验证 initialize / tools/list / tools/call 三条主链路。

MCP 是评分项「MCP/工具集成」的依据，这里用纯函数方式直接打协议层，
不依赖 Claude Desktop 等外部客户端。
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

_SERVER_PATH = Path(__file__).resolve().parents[1] / "mcp_server.py"
_spec = importlib.util.spec_from_file_location("mcp_server", _SERVER_PATH)
assert _spec and _spec.loader
mcp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mcp)


def test_initialize_returns_protocol_and_server_info() -> None:
    response = mcp.handle_request({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})

    assert response["jsonrpc"] == "2.0"
    assert response["result"]["protocolVersion"] == mcp.PROTOCOL_VERSION
    assert response["result"]["serverInfo"]["name"] == "yanbian-rice-tools"
    assert "tools" in response["result"]["capabilities"]


def test_tools_list_exposes_all_four_tools() -> None:
    response = mcp.handle_request({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})

    names = {tool["name"] for tool in response["result"]["tools"]}
    assert names == {"query_yield", "query_statistics", "query_cities", "search_knowledge"}
    for tool in response["result"]["tools"]:
        assert tool["description"]
        assert tool["inputSchema"]["type"] == "object"


def test_tools_call_query_yield_returns_rows() -> None:
    response = mcp.handle_request(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "query_yield", "arguments": {"start_year": 2020, "end_year": 2021}},
        }
    )

    content = response["result"]["content"][0]["text"]
    assert response["result"]["isError"] is False
    assert "2021" in content and "25.22" in content


def test_tools_call_unknown_tool_returns_protocol_error() -> None:
    response = mcp.handle_request(
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {"name": "no_such_tool", "arguments": {}},
        }
    )

    assert response["error"]["code"] == -32602


def test_tools_call_bad_arguments_returns_is_error() -> None:
    response = mcp.handle_request(
        {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {"name": "query_statistics", "arguments": {"field": "unknown"}},
        }
    )

    assert response["result"]["isError"] is True
    assert "工具执行失败" in response["result"]["content"][0]["text"]


def test_unknown_method_returns_method_not_found() -> None:
    response = mcp.handle_request({"jsonrpc": "2.0", "id": 6, "method": "no/such/method"})

    assert response["error"]["code"] == -32601
