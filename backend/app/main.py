import logging
# Import SSL fix module early to ensure SSL verification is properly configured
from app.ssl_fix import apply_ssl_fixes

# Apply SSL fixes again at the start of the main module
apply_ssl_fixes()

# --- Firebase Admin SDK ---
from firebase_admin import credentials, initialize_app
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
# In Cloud Run, it automatically uses the service account credentials
# No need to specify GOOGLE_APPLICATION_CREDENTIALS unless using a custom SA
try:
    firebase_app = initialize_app()
    logger.info("Firebase Admin SDK initialized successfully using default environment credentials.")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin SDK with default credentials: {e}", exc_info=True)
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