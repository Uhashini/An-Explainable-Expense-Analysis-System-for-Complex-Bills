"""Configuration settings for the Smart Receipt Analysis system."""

import os
from dotenv import load_dotenv

# Resolve absolute path to backend/.env
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_file_path = os.path.join(backend_dir, ".env")
if os.path.exists(env_file_path):
    load_dotenv(env_file_path)

try:
    from pydantic_settings import BaseSettings
except ImportError:
    try:
        from pydantic import BaseSettings
    except Exception:
        from pydantic.v1 import BaseSettings
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

    # JWT Authentication Configuration
    JWT_SECRET_KEY: str = "pantrix-secure-jwt-secret-key-super-safe-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: Optional[str] = None
    EXPO_PUBLIC_GOOGLE_CLIENT_ID: Optional[str] = None

    # Feature Flags
    ENABLE_RECIPE_ASSISTANT: bool = True
    ENABLE_CHATBOT: bool = True
    ENABLE_FORECASTING: bool = True

    # LLM / Gemma 3 12B Configuration
    GEMMA_MODEL_NAME: str = "gemma-3-12b-it"
    GEMINI_API_KEY: Optional[str] = None
    GEMMA_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    LLM_API_BASE_URL: Optional[str] = None

    # Anomaly Detection Thresholds
    ANOMALY_SCORE_THRESHOLD: float = 0.65  # Flag if anomaly score > this
    EWMA_ALPHA: float = 0.3  # Exponential smoothing factor
    ISOLATION_FOREST_CONTAMINATION: float = 0.1

    # Forecasting Configuration
    FORECAST_WINDOW_DAYS: int = 30
    MIN_HISTORY_DAYS: int = 14

    # File Storage
    UPLOAD_DIR: str = "uploads/"
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB

    # Logging
    LOG_LEVEL: str = "INFO"

    model_config = {
        "env_file": env_file_path if os.path.exists(env_file_path) else ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }




settings = Settings()
