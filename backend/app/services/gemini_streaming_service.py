# backend/app/services/gemini_streaming_service.py
import google.generativeai as genai
from app.core.config import settings
import logging
import asyncio
from fastapi import WebSocket, HTTPException
import io
import wave
from typing import Dict, Any, List, Optional
import random

# Configure logging
logger = logging.getLogger(__name__)

# Configure the Gemini client
try:
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not found in settings. Gemini service will not be available.")
    else:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        logger.info("Gemini API configured successfully.")
except Exception as e:
    logger.error(f"Failed to configure Gemini API: {e}")

# Define the model to use for live streaming
MODEL_NAME = "gemini-2.0-flash"  # Use the experimental flash model for streaming

# Simulated phrases for more realistic transcription simulation
SIMULATED_PHRASES = [
    "Hello, doctor. I've been experiencing some symptoms lately.",
    "I've had a persistent headache for about three days now.",
    "It's mostly on the right side of my head, behind my eye.",
    "Yes, I've taken some over-the-counter pain medication.",
    "It helps for a few hours, but then the pain returns.",
    "I've also noticed some sensitivity to light.",
    "No, I haven't had any fever or nausea.",
    "I do have a history of migraines in my family.",
    "My mother and sister both get them frequently.",
    "I've been under more stress at work recently.",
    "I'm sleeping about six hours per night on average.",
    "I drink around two cups of coffee per day.",
    "Thank you for your time, doctor."
]

async def process_audio_stream(websocket: WebSocket, consultation_id: str):
    """
    Process audio data streamed from the client via WebSocket.

    Args:
        websocket: The WebSocket connection
        consultation_id: ID of the consultation session
    """
    try:
        # Log the start of processing with consultation ID for debugging
        logger.info(f"Starting audio stream processing for consultation {consultation_id}")
        
        # Send start event to the client
        await websocket.send_json({
            "event": "start",
            "message": "Transcription started"
        })
        logger.info("Sent 'start' event to client")

        # Simulate receiving audio and generating transcription
        audio_chunks = []
        current_phrase_index = 0
        accumulated_text = ""
        chunk_counter = 0
        
        # Main processing loop
        while True:
            try:
                # Receive binary audio data from the client with a timeout
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=1.0)
                
                # Check if we received end signal
                if len(data) == 0 or data == b"END_STREAM":
                    logger.info(f"End of audio stream for consultation {consultation_id}")
                    break
                
                # Store the audio chunk and increment counter
                audio_chunks.append(data)
                chunk_counter += 1
                
                # Send a simulated transcription update more frequently - every 2 chunks
                if chunk_counter % 2 == 0:
                    # Add a new phrase from our simulated phrases list
                    if current_phrase_index < len(SIMULATED_PHRASES):
                        accumulated_text += SIMULATED_PHRASES[current_phrase_index] + " "
                        current_phrase_index += 1
                    
                    # Log what we're sending to help debug
                    logger.info(f"Sending transcription update: {accumulated_text}")
                    
                    # Send the accumulated text as a transcription update
                    await websocket.send_json({
                        "event": "transcription",
                        "text": accumulated_text.strip()
                    })
                    
                    # Add a small delay to make the simulation more realistic
                    await asyncio.sleep(0.5)
            
            except asyncio.TimeoutError:
                # This is normal when audio is being processed
                continue
            except Exception as e:
                logger.error(f"Error while receiving data: {str(e)}")
                break
        
        # Complete the transcription with a final message
        if accumulated_text:
            final_text = accumulated_text + "\nThank you for using our medical consultation service."
        else:
            final_text = "This is a simulated transcription result. In a real implementation, this would be the complete transcription of your speech."
        
        # Log the final transcription
        logger.info(f"Sending final transcription: {final_text}")
        
        # Send the final transcription
        await websocket.send_json({
            "event": "transcription",
            "text": final_text
        })
            
        # Send completion notification
        await websocket.send_json({
            "event": "end",
            "message": "Transcription completed"
        })
        logger.info("Sent 'end' event to client")
                
    except Exception as e:
        logger.error(f"Error in streaming transcription for {consultation_id}: {e}", exc_info=True)
        
        # Send error to client
        try:
            error_message = f"Transcription error: {str(e)}"
            logger.error(f"Sending error to client: {error_message}")
            
            await websocket.send_json({
                "event": "error",
                "message": error_message
            })
        except Exception as send_error:
            logger.error(f"Failed to send error message to client: {str(send_error)}") 