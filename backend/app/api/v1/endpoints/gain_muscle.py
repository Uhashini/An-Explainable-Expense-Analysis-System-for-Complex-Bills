"""
gain_muscle.py — FastAPI router for Person 5: Gain Muscle / Protein Intelligence

Endpoints:
  GET /api/v1/gain-muscle/{user_id}                 — GM-01, GM-02, GM-03, GM-05
  GET /api/v1/gain-muscle/{user_id}/recommendations — GM-04 (heavier query, separate)

All endpoints are user-scoped. Receipt data is filtered by user_id.
No mock data is used anywhere in this module.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.postgres_client import get_db, UserProfile
from app.services.protein_service import (
    get_full_gain_muscle_analysis,
    gm04_recommendations,
)

router = APIRouter()


def _verify_user(user_id: int, db: Session) -> UserProfile:
    """Verify user exists. Raises 404 otherwise."""
    user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}", tags=["Gain Muscle"])
def gain_muscle_analysis(user_id: int, db: Session = Depends(get_db)):
    """
    Return GM-01 (Protein Availability), GM-02 (Protein Quality),
    GM-03 (Protein Cost Efficiency), and GM-05 (Protein Trend)
    for the given user based on their actual receipt history.
    """
    _verify_user(user_id, db)
    try:
        result = get_full_gain_muscle_analysis(db, user_id)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error running protein analysis: {str(e)}",
        )


@router.get("/{user_id}/recommendations", tags=["Gain Muscle"])
def gain_muscle_recommendations(
    user_id: int,
    top_n: int = 6,
    db: Session = Depends(get_db),
):
    """
    Return GM-04 (High-Protein Recommendations) for the given user.
    Recommendations are generated dynamically from the real food database.
    Foods already purchased by the user are excluded.
    """
    _verify_user(user_id, db)
    try:
        result = gm04_recommendations(db, user_id, top_n=top_n)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating recommendations: {str(e)}",
        )
