"""流式增量提取：从模型流式返回的工具参数里，边收边抠出可展示的文字。

提交最终答案用的 submit_answer 是一个工具调用，它的参数是一段 JSON：

    {"chart_config": {...}, "labels": [...], "values": [...], "summary": "……"}

流式时这段 JSON 是分片到达的，本模块负责在分片流过时，
把 summary 字段的字符串内容逐段抠出来，让前端能边生成边渲染，
而不是等整个 JSON 收完再一次性吐出来。
"""
from __future__ import annotations

# JSON 字符串里的简单转义字符
_ESCAPES = {"n": "\n", "t": "\t", "r": "\r", '"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f"}


class SummaryExtractor:
    """从流式 JSON 片段中增量提取指定字符串字段（默认 summary）。"""

    def __init__(self, field: str = "summary") -> None:
        self._key = f'"{field}"'
        self._buffer = ""
        self._value_start = -1
        self._cursor = 0
        self._finished = False

    @property
    def finished(self) -> bool:
        """字符串字段是否已读到收尾引号"""
        return self._finished

    def feed(self, chunk: str) -> str:
        """喂入一段 JSON 片段，返回本次新解出的文本（可能为空串）。"""
        if self._finished or not chunk:
            return ""
        self._buffer += chunk

        if self._value_start < 0:
            self._value_start = self._locate_value_start()
            if self._value_start < 0:
                return ""
            self._cursor = self._value_start

        return self._consume()

    def _locate_value_start(self) -> int:
        """定位字段值引号之后的起始下标；还没到就返回 -1。"""
        key_at = self._buffer.find(self._key)
        if key_at < 0:
            return -1
        colon_at = self._buffer.find(":", key_at + len(self._key))
        if colon_at < 0:
            return -1

        index = colon_at + 1
        while index < len(self._buffer) and self._buffer[index] in " \t\r\n":
            index += 1
        if index >= len(self._buffer) or self._buffer[index] != '"':
            return -1
        return index + 1

    def _consume(self) -> str:
        """从 cursor 往后扫描，直到遇到未转义的双引号（字段结束）。"""
        chars: list[str] = []
        index = self._cursor
        length = len(self._buffer)

        while index < length:
            ch = self._buffer[index]

            if ch == "\\":
                if index + 1 >= length:
                    break  # 转义序列还没收齐，等下一个分片
                marker = self._buffer[index + 1]
                if marker == "u":
                    if index + 6 > length:
                        break  # \uXXXX 没收齐
                    try:
                        chars.append(chr(int(self._buffer[index + 2 : index + 6], 16)))
                    except ValueError:
                        pass
                    index += 6
                    continue
                chars.append(_ESCAPES.get(marker, marker))
                index += 2
                continue

            if ch == '"':
                self._finished = True
                index += 1
                break

            chars.append(ch)
            index += 1

        self._cursor = index
        return "".join(chars)
