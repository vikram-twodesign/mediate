from fastapi import APIRouter
from app.api.endpoints import transcription, analysis, reports, documents, auth, realtime, deepgram_test

api_router = APIRouter()

# Include routers for different endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(transcription.router, prefix="/transcription", tags=["Transcription"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(realtime.router, tags=["Realtime"])
api_router.include_router(deepgram_test.router, prefix="/deepgram", tags=["Deepgram Test"]) 