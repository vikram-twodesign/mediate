# backend/app/services/gemini_service.py
import google.generativeai as genai
from app.core.config import settings
import logging
from fastapi import UploadFile, HTTPException
import asyncio # Need to import asyncio
import tempfile # Import tempfile for creating temporary files
import os # Import os for file operations

# Configure logging
logger = logging.getLogger(__name__)

# Configure the Gemini client
try:
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not found in settings. Gemini service will not be available.")
        # Optionally raise an error or handle this case as needed
        # raise ValueError("GEMINI_API_KEY is required but not configured.")
    else:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        logger.info("Gemini API configured successfully.")
except Exception as e:
    logger.error(f"Failed to configure Gemini API: {e}")
    # Handle configuration error appropriately

# Define the model to use (Gemini 2.0 Flash)
# Check the official documentation for the latest recommended model identifier
# As per https://ai.google.dev/gemini-api/docs/models#gemini-2.0-flash, it's 'gemini-2.0-flash'
# Using the specific 'latest' tag might be better if available and desired: 'models/gemini-2.0-flash-latest'
# Let's stick to the documented stable name for now.
MODEL_NAME = "gemini-2.0-flash"
# Safety settings - adjust as needed for medical context (might need to be less restrictive)
# Refer to Gemini safety settings documentation
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

async def transcribe_audio_gemini(audio_file: UploadFile) -> str:
    """
    Sends audio data to the Gemini 2.0 Flash model for transcription.

    Args:
        audio_file: An UploadFile object containing the audio data.

    Returns:
        The transcribed text as a string.

    Raises:
        HTTPException: If the Gemini API is not configured or transcription fails.
    """
    if not settings.GEMINI_API_KEY:
        logger.error("Attempted to use Gemini service, but API key is not configured.")
        raise HTTPException(status_code=500, detail="Gemini API service is not configured.")

    uploaded_file_resource = None # Initialize to None to ensure it exists in finally block scope
    temp_file_path = None # Track the temporary file path

    try:
        logger.info(f"Processing audio file: {audio_file.filename}, content type: {audio_file.content_type}")

        # --- Gemini API Interaction ---
        # 1. Read the audio file
        audio_bytes = await audio_file.read()
        await audio_file.close() # Ensure the file is closed after reading
        
        # The current version of the API doesn't accept bytes directly through 'content' parameter
        # Instead, we need to write to a temporary file and provide the file path
        
        # Determine file extension from filename or content_type
        filename = audio_file.filename or "audio"
        extension = os.path.splitext(filename)[1] or ".webm" # Default to .webm if no extension
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
            tmp.write(audio_bytes)
            temp_file_path = tmp.name
            logger.info(f"Audio saved to temporary file: {temp_file_path}")

        # Make sure the frontend sends a compatible mime type (e.g., 'audio/webm', 'audio/wav')
        mime_type = audio_file.content_type or "audio/webm" # Example default
        if not mime_type.startswith("audio/"):
             logger.warning(f"Potentially incompatible mime type received: {mime_type}. Using fallback.")
             mime_type = "audio/webm" # Set a fallback MIME type
        
        logger.info(f"Uploading audio file with MIME type: {mime_type}")
        
        # Upload the file - using the correct parameter 'path' instead of 'content'
        uploaded_file_resource = genai.upload_file(
            path=temp_file_path, # Use path parameter with the temporary file
            display_name=audio_file.filename or "consultation_audio",
            mime_type=mime_type
        )
        logger.info(f"Uploaded file '{uploaded_file_resource.display_name}' as: {uploaded_file_resource.uri}")

        # 2. Initialize the generative model
        model = genai.GenerativeModel(
            MODEL_NAME,
            safety_settings=safety_settings
        )

        # 3. Send the prompt with the audio file URI to the model
        prompt = [
            "Please transcribe the following audio recording of a medical consultation accurately.",
            uploaded_file_resource # Pass the uploaded file object directly
        ]

        # Try the synchronous method if the async method doesn't work
        try:
            # First try the async version
            response = await model.generate_content_async(prompt, stream=False)
        except AttributeError:
            # Fallback to synchronous version if async not available
            logger.info("Falling back to synchronous generate_content method.")
            response = model.generate_content(prompt, stream=False)

        # 4. Process the response
        if response and hasattr(response, 'text') and response.text:
            transcription = response.text
            logger.info("Transcription received from Gemini.")
            return transcription
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini API blocked the prompt. Reason: {block_reason}")
            raise HTTPException(status_code=400, detail=f"Transcription blocked by safety filters: {block_reason}")
        else:
            logger.warning("Received no text or unexpected response structure from Gemini.")
            logger.debug(f"Full Gemini Response: {response}") # Log full response for debugging
            raise HTTPException(status_code=500, detail="Failed to get transcription from Gemini API (empty or unexpected response).")

    except Exception as e:
        logger.error(f"Error during Gemini audio transcription: {e}", exc_info=True)
        # Re-raise specific HTTP exceptions or wrap others
        if isinstance(e, HTTPException):
             raise e
        raise HTTPException(status_code=500, detail=f"An error occurred during transcription: {str(e)}")

    finally:
        # 5. Clean up resources
        # Delete the temporary file if it exists
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"Deleted temporary file: {temp_file_path}")
            except Exception as e:
                logger.error(f"Failed to delete temporary file {temp_file_path}: {e}")
        
        # Delete the uploaded file in Gemini if it exists
        if uploaded_file_resource:
            try:
                logger.info(f"Deleting uploaded file from Gemini: {uploaded_file_resource.name}")
                genai.delete_file(uploaded_file_resource.name)
            except Exception as delete_error:
                logger.error(f"Failed to delete uploaded file {uploaded_file_resource.name}: {delete_error}") 