"""
SM-04 — Weekly / Monthly Spending Trend Analysis

Analyzes the trajectory of a user's grocery expenditure across weekly and monthly intervals.
Uses STL (Seasonal and Trend decomposition using LOESS) to extract core trend lines.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
import numpy as np
import pandas as pd

from app.database.postgres_client import Receipt
from app.services.modes.save_money.schemas import (
    SpendingTrendResult,
    MonthlySpendPoint,
)

try:
    from statsmodels.tsa.seasonal import STL
    from sklearn.ensemble import IsolationForest
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False


def get_spending_trend(
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    current_spending: float = 0.0,
    current_receipt_id: Optional[int] = None,
    items_data: Optional[List[Dict[str, Any]]] = None,
    historical_receipts: Optional[List[Any]] = None,
) -> SpendingTrendResult:
    """Compute weekly and monthly spending trends.

    Args:
        db: Database session.
        user_id: User ID.
        current_spending: Total spending of the current receipt.
        current_receipt_id: Optional ID of the receipt being analyzed.
        items_data: Optional list of item dictionaries.
        historical_receipts: Optional pre-fetched historical receipt objects.

    Returns:
        SpendingTrendResult with historical monthly/weekly breakdowns and trend indicators.
    """
    if (db is None and historical_receipts is None) or user_id is None:
        return SpendingTrendResult(
            analysis_id="SM-04",
            previous_average=0.0,
            current_spending=round(current_spending, 2),
            change_percentage=0.0,
            trend="Stable",
            monthly_history=[],
            weekly_history=[],
            anomalies=[],
        )

    if historical_receipts is not None:
        other_receipts = [
            r for r in historical_receipts 
            if not current_receipt_id or getattr(r, "receipt_id", None) != current_receipt_id
        ]
    else:
        query = db.query(Receipt).filter(Receipt.user_id == user_id)
        if current_receipt_id:
            query = query.filter(Receipt.receipt_id != current_receipt_id)
        other_receipts = query.all()

    # ── 1. Calculate Monthly & Weekly Historical Aggregates ───────────────
    monthly_data: Dict[str, float] = {}
    weekly_data: Dict[str, float] = {}

    for r in other_receipts:
        if not r.date:
            continue
        
        # Handle string or datetime.date
        d_val = r.date
        if isinstance(d_val, (datetime, date)):
            d_str = d_val.strftime("%Y-%m-%d")
            m_key = d_val.strftime("%Y-%m")
            w_key = f"{d_val.year}-W{d_val.isocalendar()[1]:02d}"
        else:
            d_str = str(d_val)
            m_key = d_str[:7] if len(d_str) >= 7 else "Other"
            w_key = m_key

        amt = float(r.total_amount or 0.0)
        if m_key != "Other":
            monthly_data[m_key] = monthly_data.get(m_key, 0.0) + amt
        if w_key != "Other":
            weekly_data[w_key] = weekly_data.get(w_key, 0.0) + amt

    # Add current receipt spending to current period
    now = datetime.now()
    curr_month = now.strftime("%Y-%m")
    curr_week = f"{now.year}-W{now.isocalendar()[1]:02d}"

    monthly_data[curr_month] = monthly_data.get(curr_month, 0.0) + current_spending
    weekly_data[curr_week] = weekly_data.get(curr_week, 0.0) + current_spending

    sorted_months = sorted(monthly_data.keys())
    monthly_points: List[MonthlySpendPoint] = [
        MonthlySpendPoint(
            period=k,
            amount=round(monthly_data[k], 2),
            is_anomaly=False,
            trend_val=round(monthly_data[k], 2),
        )
        for k in sorted_months
    ]

    sorted_weeks = sorted(weekly_data.keys())
    weekly_history = [
        {"period": k, "amount": round(weekly_data[k], 2)}
        for k in sorted_weeks[-8:]  # Last 8 weeks
    ]

    # ── 2. Run STL Decomposition for Time-Series Smoothing ───────────────
    anomalies_detected = []
    if ML_AVAILABLE and len(monthly_points) >= 4:
        amounts = [m.amount for m in monthly_points]
        df = pd.DataFrame({"amount": amounts})
        try:
            period = min(max(len(amounts) // 2, 2), 12)
            stl = STL(df["amount"], period=period, robust=True)
            res = stl.fit()
            trend_line = res.trend.tolist()
            residuals = res.resid.tolist()

            if len(residuals) > 5:
                iso = IsolationForest(contamination=0.1, random_state=42)
                preds = iso.fit_predict(np.array(residuals).reshape(-1, 1))
                anomalies = [bool(p == -1) for p in preds]
            else:
                res_mean = float(np.mean(residuals))
                res_std = float(np.std(residuals))
                anomalies = [
                    bool(abs(r - res_mean) > 2.0 * res_std) if res_std > 0 else False
                    for r in residuals
                ]

            for i, m in enumerate(monthly_points):
                m.trend_val = round(float(trend_line[i]), 2)
                m.is_anomaly = anomalies[i]
                if anomalies[i]:
                    anomalies_detected.append(m.period)
        except Exception:
            pass

    # ── 3. Handle First Receipt Case ─────────────────────────────────────
    if not other_receipts:
        return SpendingTrendResult(
            analysis_id="SM-04",
            previous_average=0.0,
            current_spending=round(current_spending, 2),
            change_percentage=0.0,
            trend="First Receipt! 🎉",
            monthly_history=monthly_points,
            weekly_history=weekly_history,
            anomalies=anomalies_detected,
        )

    # ── 4. Calculate Percentage Change and Velocity ──────────────────────
    total_historical_spend = sum(float(r.total_amount or 0.0) for r in other_receipts)
    previous_average = total_historical_spend / len(other_receipts)
    change_pct = (
        ((current_spending - previous_average) / previous_average) * 100.0
        if previous_average > 0
        else 100.0
    )

    trend = "Stable"
    if change_pct > 5.0:
        trend = "Increasing"
    elif change_pct < -5.0:
        trend = "Decreasing"

    if curr_month in anomalies_detected:
        trend = "Unusual Spike" if change_pct > 0 else "Unusual Drop"

    return SpendingTrendResult(
        analysis_id="SM-04",
        previous_average=round(previous_average, 2),
        current_spending=round(current_spending, 2),
        change_percentage=round(change_pct, 1),
        trend=trend,
        monthly_history=monthly_points[-12:],  # Last 12 months
        weekly_history=weekly_history,
        anomalies=anomalies_detected,
    )
