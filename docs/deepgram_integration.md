# Deepgram Integration for Medical Consultation App

## Overview

This application uses Deepgram's speech-to-text API for real-time transcription of doctor-patient consultations. Deepgram provides high-accuracy medical transcription with support for medical terminology.

## Features

- **Real-time Streaming Transcription**: Live transcription of consultations with low latency
- **Speaker Diarization**: Automatic identification of different speakers (doctor vs. patient)
- **Smart Formatting**: Automatic formatting of numbers, dates, and other entities
- **File Upload Transcription**: Support for uploading pre-recorded consultation audio

## Setup

### 1. Get a Deepgram API Key

1. Sign up for a Deepgram account at [https://console.deepgram.com/signup](https://console.deepgram.com/signup)
2. Create a new project
3. Generate an API key with appropriate permissions

### 2. Configure Environment Variables

Add your Deepgram API key to your environment:

```bash
# Add this to your .env file
DEEPGRAM_API_KEY=your_api_key_here
```

### 3. Install Dependencies

The application requires the Deepgram SDK:

```bash
pip install deepgram-sdk==3.1.0
```

Or update your existing environment:

```bash
pip install -r requirements.txt
```

## How It Works

### Streaming Transcription

1. When a consultation starts, the frontend establishes a WebSocket connection to the backend
2. Audio from the microphone is processed and sent as 16-bit PCM audio at 16kHz
3. The backend passes this audio to Deepgram's streaming API
4. Transcription results are returned in real-time and displayed in the UI

### File Upload Transcription

1. Upload audio files through the application interface
2. The backend sends the file to Deepgram's prerecorded API
3. The complete transcription is returned and displayed

## Transcription Parameters

The application is configured with these default parameters:

- **Model**: `nova-3` (Deepgram's latest model)
- **Language**: `en-US`
- **Smart Format**: Enabled
- **Diarization**: Enabled
- **Punctuation**: Enabled
- **Endpointing**: Enabled for streaming

These parameters can be adjusted in `backend/app/services/deepgram_service.py` if needed.

## Cleanup

After confirming the Deepgram integration works correctly, you can clean up the old Google Gemini service files:

```bash
./cleanup_old_gemini_services.sh
```

## Troubleshooting

### Common Issues

1. **No Transcription Results**: Verify your Deepgram API key is valid and has sufficient credits

2. **Audio Format Issues**: Ensure your browser is correctly capturing audio at 16kHz

3. **Connection Errors**: Check network connectivity and firewall settings that might block WebSocket connections

### Debugging

- Check the backend logs for detailed error messages from Deepgram
- The frontend console logs WebSocket connection status and events

## Additional Resources

- [Deepgram Documentation](https://developers.deepgram.com/docs/)
- [Deepgram SDK GitHub](https://github.com/deepgram/deepgram-python-sdk)
- [Deepgram Streaming API](https://developers.deepgram.com/docs/live-streaming-audio) 