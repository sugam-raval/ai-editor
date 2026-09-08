import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings."""

    # OpenAI Settings
    openai_api_key: Optional[str] = None
    openai_model_name: str = "gpt-4o"
    openai_temperature: float = 0.0

    # Server Settings
    host: str = "0.0.0.0"
    port: int = 8000
    environment: str = "development"
    log_level: str = "info"

    # CORS Settings
    cors_origins: List[str] = ["*"]

    # Mock mode for testing without OpenAI API Key
    enable_mock_mode: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
