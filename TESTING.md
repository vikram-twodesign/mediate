# Testing Guide for Medical Consultation Assistant

This guide will help you run and test the pages we've implemented so far in the Medical Consultation Assistant application.

## Setting Up the Environment

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (if not already created):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install the required dependencies:
   ```bash
   pip install -r ../requirements.txt
   ```

5. Start the backend server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```

   The backend server should start at http://127.0.0.1:8000

### Frontend Setup

1. Open a new terminal window/tab

2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

3. Install Node.js dependencies (first time only):
   ```bash
   npm install
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```

   The frontend should be accessible at http://localhost:3000

## Testing the Application

### Homepage

1. Open http://localhost:3000 in your browser
2. You should see the main application page with four cards:
   - Transcription
   - Analysis
   - Reports
   - Documents

### Testing the Transcription Feature

1. Click on the "Transcription" card on the homepage
2. You'll be taken to the transcription page where you can:
   - Click "Start Recording" to start audio recording (requires microphone access)
   - Speak into your microphone
   - Click "Stop Recording" to stop recording
   - After stopping, the audio will be "transcribed" (simulation)
   - You should see a transcription appear and an audio playback control
   - A "Analyze Transcript" button will appear

### Testing the Analysis Feature

1. After transcription, click "Analyze Transcript" or navigate to http://localhost:3000/analysis
2. You'll see:
   - The transcript on the left
   - After a brief "Analyzing transcript..." message, an analysis will appear showing:
     - An analysis summary
     - Identified symptoms with confidence levels
   - Below that, a list of suggested follow-up questions with relevance scores
   - A "Generate Report" button at the bottom

## Test Data

The application currently uses simulated data for demonstration purposes:

- Transcription simulates converting audio to text (no actual API call)
- Analysis simulates processing the transcript (no actual API call)

This means your test results will show pre-defined responses rather than actual analysis. In a production version, these would be replaced with real API calls to Google's Speech-to-Text and Gemini services.

## API Documentation

You can access the FastAPI documentation for the backend API at:
http://127.0.0.1:8000/docs

This shows all available endpoints and allows you to test them directly through the interactive documentation.

## Troubleshooting

- If you encounter "module not found" errors in the backend, make sure you've installed all required packages.
- If the frontend doesn't work, make sure you've run `npm install` to install all dependencies.
- Microphone access requires browser permissions - make sure to allow this when prompted.
- If the backend fails to start, check that you don't have another service running on port 8000.
- If the frontend fails to start, check that you don't have another service running on port 3000. 