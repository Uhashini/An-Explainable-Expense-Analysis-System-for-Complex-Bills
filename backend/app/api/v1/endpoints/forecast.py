"""
Spending Forecast endpoint — SM-FORECAST

Calculates a real spending forecast for a user based on their actual saved receipts.

Logic:
  1. Fetch all receipts for the user from DB.
  2. Split into: current-month receipts vs. historical (prior months).
  3. Current-month total = sum of this month's receipt totals.
  4. Daily burn rate = current_month_total / days_elapsed_so_far.
  5. Projected month total = daily_burn_rate × total_days_in_month.
  6. Monthly budget = rolling 3-month average (or fixed fallback if < 3 months of data).
  7. Category breakdown: join ReceiptItem → FoodItem to get category,
     sum item prices per category for the current month.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
import calendar
from collections import defaultdict
from typing import List, Optional

from app.database.postgres_client import (
    get_db, Receipt, ReceiptItem, FoodItem, UserProfile
)

router = APIRouter()


def _parse_date(raw) -> Optional[date]:
    """Safely parse a receipt date (string or date) into a date object."""
    if raw is None:
        return None
    if isinstance(raw, (datetime, date)):
        return raw if isinstance(raw, date) else raw.date()
    raw = str(raw).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d %b %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _safe_float(val, default=0.0) -> float:
    """Parse a potentially string-formatted price to float."""
    if val is None:
        return default
    try:
        return float(str(val).replace(",", "").replace("₹", "").replace("Rs", "").strip())
    except (ValueError, TypeError):
        return default


# Category colour palette — consistent with app brand colours
CATEGORY_COLORS = {
    "Fruits":        "#4CAF50",
    "Vegetables":    "#8BC34A",
    "Dairy":         "#94B6EF",   # COLORS.secondary
    "Eggs":          "#FFC107",
    "Meat":          "#E91E63",
    "Seafood":       "#00BCD4",
    "Snacks":        "#990808",   # COLORS.primary
    "Beverages":     "#FF5722",
    "Grains":        "#E6E279",   # COLORS.accent
    "Pulses":        "#CDDC39",
    "Spices":        "#FF9800",
    "Oils":          "#795548",
    "Bakery":        "#9C27B0",
    "Frozen":        "#607D8B",
    "Personal Care": "#F06292",
    "Household":     "#78909C",
    "Other":         "#9E9E9E",
}

# Normalise FoodItem.category → our display buckets
CATEGORY_MAP = {
    "fruit":          "Fruits",
    "fruits":         "Fruits",
    "vegetable":      "Vegetables",
    "vegetables":     "Vegetables",
    "dairy":          "Dairy",
    "milk":           "Dairy",
    "cheese":         "Dairy",
    "egg":            "Eggs",
    "eggs":           "Eggs",
    "meat":           "Meat",
    "poultry":        "Meat",
    "chicken":        "Meat",
    "fish":           "Seafood",
    "seafood":        "Seafood",
    "snack":          "Snacks",
    "snacks":         "Snacks",
    "chips":          "Snacks",
    "beverage":       "Beverages",
    "beverages":      "Beverages",
    "drink":          "Beverages",
    "juice":          "Beverages",
    "grain":          "Grains",
    "grains":         "Grains",
    "rice":           "Grains",
    "wheat":          "Grains",
    "bread":          "Bakery",
    "bakery":         "Bakery",
    "pulse":          "Pulses",
    "pulses":         "Pulses",
    "lentil":         "Pulses",
    "dal":            "Pulses",
    "spice":          "Spices",
    "spices":         "Spices",
    "oil":            "Oils",
    "oils":           "Oils",
    "frozen":         "Frozen",
    "personal care":  "Personal Care",
    "household":      "Household",
}


def _normalise_category(raw_category: Optional[str]) -> str:
    if not raw_category:
        return "Other"
    key = raw_category.strip().lower()
    # Direct match
    if key in CATEGORY_MAP:
        return CATEGORY_MAP[key]
    # Partial match
    for k, v in CATEGORY_MAP.items():
        if k in key:
            return v
    return raw_category.strip().title() if raw_category.strip() else "Other"


@router.get("/forecast/{user_id}")
def get_spending_forecast(user_id: int, db: Session = Depends(get_db)):
    """
    Return a real spending forecast for the dashboard card.

    Response:
    {
      "month":           "OCTOBER",
      "year":            2026,
      "goal":            "SAVE MONEY",
      "currentSpend":    4200.0,       # actual this month so far
      "projectedSpend":  8100.0,       # projected by end of month
      "budget":          7500.0,       # 3-month rolling average (or fallback)
      "budgetUsedPct":   1.08,         # projectedSpend / budget
      "daysElapsed":     13,
      "daysInMonth":     31,
      "suggestion":      "...",
      "categories": [
        { "name": "Snacks", "projected": 2200, "budget": 1500, "color": "#990808" },
        ...
      ],
      "hasSufficientData": true
    }
    """
    # ── 0. Verify user exists ────────────────────────────────────────────────
    user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ── 1. Fetch all receipts ────────────────────────────────────────────────
    all_receipts = (
        db.query(Receipt)
        .filter(Receipt.user_id == user_id)
        .all()
    )

    today = date.today()
    curr_month = today.month
    curr_year = today.year
    days_in_month = calendar.monthrange(curr_year, curr_month)[1]
    days_elapsed = today.day  # days passed including today

    # ── 2. Split into current-month vs. historical ───────────────────────────
    current_month_receipts: List[Receipt] = []
    historical_by_month: dict = defaultdict(float)  # "YYYY-MM" → total spend

    for r in all_receipts:
        d = _parse_date(r.date)
        amt = _safe_float(r.total_amount)
        if d and d.year == curr_year and d.month == curr_month:
            current_month_receipts.append(r)
        elif d:
            key = f"{d.year}-{d.month:02d}"
            historical_by_month[key] += amt

    current_month_total = sum(_safe_float(r.total_amount) for r in current_month_receipts)

    # ── 3. Project end-of-month spend ────────────────────────────────────────
    # If we have current-month receipts, use daily burn rate projection.
    # If not (receipts have past dates, e.g. Neon has real data but dates are older),
    # estimate a monthly projection from ALL receipts using shopping frequency.
    using_historical_fallback = False

    if days_elapsed > 0 and current_month_total > 0:
        daily_rate = current_month_total / days_elapsed
        projected_spend = round(daily_rate * days_in_month, 2)
    elif all_receipts:
        # Fallback: estimate from all receipts
        using_historical_fallback = True
        receipt_dates = [_parse_date(r.date) for r in all_receipts]
        valid_dates = [d for d in receipt_dates if d is not None]

        if valid_dates:
            earliest = min(valid_dates)
            span_days = max((today - earliest).days + 1, 1)
            # Total spend over the date span → daily rate → monthly projection
            total_all_spend = sum(_safe_float(r.total_amount) for r in all_receipts)
            daily_rate_all = total_all_spend / span_days
            projected_spend = round(daily_rate_all * days_in_month, 2)
        else:
            # No dates at all — use simple average × 4 trips/month estimate
            avg_per_receipt = sum(_safe_float(r.total_amount) for r in all_receipts) / len(all_receipts)
            projected_spend = round(avg_per_receipt * 4, 2)
    else:
        projected_spend = 0.0

    # ── 4. Calculate budget = rolling 3-month average (or global avg fallback) ──
    sorted_months = sorted(historical_by_month.keys(), reverse=True)
    recent_months = sorted_months[:3]

    if recent_months:
        budget = round(sum(historical_by_month[m] for m in recent_months) / len(recent_months), 2)
    elif using_historical_fallback and all_receipts:
        # Budget = 90% of projected (assume they're slightly over on average)
        budget = round(projected_spend * 0.90, 2)
    elif current_month_total > 0:
        budget = round(projected_spend * 0.90, 2)
    else:
        budget = 0.0

    budget_used_pct = round(projected_spend / budget, 4) if budget > 0 else 0.0

    # ── 5. Category breakdown from actual receipt items ───────────────────────
    # Use current-month receipts if available, otherwise fall back to all receipts
    receipts_for_categories = current_month_receipts if current_month_receipts else all_receipts
    category_spend: dict = defaultdict(float)

    for r in receipts_for_categories:
        items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == r.receipt_id).all()
        for item in items:
            item_price = _safe_float(item.price)
            if item_price == 0.0:
                item_price = _safe_float(item.rate)

            # Resolve category from matched FoodItem
            category = "Other"
            if item.matched_food_id:
                food = db.query(FoodItem).filter(FoodItem.food_id == item.matched_food_id).first()
                if food and food.category:
                    category = _normalise_category(food.category)

            category_spend[category] += item_price

    # Project each category to end-of-month using the same daily-rate multiplier
    projection_multiplier = days_in_month / days_elapsed if days_elapsed > 0 else 1.0

    # Category budgets = proportional share of total budget
    total_cat_spend = sum(category_spend.values()) or 1.0
    categories = []
    for cat_name, cat_actual in sorted(category_spend.items(), key=lambda x: -x[1]):
        cat_projected = round(cat_actual * projection_multiplier, 2)
        cat_share = cat_actual / total_cat_spend
        cat_budget = round(budget * cat_share, 2) if budget > 0 else cat_projected
        categories.append({
            "name":      cat_name,
            "projected": cat_projected,
            "budget":    cat_budget,
            "color":     CATEGORY_COLORS.get(cat_name, "#9E9E9E"),
        })

    # ── 6. Generate a smart suggestion ───────────────────────────────────────
    over_budget_cats = [c for c in categories if c["projected"] > c["budget"]]
    diff = round(projected_spend - budget, 2)

    if not all_receipts:
        suggestion = "Start uploading receipts to get a personalised spending forecast for this month."
    elif projected_spend == 0.0:
        suggestion = "No spending recorded this month yet. Upload a receipt to start tracking."
    elif using_historical_fallback:
        suggestion = (
            f"Based on your purchase history, you're projected to spend ₹{projected_spend:,.0f} this month. "
            "Upload more recent receipts for a more accurate forecast."
        )
    elif over_budget_cats:
        top_cat = over_budget_cats[0]["name"]
        savings = round(over_budget_cats[0]["projected"] - over_budget_cats[0]["budget"], 2)
        suggestion = (
            f"Your {top_cat} spending is projected to exceed budget by ₹{savings:,.0f}. "
            "Consider switching to cheaper alternatives or buying in bulk."
        )
    elif diff < 0:
        suggestion = (
            f"Great job! You're on track to be ₹{abs(diff):,.0f} under budget this month. "
            "Keep up the smart shopping."
        )
    else:
        suggestion = "Your spending looks balanced this month. Keep tracking receipts for more accurate insights."

    month_name = today.strftime("%B").upper()

    return {
        "month":                    month_name,
        "year":                     curr_year,
        "goal":                     "SAVE MONEY",
        "currentSpend":             round(current_month_total, 2),
        "projectedSpend":           projected_spend,
        "budget":                   budget,
        "budgetUsedPct":            budget_used_pct,
        "daysElapsed":              days_elapsed,
        "daysInMonth":              days_in_month,
        "suggestion":               suggestion,
        "categories":               categories,
        "hasSufficientData":        len(all_receipts) > 0,
        "totalReceipts":            len(all_receipts),
        "currentMonthCount":        len(current_month_receipts),
        "usingHistoricalFallback":  using_historical_fallback,
    }
