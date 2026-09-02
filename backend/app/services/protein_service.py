"""
protein_service.py — Person 5: Gain Muscle / Protein Intelligence

Implements all 5 GM analyses:
  GM-01 — Protein Availability
  GM-02 — Protein Quality
  GM-03 — Protein Cost Efficiency
  GM-04 — High-Protein Recommendations
  GM-05 — Protein Purchasing Trend

Uses REAL receipt data, REAL food/nutrition database.
No mock data. Graceful empty states when data is unavailable.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.database.postgres_client import (
    FoodItem,
    HealthIndicators,
    Nutrition,
    Receipt,
    ReceiptItem,
    UserProfile,
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _parse_price(price_str) -> float:
    if not price_str:
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", str(price_str))
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_quantity(qty_str) -> float:
    """
    Parse a quantity string to a numeric multiplier.
    Dimensionless counts (1, 2 ...) return the raw count.
    Weight/volume strings (500g, 1kg, 250ml, 1L) are scaled to per-100-unit.
    """
    if not qty_str:
        return 1.0
    qty_str = str(qty_str).strip().lower()
    m = re.match(r"^([0-9]+(?:\.[0-9]+)?)", qty_str)
    if not m:
        return 1.0
    num = float(m.group(1))
    rest = qty_str[m.end():]

    if "kg" in rest:
        return num * 1000.0 / 100.0
    if rest.startswith("g"):
        return num / 100.0
    if "ml" in rest:
        return num / 100.0
    if rest.startswith("l") or rest == "l":
        return num * 1000.0 / 100.0
    return num


def _protein_quality_score(
    high_protein,
    health_score,
    category,
    processed_level,
) -> Tuple[float, str]:
    """
    Derive protein quality score (0-100) from existing DB fields.
    Methodology:
      +40  high_protein flag
      +30  proportional from health_score
      +20  protein-rich category
      -10  high/ultra processing
    """
    PROTEIN_RICH_CATEGORIES = {
        "protein", "meat", "poultry", "seafood", "fish", "egg", "eggs",
        "dairy", "legume", "legumes", "bean", "beans", "lentil", "lentils",
        "nut", "nuts", "seed", "seeds", "tofu", "paneer", "cheese",
    }
    score = 0.0
    if high_protein:
        score += 40.0
    if health_score is not None:
        score += (_safe_float(health_score) / 100.0) * 30.0
    cat_lower = (category or "").lower()
    if any(pk in cat_lower for pk in PROTEIN_RICH_CATEGORIES):
        score += 20.0
    if processed_level and str(processed_level).upper() in ("HIGH", "ULTRA"):
        score -= 10.0
    score = max(0.0, min(100.0, score))

    if score >= 80:
        label = "Excellent"
    elif score >= 60:
        label = "Good"
    elif score >= 40:
        label = "Moderate"
    else:
        label = "Low"

    return round(score, 1), label


# ─── Data Fetching ─────────────────────────────────────────────────────────────

def _get_user_receipt_items(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Return all receipt items for a user, enriched with food and nutrition data."""
    receipts = (
        db.query(Receipt)
        .filter(Receipt.user_id == user_id)
        .order_by(Receipt.receipt_id.asc())
        .all()
    )
    if not receipts:
        return []

    receipt_map = {r.receipt_id: r for r in receipts}
    receipt_ids = list(receipt_map.keys())

    items = (
        db.query(ReceiptItem)
        .filter(ReceiptItem.receipt_id.in_(receipt_ids))
        .all()
    )

    food_ids = {item.matched_food_id for item in items if item.matched_food_id}
    food_map: Dict[int, FoodItem] = {}
    nutrition_map: Dict[int, Nutrition] = {}
    health_map: Dict[int, HealthIndicators] = {}

    if food_ids:
        foods = (
            db.query(FoodItem)
            .options(
                joinedload(FoodItem.nutrition),
                joinedload(FoodItem.health_indicators),
            )
            .filter(FoodItem.food_id.in_(food_ids))
            .all()
        )
        for f in foods:
            food_map[f.food_id] = f
            if f.nutrition:
                nutrition_map[f.food_id] = f.nutrition
            if f.health_indicators:
                health_map[f.food_id] = f.health_indicators

    result = []
    for item in items:
        food = food_map.get(item.matched_food_id) if item.matched_food_id else None
        nutr = nutrition_map.get(item.matched_food_id) if item.matched_food_id else None
        hlth = health_map.get(item.matched_food_id) if item.matched_food_id else None
        receipt = receipt_map[item.receipt_id]

        result.append({
            "item_id": item.item_id,
            "receipt_id": item.receipt_id,
            "receipt_date": receipt.date,
            "name": item.name or "Unknown",
            "quantity_str": item.quantity,
            "price_float": _parse_price(item.price),
            "food_id": item.matched_food_id,
            "food_name": (food.display_name or food.canonical_name) if food else None,
            "category": food.category if food else None,
            "subcategory": food.subcategory if food else None,
            "serving_size": _safe_float(food.serving_size) if food else None,
            "serving_unit": food.serving_unit if food else None,
            "protein_g_per_serving": _safe_float(nutr.protein_g) if nutr else None,
            "calories_kcal_per_serving": _safe_float(nutr.calories_kcal) if nutr else None,
            "high_protein": hlth.high_protein if hlth else None,
            "health_score": hlth.health_score if hlth else None,
            "processed_level": hlth.processed_level if hlth else None,
        })

    return result


def _compute_protein_for_item(item: Dict[str, Any]) -> Optional[float]:
    protein_per_serving = item.get("protein_g_per_serving")
    if protein_per_serving is None:
        return None
    qty_multiplier = _parse_quantity(item.get("quantity_str"))
    return round(protein_per_serving * qty_multiplier, 2)


# ─── GM-01: Protein Availability ──────────────────────────────────────────────

def gm01_protein_availability(db: Session, user_id: int) -> Dict[str, Any]:
    items = _get_user_receipt_items(db, user_id)

    if not items:
        return {
            "analysis_type": "GM-01",
            "total_protein_g": 0.0,
            "matched_item_count": 0,
            "unmatched_item_count": 0,
            "items": [],
            "message": "No receipt data found. Upload receipts to see your protein analysis.",
        }

    food_aggregates: Dict = {}
    unmatched_items = []
    total_protein = 0.0
    matched_count = 0
    unmatched_count = 0

    for item in items:
        protein = _compute_protein_for_item(item)

        if item["food_id"] is None or protein is None:
            unmatched_count += 1
            unmatched_items.append({
                "name": item["name"],
                "protein_g": None,
                "note": "No nutrition data available for this item",
            })
            continue

        matched_count += 1
        total_protein += protein
        fid = item["food_id"]

        if fid not in food_aggregates:
            food_aggregates[fid] = {
                "food_id": fid,
                "food_name": item["food_name"] or item["name"],
                "category": item["category"],
                "protein_g": 0.0,
                "total_price": 0.0,
                "total_calories": 0.0,
                "purchase_count": 0,
            }

        food_aggregates[fid]["protein_g"] += protein
        food_aggregates[fid]["total_price"] += item["price_float"]
        food_aggregates[fid]["purchase_count"] += 1

        cal = item.get("calories_kcal_per_serving")
        if cal:
            qty = _parse_quantity(item.get("quantity_str"))
            food_aggregates[fid]["total_calories"] += cal * qty

    enriched_items = []
    for fid, agg in food_aggregates.items():
        pg = round(agg["protein_g"], 2)
        tp = round(agg["total_price"], 2)
        tc = round(agg["total_calories"], 2)
        enriched_items.append({
            "food_id": fid,
            "food_name": agg["food_name"],
            "category": agg["category"],
            "protein_g": pg,
            "total_price": tp,
            "protein_per_rupee": round(pg / tp, 3) if tp > 0 else None,
            "protein_per_100_kcal": round((pg / tc) * 100, 1) if tc > 0 else None,
            "purchase_count": agg["purchase_count"],
        })

    enriched_items.sort(key=lambda x: x["protein_g"], reverse=True)

    return {
        "analysis_type": "GM-01",
        "total_protein_g": round(total_protein, 2),
        "matched_item_count": matched_count,
        "unmatched_item_count": unmatched_count,
        "items": enriched_items,
        "unmatched_items": unmatched_items,
    }


# ─── GM-02: Protein Quality ────────────────────────────────────────────────────

def gm02_protein_quality(db: Session, user_id: int) -> Dict[str, Any]:
    items = _get_user_receipt_items(db, user_id)

    if not items:
        return {
            "analysis_type": "GM-02",
            "basket_quality_score": None,
            "basket_quality_label": "Unknown",
            "quality_breakdown": [],
            "methodology": "Score = high_protein flag (+40) + health_score contribution (+30 max) + protein-rich category (+20) - ultra-processing penalty (-10)",
            "message": "No receipt data found.",
        }

    quality_items = []
    weighted_score_sum = 0.0
    total_protein_weight = 0.0
    seen_food_ids = set()

    for item in items:
        if item["food_id"] is None or item["protein_g_per_serving"] is None:
            continue
        if item["food_id"] in seen_food_ids:
            continue
        seen_food_ids.add(item["food_id"])

        protein = _compute_protein_for_item(item)
        if protein is None or protein == 0:
            continue

        score, label = _protein_quality_score(
            high_protein=item.get("high_protein"),
            health_score=item.get("health_score"),
            category=item.get("category"),
            processed_level=item.get("processed_level"),
        )

        quality_items.append({
            "food_id": item["food_id"],
            "food_name": item["food_name"] or item["name"],
            "category": item["category"],
            "quality_score": score,
            "quality_label": label,
            "protein_g": round(protein, 2),
            "high_protein_flag": item.get("high_protein"),
            "health_score": item.get("health_score"),
            "processed_level": item.get("processed_level"),
        })

        weighted_score_sum += score * protein
        total_protein_weight += protein

    quality_items.sort(key=lambda x: x["quality_score"], reverse=True)

    if total_protein_weight > 0:
        basket_score = round(weighted_score_sum / total_protein_weight, 1)
        if basket_score >= 80:
            basket_label = "Excellent"
        elif basket_score >= 60:
            basket_label = "Good"
        elif basket_score >= 40:
            basket_label = "Moderate"
        else:
            basket_label = "Low"
    else:
        basket_score = None
        basket_label = "Unknown"

    return {
        "analysis_type": "GM-02",
        "basket_quality_score": basket_score,
        "basket_quality_label": basket_label,
        "quality_breakdown": quality_items,
        "methodology": (
            "Score derived from existing database fields: "
            "high_protein flag (+40 pts), health_score contribution (+30 pts max), "
            "protein-rich food category (+20 pts), ultra/high processing penalty (-10 pts). "
            "Basket score is protein-weighted average across all matched foods."
        ),
    }


# ─── GM-03: Protein Cost Efficiency ───────────────────────────────────────────

def gm03_protein_cost_efficiency(db: Session, user_id: int) -> Dict[str, Any]:
    items = _get_user_receipt_items(db, user_id)

    if not items:
        return {
            "analysis_type": "GM-03",
            "overall_efficiency": None,
            "total_protein_g": 0.0,
            "total_protein_spend": 0.0,
            "ranked_items": [],
            "message": "No receipt data found.",
        }

    food_data: Dict = {}
    total_protein = 0.0
    total_protein_spend = 0.0

    for item in items:
        protein = _compute_protein_for_item(item)
        if protein is None or protein == 0:
            continue
        price = item["price_float"]
        if price <= 0:
            continue

        fid = item["food_id"] or f"unmatched_{item['name']}"
        if fid not in food_data:
            food_data[fid] = {
                "food_name": item["food_name"] or item["name"],
                "category": item["category"],
                "total_protein_g": 0.0,
                "total_spend": 0.0,
                "purchase_count": 0,
            }

        food_data[fid]["total_protein_g"] += protein
        food_data[fid]["total_spend"] += price
        food_data[fid]["purchase_count"] += 1
        total_protein += protein
        total_protein_spend += price

    ranked = []
    for fid, agg in food_data.items():
        p = round(agg["total_protein_g"], 2)
        s = round(agg["total_spend"], 2)
        ppr = round(p / s, 3) if s > 0 else None
        ranked.append({
            "food_name": agg["food_name"],
            "category": agg["category"],
            "total_protein_g": p,
            "total_spend": s,
            "protein_per_rupee": ppr,
            "purchase_count": agg["purchase_count"],
        })

    ranked.sort(key=lambda x: (x["protein_per_rupee"] or 0.0), reverse=True)

    overall_efficiency = (
        round(total_protein / total_protein_spend, 3)
        if total_protein_spend > 0 else None
    )

    return {
        "analysis_type": "GM-03",
        "overall_efficiency": overall_efficiency,
        "total_protein_g": round(total_protein, 2),
        "total_protein_spend": round(total_protein_spend, 2),
        "ranked_items": ranked,
        "best": ranked[0] if ranked else None,
        "worst": ranked[-1] if len(ranked) > 1 else None,
    }


# ─── GM-04: High-Protein Recommendations ──────────────────────────────────────

def gm04_recommendations(db: Session, user_id: int, top_n: int = 6) -> Dict[str, Any]:
    items = _get_user_receipt_items(db, user_id)
    user_food_ids = {item["food_id"] for item in items if item["food_id"] is not None}

    candidates = (
        db.query(FoodItem)
        .options(
            joinedload(FoodItem.nutrition),
            joinedload(FoodItem.health_indicators),
        )
        .join(Nutrition, FoodItem.food_id == Nutrition.food_id)
        .filter(Nutrition.protein_g > 0)
        .all()
    )

    if not candidates:
        return {
            "analysis_type": "GM-04",
            "recommendations": [],
            "message": (
                "No food items with protein data found in the database. "
                "The food database needs to be populated with nutrition information."
            ),
        }

    scored = []
    for food in candidates:
        if food.food_id in user_food_ids:
            continue

        nutr = food.nutrition
        hlth = food.health_indicators

        protein_g = _safe_float(nutr.protein_g) if nutr else None
        calories = _safe_float(nutr.calories_kcal) if nutr else None

        if not protein_g or protein_g <= 0:
            continue

        q_score, q_label = _protein_quality_score(
            high_protein=hlth.high_protein if hlth else None,
            health_score=hlth.health_score if hlth else None,
            category=food.category,
            processed_level=hlth.processed_level if hlth else None,
        )

        candidate_score = (protein_g * q_score) / 100.0

        reason_parts = []
        if hlth and hlth.high_protein:
            reason_parts.append("flagged as high-protein")
        if food.category:
            reason_parts.append(f"{food.category} category")
        if calories and calories > 0:
            pph = round((protein_g / calories) * 100, 1)
            reason_parts.append(f"{pph}g protein per 100 kcal")
        if hlth and hlth.health_score and hlth.health_score >= 70:
            reason_parts.append(f"health score {hlth.health_score}/100")
        if hlth and hlth.vegetarian:
            reason_parts.append("vegetarian-friendly")

        reason = (
            f"Provides {protein_g:.1f}g protein per serving"
            + (f" ({', '.join(reason_parts)})" if reason_parts else "")
            + f". Quality: {q_label}."
        )

        scored.append({
            "food_id": food.food_id,
            "food_name": food.display_name or food.canonical_name,
            "category": food.category,
            "subcategory": food.subcategory,
            "protein_g_per_serving": round(protein_g, 2),
            "calories_per_serving": round(calories, 1) if calories else None,
            "quality_score": q_score,
            "quality_label": q_label,
            "candidate_score": round(candidate_score, 2),
            "reason": reason,
            "high_protein": hlth.high_protein if hlth else None,
            "vegetarian": hlth.vegetarian if hlth else None,
        })

    scored.sort(key=lambda x: x["candidate_score"], reverse=True)

    return {
        "analysis_type": "GM-04",
        "recommendations": scored[:top_n],
        "user_basket_food_count": len(user_food_ids),
        "candidates_evaluated": len(scored) + len(user_food_ids),
        "scoring_methodology": (
            "Candidate score = (protein_g × quality_score) / 100. "
            "Excludes foods already regularly purchased by the user."
        ),
    }


# ─── GM-05: Protein Purchasing Trend ──────────────────────────────────────────

def _extract_month_key(date_str: str) -> str:
    if not date_str or str(date_str).strip().lower() in ("", "unknown"):
        return "0000-00"
    date_str = str(date_str)
    m = re.match(r"(\d{4})-(\d{2})", date_str)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_str)
    if m:
        return f"{m.group(3)}-{m.group(1).zfill(2)}"
    return "0000-00"


def gm05_protein_trend(db: Session, user_id: int) -> Dict[str, Any]:
    items = _get_user_receipt_items(db, user_id)

    if not items:
        return {
            "analysis_type": "GM-05",
            "insufficient_data": True,
            "trend_direction": None,
            "change_percentage": None,
            "time_series": [],
            "message": "No receipt data found. Upload more receipts to see your protein trend.",
        }

    monthly_protein: Dict[str, float] = defaultdict(float)
    monthly_receipts: Dict[str, set] = defaultdict(set)

    for item in items:
        protein = _compute_protein_for_item(item)
        if protein is None:
            continue
        period = _extract_month_key(item.get("receipt_date"))
        monthly_protein[period] += protein
        monthly_receipts[period].add(item["receipt_id"])

    if not monthly_protein:
        return {
            "analysis_type": "GM-05",
            "insufficient_data": True,
            "trend_direction": None,
            "change_percentage": None,
            "time_series": [],
            "message": (
                "Receipt data exists but no items could be matched to protein data. "
                "Ensure food items are matched to the nutrition database."
            ),
        }

    sorted_periods = sorted(monthly_protein.keys())
    time_series = [
        {
            "period": period,
            "protein_g": round(monthly_protein[period], 2),
            "receipt_count": len(monthly_receipts[period]),
        }
        for period in sorted_periods
    ]

    if len(time_series) < 2:
        return {
            "analysis_type": "GM-05",
            "insufficient_data": True,
            "trend_direction": None,
            "change_percentage": None,
            "time_series": time_series,
            "message": (
                "Only one time period of data available. "
                "More receipts across different months are needed to determine a trend."
            ),
        }

    first_protein = time_series[0]["protein_g"]
    last_protein = time_series[-1]["protein_g"]
    change_pct = ((last_protein - first_protein) / first_protein * 100.0) if first_protein > 0 else 0.0

    if change_pct > 5:
        trend_direction, trend_emoji = "Increasing", "⬆️"
    elif change_pct < -5:
        trend_direction, trend_emoji = "Decreasing", "⬇️"
    else:
        trend_direction, trend_emoji = "Stable", "➡️"

    if len(time_series) >= 3:
        for i in range(len(time_series)):
            window = time_series[max(0, i - 1): i + 1]
            time_series[i]["moving_average"] = round(
                sum(w["protein_g"] for w in window) / len(window), 2
            )

    return {
        "analysis_type": "GM-05",
        "insufficient_data": False,
        "trend_direction": trend_direction,
        "trend_emoji": trend_emoji,
        "change_percentage": round(change_pct, 1),
        "first_period": time_series[0]["period"],
        "last_period": time_series[-1]["period"],
        "first_period_protein_g": first_protein,
        "last_period_protein_g": last_protein,
        "time_series": time_series,
    }


# ─── Combined ──────────────────────────────────────────────────────────────────

def get_full_gain_muscle_analysis(db: Session, user_id: int) -> Dict[str, Any]:
    """Run GM-01..05 (excluding GM-04 recommendations) and return combined result."""
    return {
        "user_id": user_id,
        "gm01_availability": gm01_protein_availability(db, user_id),
        "gm02_quality": gm02_protein_quality(db, user_id),
        "gm03_cost_efficiency": gm03_protein_cost_efficiency(db, user_id),
        "gm05_trend": gm05_protein_trend(db, user_id),
    }
