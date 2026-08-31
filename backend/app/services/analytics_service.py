import re
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.postgres_client import Receipt, ReceiptItem, FoodItem

def extract_float(price_str: str) -> float:
    if not price_str:
        return 0.0
    # Remove non-numeric characters except dot
    clean_str = re.sub(r'[^\d.]', '', price_str)
    try:
        return float(clean_str)
    except ValueError:
        return 0.0

def get_spending_trend(db: Session, user_id: int, current_spending: float, exclude_receipt_id: int = None):
    # Get all other receipts for the user to calculate historical average
    query = db.query(Receipt).filter(Receipt.user_id == user_id)
    if exclude_receipt_id:
        query = query.filter(Receipt.receipt_id != exclude_receipt_id)
    
    other_receipts = query.all()
    
    # Calculate monthly history
    monthly_data = {}
    for r in other_receipts:
        date_str = str(r.date) if r.date else "Unknown"
        parts = date_str.split()
        if len(parts) >= 3:
            month_key = f"{parts[1][:3]} {parts[2]}" 
        elif "-" in date_str and len(date_str) >= 7:
            month_key = date_str[:7]
        else:
            month_key = "Other"
            
        monthly_data[month_key] = monthly_data.get(month_key, 0.0) + (r.total_amount or 0.0)
        
    monthly_history = [{"month": k, "amount": round(v, 2)} for k, v in monthly_data.items()]
    monthly_history = monthly_history[-6:]

    if not other_receipts:
        return {
            "previous_average": 0.0,
            "current_spending": current_spending,
            "change_percentage": 0.0,
            "trend": "First Receipt! 🚀",
            "monthly_history": []
        }

    total_historical_spend = sum(r.total_amount or 0.0 for r in other_receipts)
    previous_average = total_historical_spend / len(other_receipts)

    if previous_average > 0:
        change_pct = ((current_spending - previous_average) / previous_average) * 100
    else:
        change_pct = 100.0

    if change_pct > 5:
        trend = "Increasing ⬆️"
    elif change_pct < -5:
        trend = "Decreasing ⬇️"
    else:
        trend = "Stable ➡️"

    return {
        "previous_average": round(previous_average, 2),
        "current_spending": round(current_spending, 2),
        "change_percentage": round(change_pct, 1),
        "trend": trend,
        "monthly_history": monthly_history
    }


def get_price_deviations(db: Session, user_id: int, items_data: list, exclude_receipt_id: int = None):
    deviations = []
    
    for item in items_data:
        food_name = item.get("name") or item.get("item_name")
        if not food_name:
            continue
            
        # The price could be under "price" or "total_price"
        price_val = item.get("total_price") if item.get("total_price") is not None else item.get("price")
        current_price = extract_float(str(price_val))
        
        # We also need quantity to get a unit price for accurate comparison, 
        # but for now we just compare the raw price like before
        if current_price == 0:
            continue
            
        matched_food_id = item.get("matched_food_id") or item.get("food_id")
        
        # Find historical purchases
        query = db.query(ReceiptItem).join(Receipt).filter(Receipt.user_id == user_id)
        if exclude_receipt_id:
            query = query.filter(ReceiptItem.receipt_id != exclude_receipt_id)
            
        if matched_food_id:
            historical_items = query.filter(ReceiptItem.matched_food_id == matched_food_id).all()
        else:
            historical_items = query.filter(func.lower(ReceiptItem.name) == func.lower(food_name)).all()
        
        historical_prices = [extract_float(hi.price) for hi in historical_items if extract_float(hi.price) > 0]
        
        if not historical_prices:
            deviations.append({
                "item_name": food_name,
                "current_price": round(current_price, 2),
                "historical_average": None,
                "difference": 0.0,
                "change_percentage": 0.0,
                "status": "First time buying"
            })
            continue
            
        avg_historical_price = sum(historical_prices) / len(historical_prices)
        
        diff = current_price - avg_historical_price
        change_pct = (diff / avg_historical_price) * 100 if avg_historical_price > 0 else 0
        
        if change_pct > 5:
            status = "Higher than usual 🔺"
        elif change_pct < -5:
            status = "Lower than usual 📉"
        else:
            status = "Normal 🔹"
            
        deviations.append({
            "item_name": food_name,
            "current_price": round(current_price, 2),
            "historical_average": round(avg_historical_price, 2),
            "difference": round(diff, 2),
            "change_percentage": round(change_pct, 1),
            "status": status
        })
        
    return deviations
