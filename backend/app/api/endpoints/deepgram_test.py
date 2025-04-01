# backend/app/api/endpoints/deepgram_test.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from app.core.config import settings
from app.services.deepgram_service import deepgram_client

router = APIRouter()
logger = logging.getLogger(__name__)

class DeepgramStatusResponse(BaseModel):
    status: str
    api_key_configured: bool
    client_initialized: bool
    details: Optional[str] = None

@router.get("/status", response_model=DeepgramStatusResponse)
async def deepgram_status():
    """
    Check the status of the Deepgram API configuration.
    """
    try:
        # Check if API key is configured
        api_key_configured = bool(settings.DEEPGRAM_API_KEY)
        api_key_preview = settings.DEEPGRAM_API_KEY[:4] + "..." if api_key_configured else "None"
        
        # Check if client is initialized
        client_initialized = deepgram_client is not None
        
        if not api_key_configured:
            return {
                "status": "error",
                "api_key_configured": False,
                "client_initialized": client_initialized,
                "details": "Deepgram API key is not configured in .env file"
            }
            
        if not client_initialized:
            return {
                "status": "error",
                "api_key_configured": True,
                "client_initialized": False,
                "details": f"API key is set (starting with {api_key_preview}), but client failed to initialize"
            }
            
        return {
            "status": "ok",
            "api_key_configured": True,
            "client_initialized": True,
            "details": f"Deepgram client is properly configured with API key starting with {api_key_preview}"
        }
    
    except Exception as e:
        logger.error(f"Error checking Deepgram status: {e}", exc_info=True)
        return {
            "status": "error",
            "api_key_configured": False,
            "client_initialized": False,
            "details": f"Error checking Deepgram status: {str(e)}"
        } 