# Real-Time Transcription Guide

## Overview

This application now supports real-time audio transcription using WebSockets and the Gemini Live API. This significantly reduces latency compared to the previous batch processing approach.

## How It Works

1. **WebSocket Connection**: When you click "Start Consultation", the frontend establishes a WebSocket connection to the backend.
2. **Audio Streaming**: Audio from your microphone is processed in real-time and sent as 16-bit PCM audio chunks at 16kHz to the backend.
3. **Gemini Live API**: The backend forwards these audio chunks to the Gemini Live API using its streaming interface.
4. **Real-Time Results**: As Gemini processes the audio, it returns partial transcription results which are immediately sent back to the frontend.
5. **Dynamic Updates**: The transcript updates in real-time as you speak, providing near-instantaneous feedback.

## Setup Instructions

### 1. Update Dependencies

First, update your Python dependencies to support the Gemini Live API:

```bash
pip install -r requirements.txt
```

### 2. Restart Backend Server

Stop your current backend server and restart it:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir backend
```

### 3. Restart Frontend Server

In a separate terminal, restart your frontend development server:

```bash
cd frontend
npm run dev
```

## Testing the Real-Time Transcription

1. Navigate to `http://localhost:3000/consultation` in your browser
2. Click "Start Consultation"
3. Speak into your microphone
4. You should see the transcription appear almost immediately with very low latency
5. Click "Stop & Process" when you're finished

## Troubleshooting

### If Transcription Doesn't Appear

1. **Check Console Logs**: Open your browser's developer console (F12) to see any error messages
2. **WebSocket Connection**: Verify that the WebSocket connection was established (look for "WebSocket connection established" in the logs)
3. **Backend Logs**: Check the terminal where your backend is running for any error messages
4. **Microphone Access**: Ensure your browser has permission to access your microphone
5. **Sample Rate**: If your device's default microphone sample rate is not compatible, you may see errors. Try a different microphone if available.

### If You Get Audio Processing Errors

The Web Audio API used for processing audio may have compatibility issues in some browsers. The application should work best in Chrome, Firefox, or Edge.

## API Key and Usage

This feature uses the Gemini Live API, which requires a valid API key and may have different usage quotas than the regular Gemini API. Ensure your API key has access to the `gemini-2.0-flash-exp` model.

## Next Steps

- Consider implementing speaker diarization (identifying who is speaking)
- Add a visual indicator when audio is being captured
- Implement automatic pause detection to segment the transcript better 