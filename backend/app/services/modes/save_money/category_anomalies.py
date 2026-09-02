import numpy as np
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.database.postgres_client import Receipt, ReceiptItem, FoodItem

try:
    from sklearn.ensemble import IsolationForest
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

from app.services.analytics_service import extract_float

def get_category_anomalies(db: Session, user_id: int, items_data: List[Dict[str, Any]]):
    """
    SM-05 / Category Anomalies
    Uses Isolation Forest to detect if spending in any category is unusually high.
    """
    anomalies = []
    if not ML_AVAILABLE or not items_data:
        return anomalies
        
    try:
        current_data = {}
        food_ids = []
        for item in items_data:
            fid = item.get("matched_food_id") or item.get("food_id")
            if fid:
                food_ids.append(fid)
                
        food_items = db.query(FoodItem).filter(FoodItem.food_id.in_(food_ids)).all()
        food_cat_map = {f.food_id: f.category or "Other" for f in food_items}
        
        for item in items_data:
            fid = item.get("matched_food_id") or item.get("food_id")
            cat_name = food_cat_map.get(fid, "Other")
            price = extract_float(str(item.get("total_price", item.get("price", "0"))))
            current_data[cat_name] = current_data.get(cat_name, 0.0) + price
            
        query = db.query(ReceiptItem, Receipt.date, FoodItem.category).join(
            Receipt, ReceiptItem.receipt_id == Receipt.receipt_id
        ).outerjoin(
            FoodItem, ReceiptItem.matched_food_id == FoodItem.food_id
        ).filter(Receipt.user_id == user_id)
        
        all_items = query.all()
        
        historical_data = {} 
        
        for item, r_date, category in all_items:
            cat_name = category or "Other"
            if cat_name not in current_data:
                continue 
                
            price = extract_float(str(item.price))
            
            if r_date:
                month_key = r_date.strftime("%Y-%m") if hasattr(r_date, 'strftime') else str(r_date)[:7]
                if cat_name not in historical_data:
                    historical_data[cat_name] = {}
                historical_data[cat_name][month_key] = historical_data[cat_name].get(month_key, 0.0) + price
        
        for cat_name, curr_total in current_data.items():
            hist = historical_data.get(cat_name, {})
            if len(hist) >= 3:
                amounts = list(hist.values())
                iso = IsolationForest(contamination=0.1, random_state=42)
                iso.fit(np.array(amounts).reshape(-1, 1))
                
                curr_pred = iso.predict(np.array([[curr_total]]))
                is_anomaly = True if curr_pred[0] == -1 else False
                avg_hist = sum(amounts) / len(amounts)
                
                if is_anomaly and curr_total > avg_hist:
                    anomalies.append({
                        "category": cat_name,
                        "historical_average": round(avg_hist, 2),
                        "current_spending": round(curr_total, 2),
                        "is_anomaly": True
                    })
    except Exception as e:
        print(f"Error in category anomalies: {e}")
        
    return anomalies
