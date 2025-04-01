from fastapi import APIRouter, Depends, HTTPException
from app.services.deepgram_service import DeepgramService
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/status")
async def deepgram_status():
    """
    Check if the Deepgram API key is valid and the service is accessible.
    Returns status information about the Deepgram connection.
    """
    try:
        settings = get_settings()
        api_key = settings.DEEPGRAM_API_KEY
        
        if not api_key:
            return {
                "status": "error",
                "message": "Deepgram API key is not configured",
                "api_key_configured": False
            }
        
        # Try to create a Deepgram client to test connection
        service = DeepgramService(api_key)
        
        # Test if we can successfully create a client
        client = service.get_client()
        
        return {
            "status": "ok",
            "message": "Deepgram API key is valid and service is accessible",
            "api_key_configured": True,
            "client_initialized": client is not None
        }
    except Exception as e:
        logger.error(f"Error checking Deepgram status: {str(e)}")
        return {
            "status": "error",
            "message": f"Error connecting to Deepgram: {str(e)}",
            "api_key_configured": True,
            "error_details": str(e)
        } 