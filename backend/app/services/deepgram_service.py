# backend/app/services/deepgram_service.py
import logging
import asyncio
import os
from typing import Dict, Any, Optional, List
from fastapi import WebSocket, HTTPException, UploadFile
import io
import os
import tempfile
import ssl
import certifi
from dotenv import load_dotenv
from app.config import get_settings

# Add these imports for SSL handling
import urllib3
import requests
from requests.packages.urllib3.exceptions import InsecureRequestWarning

from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
    PrerecordedOptions,
    FileSource
)

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Disable SSL warnings in development mode
if settings.DEBUG:
    # Disable SSL verification warnings
    urllib3.disable_warnings(InsecureRequestWarning)
    
    # Set environment variables to disable SSL verification globally
    os.environ['PYTHONHTTPSVERIFY'] = '0'
    os.environ['CURL_CA_BUNDLE'] = ''
    os.environ['REQUESTS_CA_BUNDLE'] = ''
    os.environ['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
    
    # Apply SSL bypass for Python's requests and urllib
    requests.packages.urllib3.disable_warnings()
    
    # Patch SSL context for all future SSL connections
    # This is a more aggressive approach but should fix the issues in development
    def create_unverified_ssl_context():
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context
    
    # Apply the patch globally for Python's SSL module
    ssl._create_default_https_context = create_unverified_ssl_context
    
    logger.warning("⚠️ DEVELOPMENT MODE: SSL verification completely disabled for all connections")

# Initialize the global DeepgramClient instance at module level
deepgram_client = None
try:
    # Initialize Deepgram client
    api_key = settings.DEEPGRAM_API_KEY
    if api_key:
        logger.info("Initializing Deepgram client with API key")
        # Client initialization happens after SSL settings are applied
        deepgram_client = DeepgramClient(api_key)
        logger.info("✅ Deepgram client successfully initialized")
    else:
        logger.warning("⚠️ No Deepgram API key found. Transcription will not work.")
except Exception as e:
    logger.error(f"❌ Failed to initialize Deepgram client: {str(e)}")

class DeepgramService:
    def __init__(self, api_key=None):
        settings = get_settings()
        self.api_key = api_key or settings.DEEPGRAM_API_KEY
        self.debug = settings.DEBUG
        self._client = None
        
        if not self.api_key:
            logger.warning("Deepgram API key not found. Transcription will not work.")
        else:
            logger.info("Deepgram API key configured.")
    
    def get_client(self):
        """
        Get the Deepgram client instance.
        If in debug mode, SSL verification is disabled.
        """
        if not self._client:
            try:
                # Create client - SSL verification is already handled at module level
                self._client = DeepgramClient(self.api_key)
                logger.info("✅ Deepgram client successfully initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Deepgram client: {str(e)}")
                self._client = None
                
        return self._client
    
    async def process_audio_stream(self, callback):
        """
        Process audio stream with Deepgram's live transcription.
        
        Args:
            callback: A callback function that will be called with transcription results
            
        Returns:
            A tuple containing (connection, error)
            - connection: The Deepgram live connection if successful, None otherwise
            - error: Error message if any, None otherwise
        """
        if not self.api_key:
            error_msg = "Deepgram API key not configured"
            logger.error(error_msg)
            return None, error_msg
        
        try:
            # Get the client (handles SSL verification appropriately)
            client = self.get_client()
            if not client:
                error_msg = "Failed to initialize Deepgram client"
                logger.error(error_msg)
                return None, error_msg
            
            # Configure live transcription options
            options = LiveOptions(
                model="nova-2",
                language="en-US",
                smart_format=True,
                interim_results=True,
                endpointing=True
            )
            
            logger.info("Creating Deepgram live transcription connection...")
            
            # Create the live transcription connection
            connection = client.listen.live.v("1")
            
            # Set up event handlers using the simpler callback approach
            # This is compatible with newer SDK versions
            connection.on_transcript = lambda transcript: callback(transcript.channel.alternatives[0].transcript if transcript and hasattr(transcript, "channel") and hasattr(transcript.channel, "alternatives") else "")
            connection.on_error = lambda error: callback(f"TRANSCRIPTION_ERROR: {error}")
            connection.on_close = lambda: callback("TRANSCRIPTION_CLOSED")
            
            # Start the connection
            await connection.start(options)
            logger.info("Successfully connected to Deepgram live transcription")
            
            return connection, None
            
        except Exception as e:
            error_msg = f"Error connecting to Deepgram: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

# Default transcription parameters - customize based on your medical application needs
DEFAULT_LIVE_OPTIONS = {
    "model": "nova-2",        # Using nova-2 which is more stable and widely supported
    "language": "en-US",      # Language code
    "smart_format": True,     # Format numbers, currency, etc.
    "diarize": True,          # Identify different speakers
    "punctuate": True,        # Add punctuation
    "endpointing": True,      # Detect end of speech segments
}

DEFAULT_FILE_OPTIONS = {
    "model": "nova-2",        # Using nova-2 for consistency
    "language": "en-US",
    "smart_format": True,
    "diarize": True,
    "punctuate": True,
}

async def process_audio_stream(websocket: WebSocket, consultation_id: str):
    """
    Process audio data streamed from the client via WebSocket using Deepgram.
    
    Args:
        websocket: The WebSocket connection
        consultation_id: ID of the consultation session
    """
    # Check if Deepgram is configured
    if not deepgram_client:
        logger.error("Attempted to use Deepgram service, but API key is not configured.")
        await websocket.send_json({
            "event": "error",
            "message": "Deepgram service is not configured."
        })
        return
        
    try:
        # Log the start of processing
        logger.info(f"Starting Deepgram audio stream processing for consultation {consultation_id}")
        
        # Send start event to the client
        await websocket.send_json({
            "event": "start",
            "message": "Transcription started"
        })
        
        # Create a connection to Deepgram's live transcription service
        try:
            # Create options object, ensuring all parameters are properly set
            live_options = LiveOptions(
                model=DEFAULT_LIVE_OPTIONS["model"],
                language=DEFAULT_LIVE_OPTIONS["language"],
                smart_format=DEFAULT_LIVE_OPTIONS["smart_format"],
                diarize=DEFAULT_LIVE_OPTIONS["diarize"],
                punctuate=DEFAULT_LIVE_OPTIONS["punctuate"],
                endpointing=DEFAULT_LIVE_OPTIONS["endpointing"],
                interim_results=True
            )
            
            logger.info(f"Configured LiveOptions: {live_options}")
            
            # Create the Deepgram connection with simplified setup
            # SSL verification should already be disabled globally if in DEBUG mode
            connection = deepgram_client.listen.live.v("1").start(live_options)
            logger.info("Deepgram live connection created successfully")
            
        except Exception as conn_err:
            logger.error(f"Failed to create Deepgram connection: {conn_err}", exc_info=True)
            await websocket.send_json({
                "event": "error",
                "message": f"Failed to initialize Deepgram: {str(conn_err)}"
            })
            return
        
        # Track the final transcription result
        accumulated_text = ""
        
        # Set up event listeners for the Deepgram connection using the correct event handling API
        # For newer versions of the Deepgram SDK, we use the LiveTranscriptionEvents enum
        
        # Define the transcript handler as a callback function
        async def on_transcript(transcript):
            nonlocal accumulated_text
            try:
                # Check if transcript has alternatives
                if transcript and hasattr(transcript, "channel") and hasattr(transcript.channel, "alternatives"):
                    # Get the transcript text
                    transcript_text = transcript.channel.alternatives[0].transcript
                    
                    # Try to get speaker information if available
                    speaker_text = transcript_text
                    has_speaker_info = False
                    
                    # First try to get utterances directly from the transcript
                    if hasattr(transcript, "utterances") and transcript.utterances:
                        logger.debug("Found utterances in transcript")
                        speaker_segments = []
                        for utterance in transcript.utterances:
                            if hasattr(utterance, "speaker") and hasattr(utterance, "transcript"):
                                speaker_label = f"Speaker {utterance.speaker}"
                                # Designate Speaker 0 as Doctor and Speaker 1 as Patient
                                if utterance.speaker == 0:
                                    speaker_label = "Doctor"
                                elif utterance.speaker == 1:
                                    speaker_label = "Patient"
                                    
                                speaker_segments.append(f"{speaker_label}: {utterance.transcript}")
                        
                        if speaker_segments:
                            speaker_text = " ".join(speaker_segments)
                            has_speaker_info = True
                    
                    # Also try to get speaker turns if utterances aren't available
                    elif hasattr(transcript, "channel") and hasattr(transcript.channel, "alternatives"):
                        alt = transcript.channel.alternatives[0]
                        if hasattr(alt, "speaker_turns") and alt.speaker_turns:
                            logger.debug("Found speaker_turns in transcript alternative")
                            speaker_segments = []
                            for turn in alt.speaker_turns:
                                if hasattr(turn, "speaker") and hasattr(turn, "text"):
                                    speaker_label = f"Speaker {turn.speaker}"
                                    # Designate Speaker 0 as Doctor and Speaker 1 as Patient
                                    if turn.speaker == 0:
                                        speaker_label = "Doctor"
                                    elif turn.speaker == 1:
                                        speaker_label = "Patient"
                                        
                                    speaker_segments.append(f"{speaker_label}: {turn.text}")
                            
                            if speaker_segments:
                                speaker_text = " ".join(speaker_segments)
                                has_speaker_info = True
                    
                    # Fallback to just parsing the text for speaker labels
                    elif ":" in transcript_text and \
                         ("Doctor:" in transcript_text or "Patient:" in transcript_text or 
                          "Speaker 0:" in transcript_text or "Speaker 1:" in transcript_text):
                        logger.debug("Found speaker labels in transcript text")
                        # The text already has speaker labels, so use it directly
                        speaker_text = transcript_text
                        has_speaker_info = True
                    
                    # Only update and send if there's actual text
                    if transcript_text:
                        # For final results, append to accumulated text
                        if transcript.is_final:
                            # If we have speaker information, use that
                            accumulated_text += speaker_text + " "
                            
                        # Send the current state to the client
                        text_to_send = accumulated_text + (speaker_text if not transcript.is_final else "")
                        
                        # Only send if we have text
                        if text_to_send.strip():
                            await websocket.send_json({
                                "event": "transcription",
                                "text": text_to_send.strip(),
                                "is_final": transcript.is_final,
                                "has_speaker_info": has_speaker_info
                            })
                            
                            # Log periodically (not every transcript to avoid flooding)
                            if transcript.is_final:
                                logger.debug(f"Sending transcription update: {text_to_send.strip()}")
            except Exception as e:
                logger.error(f"Error handling transcript: {e}")
        
        # Register event handlers using the correct approach for the current SDK version
        connection.on_transcript = on_transcript
        
        # Define event handlers for other events
        connection.on_open = lambda: logger.info(f"Deepgram connection opened for consultation {consultation_id}")
        connection.on_close = lambda: logger.info(f"Deepgram connection closed for consultation {consultation_id}")
        connection.on_error = lambda error: logger.error(f"Deepgram error: {error}")
        
        # Main processing loop to receive audio from the client's browser
        try:
            while True:
                # Receive binary audio data from the client
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=1.0)
                
                # Check if we received end signal
                if len(data) == 0 or data == b"END_STREAM":
                    logger.info(f"End of audio stream for consultation {consultation_id}")
                    break
                
                # Send audio data to Deepgram
                connection.send(data)
                
        except asyncio.TimeoutError:
            # This is normal when audio is being processed
            pass
        except Exception as e:
            logger.error(f"Error while receiving data: {str(e)}")
        finally:
            # Close the Deepgram connection
            await connection.finish()
            
            # Send completion notification
            await websocket.send_json({
                "event": "end",
                "message": "Transcription completed"
            })
            logger.info(f"Transcription completed for consultation {consultation_id}")
    
    except Exception as e:
        logger.error(f"Error in Deepgram streaming for {consultation_id}: {e}", exc_info=True)
        
        # Send error to client
        try:
            await websocket.send_json({
                "event": "error",
                "message": f"Transcription error: {str(e)}"
            })
        except Exception as send_error:
            logger.error(f"Failed to send error message to client: {str(send_error)}")

async def transcribe_audio_file(audio_file: UploadFile) -> Dict[str, Any]:
    """
    Transcribes an uploaded audio file using Deepgram's prerecorded API.
    
    Args:
        audio_file: An UploadFile object containing the audio data
        
    Returns:
        Dict containing the transcription result
        
    Raises:
        HTTPException: If the Deepgram API is not configured or transcription fails
    """
    if not deepgram_client:
        logger.error("Attempted to use Deepgram service, but API key is not configured.")
        raise HTTPException(status_code=500, detail="Deepgram service is not configured.")
    
    temp_file_path = None
    
    try:
        logger.info(f"Processing audio file: {audio_file.filename}, content type: {audio_file.content_type}")
        
        # Read the audio file
        audio_bytes = await audio_file.read()
        await audio_file.close()
        
        # Determine file extension from filename or content_type
        filename = audio_file.filename or "audio"
        extension = os.path.splitext(filename)[1] or ".webm"  # Default to .webm if no extension
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
            tmp.write(audio_bytes)
            temp_file_path = tmp.name
            logger.info(f"Audio saved to temporary file: {temp_file_path}")
        
        # Create file source for Deepgram
        source = FileSource(path=temp_file_path)
        
        # Create options for prerecorded transcription
        options = PrerecordedOptions(**DEFAULT_FILE_OPTIONS)
        
        # Send to Deepgram for transcription
        response = await deepgram_client.listen.prerecorded.v("1").transcribe_file(source, options)
        
        # Process the response
        if response and hasattr(response, "results"):
            logger.info("Transcription received from Deepgram")
            result = response.to_dict()  # Convert to dictionary
            
            # Extract and format the result as needed for your application
            # You can customize this based on your specific needs
            formatted_result = {
                "status": "completed",
                "segments": []
            }
            
            # Build a full text with proper speaker labels
            full_text_with_speakers = ""
            
            # Extract segments with speaker information if available
            utterances = result.get("results", {}).get("utterances", [])
            if utterances:
                for utterance in utterances:
                    speaker_label = f"Speaker {utterance.get('speaker', 0)}"
                    
                    # Designate Speaker 0 as Doctor and Speaker 1 as Patient
                    if utterance.get('speaker') == 0:
                        speaker_label = "Doctor"
                    elif utterance.get('speaker') == 1:
                        speaker_label = "Patient"
                    
                    text = utterance.get("transcript", "")
                    
                    # Add to full text with proper formatting
                    full_text_with_speakers += f"{speaker_label}: {text} "
                    
                    # Add to segments
                    formatted_result["segments"].append({
                        "speaker": speaker_label,
                        "text": text,
                        "start_time": utterance.get("start", 0),
                        "end_time": utterance.get("end", 0)
                    })
                
                # Use the formatted text with speakers
                formatted_result["text"] = full_text_with_speakers.strip()
            else:
                # Fallback to regular transcript if no speaker information
                formatted_result["text"] = result.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
            
            return formatted_result
        else:
            logger.warning("Received unexpected response structure from Deepgram")
            raise HTTPException(status_code=500, detail="Failed to get transcription (unexpected response)")
    
    except Exception as e:
        logger.error(f"Error during Deepgram audio file transcription: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"An error occurred during transcription: {str(e)}")
    
    finally:
        # Clean up the temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"Deleted temporary file: {temp_file_path}")
            except Exception as e:
                logger.error(f"Failed to delete temporary file {temp_file_path}: {e}") 