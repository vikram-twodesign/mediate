import logging
import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file at startup
load_dotenv()
logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    
    # MongoDB
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "medical_consultation")
    
    # External services
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # CORS
    CORS_ORIGINS: list = ["*"]

@lru_cache()
def get_settings() -> Settings:
    """Get application settings as a singleton for efficient reuse."""
    settings = Settings()
    
    # Log important settings
    if settings.DEBUG:
        logger.info("Running in DEBUG mode")
    
    # Log API key status (without revealing the key)
    if settings.DEEPGRAM_API_KEY:
        logger.info(f"Deepgram API key configured: {settings.DEEPGRAM_API_KEY[:4]}...")
    else:
        logger.warning("Deepgram API key not configured. Transcription will not work.")
    
    # Log OpenAI API key status
    if settings.OPENAI_API_KEY:
        logger.info(f"OpenAI API key configured: {settings.OPENAI_API_KEY[:4]}...")
    else:
        logger.warning("OpenAI API key not configured. OpenAI services will not work.")
    
    return settings 