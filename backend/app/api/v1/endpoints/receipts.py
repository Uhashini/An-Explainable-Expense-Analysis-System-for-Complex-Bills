import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.ocr_service import ocr_service
from app.services.product_matcher import product_matcher

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload", tags=["Receipts"])
async def upload_receipt(file: UploadFile = File(...)):
    """
    Upload a receipt image and return structured receipt data.

    Response shape:
    {
        "status": "success",
        "filename": "...",
        "data": {
            "receipt_info": {
                "merchant_name": str,
                "date": str,
                "total_amount": float,
                "items": [{ "name", "quantity", "unit_price", "total_price" }]
            },
            "words": [...],
            "boxes": [...],
            "entities": [...],
            "image_size": { "width": int, "height": int }
        }
    }
    """
    # Be permissive — React Native sometimes sends no content type or image/octet-stream
    if file.content_type and not file.content_type.startswith("image/") and file.content_type != "application/octet-stream":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Must be an image.",
        )

    try:
        from fastapi.concurrency import run_in_threadpool
        
        contents = await file.read()

        # Full OCR + LayoutLM pipeline (run in threadpool to prevent blocking the async event loop)
        result = await run_in_threadpool(ocr_service.extract_structured_data, contents)

        # Stamp the original filename
        result["filename"] = file.filename

        # Auto-match extracted items against database food & nutrition items
        items = result.get("data", {}).get("receipt_info", {}).get("items", [])
        for item in items:
            try:
                item_name = item.get("name", "")
                if item_name:
                    match = product_matcher.match_item(item_name)
                    if match:
                        item["food_id"] = match.get("food_id")
                        item["matched_name"] = match.get("matched_name")
                        item["display_name"] = match.get("display_name")
                        item["category"] = match.get("category")
                        item["subcategory"] = match.get("subcategory")
                        item["serving_size"] = match.get("serving_size")
                        item["serving_unit"] = match.get("serving_unit")
                        item["nutrition"] = match.get("nutrition")
                        item["health"] = match.get("health")
            except Exception as match_err:
                logger.warning(f"Failed to match item '{item.get('name')}': {match_err}")

        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Error processing receipt: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing receipt: {str(e)}\n{traceback.format_exc()}",
        )

class MatchProductsRequest(BaseModel):
    items: List[Dict[str, Any]]

@router.post("/match-products", tags=["Receipts"])
async def match_products(request: MatchProductsRequest):
    """
    Enhance a list of receipt items by matching them against the food database.
    """
    try:
        from fastapi.concurrency import run_in_threadpool
        
        def _match_items():
            enriched_items = []
            for item in request.items:
                match = product_matcher.match_item(item.get("name", ""))
                if match:
                    item["food_id"] = match.get("food_id")
                    item["matched_name"] = match.get("matched_name")
                    item["display_name"] = match.get("display_name")
                    item["category"] = match.get("category")
                    item["subcategory"] = match.get("subcategory")
                    item["serving_size"] = match.get("serving_size")
                    item["serving_unit"] = match.get("serving_unit")
                    item["nutrition"] = match.get("nutrition")
                    item["health"] = match.get("health")
                enriched_items.append(item)
            return enriched_items
            
        enriched_items = await run_in_threadpool(_match_items)
        return {"status": "success", "items": enriched_items}
        
    except Exception as e:
        error_msg = str(e)
        if "Connection refused" in error_msg:
            detail = "Database connection refused. Your Neon PostgreSQL database might be asleep. Please go to your Neon console to wake it up."
        else:
            detail = f"Error matching products: {error_msg}"
            
        raise HTTPException(
            status_code=500,
            detail=detail,
        )

from sqlalchemy.orm import Session
from fastapi import Depends
from app.database.postgres_client import get_db, UserProfile, Receipt, ReceiptItem
from typing import Optional

class ReceiptItemCreate(BaseModel):
    name: str
    matched_food_id: Optional[int] = None
    quantity: Optional[str] = None
    rate: Optional[str] = None
    price: Optional[str] = None

class ReceiptCreate(BaseModel):
    user_id: int
    merchant_name: Optional[str] = None
    date: Optional[str] = None
    total_amount: Optional[float] = None
    items: List[ReceiptItemCreate]

@router.post("/save", tags=["Receipts"])
def save_receipt(data: ReceiptCreate, db: Session = Depends(get_db)):
    user = db.query(UserProfile).filter(UserProfile.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    receipt = Receipt(
        user_id=data.user_id,
        merchant_name=data.merchant_name,
        date=data.date,
        total_amount=data.total_amount
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    
    for item in data.items:
        db_item = ReceiptItem(
            receipt_id=receipt.receipt_id,
            name=item.name,
            matched_food_id=item.matched_food_id,
            quantity=item.quantity,
            rate=item.rate,
            price=item.price
        )
        db.add(db_item)
        
    db.commit()
    return {"status": "success", "message": "Receipt saved successfully", "receipt_id": receipt.receipt_id}

@router.get("/user/{user_id}", tags=["Receipts"])
def get_user_receipts(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Fetch receipts for the user, ordered by most recent first
    receipts = db.query(Receipt).filter(Receipt.user_id == user_id).order_by(Receipt.receipt_id.desc()).all()
    
    result = []
    for r in receipts:
        # Count items for each receipt
        item_count = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == r.receipt_id).count()
        
        result.append({
            "receipt_id": r.receipt_id,
            "merchant_name": r.merchant_name or "Unknown Store",
            "date": r.date or "Unknown Date",
            "total_amount": r.total_amount or 0.0,
            "items_count": item_count
        })
        
    return {"status": "success", "receipts": result}

from sqlalchemy.orm import joinedload
from app.database.postgres_client import FoodItem, Nutrition

@router.get("/{receipt_id}", tags=["Receipts"])
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.receipt_id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt_id).all()
    
    formatted_items = []
    for item in items:
        item_data = {
            "item_id": item.item_id,
            "name": item.name,
            "matched_product_id": item.matched_food_id,
            "food_id": item.matched_food_id,
            "quantity": item.quantity,
            "unit_price": item.rate,
            "total_price": item.price,
        }
        
        if item.matched_food_id:
            food = db.query(FoodItem).options(joinedload(FoodItem.nutrition)).filter(FoodItem.food_id == item.matched_food_id).first()
            if food:
                item_data["matched_name"] = food.display_name or food.canonical_name
                item_data["category"] = food.category
                
                if food.nutrition:
                    item_data["nutrition"] = {
                        "calories_kcal": float(food.nutrition.calories_kcal) if food.nutrition.calories_kcal else None,
                        "protein_g": float(food.nutrition.protein_g) if food.nutrition.protein_g else None,
                        "carbohydrates_g": float(food.nutrition.carbohydrates_g) if food.nutrition.carbohydrates_g else None,
                        "fat_g": float(food.nutrition.fat_g) if food.nutrition.fat_g else None,
                    }
                    
        formatted_items.append(item_data)
        
    return {
        "status": "success",
        "data": {
            "receipt_info": {
                "receipt_id": receipt.receipt_id,
                "merchant_name": receipt.merchant_name,
                "date": receipt.date,
                "total_amount": receipt.total_amount,
                "items": formatted_items
            }
        }
    }


class SaveMoneyAnalysisRequest(BaseModel):
    items: List[Dict[str, Any]]
    monthly_budget: Optional[float] = 3000.0
    previous_spend: Optional[float] = 0.0
    top_n: Optional[int] = None


@router.post("/analyze-save-money", tags=["Receipts"])
async def analyze_save_money(request: SaveMoneyAnalysisRequest):
    """
    Run Save Money mode (SM-01, SM-02, SM-03) on a list of receipt items.
    """
    try:
        from app.services.modes.save_money import run_save_money_analysis
        from app.services.modes.save_money.schemas import ReceiptItem

        receipt_items = []
        for it in request.items:
            name = it.get("name") or it.get("matched_name") or it.get("display_name") or "Unknown Item"
            category = it.get("category") or "Uncategorized"
            qty = float(it.get("quantity") or 1)
            
            if "unit_price" in it and it["unit_price"] is not None:
                price = float(it["unit_price"])
            elif "price" in it and it["price"] is not None:
                price = float(it["price"])
            elif "total_price" in it and it["total_price"] is not None:
                price = float(it["total_price"]) / (qty if qty > 0 else 1)
            else:
                price = 0.0

            receipt_items.append(
                ReceiptItem(
                    name=name,
                    category=category,
                    price=price,
                    quantity=qty,
                )
            )

        analysis = run_save_money_analysis(
            items=receipt_items,
            monthly_budget=request.monthly_budget,
            previous_spend=request.previous_spend or 0.0,
            top_n=request.top_n,
        )

        return {
            "status": "success",
            "data": analysis.dict(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing save money mode: {str(e)}",
        )

