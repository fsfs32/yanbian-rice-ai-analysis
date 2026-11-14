"""应用配置。

通过 pydantic-settings 从环境变量 / .env 文件读取，禁止在代码中硬编码
任何密钥（这是项目红线之一）。
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """全局配置项，字段名即环境变量名（大小写不敏感）。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # 服务
    # ------------------------------------------------------------------
    app_name: str = "延边大米 · AI 数据分析服务"
    app_env: str = Field(default="development", description="development / production / test")
    debug: bool = True

    # ------------------------------------------------------------------
    # CORS：放行前端来源
    # ------------------------------------------------------------------
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    # ------------------------------------------------------------------
    # LLM（默认 DeepSeek，OpenAI 兼容协议，可切换其它兼容端点）
    # ------------------------------------------------------------------
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_api_key: str = ""
    llm_model: str = "deepseek-chat"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 2048
    llm_timeout_seconds: float = 20.0
    llm_max_retries: int = 2

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, value: object) -> object:
        """支持以逗号分隔字符串或 JSON 数组形式注入 CORS 来源。"""
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    """返回单例配置（进程内缓存）。"""
    return Settings()


settings = get_settings()
