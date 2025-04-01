from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class TranscriptionSegment(BaseModel):
    speaker: str
    text: str
    start_time: float
    end_time: float

class Transcription(BaseModel):
    id: str = Field(default_factory=lambda: f"trans_{uuid.uuid4().hex}")
    status: str  # "processing", "completed", "failed"
    text: Optional[str] = None
    segments: Optional[List[TranscriptionSegment]] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    audio_file_path: Optional[str] = None
    doctor_id: Optional[str] = None
    patient_id: Optional[str] = None
    consultation_date: Optional[datetime] = None
    
    class Config:
        schema_extra = {
            "example": {
                "id": "trans_123456789abcdef",
                "status": "completed",
                "text": "Doctor: How are you feeling today? Patient: I've been having headaches.",
                "segments": [
                    {
                        "speaker": "Doctor",
                        "text": "How are you feeling today?",
                        "start_time": 0.0,
                        "end_time": 2.5
                    },
                    {
                        "speaker": "Patient",
                        "text": "I've been having headaches.",
                        "start_time": 3.0,
                        "end_time": 5.0
                    }
                ],
                "error": None,
                "created_at": "2023-10-15T14:30:00Z",
                "updated_at": "2023-10-15T14:35:00Z",
                "audio_file_path": "path/to/audio/file.wav",
                "doctor_id": "doc_123456",
                "patient_id": "pat_123456",
                "consultation_date": "2023-10-15T14:30:00Z"
            }
        } 