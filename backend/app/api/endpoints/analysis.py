from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.analysis_service import analyze_transcript, generate_questions

router = APIRouter()

class AnalysisRequest(BaseModel):
    transcript_id: str
    transcript_text: str

class SymptomAnalysis(BaseModel):
    symptom: str
    confidence: float
    severity: Optional[str] = None
    related_conditions: Optional[List[str]] = None

class QuestionSuggestion(BaseModel):
    question: str
    relevance_score: float
    context: Optional[str] = None

class AnalysisResponse(BaseModel):
    identified_symptoms: List[SymptomAnalysis]
    suggested_questions: List[QuestionSuggestion]
    analysis_summary: Optional[str] = None

@router.post("/analyze-transcript", response_model=AnalysisResponse)
async def analyze_transcript_endpoint(request: AnalysisRequest):
    """
    Analyze a transcript to identify symptoms and generate relevant question suggestions
    using Google Gemini API.
    """
    try:
        # Call the analysis service
        analysis_result = await analyze_transcript(request.transcript_text)
        
        # Generate follow-up questions based on the transcript
        questions = await generate_questions(
            request.transcript_text, 
            analysis_result.get("identified_symptoms", [])
        )
        
        return {
            "identified_symptoms": analysis_result.get("identified_symptoms", []),
            "suggested_questions": questions,
            "analysis_summary": analysis_result.get("summary")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/real-time-analysis", response_model=Dict[str, Any])
async def analyze_real_time(transcript_segment: str):
    """
    Analyze a segment of transcript in real-time to provide immediate feedback.
    For real-time question suggestions during the consultation.
    """
    # Placeholder - this would be implemented with streaming analysis
    return {
        "suggested_questions": [
            {"question": "Could you describe the pain level?", "relevance_score": 0.95}
        ]
    } 