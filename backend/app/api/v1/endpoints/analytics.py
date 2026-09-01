import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.postgres_client import get_db, Receipt, ReceiptItem, AnalysisResult
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

def run_isolated(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception as e:
        print(f"Error executing {func.__name__}: {e}")
        return None

@router.post("/calculate")
def analyze_receipt(req: AnalyticsRequest, db: Session = Depends(get_db)):
    # 1. Database Cache Check
    if req.receipt_id:
        existing_result = db.query(AnalysisResult).filter(
            AnalysisResult.user_id == req.user_id,
            AnalysisResult.receipt_id == req.receipt_id
        ).first()
        
        if existing_result:
            return {
                "status": "success",
                "data": {
                    "trend": json.loads(existing_result.trend_data) if existing_result.trend_data else None,
                    "price_deviations": json.loads(existing_result.price_deviations) if existing_result.price_deviations else None
                }
            }

    # 2. Parallel Processing with ThreadPoolExecutor
    items_data = [item.dict() for item in req.items]
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_trend = executor.submit(run_isolated, get_spending_trend, db, req.user_id, req.total_amount, req.receipt_id)
        future_price = executor.submit(run_isolated, get_price_deviations, db, req.user_id, items_data, req.receipt_id)
        
        trend_data = future_trend.result()
        price_deviations = future_price.result()

    # 3. Store Results in Cache
    if req.receipt_id:
        try:
            analysis_result = AnalysisResult(
                user_id=req.user_id,
                receipt_id=req.receipt_id,
                trend_data=json.dumps(trend_data) if trend_data else None,
                price_deviations=json.dumps(price_deviations) if price_deviations else None
            )
            db.add(analysis_result)
            db.commit()
        except Exception as db_err:
            db.rollback()
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
    # 1. Database Cache Check
    existing_result = db.query(AnalysisResult).filter(
        AnalysisResult.user_id == user_id,
        AnalysisResult.receipt_id == receipt_id
    ).first()
    
    if existing_result:
        return {
            "status": "success",
            "data": {
                "trend": json.loads(existing_result.trend_data) if existing_result.trend_data else None,
                "price_deviations": json.loads(existing_result.price_deviations) if existing_result.price_deviations else None
            }
        }

    # Verify receipt exists and belongs to user
    receipt = db.query(Receipt).filter(
        Receipt.receipt_id == receipt_id,
        Receipt.user_id == user_id
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found or unauthorized")

    # Get items explicitly
    current_items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt_id).all()
    items_data = [{"name": item.name, "price": item.price, "matched_food_id": item.matched_food_id} for item in current_items]

    # 2. Parallel Processing
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_trend = executor.submit(run_isolated, get_spending_trend, db, user_id, receipt.total_amount or 0.0, receipt_id)
        future_price = executor.submit(run_isolated, get_price_deviations, db, user_id, items_data, receipt_id)
        
        trend_data = future_trend.result()
        price_deviations = future_price.result()

    # 3. Store Results in Cache
    try:
        analysis_result = AnalysisResult(
            user_id=user_id,
            receipt_id=receipt_id,
            trend_data=json.dumps(trend_data) if trend_data else None,
            price_deviations=json.dumps(price_deviations) if price_deviations else None
        )
        db.add(analysis_result)
        db.commit()
    except Exception as db_err:
        db.rollback()
        print(f"Warning: Failed to save analysis result to database: {db_err}")

    return {
        "status": "success",
        "data": {
            "trend": trend_data,
            "price_deviations": price_deviations
        }
    }
