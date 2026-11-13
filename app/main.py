"""应用入口。

仅负责「装配」，不承载业务逻辑：
- 创建 FastAPI 实例
- 注册 CORS 中间件
- 注册请求上下文中间件（request_id + 结构化访问日志）
- 注册全局异常处理器
- 挂载路由
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.exceptions import register_exception_handlers
from .core.logging import setup_logging
from .core.middleware import RequestContextMiddleware

setup_logging(level=logging.DEBUG if settings.debug else logging.INFO)

# ---------------------------------------------------------------------------
# 应用实例
# ---------------------------------------------------------------------------
app = FastAPI(
    title="延边大米 · AI 数据分析服务",
    description="为前端「延边大米长势与产量 AI 数据分析平台」提供唯一接口 /api/ask",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS：放行前端来源
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 请求上下文（request_id / 访问日志）；放在最后注册使其成为最外层中间件
# ---------------------------------------------------------------------------
app.add_middleware(RequestContextMiddleware)

# ---------------------------------------------------------------------------
# 全局异常处理
# ---------------------------------------------------------------------------
register_exception_handlers(app)

# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------
from .api.routes import ask  # noqa: E402  # 延迟导入，避免循环依赖

app.include_router(ask.router)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """健康检查，供部署探针与联调自检使用。"""
    return {"status": "ok"}
