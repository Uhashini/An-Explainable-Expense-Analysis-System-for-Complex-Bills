"""
Nutrition Forecast endpoint — EH-FORECAST

Calculates a real nutrition forecast from the user's actual receipt items.

Logic:
  1. Fetch all ReceiptItems for the user (via their receipts).
  2. For each item, attempt to get nutrition from FoodItem → Nutrition (Neon DB).
  3. If DB has no nutrition (local SQLite fallback), use built-in nutrition lookup
     keyed by common grocery item name patterns.
  4. Aggregate: total calories, protein, carbs, fat, fiber, sugar across all items.
  5. Calculate per-day averages over the receipt date span (or last 30 days).
  6. Compare against standard RDA (Recommended Dietary Allowances).
  7. Calculate healthy basket score: % of items classified as healthy/unprocessed.
  8. Identify nutrient gaps and generate targeted suggestions.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, date, timedelta
from collections import defaultdict
from typing import Optional, List, Dict, Any
import re

from app.database.postgres_client import (
    get_db, Receipt, ReceiptItem, FoodItem, Nutrition,
    HealthIndicators, UserProfile
)

router = APIRouter()


# ── Recommended Daily Allowances (per day, adult average) ─────────────────────
RDA = {
    "calories_kcal":    2000.0,   # kcal
    "protein_g":          50.0,   # g
    "carbohydrates_g":   300.0,   # g
    "fat_g":              65.0,   # g
    "fiber_g":            28.0,   # g
    "sugar_g":            50.0,   # g (added sugar limit)
}

# Display labels for nutrients
NUTRIENT_LABELS = {
    "calories_kcal":   "Calories",
    "protein_g":       "Protein",
    "carbohydrates_g": "Carbohydrates",
    "fat_g":           "Fat",
    "fiber_g":         "Fiber",
    "sugar_g":         "Sugar",
}

NUTRIENT_UNITS = {
    "calories_kcal":   "kcal",
    "protein_g":       "g",
    "carbohydrates_g": "g",
    "fat_g":           "g",
    "fiber_g":         "g",
    "sugar_g":         "g",
}

# Colour coding for nutrient bars
NUTRIENT_COLORS = {
    "calories_kcal":   "#FF7043",
    "protein_g":       "#42A5F5",
    "carbohydrates_g": "#E6E279",
    "fat_g":           "#AB47BC",
    "fiber_g":         "#66BB6A",
    "sugar_g":         "#EF5350",
}


# ── Built-in nutrition knowledge base (per 100 g / standard serving) ──────────
# Values are approximate and cover the most common Indian grocery items.
# Format: { pattern: { calories_kcal, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g, is_healthy } }
# 'is_healthy': True = unprocessed/whole food, False = processed
NUTRITION_KB: List[Dict[str, Any]] = [
    # Fruits
    {"patterns": ["banana"],          "cal": 89,  "prot": 1.1, "carb": 23.0, "fat": 0.3, "fib": 2.6, "sug": 12.2, "healthy": True,  "cat": "Fruits"},
    {"patterns": ["apple"],           "cal": 52,  "prot": 0.3, "carb": 14.0, "fat": 0.2, "fib": 2.4, "sug": 10.4, "healthy": True,  "cat": "Fruits"},
    {"patterns": ["mango"],           "cal": 60,  "prot": 0.8, "carb": 15.0, "fat": 0.4, "fib": 1.6, "sug": 13.7, "healthy": True,  "cat": "Fruits"},
    {"patterns": ["orange", "mosambi"], "cal": 47, "prot": 0.9, "carb": 12.0, "fat": 0.1, "fib": 2.4, "sug": 9.4, "healthy": True, "cat": "Fruits"},
    {"patterns": ["grapes", "grape"], "cal": 69,  "prot": 0.7, "carb": 18.0, "fat": 0.2, "fib": 0.9, "sug": 15.5, "healthy": True, "cat": "Fruits"},
    {"patterns": ["papaya"],          "cal": 43,  "prot": 0.5, "carb": 11.0, "fat": 0.3, "fib": 1.7, "sug": 7.8,  "healthy": True,  "cat": "Fruits"},
    {"patterns": ["watermelon"],      "cal": 30,  "prot": 0.6, "carb": 7.6,  "fat": 0.2, "fib": 0.4, "sug": 6.2,  "healthy": True,  "cat": "Fruits"},
    {"patterns": ["pomegranate"],     "cal": 83,  "prot": 1.7, "carb": 19.0, "fat": 1.2, "fib": 4.0, "sug": 13.7, "healthy": True,  "cat": "Fruits"},
    # Vegetables
    {"patterns": ["spinach", "palak"], "cal": 23, "prot": 2.9, "carb": 3.6,  "fat": 0.4, "fib": 2.2, "sug": 0.4,  "healthy": True,  "cat": "Vegetables"},
    {"patterns": ["tomato"],          "cal": 18,  "prot": 0.9, "carb": 3.9,  "fat": 0.2, "fib": 1.2, "sug": 2.6,  "healthy": True,  "cat": "Vegetables"},
    {"patterns": ["onion", "pyaz"],   "cal": 40,  "prot": 1.1, "carb": 9.3,  "fat": 0.1, "fib": 1.7, "sug": 4.2,  "healthy": True,  "cat": "Vegetables"},
    {"patterns": ["potato", "aloo"],  "cal": 77,  "prot": 2.0, "carb": 17.0, "fat": 0.1, "fib": 2.2, "sug": 0.8,  "healthy": True,  "cat": "Vegetables"},
    {"patterns": ["carrot", "gajar"], "cal": 41,  "prot": 0.9, "carb": 10.0, "fat": 0.2, "fib": 2.8, "sug": 4.7,  "healthy": True,  "cat": "Vegetables"},
    {"patterns": ["cabbage", "patta gobhi"], "cal": 25, "prot": 1.3, "carb": 5.8, "fat": 0.1, "fib": 2.5, "sug": 3.2, "healthy": True, "cat": "Vegetables"},
    {"patterns": ["capsicum", "bell pepper"], "cal": 31, "prot": 1.0, "carb": 6.0, "fat": 0.3, "fib": 2.1, "sug": 4.2, "healthy": True, "cat": "Vegetables"},
    {"patterns": ["cauliflower", "gobhi"], "cal": 25, "prot": 1.9, "carb": 5.0, "fat": 0.3, "fib": 2.0, "sug": 1.9, "healthy": True, "cat": "Vegetables"},
    {"patterns": ["broccoli"],        "cal": 34,  "prot": 2.8, "carb": 7.0,  "fat": 0.4, "fib": 2.6, "sug": 1.7,  "healthy": True,  "cat": "Vegetables"},
    # Dairy
    {"patterns": ["milk", "doodh"],   "cal": 61,  "prot": 3.2, "carb": 4.8,  "fat": 3.3, "fib": 0.0, "sug": 4.8,  "healthy": True,  "cat": "Dairy"},
    {"patterns": ["curd", "yogurt", "dahi"], "cal": 59, "prot": 3.5, "carb": 4.7, "fat": 3.3, "fib": 0.0, "sug": 4.7, "healthy": True, "cat": "Dairy"},
    {"patterns": ["paneer", "cottage cheese"], "cal": 265, "prot": 18.3, "carb": 1.2, "fat": 20.8, "fib": 0.0, "sug": 1.2, "healthy": True, "cat": "Dairy"},
    {"patterns": ["cheese"],          "cal": 402, "prot": 25.0, "carb": 1.3, "fat": 33.0, "fib": 0.0, "sug": 0.5,  "healthy": False, "cat": "Dairy"},
    {"patterns": ["butter", "makhan"], "cal": 717, "prot": 0.9, "carb": 0.1, "fat": 81.0, "fib": 0.0, "sug": 0.1,  "healthy": False, "cat": "Dairy"},
    {"patterns": ["ghee"],            "cal": 900, "prot": 0.0, "carb": 0.0,  "fat": 100.0,"fib": 0.0, "sug": 0.0,  "healthy": False, "cat": "Oils"},
    {"patterns": ["almond milk"],     "cal": 17,  "prot": 0.6, "carb": 0.6,  "fat": 1.1, "fib": 0.2, "sug": 0.0,  "healthy": True,  "cat": "Dairy"},
    # Eggs & Meat
    {"patterns": ["egg", "anda"],     "cal": 155, "prot": 13.0, "carb": 1.1, "fat": 11.0, "fib": 0.0, "sug": 1.1,  "healthy": True,  "cat": "Eggs"},
    {"patterns": ["chicken"],         "cal": 239, "prot": 27.0, "carb": 0.0, "fat": 14.0, "fib": 0.0, "sug": 0.0,  "healthy": True,  "cat": "Meat"},
    {"patterns": ["fish", "salmon", "tuna", "rohu", "katla"], "cal": 206, "prot": 22.0, "carb": 0.0, "fat": 13.0, "fib": 0.0, "sug": 0.0, "healthy": True, "cat": "Seafood"},
    {"patterns": ["mutton", "lamb"],  "cal": 294, "prot": 25.0, "carb": 0.0, "fat": 21.0, "fib": 0.0, "sug": 0.0,  "healthy": True,  "cat": "Meat"},
    # Grains & Pulses
    {"patterns": ["rice", "chawal"],  "cal": 130, "prot": 2.7, "carb": 28.0, "fat": 0.3, "fib": 0.4, "sug": 0.0,  "healthy": True,  "cat": "Grains"},
    {"patterns": ["brown rice"],      "cal": 112, "prot": 2.6, "carb": 23.0, "fat": 0.9, "fib": 1.8, "sug": 0.0,  "healthy": True,  "cat": "Grains"},
    {"patterns": ["wheat", "atta", "flour"], "cal": 340, "prot": 13.0, "carb": 72.0, "fat": 2.5, "fib": 10.7, "sug": 0.4, "healthy": True, "cat": "Grains"},
    {"patterns": ["bread", "roti"],   "cal": 265, "prot": 9.0, "carb": 51.0, "fat": 3.2, "fib": 2.7, "sug": 5.0,  "healthy": True,  "cat": "Bakery"},
    {"patterns": ["dal", "lentil", "masoor", "moong", "chana", "rajma"], "cal": 116, "prot": 9.0, "carb": 20.0, "fat": 0.4, "fib": 7.9, "sug": 1.8, "healthy": True, "cat": "Pulses"},
    {"patterns": ["oats", "oatmeal"], "cal": 389, "prot": 17.0, "carb": 66.0, "fat": 7.0, "fib": 11.0, "sug": 0.0,  "healthy": True,  "cat": "Grains"},
    # Nuts & Seeds
    {"patterns": ["almond", "badam"], "cal": 579, "prot": 21.0, "carb": 22.0, "fat": 50.0, "fib": 12.5, "sug": 4.4, "healthy": True,  "cat": "Nuts"},
    {"patterns": ["peanut", "groundnut", "mungfali"], "cal": 567, "prot": 26.0, "carb": 16.0, "fat": 49.0, "fib": 8.5, "sug": 4.0, "healthy": True, "cat": "Nuts"},
    {"patterns": ["cashew", "kaju"], "cal": 553, "prot": 18.0, "carb": 30.0, "fat": 44.0, "fib": 3.3, "sug": 5.9,  "healthy": True,  "cat": "Nuts"},
    {"patterns": ["walnut", "akhrot"], "cal": 654, "prot": 15.0, "carb": 14.0, "fat": 65.0, "fib": 6.7, "sug": 2.6, "healthy": True, "cat": "Nuts"},
    # Oils
    {"patterns": ["oil", "cooking oil", "sunflower oil", "olive oil", "coconut oil"], "cal": 884, "prot": 0.0, "carb": 0.0, "fat": 100.0, "fib": 0.0, "sug": 0.0, "healthy": False, "cat": "Oils"},
    # Snacks & Processed
    {"patterns": ["biscuit", "cookie", "cracker"], "cal": 450, "prot": 6.0, "carb": 65.0, "fat": 18.0, "fib": 1.5, "sug": 20.0, "healthy": False, "cat": "Snacks"},
    {"patterns": ["chips", "namkeen", "crisps"], "cal": 536, "prot": 7.0, "carb": 53.0, "fat": 35.0, "fib": 4.8, "sug": 0.5, "healthy": False, "cat": "Snacks"},
    {"patterns": ["chocolate", "choco"], "cal": 546, "prot": 5.0, "carb": 60.0, "fat": 31.0, "fib": 7.0, "sug": 47.0, "healthy": False, "cat": "Snacks"},
    {"patterns": ["noodles", "pasta", "maggi"], "cal": 371, "prot": 13.0, "carb": 74.0, "fat": 2.5, "fib": 3.2, "sug": 3.0, "healthy": False, "cat": "Snacks"},
    # Beverages
    {"patterns": ["juice"],           "cal": 45,  "prot": 0.7, "carb": 10.0, "fat": 0.2, "fib": 0.2, "sug": 9.0,   "healthy": False, "cat": "Beverages"},
    {"patterns": ["tea", "chai"],     "cal": 4,   "prot": 0.0, "carb": 1.0,  "fat": 0.0, "fib": 0.0, "sug": 0.0,   "healthy": True,  "cat": "Beverages"},
    {"patterns": ["coffee"],          "cal": 2,   "prot": 0.3, "carb": 0.0,  "fat": 0.0, "fib": 0.0, "sug": 0.0,   "healthy": True,  "cat": "Beverages"},
    {"patterns": ["sugar", "shakkar", "cheeni"], "cal": 387, "prot": 0.0, "carb": 100.0, "fat": 0.0, "fib": 0.0, "sug": 100.0, "healthy": False, "cat": "Other"},
    {"patterns": ["salt", "namak"],   "cal": 0,   "prot": 0.0, "carb": 0.0,  "fat": 0.0, "fib": 0.0, "sug": 0.0,   "healthy": True,  "cat": "Other"},
]


def _lookup_nutrition(item_name: str) -> Optional[Dict[str, Any]]:
    """Match an item name against the built-in nutrition knowledge base."""
    name_lower = item_name.lower().strip()
    for entry in NUTRITION_KB:
        for pattern in entry["patterns"]:
            if pattern in name_lower:
                return entry
    return None


def _safe_float(val, default=0.0) -> float:
    if val is None:
        return default
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return default


def _parse_date(raw) -> Optional[date]:
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


def _estimate_serving_factor(item_name: str, quantity_str: Optional[str]) -> float:
    """
    Estimate how many 100g-equivalent servings an item represents.
    E.g. '1 KG' → 10 (10 × 100g), '500g' → 5, '1 L' → 10 (milk ~1kg/L).
    """
    if not quantity_str:
        # Try to extract weight/volume from item name
        name_lower = (item_name + " " + (quantity_str or "")).lower()
    else:
        name_lower = (item_name + " " + quantity_str).lower()

    # Match patterns like "1 KG", "500 G", "250G", "2 L", "1L"
    kg_match  = re.search(r'(\d+(?:\.\d+)?)\s*kg', name_lower)
    g_match   = re.search(r'(\d+(?:\.\d+)?)\s*g\b', name_lower)
    l_match   = re.search(r'(\d+(?:\.\d+)?)\s*l\b', name_lower)
    ml_match  = re.search(r'(\d+(?:\.\d+)?)\s*ml', name_lower)
    pcs_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:pcs|pc|piece|nos|no\.)', name_lower)

    if kg_match:
        return float(kg_match.group(1)) * 10.0   # 1 kg = 10 × 100g
    if l_match:
        return float(l_match.group(1)) * 10.0    # 1 L ≈ 10 × 100g
    if g_match:
        return float(g_match.group(1)) / 100.0
    if ml_match:
        return float(ml_match.group(1)) / 100.0
    if pcs_match:
        return float(pcs_match.group(1)) * 1.5   # assume ~150g per piece

    # Default: assume a typical grocery purchase = ~300g equivalent
    return 3.0


@router.get("/nutrition-forecast/{user_id}")
def get_nutrition_forecast(user_id: int, db: Session = Depends(get_db)):
    """
    Return a nutrition forecast for the dashboard Eat Healthy card.

    Response:
    {
      "month": "OCTOBER",
      "year": 2026,
      "healthyBasketScore": 72,
      "totalItems": 10,
      "healthyItems": 7,
      "nutrients": {
        "calories_kcal":   { "label": "Calories",   "unit": "kcal", "total": 45000, "perDay": 1500, "rda": 2000, "pct": 75, "color": "#FF7043" },
        "protein_g":       { ... },
        ...
      },
      "gaps": ["Protein", "Fiber"],
      "excesses": ["Sugar"],
      "suggestion": "...",
      "topHealthyItems": ["Spinach", "Brown Rice"],
      "topUnhealthyItems": ["Chips"],
      "categories": [
        { "name": "Vegetables", "items": 3, "healthy": true, "color": "#66BB6A" },
        ...
      ],
      "hasSufficientData": true,
      "dataSource": "db" | "builtin"
    }
    """
    # ── 0. Verify user ────────────────────────────────────────────────────────
    user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ── 1. Fetch all receipts + items ─────────────────────────────────────────
    all_receipts = db.query(Receipt).filter(Receipt.user_id == user_id).all()

    if not all_receipts:
        return {
            "month": date.today().strftime("%B").upper(),
            "year": date.today().year,
            "healthyBasketScore": 0,
            "totalItems": 0,
            "healthyItems": 0,
            "nutrients": {},
            "gaps": [],
            "excesses": [],
            "suggestion": "Upload your first receipt to start tracking your nutrition forecast.",
            "topHealthyItems": [],
            "topUnhealthyItems": [],
            "categories": [],
            "hasSufficientData": False,
            "dataSource": "none",
        }

    # ── 2. Determine date span for per-day averaging ──────────────────────────
    dates = [_parse_date(r.date) for r in all_receipts]
    dates = [d for d in dates if d is not None]

    today = date.today()
    if dates:
        earliest = min(dates)
        span_days = max((today - earliest).days + 1, 1)
    else:
        span_days = max(len(all_receipts) * 7, 1)  # assume ~1 receipt/week

    # ── 3. Aggregate nutrition across ALL items ───────────────────────────────
    nutrient_totals: Dict[str, float] = defaultdict(float)
    healthy_count   = 0
    total_count     = 0
    data_source     = "none"
    healthy_items   : List[str] = []
    unhealthy_items : List[str] = []
    category_counts : Dict[str, Dict] = defaultdict(lambda: {"items": 0, "healthy": True})

    for receipt in all_receipts:
        items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt.receipt_id).all()

        for item in items:
            total_count += 1
            item_name   = item.name or ""
            qty_str     = item.quantity or ""
            serving_factor = _estimate_serving_factor(item_name, qty_str)

            nutrition_data = None
            is_healthy     = None
            item_category  = "Other"

            # ── Try DB first (works when Neon is up) ──────────────────────
            if item.matched_food_id:
                food = (
                    db.query(FoodItem)
                    .options(
                        joinedload(FoodItem.nutrition),
                        joinedload(FoodItem.health_indicators),
                    )
                    .filter(FoodItem.food_id == item.matched_food_id)
                    .first()
                )
                if food and food.nutrition:
                    n = food.nutrition
                    nutrition_data = {
                        "cal":  _safe_float(n.calories_kcal),
                        "prot": _safe_float(n.protein_g),
                        "carb": _safe_float(n.carbohydrates_g),
                        "fat":  _safe_float(n.fat_g),
                        "fib":  _safe_float(n.fiber_g),
                        "sug":  _safe_float(n.sugar_g),
                    }
                    item_category = food.category or "Other"
                    if food.health_indicators:
                        is_healthy = not food.health_indicators.is_processed
                    data_source = "db"

            # ── Fallback to built-in knowledge base ───────────────────────
            if nutrition_data is None:
                kb = _lookup_nutrition(item_name)
                if kb:
                    nutrition_data = {
                        "cal":  kb["cal"],
                        "prot": kb["prot"],
                        "carb": kb["carb"],
                        "fat":  kb["fat"],
                        "fib":  kb["fib"],
                        "sug":  kb["sug"],
                    }
                    item_category = kb.get("cat", "Other")
                    is_healthy    = kb.get("healthy", True)
                    if data_source != "db":
                        data_source = "builtin"

            if nutrition_data:
                nutrient_totals["calories_kcal"]   += nutrition_data["cal"]  * serving_factor
                nutrient_totals["protein_g"]        += nutrition_data["prot"] * serving_factor
                nutrient_totals["carbohydrates_g"]  += nutrition_data["carb"] * serving_factor
                nutrient_totals["fat_g"]            += nutrition_data["fat"]  * serving_factor
                nutrient_totals["fiber_g"]          += nutrition_data["fib"]  * serving_factor
                nutrient_totals["sugar_g"]          += nutrition_data["sug"]  * serving_factor

            # Healthy / unhealthy tracking
            if is_healthy is True:
                healthy_count += 1
                display_name = item_name.title().strip()[:30]
                if display_name and display_name not in healthy_items:
                    healthy_items.append(display_name)
            elif is_healthy is False:
                display_name = item_name.title().strip()[:30]
                if display_name and display_name not in unhealthy_items:
                    unhealthy_items.append(display_name)

            # Category tracking
            cat_key = item_category or "Other"
            category_counts[cat_key]["items"] += 1
            if is_healthy is False:
                category_counts[cat_key]["healthy"] = False

    # ── 4. Calculate per-day averages ─────────────────────────────────────────
    CATEGORY_COLORS_MAP = {
        "Fruits":     "#4CAF50", "Vegetables": "#8BC34A", "Dairy":  "#94B6EF",
        "Eggs":       "#FFC107", "Meat":       "#E91E63",  "Seafood":"#00BCD4",
        "Snacks":     "#990808", "Beverages":  "#FF5722",  "Grains": "#E6E279",
        "Pulses":     "#CDDC39", "Nuts":       "#FF9800",  "Oils":   "#795548",
        "Bakery":     "#9C27B0", "Frozen":     "#607D8B",  "Other":  "#9E9E9E",
    }

    nutrients_out: Dict[str, Any] = {}
    gaps: List[str] = []
    excesses: List[str] = []

    for key, rda_val in RDA.items():
        total = round(nutrient_totals.get(key, 0.0), 1)
        per_day = round(total / span_days, 1)
        pct = round((per_day / rda_val) * 100, 1) if rda_val > 0 else 0.0
        nutrients_out[key] = {
            "label":  NUTRIENT_LABELS[key],
            "unit":   NUTRIENT_UNITS[key],
            "total":  total,
            "perDay": per_day,
            "rda":    rda_val,
            "pct":    pct,
            "color":  NUTRIENT_COLORS[key],
        }
        # Gap = below 60% of RDA
        if 0 < pct < 60 and key != "sugar_g":
            gaps.append(NUTRIENT_LABELS[key])
        # Excess = above 130% of RDA (only flag sugar + fat as excess)
        if pct > 130 and key in ("sugar_g", "fat_g"):
            excesses.append(NUTRIENT_LABELS[key])

    # ── 5. Healthy basket score ───────────────────────────────────────────────
    healthy_score = round((healthy_count / total_count) * 100) if total_count > 0 else 0

    # ── 6. Smart suggestion ───────────────────────────────────────────────────
    if total_count == 0:
        suggestion = "Upload a receipt to start tracking your nutrition forecast."
    elif not nutrients_out:
        suggestion = "Your items couldn't be matched to nutrition data yet. Try uploading clearer receipts."
    elif gaps and excesses:
        suggestion = (
            f"Your basket is low on {', '.join(gaps[:2])} and high on {', '.join(excesses[:2])}. "
            "Add more whole foods like leafy greens, pulses, and fruits."
        )
    elif gaps:
        top_gap = gaps[0]
        if top_gap == "Protein":
            suggestion = "Your basket is low on protein. Consider adding eggs, paneer, dal, or chicken to your next shop."
        elif top_gap == "Fiber":
            suggestion = "Fiber is below target. Add more vegetables, oats, and whole grains to improve gut health."
        elif top_gap == "Calories":
            suggestion = "Calorie intake from purchased foods seems low. Make sure you're buying enough staples like rice, wheat, and pulses."
        else:
            suggestion = f"Your {top_gap} intake from groceries is below the recommended level. Consider diversifying your basket."
    elif excesses:
        top_excess = excesses[0]
        suggestion = f"Your basket has high {top_excess} content. Consider swapping some processed items for whole food alternatives."
    elif healthy_score >= 80:
        suggestion = "Excellent! Your basket is highly nutritious. Keep up the healthy shopping habits."
    elif healthy_score >= 60:
        suggestion = "Good basket overall. A few more vegetables or pulses would make it even more balanced."
    else:
        suggestion = "Your basket has room for improvement. Try replacing some processed items with fresh vegetables, fruits, and whole grains."

    # ── 7. Categories summary ─────────────────────────────────────────────────
    categories_out = [
        {
            "name":    cat,
            "items":   info["items"],
            "healthy": info["healthy"],
            "color":   CATEGORY_COLORS_MAP.get(cat, "#9E9E9E"),
        }
        for cat, info in sorted(category_counts.items(), key=lambda x: -x[1]["items"])
    ]

    return {
        "month":             today.strftime("%B").upper(),
        "year":              today.year,
        "healthyBasketScore": healthy_score,
        "totalItems":        total_count,
        "healthyItems":      healthy_count,
        "nutrients":         nutrients_out,
        "gaps":              gaps,
        "excesses":          excesses,
        "suggestion":        suggestion,
        "topHealthyItems":   healthy_items[:5],
        "topUnhealthyItems": unhealthy_items[:3],
        "categories":        categories_out,
        "hasSufficientData": total_count > 0,
        "dataSource":        data_source,
        "spanDays":          span_days,
    }
