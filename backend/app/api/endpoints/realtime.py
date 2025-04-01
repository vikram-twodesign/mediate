# backend/app/api/endpoints/realtime.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
import logging
import asyncio # Need asyncio for sleep
from app.services.deepgram_service import DeepgramService
from app.config import get_settings
import base64

# Basic logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory storage of active WebSocket connections and their Deepgram connections
active_connections = {}

@router.websocket("/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Create a unique ID for this connection
    connection_id = id(websocket)
    logger.info(f"New WebSocket connection established: {connection_id}")
    
    # Store the WebSocket connection
    active_connections[connection_id] = {"websocket": websocket, "deepgram_connection": None}
    
    # Get settings
    settings = get_settings()
    
    # Create a callback function to handle transcription results
    async def transcription_callback(transcript):
        try:
            if transcript.startswith("TRANSCRIPTION_ERROR"):
                await websocket.send_json({"error": transcript})
            elif transcript == "TRANSCRIPTION_CLOSED":
                await websocket.send_json({"status": "closed"})
            else:
                await websocket.send_json({"transcript": transcript})
        except Exception as e:
            logger.error(f"Error in transcription callback: {str(e)}")
    
    try:
        # Initialize Deepgram service
        deepgram_service = DeepgramService()
        
        # Start Deepgram live transcription connection
        connection, error = await deepgram_service.process_audio_stream(transcription_callback)
        
        if error:
            logger.error(f"Failed to start Deepgram connection: {error}")
            await websocket.send_json({"error": f"Failed to initialize transcription: {error}"})
            return
        
        # Store the Deepgram connection
        active_connections[connection_id]["deepgram_connection"] = connection
        
        # Send a message indicating that transcription is ready
        await websocket.send_json({"status": "ready", "message": "Transcription is ready. Send audio data."})
        
        # Keep the connection open and process incoming audio data
        while True:
            # Receive message from WebSocket
            data = await websocket.receive_text()
            
            # Check if the message is a ping
            if data == "ping":
                await websocket.send_text("pong")
                continue
            
            try:
                # Assuming data is base64 encoded audio
                audio_data = base64.b64decode(data)
                
                # Send audio data to Deepgram
                connection.send(audio_data)
            except Exception as e:
                logger.error(f"Error processing audio data: {str(e)}")
                await websocket.send_json({"error": f"Error processing audio: {str(e)}"})
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {str(e)}")
        try:
            await websocket.send_json({"error": f"Server error: {str(e)}"})
        except:
            pass
    
    finally:
        # Clean up Deepgram connection if it exists
        connection_info = active_connections.pop(connection_id, None)
        if connection_info and connection_info.get("deepgram_connection"):
            try:
                await connection_info["deepgram_connection"].finish()
                logger.info(f"Closed Deepgram connection for {connection_id}")
            except Exception as e:
                logger.error(f"Error closing Deepgram connection: {str(e)}")

websocket_router = router 