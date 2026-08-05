"""Configuration settings for the Smart Receipt Analysis system."""

# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App Info
    APP_NAME: str = "Smart Receipt Analysis & Anomaly Detection"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database Configuration
    MONGO_URL: str = "mongodb://localhost:27017"
    MONGO_DB: str = "receipt_db"

    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    POSTGRES_URL: str = "postgresql://user:password@localhost:5432/receipt_db"

    # Model Paths
    TESSERACT_PATH: Optional[str] = None
    LAYOUTLMV3_MODEL_PATH: str = "microsoft/layoutlmv3-base"
    LAYOUTLMV3_CHECKPOINT: Optional[str] = None

    # API Configuration
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list = ["*"]

    # Feature Flags
    ENABLE_RECIPE_ASSISTANT: bool = True
    ENABLE_CHATBOT: bool = True
    ENABLE_FORECASTING: bool = True

    # Anomaly Detection Thresholds
    ANOMALY_SCORE_THRESHOLD: float = 0.65  # Flag if anomaly score > this
    EWMA_ALPHA: float = 0.3  # Exponential smoothing factor
    ISOLATION_FOREST_CONTAMINATION: float = 0.1

    # Forecasting Configuration
    FORECAST_WINDOW_DAYS: int = 30
    MIN_HISTORY_DAYS: int = 14

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
