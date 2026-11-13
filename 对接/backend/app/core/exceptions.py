"""统一异常体系与全局异常处理器。

业务异常统一继承 `AppError`，携带稳定错误码；全局处理器将异常归一化为
标准 JSON 错误响应，避免把堆栈信息泄露给前端。
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import settings


class AppError(Exception):
    """业务异常基类。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        detail: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.detail = detail or {}


class LlmError(AppError):
    """大模型调用失败。"""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="LLM_ERROR", status_code=502)


class LlmTimeoutError(AppError):
    """大模型调用超时。"""

    def __init__(self, message: str = "AI 服务响应超时，请稍后重试") -> None:
        super().__init__(message, code="LLM_TIMEOUT", status_code=504)


class ToolExecutionError(AppError):
    """工具（数据查询）执行失败。"""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="TOOL_EXECUTION_ERROR", status_code=500)


class ResponseValidationError(AppError):
    """后端生成的响应未通过契约校验。"""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="RESPONSE_VALIDATION_ERROR", status_code=500)


def _build_error_body(exc: AppError) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": {"code": exc.code, "message": exc.message}
    }
    if exc.detail:
        body["error"]["detail"] = exc.detail
    return body


def register_exception_handlers(app: FastAPI) -> None:
    """向应用注册全局异常处理器。"""

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_build_error_body(exc))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "REQUEST_VALIDATION_ERROR", "message": "请求参数不合法", "detail": exc.errors()}},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        if settings.debug:
            message = f"{type(exc).__name__}: {exc}"
        else:
            message = "服务内部错误"
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_ERROR", "message": message}},
        )
