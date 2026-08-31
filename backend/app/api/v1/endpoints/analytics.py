from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.postgres_client import get_db, Receipt, ReceiptItem
from app.services.analytics_service import get_spending_trend, get_price_deviations

from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ReceiptItemData(BaseModel):
    name: str
    price: Optional[str] = None
    total_price: Optional[str] = None
    matched_food_id: Optional[int] = None
    food_id: Optional[int] = None

class AnalyticsRequest(BaseModel):
    user_id: int
    receipt_id: Optional[int] = None
    total_amount: float
    items: List[ReceiptItemData]

@router.post("/calculate")
def analyze_receipt(req: AnalyticsRequest, db: Session = Depends(get_db)):
    items_data = [item.dict() for item in req.items]
    
    trend_data = get_spending_trend(db, req.user_id, req.total_amount, req.receipt_id)
    price_deviations = get_price_deviations(db, req.user_id, items_data, req.receipt_id)

    # Insert into AnalysisResult database table
    try:
        import json
        from app.database.postgres_client import AnalysisResult
        analysis_result = AnalysisResult(
            user_id=req.user_id,
            receipt_id=req.receipt_id,
            trend_data=json.dumps(trend_data),
            price_deviations=json.dumps(price_deviations)
        )
        db.add(analysis_result)
        db.commit()
    except Exception as db_err:
        print(f"Warning: Failed to save analysis result to database: {db_err}")

    return {
        "status": "success",
        "data": {
            "trend": trend_data,
            "price_deviations": price_deviations
        }
    }

@router.get("/receipt/{receipt_id}")
def get_receipt_analytics(receipt_id: int, user_id: int, db: Session = Depends(get_db)):
    # Verify receipt exists and belongs to user
    receipt = db.query(Receipt).filter(
        Receipt.receipt_id == receipt_id,
        Receipt.user_id == user_id
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found or unauthorized")

    # Get items explicitly since Receipt doesn't have an items relationship
    current_items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt_id).all()
    items_data = [{"name": item.name, "price": item.price, "matched_food_id": item.matched_food_id} for item in current_items]

    trend_data = get_spending_trend(db, user_id, receipt.total_amount or 0.0, receipt_id)
    price_deviations = get_price_deviations(db, user_id, items_data, receipt_id)

    return {
        "status": "success",
        "data": {
            "trend": trend_data,
            "price_deviations": price_deviations
        }
    }
