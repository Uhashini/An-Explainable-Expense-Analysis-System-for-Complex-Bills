import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date
import calendar
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.postgres_client import (
    get_db, Receipt, ReceiptItem, AnalysisResult, FoodItem, UserProfile
)

from app.services.modes.save_money.spending_trend import get_spending_trend
from app.services.modes.save_money.price_deviation import get_price_deviations
from app.services.modes.save_money.schemas import ReceiptItem as SchemaReceiptItem

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
    
    # Map for price deviations
    schema_items = []
    for it in items_data:
        qty = float(it.get("quantity") or 1.0)
        p = float(it.get("total_price") or it.get("price") or 0.0)
        unit_p = p / qty if p > 0 and qty > 0 else float(it.get("unit_price") or p)
        
        schema_items.append(SchemaReceiptItem(
            name=it.get("name") or "Unknown",
            price=unit_p,
            quantity=qty,
            matched_food_id=it.get("matched_food_id") or it.get("food_id")
        ))
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_trend = executor.submit(run_isolated, get_spending_trend, db, req.user_id, req.total_amount, req.receipt_id, items_data)
        future_price = executor.submit(run_isolated, get_price_deviations, db, req.user_id, schema_items, req.receipt_id)
        
        trend_data = future_trend.result()
        price_result = future_price.result()
        price_deviations = price_result.dict().get("price_deviation", []) if price_result else None

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

    # Map for price deviations
    schema_items = []
    for it in items_data:
        qty = float(it.get("quantity") or 1.0)
        p = float(it.get("total_price") or it.get("price") or 0.0)
        unit_p = p / qty if p > 0 and qty > 0 else float(it.get("unit_price") or p)
        
        schema_items.append(SchemaReceiptItem(
            name=it.get("name") or "Unknown",
            price=unit_p,
            quantity=qty,
            matched_food_id=it.get("matched_food_id") or it.get("food_id")
        ))

    # 2. Parallel Processing
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_trend = executor.submit(run_isolated, get_spending_trend, db, user_id, float(receipt.total_amount or 0.0), receipt_id, items_data)
        future_price = executor.submit(run_isolated, get_price_deviations, db, user_id, schema_items, receipt_id)
        
        trend_data = future_trend.result()
        price_result = future_price.result()
        price_deviations = price_result.dict().get("price_deviation", []) if price_result else None

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


def _parse_safe_date(raw) -> Optional[date]:
    if raw is None:
        return None
    if isinstance(raw, (datetime, date)):
        return raw if isinstance(raw, date) else raw.date()
    raw_str = str(raw).strip()
    if not raw_str or "unknown" in raw_str.lower():
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d %b %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(raw_str, fmt).date()
        except ValueError:
            continue
    return None

CATEGORY_PALETTE = {
    "Fresh Produce": "#2E7D32",
    "Dairy & Eggs": "#1565C0",
    "Meat & Protein": "#C62828",
    "Grains & Pantry": "#E65100",
    "Snacks & Drinks": "#6A1B9A",
    "Bakery": "#AD1457",
    "Household & Other": "#455A64",
}

def _categorize_item(name: str, food_category: Optional[str]) -> str:
    if food_category:
        fc = food_category.strip().lower()
        if any(w in fc for w in ["fruit", "vegetable", "produce", "greens"]):
            return "Fresh Produce"
        if any(w in fc for w in ["dairy", "milk", "cheese", "yogurt", "curd", "paneer", "egg"]):
            return "Dairy & Eggs"
        if any(w in fc for w in ["meat", "poultry", "chicken", "fish", "seafood", "mutton", "beef", "pork"]):
            return "Meat & Protein"
        if any(w in fc for w in ["grain", "rice", "wheat", "flour", "atta", "pulse", "dal", "oil", "spice", "pantry", "cereal"]):
            return "Grains & Pantry"
        if any(w in fc for w in ["snack", "chip", "biscuit", "cookie", "beverage", "drink", "soda", "juice", "sweet", "chocolate", "tea", "coffee"]):
            return "Snacks & Drinks"
        if any(w in fc for w in ["bakery", "bread", "bun", "toast", "cake", "pastry"]):
            return "Bakery"
    
    # Fallback to name heuristic
    n = (name or "").lower()
    if any(w in n for w in ["apple", "banana", "onion", "tomato", "potato", "carrot", "fruit", "veg", "spinach", "mango", "orange", "lemon"]):
        return "Fresh Produce"
    if any(w in n for w in ["milk", "curd", "paneer", "cheese", "egg", "butter", "ghee", "yogurt"]):
        return "Dairy & Eggs"
    if any(w in n for w in ["chicken", "mutton", "fish", "meat", "prawn", "beef"]):
        return "Meat & Protein"
    if any(w in n for w in ["rice", "atta", "flour", "wheat", "dal", "oil", "sugar", "salt", "spice", "masala", "grain", "pulse"]):
        return "Grains & Pantry"
    if any(w in n for w in ["chip", "biscuit", "cookie", "snack", "coke", "pepsi", "soda", "tea", "coffee", "juice", "chocolate", "wafer"]):
        return "Snacks & Drinks"
    if any(w in n for w in ["bread", "bun", "toast", "cake", "croissant"]):
        return "Bakery"
        
    return "Household & Other"


@router.get("/spending/{user_id}")
def get_user_spending_analytics(user_id: int, db: Session = Depends(get_db)):
    """
    Returns authentic, receipt-derived financial spending analytics.
    For new users with 0 receipts, returns has_data=False so the client
    can render a pristine empty state with zero fake data.
    """
    receipts = (
        db.query(Receipt)
        .filter(Receipt.user_id == user_id)
        .all()
    )
    if not receipts:
        return {
            "status": "success",
            "has_data": False,
            "total_spend": 0.0,
            "this_month_spend": 0.0,
            "total_receipts": 0,
            "this_month_receipts": 0,
            "avg_basket": 0.0,
            "daily_burn": 0.0,
            "projected_month_end": 0.0,
            "timeline_all": [],
            "timeline_this_month": [],
            "categories_all": [],
            "categories_this_month": [],
            "ai_tip": None,
        }

    today = date.today()
    curr_year = today.year
    curr_month = today.month
    days_in_month = calendar.monthrange(curr_year, curr_month)[1]
    days_elapsed = max(1, today.day)

    sorted_receipts = []
    for r in receipts:
        d = _parse_safe_date(r.date)
        amt = float(r.total_amount or 0.0)
        sorted_receipts.append({
            "receipt_id": r.receipt_id,
            "merchant_name": r.merchant_name or "Grocery Store",
            "date_obj": d,
            "date_str": r.date or "Unknown Date",
            "total_amount": amt,
        })
    sorted_receipts.sort(key=lambda x: x["date_obj"] if x["date_obj"] else date.min)

    total_spend = 0.0
    this_month_spend = 0.0
    timeline_all = []
    timeline_this_month = []

    rolling_all = 0.0
    rolling_month = 0.0
    this_month_count = 0

    for idx, r in enumerate(sorted_receipts):
        amt = r["total_amount"]
        rolling_all += amt
        total_spend += amt

        d = r["date_obj"]
        is_this_month = False
        date_label = d.strftime("%d %b") if d else f"Trip {idx + 1}"

        if d and d.year == curr_year and d.month == curr_month:
            is_this_month = True
            this_month_spend += amt
            this_month_count += 1
            rolling_month += amt
            timeline_this_month.append({
                "id": r["receipt_id"],
                "date": date_label,
                "merchant": r["merchant_name"],
                "amount": round(amt, 2),
                "cumulative": round(rolling_month, 2),
                "is_this_month": True,
            })

        timeline_all.append({
            "id": r["receipt_id"],
            "date": date_label,
            "merchant": r["merchant_name"],
            "amount": round(amt, 2),
            "cumulative": round(rolling_all, 2),
            "is_this_month": is_this_month,
        })

    receipt_ids = [r["receipt_id"] for r in sorted_receipts]
    items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id.in_(receipt_ids)).all()
    
    food_ids = list({it.matched_food_id for it in items if it.matched_food_id})
    foods_by_id = {}
    if food_ids:
        foods = db.query(FoodItem).filter(FoodItem.food_id.in_(food_ids)).all()
        foods_by_id = {f.food_id: f for f in foods}

    receipt_month_map = {
        r["receipt_id"]: (r["date_obj"] and r["date_obj"].year == curr_year and r["date_obj"].month == curr_month)
        for r in sorted_receipts
    }

    cat_totals_all = defaultdict(float)
    cat_totals_month = defaultdict(float)

    for item in items:
        p = 0.0
        try:
            p = float(str(item.price or item.rate or 0.0).replace(",", "").replace("₹", "").strip())
        except:
            p = 0.0
        
        food = foods_by_id.get(item.matched_food_id) if item.matched_food_id else None
        cat = _categorize_item(item.name, food.category if food else None)
        
        cat_totals_all[cat] += p
        if receipt_month_map.get(item.receipt_id, False):
            cat_totals_month[cat] += p

    def format_categories(cat_dict, base_spend):
        res = []
        tot = sum(cat_dict.values())
        effective_tot = tot if tot > 0 else base_spend
        for c_name, c_amt in sorted(cat_dict.items(), key=lambda kv: -kv[1]):
            pct = round((c_amt / effective_tot) * 100, 1) if effective_tot > 0 else 0.0
            res.append({
                "label": c_name,
                "amount": round(c_amt, 2),
                "pct": pct,
                "color": CATEGORY_PALETTE.get(c_name, "#455A64"),
            })
        return res

    categories_all = format_categories(cat_totals_all, total_spend)
    categories_this_month = format_categories(cat_totals_month, this_month_spend) if this_month_spend > 0 else categories_all

    daily_burn = round(this_month_spend / days_elapsed, 2)
    projected = round(daily_burn * days_in_month, 2)
    avg_basket = round(total_spend / max(1, len(sorted_receipts)), 2)

    top_cat = categories_all[0]["label"] if categories_all else "Grocery"
    top_cat_amt = categories_all[0]["amount"] if categories_all else 0.0
    ai_tip = f"Your highest grocery expense is {top_cat} (₹{top_cat_amt:,.0f}). Buying regular {top_cat.lower()} staples in bulk packs or opting for local alternatives could save ~10–18% on your monthly runs."

    return {
        "status": "success",
        "has_data": True,
        "total_spend": round(total_spend, 2),
        "this_month_spend": round(this_month_spend, 2),
        "total_receipts": len(sorted_receipts),
        "this_month_receipts": this_month_count,
        "avg_basket": avg_basket,
        "daily_burn": daily_burn,
        "projected_month_end": projected,
        "timeline_all": timeline_all,
        "timeline_this_month": timeline_this_month if timeline_this_month else timeline_all,
        "categories_all": categories_all,
        "categories_this_month": categories_this_month,
        "ai_tip": ai_tip,
    }

