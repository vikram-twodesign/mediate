import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from uuid import uuid4
# Remove unused imports related to background tasks and old service
# from fastapi import BackgroundTasks
# import os
# from app.services.transcription_service import transcribe_audio

# Import the new Gemini service
# from app.services.gemini_service import transcribe_audio_gemini

from app.services.deepgram_service import transcribe_audio_file, process_audio_stream

import asyncio
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)
import os
from dotenv import load_dotenv

# Import the new AI analysis service
from app.services.ai_analysis import analyze_transcript_chunk

# Load environment variables
load_dotenv()

# Get API key from environment
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Deepgram client configuration
config: DeepgramClientOptions = DeepgramClientOptions(
    verbose=logging.DEBUG # Optional: Log Deepgram SDK details
)

# --- Input Validation ---
if not DEEPGRAM_API_KEY:
    logger.error("DEEPGRAM_API_KEY not found in environment variables.")
    # In a real app, you might raise an exception or handle this differently
    # For now, we'll allow it to proceed but Deepgram connection will fail.

# Initialize Deepgram client only if the key exists
deepgram: DeepgramClient | None = None
if DEEPGRAM_API_KEY:
    try:
        deepgram = DeepgramClient(DEEPGRAM_API_KEY, config)
        logger.info("Deepgram client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Deepgram client: {e}", exc_info=True)
else:
    logger.warning("Deepgram client not initialized due to missing API key.")

router = APIRouter()

# Define the necessary response models
class DirectTranscriptionResponse(BaseModel):
    transcription: Optional[str] = None
    error: Optional[str] = None

# Remove the old request model if not needed elsewhere
# class TranscriptionRequest(BaseModel):
#     audio_url: Optional[str] = None
#     language_code: str = "en-US"
#     enable_automatic_punctuation: bool = True
#     enable_speaker_diarization: bool = True
#     diarization_speaker_count: int = 2

# Remove the old response model if not needed elsewhere
# class TranscriptionResponse(BaseModel):
#     id: str
#     status: str
#     text: Optional[str] = None
#     segments: Optional[List[dict]] = None
#     error: Optional[str] = None

@router.post("/direct", response_model=DirectTranscriptionResponse)
async def transcribe_audio_direct(
    file: UploadFile = File(...),
):
    """
    Transcribes an uploaded audio file directly using the Deepgram API.
    Receives an audio file and returns the transcription text.
    """
    try:
        # Check file type
        content_type = file.content_type or ""
        if not content_type.startswith("audio/"):
            raise HTTPException(
                status_code=400, 
                detail=f"File must be an audio file, got {content_type}")
        
        # Process with Deepgram
        result = await transcribe_audio_file(file)
        
        # Extract transcription text for the direct response format
        transcription_text = result.get("text", "")
        
        if transcription_text:
            return {"transcription": transcription_text}
        else:
            raise HTTPException(status_code=500, detail="Transcription resulted in empty text.")

    except HTTPException as http_exc:
        # Re-raise HTTPExceptions raised by the service
        raise http_exc
    except Exception as e:
        # Catch any other unexpected errors
        logger.error(f"Unexpected error during direct transcription: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

# Comment out or remove the old polling endpoint as it's not used in this direct flow
# @router.get("/{transcription_id}", response_model=TranscriptionResponse)
# async def get_transcription(transcription_id: str):
#     """
#     Get the status or result of a transcription task.
#     This will be implemented to check status and return results when complete.
#     """
#     # This is a placeholder - actual implementation would check database
#     return {
#         "id": transcription_id,
#         "status": "processing",
#         "text": None,
#         "segments": None,
#         "error": None
#     }

# Keep the old endpoint commented out or remove if definitely not needed
# @router.post("/", response_model=TranscriptionResponse)
# async def transcribe_audio_file(...):
#    ... 

@router.post("/upload", response_model=Dict[str, Any])
async def upload_audio(
    file: UploadFile = File(...),
):
    """
    Upload an audio file for transcription.
    
    The endpoint uses Deepgram to transcribe the audio file and returns
    the transcription results.
    
    Parameters:
    - file: The audio file to transcribe
    
    Returns:
    - A dictionary containing transcription results
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    try:
        # Check file type
        content_type = file.content_type or ""
        if not content_type.startswith("audio/"):
            raise HTTPException(
                status_code=400, 
                detail=f"File must be an audio file, got {content_type}")
        
        # Process with Deepgram
        result = await transcribe_audio_file(file)
        
        return result
    except Exception as e:
        logger.error(f"Error processing audio file: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e)) 

@router.websocket("/ws/transcribe")
async def transcribe_stream_endpoint(websocket: WebSocket):
    """Handles the WebSocket connection for real-time transcription and AI analysis."""
    await websocket.accept()
    logger.info("WebSocket connection accepted.")

    if not deepgram:
        logger.error("Deepgram client not available. Cannot start transcription.")
        await websocket.send_json({"type": "error", "message": "Deepgram client not configured on server."})
        await websocket.close(code=1011) # Internal Error
        return

    dg_connection = None # Initialize connection variable
    # --- Variables for AI Analysis ---
    full_transcript_text = "" # Accumulate transcript here
    last_analyzed_length = 0
    ANALYSIS_THRESHOLD = 300 # Analyze every N characters of new transcript
    analysis_task = None # To hold the background analysis task

    try:
        # Configure Deepgram options for the live stream
        options = LiveOptions(
            model="nova-2",
            language="en-US",
            smart_format=True,
            diarize=True,
            encoding="linear16",
            sample_rate=16000,
            channels=1,
        )
        logger.info(f"Attempting to connect to Deepgram with options: {options}")

        dg_connection = deepgram.listen.asynclive.v("1")

        # --- Define Helper for Analysis ---
        async def run_analysis(current_transcript: str):
            nonlocal last_analyzed_length
            logger.info(f"Running AI analysis on transcript (length: {len(current_transcript)})...")
            analysis_result = await analyze_transcript_chunk(current_transcript)
            if analysis_result:
                logger.info(f"AI analysis successful: {analysis_result}")
                try:
                    logger.info(f"Attempting to send analysis results via WebSocket...")
                    await websocket.send_json({"type": "analysis", "data": analysis_result})
                    logger.info("Successfully sent analysis results via WebSocket.")
                    # Update last analyzed length *after* successful send
                    last_analyzed_length = len(current_transcript)
                except WebSocketDisconnect:
                     logger.warning("WebSocket disconnected during AI analysis result sending.")
                except Exception as send_err:
                    logger.error(f"Failed to send analysis result over WebSocket: {send_err}")
            else:
                logger.warning("AI analysis returned None or failed.")
            # Indicate task completion (or handle errors if needed)

        # --- Define Deepgram Event Handlers ---
        async def on_message(self, result, **kwargs):
            nonlocal full_transcript_text, last_analyzed_length, analysis_task
            try:
                if not result or not result.channel or not result.channel.alternatives:
                    logger.warning("Received empty or malformed transcript result from Deepgram.")
                    return

                sentence = result.channel.alternatives[0].transcript
                if not sentence:
                    return

                words = result.channel.alternatives[0].words
                speaker = words[0].speaker if words else 0
                is_final = result.is_final

                # Construct message to send back to frontend (original transcript part)
                message_to_send = {
                    "type": "transcript",
                    "is_final": is_final,
                    "speaker": speaker,
                    "text": sentence.strip()
                }
                await websocket.send_json(message_to_send)
                logger.info(f"Sent to client: Speaker {speaker}: {sentence.strip()} (Final: {is_final})")

                # --- AI Analysis Trigger ---
                if is_final and sentence.strip():
                    # Append final transcript segment with speaker info
                    full_transcript_text += f"Speaker {speaker + 1}: {sentence.strip()}\n"
                    
                    # --> Add log to check threshold condition
                    logger.debug(f"Checking analysis threshold: Current length={len(full_transcript_text)}, Last analyzed={last_analyzed_length}, Threshold={ANALYSIS_THRESHOLD}")

                    # Check if enough new text has accumulated and no analysis is running
                    if len(full_transcript_text) - last_analyzed_length >= ANALYSIS_THRESHOLD and (analysis_task is None or analysis_task.done()):
                        # Launch analysis in the background
                        logger.info(f"Threshold reached ({len(full_transcript_text) - last_analyzed_length} >= {ANALYSIS_THRESHOLD}). Triggering AI analysis task.")
                        analysis_task = asyncio.create_task(run_analysis(full_transcript_text))
                        # Don't update last_analyzed_length here; update it after analysis succeeds
                    elif analysis_task and not analysis_task.done():
                        logger.debug("AI analysis already in progress, skipping trigger.")

            except WebSocketDisconnect:
                 logger.warning("WebSocket disconnected during message processing.")
                 # Allow the main loop to handle cleanup
                 raise
            except Exception as e:
                logger.error(f"Error processing Deepgram message or triggering analysis: {e}", exc_info=True)
                try:
                   await websocket.send_json({"type": "error", "message": "Error processing transcript."})
                except Exception:
                    pass

        async def on_metadata(self, metadata, **kwargs):
            logger.info(f"Deepgram metadata received: {metadata}")

        async def on_utterance_end(self, utterance_end, **kwargs):
            nonlocal analysis_task, full_transcript_text
            logger.info(f"Deepgram utterance end received: {utterance_end}")
            # Option: Trigger a final analysis run if not already running and there's text
            if full_transcript_text and (analysis_task is None or analysis_task.done()):
                 logger.info("Triggering final analysis on utterance end.")
                 logger.info("Starting final analysis task on utterance end...")
                 analysis_task = asyncio.create_task(run_analysis(full_transcript_text))

        async def on_error(self, error, **kwargs):
            logger.error(f"Deepgram error received: {error}")
            try:
                await websocket.send_json({"type": "error", "message": f"Transcription service error: {error.get('message', 'Unknown error')}"})
            except Exception:
                pass # Ignore if sending fails

        # Assign handlers
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        dg_connection.on(LiveTranscriptionEvents.Metadata, on_metadata)
        dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)

        # Start the connection
        await dg_connection.start(options)
        logger.info("Deepgram connection started.")

        # Send a ready message to the client
        await websocket.send_json({"type": "status", "message": "Transcription service ready"})

        # --- Receive Audio Data Loop ---
        while True:
            try:
                # Receive binary audio data from the client
                data = await websocket.receive_bytes()
                # logger.debug(f"Received {len(data)} bytes from client") # Very verbose

                # Send the audio data to Deepgram
                # Use the asynchronous send method
                await dg_connection.send(data)

            except WebSocketDisconnect:
                logger.info("WebSocket disconnected by client.")
                break # Exit the loop
            except Exception as e:
                logger.error(f"Error receiving/sending audio data: {e}", exc_info=True)
                # Decide if the error is fatal or recoverable
                # For now, we'll try to send an error and break
                try:
                    await websocket.send_json({"type": "error", "message": "Server error processing audio."})
                except Exception:
                    pass # Ignore if sending fails
                break # Exit the loop

    except Exception as e:
        logger.error(f"Error during WebSocket setup or main loop: {e}", exc_info=True)
        try:
            # Attempt to send a final error message if the socket is still open
            await websocket.send_json({"type": "error", "message": f"An internal server error occurred: {e}"}) 
        except Exception:
            pass # Ignore if socket is already closed

    finally:
        logger.info("Cleaning up WebSocket connection...")
        # Wait for any pending analysis task to finish (with a timeout)
        if analysis_task and not analysis_task.done():
            logger.info("Waiting for pending analysis task to complete...")
            try:
                await asyncio.wait_for(analysis_task, timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("Timeout waiting for analysis task to complete.")
                analysis_task.cancel()
            except Exception as task_err:
                 logger.error(f"Error during final analysis task wait: {task_err}")

        # Cleanly close the Deepgram connection if it was opened
        if dg_connection:
            logger.info("Closing Deepgram connection...")
            await dg_connection.finish()
            logger.info("Deepgram connection closed.")

        # Ensure the WebSocket is closed from the server side
        try:
            # Check state before closing
            if websocket.client_state != WebSocketState.DISCONNECTED:
                 await websocket.close()
                 logger.info("WebSocket connection closed from server.")
        except RuntimeError as e:
             # Handle cases where the connection might already be closed unexpectedly
             if "WebSocket is not connected" in str(e):
                  logger.warning("WebSocket already closed when attempting final close.")
             else:
                  logger.error(f"Runtime error during WebSocket close: {e}")
        except Exception as e:
             logger.error(f"Error during WebSocket close: {e}", exc_info=True)

# --- Import necessary type for state checking ---
from starlette.websockets import WebSocketState

# Keep the old endpoint commented out or remove if definitely not needed
# @router.post("/", response_model=TranscriptionResponse)
# async def transcribe_audio_file(...):
#    ... 