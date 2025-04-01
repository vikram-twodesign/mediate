from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter()

class ReportRequest(BaseModel):
    transcript_id: str
    analysis_id: Optional[str] = None
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    consultation_date: Optional[datetime] = None
    additional_notes: Optional[str] = None

class DiagnosisSuggestion(BaseModel):
    condition: str
    confidence: float
    supporting_symptoms: List[str]
    recommended_followup: Optional[str] = None

class Report(BaseModel):
    id: str
    created_at: datetime
    transcript_id: str
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    consultation_date: Optional[datetime] = None
    symptoms_summary: List[Dict[str, Any]]
    diagnosis_suggestions: List[DiagnosisSuggestion]
    consultation_summary: str
    additional_notes: Optional[str] = None

@router.post("/generate", response_model=Report)
async def generate_report(request: ReportRequest):
    """
    Generate a structured consultation report based on transcript and analysis results.
    Uses Gemini AI to summarize and structure the information.
    """
    # This is a placeholder - actual implementation would generate a real report
    report_id = "report_123"
    
    return {
        "id": report_id,
        "created_at": datetime.now(),
        "transcript_id": request.transcript_id,
        "patient_name": request.patient_name,
        "doctor_name": request.doctor_name,
        "consultation_date": request.consultation_date or datetime.now(),
        "symptoms_summary": [
            {"symptom": "Headache", "severity": "Moderate", "duration": "3 days"}
        ],
        "diagnosis_suggestions": [
            {
                "condition": "Migraine",
                "confidence": 0.85,
                "supporting_symptoms": ["Headache", "Light sensitivity"],
                "recommended_followup": "Consider triptan medication"
            }
        ],
        "consultation_summary": "Patient reported moderate headache for past 3 days with light sensitivity.",
        "additional_notes": request.additional_notes
    }

@router.get("/{report_id}", response_model=Report)
async def get_report(report_id: str):
    """
    Retrieve a previously generated report by ID.
    """
    # This is a placeholder - actual implementation would retrieve from database
    return {
        "id": report_id,
        "created_at": datetime.now(),
        "transcript_id": "transcript_123",
        "patient_name": "Test Patient",
        "doctor_name": "Dr. Test",
        "consultation_date": datetime.now(),
        "symptoms_summary": [
            {"symptom": "Headache", "severity": "Moderate", "duration": "3 days"}
        ],
        "diagnosis_suggestions": [
            {
                "condition": "Migraine",
                "confidence": 0.85,
                "supporting_symptoms": ["Headache", "Light sensitivity"],
                "recommended_followup": "Consider triptan medication"
            }
        ],
        "consultation_summary": "Patient reported moderate headache for past 3 days with light sensitivity.",
        "additional_notes": "Follow up in two weeks"
    } 