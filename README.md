# Medical Consultation Transcription App

This application provides real-time transcription services for medical consultations using Deepgram's AI speech recognition.

## Features

- Real-time audio transcription
- WebSocket communication for instant feedback
- Simple user interface for medical consultations

## Prerequisites

- Python 3.8+ for the backend
- Node.js 14+ for the frontend
- A Deepgram API key (sign up at [console.deepgram.com](https://console.deepgram.com))

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/medical-consultation-app.git
cd medical-consultation-app
```

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file
touch .env
```

Edit the `.env` file and add your Deepgram API key:

```
DEEPGRAM_API_KEY=your_api_key_here
DEBUG=true  # Set to false in production
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Fix SSL Certificate Issues (Development Only)

If you encounter SSL certificate verification issues with Deepgram, run the included SSL fix script:

```bash
cd backend
python ../fix_ssl.py
```

Follow the prompts to apply the SSL verification bypass. This should only be used during development.

### 5. Start the application

**Backend:**
```bash
cd backend
DEBUG=true python -m app.main
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## Using the Application

1. Open your browser to http://localhost:3000
2. Navigate to the consultation page
3. Click the "Start Transcription" button to begin recording and transcribing
4. Speak clearly into your microphone
5. The transcription will appear in real-time on the screen

## Troubleshooting

### Transcription Not Working

1. Check your Deepgram API key is correctly set in the `.env` file
2. Verify the Deepgram status at http://localhost:8000/api/deepgram/status
3. If you see SSL certificate errors, run the fix_ssl.py script
4. Check browser console for WebSocket connection errors
5. Ensure microphone permissions are granted in your browser

### SSL Certificate Issues

If you encounter SSL certificate verification errors:

1. Run the SSL fix script: `python fix_ssl.py`
2. Choose option 1 or 2 to apply the SSL bypass
3. Restart the backend server
4. Or add `DEBUG=true` to your environment to automatically disable SSL verification

## License

This project is licensed under the MIT License - see the LICENSE file for details. 