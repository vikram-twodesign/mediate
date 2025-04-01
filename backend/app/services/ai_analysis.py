import os
import google.generativeai as genai
import json
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure the Gemini API client
try:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.error("GOOGLE_API_KEY not found in environment variables.")
        # Handle the error appropriately, maybe raise an exception or set a default
        raise ValueError("GOOGLE_API_KEY not found. Please set it in your .env file.")
    genai.configure(api_key=api_key)
    logger.info("Google Generative AI client configured successfully.") # Add success log
except ValueError as e:
    logger.error(e)
    # Depending on the application's needs, you might want to exit or disable AI features


# Define the model name we want to use
MODEL_NAME = "gemini-2.5-pro-exp-03-25" # Using the experimental model as requested

# Safety settings for the generation - adjust as needed
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Generation configuration
GENERATION_CONFIG = {
  "temperature": 0.7, # Controls randomness - lower for more deterministic, higher for more creative
  "top_p": 1,
  "top_k": 1,
  "max_output_tokens": 2048, # Max tokens in the response
  "response_mime_type": "application/json", # Request JSON output directly
}

# Function to analyze transcript chunk using Gemini
async def analyze_transcript_chunk(transcript_text: str) -> dict | None:
    """
    Analyzes a chunk of transcript text using the Gemini API to extract symptoms,
    suggest questions, assess severity, and provide possible diagnoses.

    Args:
        transcript_text: The text of the conversation transcript chunk.

    Returns:
        A dictionary containing 'symptoms', 'suggestions', 'severity', and 'diagnoses' if successful,
        otherwise None.
    """
    try:
        # Instantiating the model here will use the globally configured API key
        # If genai.configure() failed earlier, this instantiation will likely raise an error
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=GENERATION_CONFIG,
            safety_settings=SAFETY_SETTINGS
        )

        # Construct the prompt for the LLM
        # Instructing it to act as a medical assistant and return JSON
        prompt = f"""
        Analyze the following medical consultation transcript snippet. Act as a highly astute medical assistant analyzing the conversation between a doctor and a patient.

        Transcript Snippet:
        ---
        {transcript_text}
        ---

        Based **strictly** on the transcript snippet provided, perform the following tasks with detail and nuance:
        1.  **Identify and list key patient symptoms mentioned.** Be precise and include any qualifying details mentioned (e.g., "sharp chest pain on inhalation, started 2 days ago", "mild, intermittent dizziness, worse on standing"). Distinguish between primary symptoms and associated minor complaints. If no clear symptoms are mentioned in this snippet, return an empty list.
        2.  **Suggest 3-5 insightful follow-up questions** the doctor could ask to further explore the patient's condition based on the *current* context. Questions should aim to clarify ambiguity, rule out differential diagnoses, or quantify symptoms (e.g., "On a scale of 1-10, how severe is the headache?", "Does the dizziness occur every time you stand?", "Have you experienced similar symptoms before?"). If the snippet lacks sufficient context for meaningful questions, return an empty list.
        3.  **Assess the potential clinical severity** based *only* on the information in this snippet. Use one of the following categories: "Low", "Medium", "High", "Urgent". Consider the nature of the symptoms mentioned (e.g., chest pain vs. mild headache). If severity cannot be reasonably determined from the snippet, default to "Low". Provide a brief (1-sentence) rationale for the chosen severity level.
        4.  **List up to 3 potential differential diagnoses** that could explain the symptoms mentioned *in this snippet*, ordered by likelihood. For each diagnosis, provide a confidence level ("High", "Medium", "Low") reflecting the certainty based *only* on this snippet. Include a brief (1-sentence) rationale explaining why each diagnosis is considered. If there is insufficient information for diagnostic suggestions, return an empty list.

        Return your analysis **strictly** in the following JSON format, with no explanatory text outside the JSON structure. Ensure all rationales are included within the specified fields:
        {{
          "symptoms": [
            {{"description": "Detailed symptom 1 description", "is_primary": true/false}},
            {{"description": "Detailed symptom 2 description", "is_primary": true/false}},
            ...
          ],
          "suggestions": [
            "Insightful question 1?",
            "Insightful question 2?",
            ...
          ],
          "severity": {{ "level": "Chosen Severity Level", "rationale": "Brief rationale for severity." }},
          "diagnoses": [
            {{ "name": "Possible Diagnosis 1", "confidence": "High/Medium/Low", "rationale": "Brief rationale for this diagnosis based on snippet." }},
            {{ "name": "Possible Diagnosis 2", "confidence": "High/Medium/Low", "rationale": "Brief rationale for this diagnosis based on snippet." }},
            ...
          ]
        }}
        """

        logger.info(f"Sending request to Gemini model {MODEL_NAME}...")
        response = await model.generate_content_async(prompt) # Use async version

        # Log the raw response text for debugging (optional)
        # logger.debug(f"Raw Gemini Response Text: {response.text}")

        # The response.text should already be JSON because we requested "application/json"
        # We still parse it to ensure it's valid JSON and convert it to a Python dict
        analysis_result = json.loads(response.text)

        # Enhanced validation for the new structure
        if not isinstance(analysis_result, dict) or \
           not isinstance(analysis_result.get('symptoms'), list) or \
           not isinstance(analysis_result.get('suggestions'), list) or \
           not isinstance(analysis_result.get('severity'), dict) or \
           not isinstance(analysis_result.get('diagnoses'), list) or \
           'level' not in analysis_result.get('severity', {}) or \
           'rationale' not in analysis_result.get('severity', {}):
            # Further checks for list items can be added if needed
            logger.error(f"Received unexpected or incomplete JSON structure from Gemini: {analysis_result}")
            return None
        
        # Validate symptom structure (optional but good practice)
        for symptom in analysis_result.get('symptoms', []):
            if not isinstance(symptom, dict) or \
               'description' not in symptom or \
               'is_primary' not in symptom:
                logger.error(f"Invalid symptom structure found: {symptom}")
                return None
        
        # Validate diagnoses structure (optional but good practice)
        for diagnosis in analysis_result.get('diagnoses', []):
            if not isinstance(diagnosis, dict) or \
               'name' not in diagnosis or \
               'confidence' not in diagnosis or \
               'rationale' not in diagnosis:
                logger.error(f"Invalid diagnosis structure found: {diagnosis}")
                return None
        
        logger.info(f"Successfully received analysis from Gemini: {analysis_result}")
        return analysis_result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON response from Gemini: {e}")
        logger.error(f"Problematic response text: {response.text if 'response' in locals() else 'No response object'}")
        return None
    except Exception as e:
        # Catch other potential errors (API connection issues, etc.)
        logger.error(f"An error occurred during Gemini API call: {e}", exc_info=True)
        # Log response details if available
        if 'response' in locals() and hasattr(response, 'prompt_feedback'):
             logger.error(f"Prompt Feedback: {response.prompt_feedback}")
        if 'response' in locals() and hasattr(response, 'candidates') and response.candidates:
             logger.error(f"Finish Reason: {response.candidates[0].finish_reason}")
             logger.error(f"Safety Ratings: {response.candidates[0].safety_ratings}")
        return None

# Example usage (for testing purposes)
if __name__ == "__main__":
    import asyncio

    async def test_analysis():
        # Ensure API key is loaded if running directly
        if not os.getenv("GOOGLE_API_KEY"):
             print("Please set the GOOGLE_API_KEY environment variable in a .env file.")
             return
             
        test_transcript = """
        Doctor: Good morning, Mrs. Davis. What brings you in today?
        Patient: Good morning, Doctor. I've been having these persistent headaches for the past week, especially in the mornings. They feel like a dull ache behind my eyes. Sometimes I also feel a bit dizzy when I stand up too quickly.
        Doctor: Okay, a week of persistent morning headaches with dizziness. Any other symptoms? Fever, neck stiffness, vision changes?
        Patient: No fever or stiffness. Maybe my vision is slightly blurry sometimes, but it passes quickly.
        """
        print("Testing AI analysis...")
        result = await analyze_transcript_chunk(test_transcript)
        if result:
            print("\nAnalysis Result:")
            print(json.dumps(result, indent=2))
        else:
            print("\nAnalysis failed.")

    # Run the async test function
    asyncio.run(test_analysis()) 