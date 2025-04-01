import os
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings(BaseModel):
    # API settings
    API_HOST: str = Field(default=os.getenv("API_HOST", "0.0.0.0"))
    API_PORT: int = Field(default=int(os.getenv("API_PORT", "8000")))
    DEBUG: bool = Field(default=bool(os.getenv("DEBUG", "True")))
    
    # Security
    SECRET_KEY: str = Field(default=os.getenv("SECRET_KEY", ""))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    
    # Database
    DATABASE_URL: str = Field(default=os.getenv("DATABASE_URL", ""))
    
    # CORS - Update to explicitly include the frontend origin
    CORS_ORIGINS: list[str] = Field(default=["http://localhost:3000", "http://127.0.0.1:3000"])
    
    # External APIs
    OPENAI_API_KEY: str = Field(default=os.getenv("OPENAI_API_KEY", ""))
    GOOGLE_SPEECH_TO_TEXT_KEY: str = Field(default=os.getenv("GOOGLE_SPEECH_TO_TEXT_KEY", ""))
    GEMINI_API_KEY: str = Field(default=os.getenv("GEMINI_API_KEY", ""))
    DEEPGRAM_API_KEY: str = Field(default=os.getenv("DEEPGRAM_API_KEY", ""))

settings = Settings() 