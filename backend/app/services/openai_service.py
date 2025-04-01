import logging
import os
import json
import asyncio
import websockets
import base64
import ssl
from typing import Dict, Any, Optional, List, Callable
from fastapi import WebSocket, HTTPException

from app.config import get_settings
from app.core.config import settings
from app.ssl_fix import apply_ssl_fixes

# Configure logging
logger = logging.getLogger(__name__)

# Constants for OpenAI API
OPENAI_API_URL = "wss://api.openai.com/v1/audio/transcriptions"
OPENAI_MODEL = "whisper-1"  # The model to use for transcription

async def process_audio_stream(websocket: WebSocket, consultation_id: str):
    """
    Process audio data streamed from the client via WebSocket using OpenAI's Real-time Transcription API.
    
    Args:
        websocket: The WebSocket connection from the client
        consultation_id: ID of the consultation session
    """
    settings = get_settings()
    
    # Check if OpenAI API key is configured
    if not settings.OPENAI_API_KEY:
        logger.error("Attempted to use OpenAI service, but API key is not configured.")
        await websocket.send_json({
            "event": "error",
            "message": "OpenAI API key is not configured."
        })
        return
    
    try:
        # Log the start of processing
        logger.info(f"Starting OpenAI audio stream processing for consultation {consultation_id}")
        
        # Send start event to the client
        await websocket.send_json({
            "event": "start",
            "message": "Transcription started"
        })
        
        # Create connection to OpenAI's WebSocket API
        auth_header = f"Bearer {settings.OPENAI_API_KEY}"
        connection_url = f"{OPENAI_API_URL}?model={OPENAI_MODEL}"
        
        # Configure SSL context for the connection
        ssl_context = None
        if settings.DEBUG:
            # Apply SSL fixes and create an unverified context for development
            logger.warning("⚠️ DEVELOPMENT MODE: Creating unverified SSL context for OpenAI API")
            # Apply our comprehensive SSL fixes
            apply_ssl_fixes(debug_mode=True)
            
            # Create an SSL context that doesn't verify certificates in development
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
        
        # Connect to OpenAI with appropriate SSL settings
        websocket_options = {
            "extra_headers": {"Authorization": auth_header},
            "ssl": ssl_context,  # Use our custom SSL context in development
            "ping_interval": None,  # Disable ping to avoid any timing issues
            "ping_timeout": None,  # Disable ping timeout
            "close_timeout": 10,  # Shorter close timeout
            "max_size": None,  # No limit on message size
        }
        
        logger.info(f"Connecting to OpenAI at {connection_url} with DEBUG={settings.DEBUG}")
        
        async with websockets.connect(
            connection_url,
            **websocket_options
        ) as openai_ws:
            # Track the accumulated text for the session
            accumulated_text = ""
            
            # Set up task for receiving from OpenAI
            async def receive_from_openai():
                nonlocal accumulated_text
                try:
                    async for message in openai_ws:
                        # Parse the response from OpenAI
                        response = json.loads(message)
                        
                        if "text" in response:
                            # Extract the text from the response
                            transcript_text = response.get("text", "")
                            is_final = response.get("is_final", False)
                            
                            # If this is a final segment, append to accumulated text
                            if is_final and transcript_text:
                                accumulated_text += transcript_text + " "
                            
                            # Determine if there's speaker information (if OpenAI provides it)
                            speaker_text = transcript_text
                            has_speaker_info = False
                            
                            # Only send if we have text
                            if transcript_text.strip():
                                await websocket.send_json({
                                    "event": "transcription",
                                    "text": accumulated_text + (transcript_text if not is_final else ""),
                                    "is_final": is_final,
                                    "has_speaker_info": has_speaker_info
                                })
                                
                                # Log periodically
                                if is_final and transcript_text:
                                    logger.debug(f"Transcription: {transcript_text}")
                        
                        elif "error" in response:
                            # Handle error messages from OpenAI
                            error_msg = response.get("error", {}).get("message", "Unknown error")
                            logger.error(f"OpenAI transcription error: {error_msg}")
                            await websocket.send_json({
                                "event": "error",
                                "message": f"Transcription error: {error_msg}"
                            })
                except Exception as e:
                    logger.error(f"Error receiving from OpenAI: {str(e)}")
                    await websocket.send_json({
                        "event": "error",
                        "message": f"Error receiving from OpenAI: {str(e)}"
                    })
            
            # Set up task for sending to OpenAI
            async def send_to_openai():
                try:
                    while True:
                        # Receive binary audio data from client
                        data = await asyncio.wait_for(websocket.receive_bytes(), timeout=1.0)
                        
                        # Check if we received end signal
                        if len(data) == 0 or data == b"END_STREAM":
                            logger.info(f"End of audio stream for consultation {consultation_id}")
                            break
                        
                        # Prepare audio data according to OpenAI's requirements
                        # We need to encode as base64 if OpenAI expects it
                        audio_message = {
                            "audio": base64.b64encode(data).decode('utf-8'),
                            "encoding": "base64"
                        }
                        
                        # Send to OpenAI
                        await openai_ws.send(json.dumps(audio_message))
                except asyncio.TimeoutError:
                    # This is normal when audio is being processed
                    pass
                except Exception as e:
                    logger.error(f"Error sending to OpenAI: {str(e)}")
                    raise
            
            # Run both tasks concurrently
            try:
                # Create tasks for sending and receiving
                send_task = asyncio.create_task(send_to_openai())
                receive_task = asyncio.create_task(receive_from_openai())
                
                # Wait for the send task to complete (when the client stops sending)
                await send_task
                
                # Cancel the receive task
                receive_task.cancel()
                try:
                    await receive_task
                except asyncio.CancelledError:
                    pass
            except Exception as e:
                logger.error(f"Error in OpenAI WebSocket communication: {str(e)}")
            finally:
                # Send completion notification
                await websocket.send_json({
                    "event": "end",
                    "message": "Transcription completed"
                })
                logger.info(f"Transcription completed for consultation {consultation_id}")
                
    except Exception as e:
        logger.error(f"Error in OpenAI streaming for {consultation_id}: {e}", exc_info=True)
        
        # Send error to client
        try:
            await websocket.send_json({
                "event": "error",
                "message": f"Transcription error: {str(e)}"
            })
        except Exception as send_error:
            logger.error(f"Failed to send error message to client: {str(send_error)}") 