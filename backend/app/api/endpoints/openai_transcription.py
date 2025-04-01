import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from uuid import uuid4

from app.services.openai_service import process_audio_stream
from app.ssl_fix import apply_ssl_fixes

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/transcribe")
async def openai_transcribe_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio transcription using OpenAI's API.
    The client sends audio data as binary messages, and receives transcription results.
    """
    # Generate a unique ID for this consultation
    consultation_id = f"openai-consultation-{uuid4()}"
    
    try:
        # Apply SSL fixes before accepting the connection
        apply_ssl_fixes()
        
        # Accept the WebSocket connection
        await websocket.accept()
        logger.info(f"WebSocket connection established for OpenAI transcription: {consultation_id}")
        
        # Send a ready message to the client
        await websocket.send_json({
            "status": "ready", 
            "message": "OpenAI transcription service ready",
            "consultation_id": consultation_id
        })
        
        # Process the audio stream using the OpenAI service
        await process_audio_stream(websocket, consultation_id)
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for OpenAI transcription: {consultation_id}")
    except Exception as e:
        logger.error(f"Error in OpenAI transcription WebSocket: {str(e)}", exc_info=True)
        try:
            await websocket.send_json({
                "event": "error",
                "message": f"Server error: {str(e)}",
                "consultation_id": consultation_id
            })
        except:
            pass  # Connection might already be closed 