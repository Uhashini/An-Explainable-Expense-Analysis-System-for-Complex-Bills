from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from app.database.postgres_client import get_db, UserProfile
from app.services.gemma_chatbot_service import gemma_chatbot_service
from app.services.llm_monitor import llm_monitor
from app.evaluation.evaluator import LLMEvaluator

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    user_id: int
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatConfigRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None

@router.post("/chat")
def chat_with_gemma(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Chat endpoint powered by Gemma 3 / Gemini LLM.
    Automatically retrieves user profile and receipt history to supply deep context.
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    history_payload = [{"role": h.role, "content": h.content} for h in request.history] if request.history else []

    try:
        response = gemma_chatbot_service.chat(
            user_id=request.user_id,
            message=request.message.strip(),
            conversation_history=history_payload,
            db=db,
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")

@router.get("/suggestions/{user_id}")
def get_chat_suggestions(user_id: int, db: Session = Depends(get_db)):
    """
    Returns smart suggested prompt chips tailored to user's tracked receipts & goals.
    """
    user_context = gemma_chatbot_service.build_user_context(user_id, db)
    goals = user_context.get("goals_and_health", {}).get("goals", "") or ""
    summary = user_context.get("receipt_summary", {})
    all_receipts = summary.get("all_receipts", [])

    suggestions = []

    # 1. Receipt-specific suggestions
    if all_receipts:
        latest = all_receipts[0]
        merchant = latest.get("merchant", "my latest visit")
        suggestions.append(f"Break down my spend at {merchant}")
        suggestions.append("Which foods in my receipts have the highest protein?")
    else:
        suggestions.append("What groceries should I buy for a high-protein diet?")

    # 2. Goal-specific suggestions
    if "muscle" in goals.lower():
        suggestions.append("Am I meeting my daily protein target?")
        suggestions.append("Explain my muscle-gain nutrition plan in detail")
    elif "healthy" in goals.lower() or "weight" in goals.lower():
        suggestions.append("How many calories should I eat daily?")
        suggestions.append("Explain 3 clean food swaps in detail")
    else:
        suggestions.append("How can I save ₹500 on groceries?")
        suggestions.append("Analyze my monthly spending pattern in detail")

    return {
        "status": "success",
        "user_id": user_id,
        "suggestions": suggestions[:4],
        "context_summary": {
            "total_receipts": summary.get("total_receipts", 0),
            "total_spent": summary.get("total_spent", 0.0),
            "total_protein_g": summary.get("total_protein_g", 0.0),
        }
    }

@router.get("/status")
def get_status():
    """
    Returns configuration and status of the Gemma 3 LLM service.
    """
    gemma_chatbot_service._refresh_keys()
    has_api_key = bool(
        gemma_chatbot_service.api_key
        or gemma_chatbot_service.groq_key
        or gemma_chatbot_service.openrouter_key
    )

    provider = "Local Data-Grounded Mode (Gemma 3 12B Engine)"
    if gemma_chatbot_service.api_key:
        provider = "Google AI Studio (Gemini / Gemma API)"
    elif gemma_chatbot_service.groq_key:
        provider = "Groq Ultra-Fast API"
    elif gemma_chatbot_service.openrouter_key:
        provider = "OpenRouter"

    return {
        "status": "online",
        "model": gemma_chatbot_service.default_model,
        "has_api_key": has_api_key,
        "provider": provider,
    }

@router.post("/config")
def update_config(config: ChatConfigRequest):
    """
    Dynamically update API keys for Google Gemini, Groq, or OpenRouter without server restart.
    """
    gemma_chatbot_service.set_keys(
        gemini_api_key=config.gemini_api_key,
        groq_api_key=config.groq_api_key,
        openrouter_api_key=config.openrouter_api_key,
    )
    return {
        "status": "success",
        "message": "Chatbot API keys updated successfully.",
        "has_gemini_key": bool(gemma_chatbot_service.api_key),
        "has_groq_key": bool(gemma_chatbot_service.groq_key),
        "has_openrouter_key": bool(gemma_chatbot_service.openrouter_key),
    }

class ChatEvalRequest(BaseModel):
    query: str
    response: str
    user_context: Optional[Dict[str, Any]] = None
    is_long_requested: Optional[bool] = False

@router.get("/monitoring/metrics")
def get_llm_metrics():
    """
    Returns live rolling observability metrics for the Gemma Chatbot LLM.
    Includes request counts, p50/p90 latency, error rates, model distribution,
    and DeepEval/Ragas quality scores.
    """
    return llm_monitor.get_metrics()

@router.get("/monitoring/traces")
def get_llm_traces(
    limit: int = Query(50, ge=1, le=500),
    flagged_only: bool = Query(False),
    min_latency_ms: Optional[float] = Query(None)
):
    """
    Returns recent LLM interaction traces with full query, response, latency, and quality evaluations.
    """
    return {
        "status": "success",
        "traces": llm_monitor.get_traces(
            limit=limit,
            flagged_only=flagged_only,
            min_latency_ms=min_latency_ms
        )
    }

@router.post("/monitoring/evaluate")
def evaluate_interaction(request: ChatEvalRequest):
    """
    On-demand evaluation of an interaction against DeepEval and Ragas criteria.
    """
    evaluator = LLMEvaluator()
    result = evaluator.evaluate_all(
        query=request.query,
        response=request.response,
        user_context=request.user_context or {},
        is_long_requested=request.is_long_requested or False
    )
    return {
        "status": "success",
        "evaluation": result
    }
