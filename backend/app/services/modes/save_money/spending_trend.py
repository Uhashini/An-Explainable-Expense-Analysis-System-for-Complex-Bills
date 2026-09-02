import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.database.postgres_client import Receipt

try:
    from statsmodels.tsa.seasonal import STL
    from sklearn.ensemble import IsolationForest
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

from app.services.modes.save_money.category_anomalies import get_category_anomalies

def get_spending_trend(
    db: Session, 
    user_id: int, 
    current_spending: float, 
    current_receipt_id: Optional[int] = None, 
    items_data: Optional[List[Dict[str, Any]]] = None
):
    """
    SM-06 / Spending Trend Analysis
    Uses STL decomposition and Isolation Forest to detect unusual spending spikes in the user's monthly trend.
    """
    query = db.query(Receipt).filter(Receipt.user_id == user_id)
    if current_receipt_id:
        query = query.filter(Receipt.receipt_id != current_receipt_id)
    
    other_receipts = query.all()
    
    # Calculate monthly history
    monthly_data = {}
    for r in other_receipts:
        if not r.date:
            continue
        date_str = str(r.date)
        parts = date_str.split()
        if len(parts) >= 3:
            month_key = f"{parts[1][:3]} {parts[2]}" 
        elif "-" in date_str and len(date_str) >= 7:
            month_key = date_str[:7]
        else:
            month_key = "Other"
            
        monthly_data[month_key] = monthly_data.get(month_key, 0.0) + (r.total_amount or 0.0)
    
    curr_date = datetime.now().strftime("%Y-%m")
    monthly_data[curr_date] = monthly_data.get(curr_date, 0.0) + current_spending
    
    sorted_months = sorted(monthly_data.keys())
    monthly_history = [{"month": k, "amount": round(monthly_data[k], 2), "is_anomaly": False, "trend_val": round(monthly_data[k], 2)} for k in sorted_months if k != "Other"]
    
    anomalies_detected = []
    if ML_AVAILABLE and len(monthly_history) >= 4:
        amounts = [m["amount"] for m in monthly_history]
        df = pd.DataFrame({"amount": amounts})
        try:
            period = min(max(len(amounts) // 2, 2), 12)
            stl = STL(df['amount'], period=period, robust=True)
            res = stl.fit()
            trend_line = res.trend.tolist()
            residuals = res.resid.tolist()
            
            if len(residuals) > 5:
                iso = IsolationForest(contamination=0.1, random_state=42)
                preds = iso.fit_predict(np.array(residuals).reshape(-1, 1))
                anomalies = [True if p == -1 else False for p in preds]
            else:
                res_mean = np.mean(residuals)
                res_std = np.std(residuals)
                anomalies = [True if abs(r - res_mean) > 2 * res_std else False for r in residuals] if res_std > 0 else [False]*len(residuals)
                
            for i, m in enumerate(monthly_history):
                m["trend_val"] = round(trend_line[i], 2)
                m["is_anomaly"] = anomalies[i]
                if anomalies[i]:
                    anomalies_detected.append(m["month"])
        except Exception as e:
            print(f"STL Error: {e}")
            pass

    cat_anomalies = []
    if items_data:
        cat_anomalies = get_category_anomalies(db, user_id, items_data)
    
    if not other_receipts:
        return {
            "previous_average": 0.0,
            "current_spending": current_spending,
            "change_percentage": 0.0,
            "trend": "First Receipt! 🎉",
            "monthly_history": monthly_history,
            "anomalies": anomalies_detected,
            "category_anomalies": cat_anomalies
        }

    total_historical_spend = sum(r.total_amount or 0.0 for r in other_receipts)
    previous_average = total_historical_spend / len(other_receipts)
    change_pct = ((current_spending - previous_average) / previous_average) * 100 if previous_average > 0 else 100.0

    trend = "Stable"
    if change_pct > 5: trend = "Increasing"
    elif change_pct < -5: trend = "Decreasing"
        
    if curr_date in anomalies_detected:
        trend = "Unusual Spike" if change_pct > 0 else "Unusual Drop"

    return {
        "previous_average": round(previous_average, 2),
        "current_spending": round(current_spending, 2),
        "change_percentage": round(change_pct, 1),
        "trend": trend,
        "monthly_history": monthly_history[-12:],
        "anomalies": anomalies_detected,
        "category_anomalies": cat_anomalies
    }
