from fastapi import APIRouter
from app.api.endpoints import transcription, realtime, deepgram, openai_transcription

api_router = APIRouter()
api_router.include_router(transcription.router, prefix="/consultations", tags=["consultations"])
api_router.include_router(realtime.router, prefix="/realtime", tags=["realtime"])
api_router.include_router(deepgram.router, prefix="/deepgram", tags=["deepgram"])
api_router.include_router(openai_transcription.router, prefix="/openai", tags=["openai"]) 