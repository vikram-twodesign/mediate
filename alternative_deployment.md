# Alternative Deployment Options

## Option 1: Deploy to Render.com

Render.com supports WebSockets and is easy to set up:

1. Sign up for a Render.com account
2. Create a new Web Service
3. Connect to your GitHub repo
4. Set the following:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add all your environment variables from `.env.cloud`
5. Deploy

## Option 2: Deploy to Railway.app

Railway.app also supports WebSockets:

1. Sign up for a Railway.app account
2. Create a new project and select "Deploy from GitHub repo"
3. Configure as a Python service
4. Add your environment variables from `.env.cloud`
5. Railway will automatically detect your Dockerfile

## Option 3: Using Firebase Functions as a proxy (Limited WebSocket Support)

If you want to stay within the Firebase ecosystem but can't use Google Cloud Run:

1. Initialize Firebase Functions in your project
2. Create a function that forwards API requests to your backend hosted elsewhere
3. This works for HTTP requests but has limitations for WebSockets

```javascript
// Example Firebase Function proxy (limited, doesn't support WebSockets)
const functions = require('firebase-functions');
const fetch = require('node-fetch');

const BACKEND_URL = 'https://your-backend-on-render.com';

exports.api = functions.https.onRequest(async (req, res) => {
  const url = `${BACKEND_URL}${req.url}`;
  
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    const data = await response.text();
    
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).send('Error proxying to backend');
  }
});
```

**Note**: Firebase Functions cannot proxy WebSocket connections. For the full WebSocket functionality, use Options 1 or 2. 