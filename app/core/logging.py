"""结构化日志与请求上下文。

- 通过 contextvars 在单次请求生命周期内透传 request_id，把同一请求的多条日志串起来；
- 日志以 JSON 行输出，便于采集、检索与排障（企业级可观测性基础）。
"""
from __future__ import annotations

import contextvars
import json
import logging
import sys
from datetime import datetime, timezone

# 请求上下文中透传的 request_id
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

# 允许从 logging extra 中透传的字段（见 core/middleware.py）
_LOG_RECORD_FIELDS = ("method", "path", "status", "elapsed_ms")


class JsonFormatter(logging.Formatter):
    """把日志记录格式化为单行 JSON。"""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "request_id": request_id_var.get(),
            "message": record.getMessage(),
        }
        for field in _LOG_RECORD_FIELDS:
            if hasattr(record, field):
                payload[field] = getattr(record, field)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def setup_logging(level: int = logging.INFO) -> None:
    """初始化根日志器：JSON 行输出到 stdout。"""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


logger = logging.getLogger("app")
