import logging
# Import SSL fix module early to ensure SSL verification is properly configured
from app.ssl_fix import apply_ssl_fixes

# Apply SSL fixes again at the start of the main module
apply_ssl_fixes()

# --- Firebase Admin SDK ---
import firebase_admin
from firebase_admin import credentials
import os
# --- End Firebase Admin SDK ---

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import api_router # Updated import path
# Remove or comment out the old WebSocket router import if no longer needed
# from app.api.endpoints.realtime import websocket_router 
# Import the new transcription router
from app.api.endpoints.transcription import router as transcription_ws_router
from app.config import get_settings
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# --- Firebase Initialization ---
try:
    # Get the path to the service account key from the environment variable
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        logger.warning("GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Firebase Admin SDK will not be initialized.")
        # Depending on your requirements, you might want to raise an error here if Firebase is critical
        # raise ValueError("GOOGLE_APPLICATION_CREDENTIALS is not set")
        firebase_app = None
    elif not os.path.exists(cred_path):
        logger.error(f"Firebase credentials file not found at path: {cred_path}")
        firebase_app = None
    else:
        cred = credentials.Certificate(cred_path)
        firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized successfully.")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin SDK: {e}", exc_info=True)
    firebase_app = None
# --- End Firebase Initialization ---

# Create FastAPI app
app = FastAPI(title="Medical Consultation API")

# Get settings
settings = get_settings()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modify as needed for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router with /api prefix
app.include_router(api_router, prefix="/api")

# Register the new Transcription WebSocket router at the root
app.include_router(transcription_ws_router)

# Remove or comment out the old WebSocket router includes
# app.include_router(websocket_router)
# app.include_router(websocket_router, prefix="/api")

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info("Application startup")
    
    # Log Firebase initialization status
    if firebase_app:
        logger.info("Firebase connection established during startup.")
    else:
        logger.warning("Firebase connection NOT established during startup.")
        
    # Log all registered routes for debugging
    routes = [
        f"{route.path} [{','.join(route.methods) if hasattr(route, 'methods') and route.methods else 'WS'}]"
        for route in app.routes
    ]
    logger.info(f"Registered routes: {routes}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown")

@app.get("/")
def read_root():
    return {"message": "Medical Consultation API"}

# Run the application when executed directly
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    ) 