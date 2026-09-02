import re
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Float

from app.database.postgres_client import Receipt, ReceiptItem
from app.services.modes.save_money.schemas import (
    ReceiptItem as SchemaReceiptItem,
    PriceDeviationResult,
    PriceDeviationItem
)

def extract_float(price_str: str) -> float:
    if not price_str:
        return 0.0
    # Remove non-numeric characters except dot
    clean_str = re.sub(r'[^\d.]', '', str(price_str))
    try:
        return float(clean_str)
    except ValueError:
        return 0.0

def get_price_deviations(
    db: Session, 
    user_id: int, 
    items_data: List[SchemaReceiptItem], 
    exclude_receipt_id: Optional[int] = None
) -> PriceDeviationResult:
    """
    SM-07: Price Deviation Analysis.
    Calculates if the user is paying more than their historical average for items.
    """
    deviations = []
    
    # 1. Extract all food IDs from the current receipt
    food_ids = []
    for item in items_data:
        fid = item.matched_food_id or item.food_id
        if fid:
            food_ids.append(fid)
            
    # 2. Optimized Query: Fetch historical items for ALL food IDs in one go (Solves N+1 Problem)
    historical_averages = {}
    if food_ids:
        query = db.query(
            ReceiptItem.matched_food_id, 
            ReceiptItem.price, 
            ReceiptItem.quantity
        ).join(Receipt).filter(
            Receipt.user_id == user_id,
            ReceiptItem.matched_food_id.in_(food_ids)
        )
        if exclude_receipt_id:
            query = query.filter(ReceiptItem.receipt_id != exclude_receipt_id)
            
        historical_rows = query.all()
        
        # 3. Group and calculate true Unit Price in Python to safely handle string quantities like '1kg'
        historical_prices_map = {fid: [] for fid in food_ids}
        for row in historical_rows:
            if row.matched_food_id:
                p = extract_float(row.price)
                q = extract_float(row.quantity) or 1.0
                if p > 0:
                    historical_prices_map[row.matched_food_id].append(p / q)
                    
        for fid, prices in historical_prices_map.items():
            if prices:
                historical_averages[fid] = sum(prices) / len(prices)

    # 4. Process each item and apply the 4-Tier logic
    for item in items_data:
        food_name = item.name
        if not food_name:
            continue
            
        current_unit_price = extract_float(str(item.price))
        if current_unit_price == 0:
            continue
            
        current_quantity = extract_float(str(item.quantity)) or 1.0
            
        matched_food_id = item.matched_food_id or item.food_id
        avg_historical_price = historical_averages.get(matched_food_id)
        
        if not avg_historical_price:
            deviations.append(PriceDeviationItem(
                item_name=food_name,
                current_price=round(current_unit_price, 2),
                historical_average=None,
                difference=0.0,
                change_percentage=0.0,
                status="First time buying"
            ))
            continue
            
        diff = current_unit_price - avg_historical_price
        change_pct = (diff / avg_historical_price) * 100 if avg_historical_price > 0 else 0
        
        # 4-Tier Classification Logic from Specification
        if change_pct > 30:
            status = "Significant Increase 🔴"
        elif change_pct > 15:
            status = "High 🔴"
        elif change_pct > 5:
            status = "Slightly Higher 🟡"
        elif change_pct < -5:
            status = "Lower than usual 🟢"
        else:
            status = "Normal 🟢"
            
        deviations.append(PriceDeviationItem(
            item_name=food_name,
            current_price=round(current_unit_price, 2),
            historical_average=round(avg_historical_price, 2),
            difference=round(diff, 2),
            change_percentage=round(change_pct, 1),
            status=status
        ))
        
    return PriceDeviationResult(
        analysis_id="SM-07",
        price_deviation=deviations
    )
