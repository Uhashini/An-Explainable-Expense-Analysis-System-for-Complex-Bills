"""
Health Intelligence Service - Pantrics
Provides clinically-sound, explainable, and personalized nutrition intelligence:
1. Glycemic Impact & Carbohydrate Quality Analysis
2. Sodium Intake & Cardiovascular Risk Evaluation
3. Allergen & Dietary Restriction Screening (Confirmed vs Inferred)
4. Macronutrient Balance & Gap Analysis
5. Goal-Specific & Medical Condition Personalized Recommendations
"""

from typing import Dict, List, Any, Optional, Tuple
import re
from sqlalchemy.orm import Session
from app.database.postgres_client import (
    UserProfile, UserOnboarding, Receipt, ReceiptItem,
    FoodItem, Nutrition, HealthIndicators
)
from app.services.product_matcher import product_matcher

# ── Reference Daily Dietary Values (Adult Standard) ───────────────────────────
REFERENCE_VALUES = {
    "daily_calories": 2000.0,      # kcal
    "daily_protein": 50.0,         # g (0.8g/kg general reference)
    "daily_carbs": 275.0,          # g (~55% calories)
    "daily_fat": 70.0,             # g (~30% calories)
    "daily_fiber": 28.0,           # g (AHA / ICMR standard)
    "daily_sugar_limit": 36.0,     # g (AHA added sugar ceiling)
    "daily_sodium_limit": 2000.0,  # mg (WHO / AHA general limit)
    "daily_sodium_htn_limit": 1500.0, # mg (Strict limit for hypertension / heart risk)
}

# ── Allergen Keyword Dictionaries ─────────────────────────────────────────────
ALLERGEN_TAXONOMY = {
    "dairy": {
        "display": "Milk & Dairy",
        "keywords": [
            "milk", "dairy", "curd", "dahi", "yogurt", "paneer", "cheese", "butter",
            "ghee", "cream", "whey", "casein", "custard", "buttermilk", "lassi",
            "malai", "khoya", "mawa"
        ]
    },
    "gluten": {
        "display": "Gluten & Wheat",
        "keywords": [
            "wheat", "gluten", "maida", "atta", "flour", "bread", "roti", "paratha",
            "naan", "puri", "pasta", "noodle", "noodles", "biscuit", "cookie",
            "cake", "pastry", "wafer", "semolina", "sooji", "rava", "barley", "rye"
        ]
    },
    "peanuts": {
        "display": "Peanuts",
        "keywords": [
            "peanut", "peanuts", "groundnut", "groundnuts", "chikki", "monkey nut"
        ]
    },
    "tree_nuts": {
        "display": "Tree Nuts",
        "keywords": [
            "nut", "nuts", "almond", "badam", "cashew", "kaju", "walnut", "akhrot",
            "pistachio", "pista", "hazelnut", "pecan", "macadamia"
        ]
    },
    "soy": {
        "display": "Soy & Soya",
        "keywords": [
            "soy", "soya", "soybean", "tofu", "edamame", "soy sauce", "soya chunks"
        ]
    },
    "eggs": {
        "display": "Eggs",
        "keywords": [
            "egg", "eggs", "anda", "omelette", "omelet", "mayo", "mayonnaise"
        ]
    },
    "fish": {
        "display": "Fish",
        "keywords": [
            "fish", "salmon", "tuna", "pomfret", "surmai", "rohu", "catla", "mackerel"
        ]
    },
    "shellfish": {
        "display": "Shellfish & Seafood",
        "keywords": [
            "shellfish", "prawn", "prawns", "shrimp", "crab", "lobster", "clam", "oyster"
        ]
    }
}

NON_VEG_KEYWORDS = [
    "chicken", "mutton", "beef", "pork", "meat", "lamb", "bacon", "ham",
    "sausage", "salami", "fish", "prawn", "shrimp", "crab", "egg", "anda"
]

# ── Fallback Nutrition Knowledge Base (Values per standard serving / 100g) ────
# Used if DB has missing fields or offline SQLite fallback
NUTRITION_LOOKUP_TABLE = [
    # Main Dishes / Rice / Grains
    {"keywords": ["fried rice", "rice half", "chicken fried rice"], "cal": 480, "prot": 22.0, "carb": 68.0, "fat": 14.0, "fib": 2.5, "sug": 2.0, "sod": 680, "gi": 72, "cat": "Main Dish"},
    {"keywords": ["biryani", "pulao"], "cal": 520, "prot": 24.0, "carb": 65.0, "fat": 18.0, "fib": 3.0, "sug": 2.5, "sod": 740, "gi": 68, "cat": "Main Dish"},
    {"keywords": ["white rice", "steamed rice", "boiled rice"], "cal": 240, "prot": 4.5, "carb": 53.0, "fat": 0.5, "fib": 0.8, "sug": 0.1, "sod": 5, "gi": 73, "cat": "Grains"},
    {"keywords": ["brown rice"], "cal": 216, "prot": 5.0, "carb": 45.0, "fat": 1.8, "fib": 3.5, "sug": 0.7, "sod": 10, "gi": 55, "cat": "Grains"},
    {"keywords": ["roti", "chapati", "phulka"], "cal": 120, "prot": 3.5, "carb": 22.0, "fat": 1.5, "fib": 3.0, "sug": 0.5, "sod": 110, "gi": 58, "cat": "Grains"},
    {"keywords": ["paratha", "naan"], "cal": 260, "prot": 6.0, "carb": 38.0, "fat": 10.0, "fib": 2.2, "sug": 1.5, "sod": 340, "gi": 70, "cat": "Grains"},
    {"keywords": ["dosa", "masala dosa"], "cal": 280, "prot": 6.5, "carb": 42.0, "fat": 9.0, "fib": 2.8, "sug": 1.0, "sod": 420, "gi": 65, "cat": "Breakfast"},
    {"keywords": ["idli"], "cal": 130, "prot": 4.0, "carb": 26.0, "fat": 0.8, "fib": 1.8, "sug": 0.4, "sod": 180, "gi": 60, "cat": "Breakfast"},
    {"keywords": ["oats", "oatmeal"], "cal": 150, "prot": 5.5, "carb": 27.0, "fat": 2.5, "fib": 4.0, "sug": 1.0, "sod": 2, "gi": 50, "cat": "Grains"},
    
    # Proteins / Pulses / Meats
    {"keywords": ["chicken breast", "grilled chicken", "chicken"], "cal": 220, "prot": 31.0, "carb": 0.0, "fat": 9.0, "fib": 0.0, "sug": 0.0, "sod": 180, "gi": 0, "cat": "Poultry"},
    {"keywords": ["egg", "boiled egg", "eggs"], "cal": 75, "prot": 6.3, "carb": 0.5, "fat": 5.0, "fib": 0.0, "sug": 0.5, "sod": 65, "gi": 0, "cat": "Dairy & Eggs"},
    {"keywords": ["paneer"], "cal": 265, "prot": 18.0, "carb": 2.5, "fat": 21.0, "fib": 0.0, "sug": 2.0, "sod": 22, "gi": 15, "cat": "Dairy"},
    {"keywords": ["dal", "lentil", "sambar", "chana", "rajma"], "cal": 180, "prot": 10.5, "carb": 28.0, "fat": 3.0, "fib": 7.5, "sug": 1.8, "sod": 320, "gi": 35, "cat": "Legumes"},
    {"keywords": ["fish", "salmon", "tuna"], "cal": 190, "prot": 26.0, "carb": 0.0, "fat": 8.5, "fib": 0.0, "sug": 0.0, "sod": 120, "gi": 0, "cat": "Seafood"},
    {"keywords": ["tofu", "soya"], "cal": 140, "prot": 15.0, "carb": 3.0, "fat": 8.0, "fib": 2.0, "sug": 0.5, "sod": 15, "gi": 15, "cat": "Plant Protein"},
    
    # Dairy & Beverages
    {"keywords": ["milk", "cow milk", "doodh"], "cal": 130, "prot": 6.8, "carb": 9.6, "fat": 6.5, "fib": 0.0, "sug": 9.6, "sod": 98, "gi": 38, "cat": "Dairy"},
    {"keywords": ["curd", "yogurt", "dahi"], "cal": 110, "prot": 6.0, "carb": 8.5, "fat": 5.5, "fib": 0.0, "sug": 8.0, "sod": 85, "gi": 35, "cat": "Dairy"},
    {"keywords": ["tea", "chai"], "cal": 55, "prot": 1.5, "carb": 8.0, "fat": 1.5, "fib": 0.0, "sug": 7.0, "sod": 20, "gi": 45, "cat": "Beverage"},
    {"keywords": ["coffee"], "cal": 70, "prot": 2.0, "carb": 9.0, "fat": 2.0, "fib": 0.0, "sug": 8.0, "sod": 25, "gi": 45, "cat": "Beverage"},
    {"keywords": ["water"], "cal": 0, "prot": 0.0, "carb": 0.0, "fat": 0.0, "fib": 0.0, "sug": 0.0, "sod": 0, "gi": 0, "cat": "Beverage"},
    {"keywords": ["soda", "coke", "pepsi", "sprite", "soft drink"], "cal": 150, "prot": 0.0, "carb": 39.0, "fat": 0.0, "fib": 0.0, "sug": 39.0, "sod": 45, "gi": 85, "cat": "Soft Drink"},
    
    # Snacks & Confectionery (High Glycemic / Sodium)
    {"keywords": ["potato chips", "chips", "crisps"], "cal": 320, "prot": 3.5, "carb": 35.0, "fat": 19.0, "fib": 2.2, "sug": 1.0, "sod": 480, "gi": 75, "cat": "Snack"},
    {"keywords": ["biscuit", "cookies", "wafer"], "cal": 280, "prot": 3.8, "carb": 42.0, "fat": 11.5, "fib": 1.2, "sug": 18.0, "sod": 240, "gi": 70, "cat": "Snack"},
    {"keywords": ["chocolate", "candy", "sweet"], "cal": 340, "prot": 4.0, "carb": 48.0, "fat": 16.0, "fib": 1.5, "sug": 42.0, "sod": 80, "gi": 70, "cat": "Confectionery"},
    {"keywords": ["maggi", "noodles", "instant noodles"], "cal": 390, "prot": 7.5, "carb": 56.0, "fat": 15.0, "fib": 2.5, "sug": 2.5, "sod": 920, "gi": 74, "cat": "Instant Food"},
    
    # Fruits & Vegetables (Protective / Low GI)
    {"keywords": ["banana"], "cal": 90, "prot": 1.1, "carb": 23.0, "fat": 0.3, "fib": 2.6, "sug": 12.0, "sod": 1, "gi": 51, "cat": "Fruits"},
    {"keywords": ["apple"], "cal": 72, "prot": 0.4, "carb": 19.0, "fat": 0.2, "fib": 3.3, "sug": 14.0, "sod": 1, "gi": 36, "cat": "Fruits"},
    {"keywords": ["orange"], "cal": 62, "prot": 1.2, "carb": 15.4, "fat": 0.2, "fib": 3.1, "sug": 12.2, "sod": 0, "gi": 43, "cat": "Fruits"},
    {"keywords": ["salad", "cucumber", "lettuce", "greens"], "cal": 45, "prot": 1.8, "carb": 8.0, "fat": 0.5, "fib": 3.5, "sug": 3.0, "sod": 30, "gi": 15, "cat": "Vegetables"},
    {"keywords": ["spinach", "palak", "broccoli"], "cal": 35, "prot": 3.2, "carb": 5.5, "fat": 0.6, "fib": 3.0, "sug": 1.2, "sod": 75, "gi": 15, "cat": "Vegetables"},
    {"keywords": ["tomato"], "cal": 22, "prot": 1.1, "carb": 4.8, "fat": 0.2, "fib": 1.5, "sug": 3.2, "sod": 6, "gi": 15, "cat": "Vegetables"},
]


class HealthIntelligenceService:
    """
    Core service delivering deep, personalized nutrition analytics for Pantrics.
    Integrates DB nutrition tables, user profiles, and clinical evidence guidelines.
    """

    def analyze_health_intelligence(
        self,
        db: Session,
        user_id: int,
        receipt_id: Optional[int] = None,
        custom_items: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end personalized nutrition analysis for the given user and receipt items.
        """
        # 1. Fetch user profile and onboarding data
        user_profile, onboarding = self._get_user_context(db, user_id)
        
        # 2. Extract items to analyze
        items = self._resolve_items(db, user_id, receipt_id, custom_items)
        
        # 3. Enrich items with nutrition, GI, and allergen profiles
        enriched_items = [self._enrich_item(db, it) for it in items]
        
        # 4. Compute Module A: Glycemic Impact
        glycemic_data = self._compute_glycemic_impact(enriched_items, onboarding)
        
        # 5. Compute Module B: Sodium & Cardiovascular Health
        sodium_data = self._compute_sodium_cardiovascular(enriched_items, onboarding)
        
        # 6. Compute Module C: Allergen & Dietary Restriction Screening
        allergen_data = self._compute_allergen_screening(enriched_items, onboarding)
        
        # 7. Compute Module D: Nutritional Balance Analysis
        balance_data = self._compute_nutritional_balance(enriched_items, onboarding)
        
        # 8. Compute Module E: Personalized Recommendations
        recommendations = self._generate_personalized_recommendations(
            enriched_items, onboarding, glycemic_data, sodium_data, allergen_data, balance_data
        )

        # 9. Multi-receipt trend indicators (if historical data exists)
        historical_summary = self._compute_historical_summary(db, user_id, receipt_id)

        return {
            "status": "success",
            "user_id": user_id,
            "receipt_id": receipt_id,
            "total_items_analyzed": len(enriched_items),
            "user_context": {
                "name": user_profile.name if user_profile else "User",
                "goals": onboarding.goals if onboarding and onboarding.goals else "Eat Healthy",
                "food_preference": onboarding.food_preference if onboarding and onboarding.food_preference else "Not specified",
                "allergies": onboarding.allergies if onboarding and onboarding.allergies else "None declared",
                "medical_conditions": onboarding.medical_conditions if onboarding and onboarding.medical_conditions else "None declared",
            },
            "glycemic_impact": glycemic_data,
            "sodium_cardiovascular": sodium_data,
            "allergen_detection": allergen_data,
            "nutritional_balance": balance_data,
            "personalized_recommendations": recommendations,
            "historical_summary": historical_summary,
            "disclaimer": "Nutritional and glycemic values are estimated using food composition reference models and OCR item mapping. For clinical allergy management, diabetes therapy, or specific medical conditions, always verify physical product packaging and consult a registered healthcare professional."
        }

    # ── Internal Helpers ────────────────────────────────────────────────────────

    def _get_user_context(self, db: Session, user_id: int) -> Tuple[Optional[UserProfile], Optional[UserOnboarding]]:
        user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        onboarding = db.query(UserOnboarding).filter(UserOnboarding.user_id == user_id).first()
        return user, onboarding

    def _resolve_items(
        self,
        db: Session,
        user_id: int,
        receipt_id: Optional[int],
        custom_items: Optional[List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        if custom_items and len(custom_items) > 0:
            return custom_items

        if receipt_id:
            db_items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt_id).all()
            if db_items:
                return [
                    {
                        "name": it.name,
                        "quantity": it.quantity or "1",
                        "price": it.price,
                        "rate": it.rate,
                        "matched_food_id": it.matched_food_id
                    }
                    for it in db_items
                ]

        # Fallback to user's most recent receipt
        latest_receipt = (
            db.query(Receipt)
            .filter(Receipt.user_id == user_id)
            .order_by(Receipt.receipt_id.desc())
            .first()
        )
        if latest_receipt:
            db_items = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == latest_receipt.receipt_id).all()
            if db_items:
                return [
                    {
                        "name": it.name,
                        "quantity": it.quantity or "1",
                        "price": it.price,
                        "rate": it.rate,
                        "matched_food_id": it.matched_food_id
                    }
                    for it in db_items
                ]

        return []

    def _enrich_item(self, db: Session, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enriches a raw receipt item with nutrition, GI, sodium, and allergen parameters.
        Respects data availability: distinguishes verified DB, reference estimate, or unavailable.
        """
        name = item.get("name") or item.get("display_name") or item.get("matched_name") or "Food Item"
        qty_val = self._parse_qty(item.get("quantity") or item.get("qty") or 1)
        
        matched_id = item.get("matched_food_id") or item.get("food_id")
        nut_data = None
        data_source = "unavailable"
        gi_val = 55
        cat_val = item.get("category") or "General"
        is_processed = False
        db_allergen = None
        db_veg = None
        db_gluten_free = None

        # 1. Try PostgreSQL / DB match
        if matched_id:
            food = (
                db.query(FoodItem)
                .filter(FoodItem.food_id == matched_id)
                .first()
            )
            if food:
                cat_val = food.category or cat_val
                if food.nutrition:
                    n = food.nutrition
                    # Check if actual values exist (not all None)
                    if n.calories_kcal is not None or n.protein_g is not None or n.carbohydrates_g is not None:
                        nut_data = {
                            "calories": float(n.calories_kcal or 0),
                            "protein": float(n.protein_g or 0),
                            "carbs": float(n.carbohydrates_g or 0),
                            "fat": float(n.fat_g or 0),
                            "fiber": float(n.fiber_g or 0),
                            "sugar": float(n.sugar_g or 0),
                            "sodium": float(n.sodium_mg or 0),
                        }
                        data_source = "verified_db"

                if food.health_indicators:
                    h = food.health_indicators
                    is_processed = bool(h.is_processed)
                    db_allergen = h.allergen
                    db_veg = h.vegetarian
                    db_gluten_free = h.gluten_free

        # 2. Try reference knowledge base first (instant, robust, comprehensive)
        if not nut_data:
            ref = self._lookup_reference_nutrition(name)
            if ref:
                nut_data = {
                    "calories": ref["cal"],
                    "protein": ref["prot"],
                    "carbs": ref["carb"],
                    "fat": ref["fat"],
                    "fiber": ref["fib"],
                    "sugar": ref["sug"],
                    "sodium": ref["sod"],
                }
                gi_val = ref.get("gi", 55)
                cat_val = ref.get("cat", cat_val)
                data_source = "reference_estimate"

        # 3. Direct DB match by item name keyword
        if not nut_data:
            try:
                clean_name = re.sub(r'[^a-zA-Z\s]', '', name).strip()
                tokens = [t for t in clean_name.split() if len(t) > 3]
                for token in tokens:
                    food = db.query(FoodItem).filter(FoodItem.canonical_name.ilike(f"%{token}%")).first()
                    if food and food.nutrition:
                        n = food.nutrition
                        if n.calories_kcal is not None or n.protein_g is not None or n.carbohydrates_g is not None:
                            nut_data = {
                                "calories": float(n.calories_kcal or 0),
                                "protein": float(n.protein_g or 0),
                                "carbs": float(n.carbohydrates_g or 0),
                                "fat": float(n.fat_g or 0),
                                "fiber": float(n.fiber_g or 0),
                                "sugar": float(n.sugar_g or 0),
                                "sodium": float(n.sodium_mg or 0),
                            }
                            data_source = "verified_db"
                            cat_val = food.category or cat_val
                            if food.health_indicators:
                                h = food.health_indicators
                                is_processed = bool(h.is_processed)
                                db_allergen = h.allergen
                                db_veg = h.vegetarian
                                db_gluten_free = h.gluten_free
                            break
            except Exception as e:
                logger.debug(f"Direct DB keyword search skipped: {e}")

        # 4. Try product_matcher lookup if already initialized (non-blocking)
        if not nut_data and getattr(product_matcher, "is_initialized", False):
            try:
                match = product_matcher.match_item(name)
                if match and match.get("nutrition"):
                    n = match["nutrition"]
                    if any(v is not None for v in n.values()):
                        nut_data = {
                            "calories": float(n.get("calories_kcal") or 0),
                            "protein": float(n.get("protein_g") or 0),
                            "carbs": float(n.get("carbohydrates_g") or 0),
                            "fat": float(n.get("fat_g") or 0),
                            "fiber": float(n.get("fiber_g") or 0),
                            "sugar": float(n.get("sugar_g") or 0),
                            "sodium": float(n.get("sodium_mg") or 0),
                        }
                        data_source = "verified_db"
                        cat_val = match.get("category") or cat_val
                        h = match.get("health") or {}
                        is_processed = bool(h.get("is_processed", False))
                        db_allergen = h.get("allergen")
                        db_veg = h.get("vegetarian")
                        db_gluten_free = h.get("gluten_free")
            except Exception as e:
                logger.debug(f"ProductMatcher lookup skipped: {e}")

        # If data is completely unavailable
        if not nut_data:
            nut_data = {
                "calories": 0.0,
                "protein": 0.0,
                "carbs": 0.0,
                "fat": 0.0,
                "fiber": 0.0,
                "sugar": 0.0,
                "sodium": 0.0,
            }
            data_source = "unavailable"

        # Compute Glycemic Index and Load
        gl_val = round((nut_data["carbs"] * gi_val) / 100.0, 1)

        return {
            "name": name,
            "quantity": qty_val,
            "category": cat_val,
            "data_source": data_source,
            "is_data_available": data_source != "unavailable",
            "is_processed": is_processed,
            "per_serving": nut_data,
            "total_nutrition": {
                "calories": round(nut_data["calories"] * qty_val, 1),
                "protein": round(nut_data["protein"] * qty_val, 1),
                "carbs": round(nut_data["carbs"] * qty_val, 1),
                "fat": round(nut_data["fat"] * qty_val, 1),
                "fiber": round(nut_data["fiber"] * qty_val, 1),
                "sugar": round(nut_data["sugar"] * qty_val, 1),
                "sodium": round(nut_data["sodium"] * qty_val, 1),
            },
            "glycemic_index": gi_val,
            "glycemic_load": round(gl_val * qty_val, 1),
            "db_allergen": db_allergen,
            "db_veg": db_veg,
            "db_gluten_free": db_gluten_free
        }

    def _lookup_reference_nutrition(self, name: str) -> Optional[Dict[str, Any]]:
        name_lower = name.lower()
        for entry in NUTRITION_LOOKUP_TABLE:
            for kw in entry["keywords"]:
                if kw in name_lower:
                    return entry
        return None

    def _parse_qty(self, raw_qty: Any) -> float:
        if isinstance(raw_qty, (int, float)):
            return max(1.0, float(raw_qty))
        try:
            cleaned = re.sub(r'[^0-9.]', '', str(raw_qty))
            return max(1.0, float(cleaned)) if cleaned else 1.0
        except ValueError:
            return 1.0

    # ── Module A: Glycemic Impact ─────────────────────────────────────────────

    def _compute_glycemic_impact(
        self,
        items: List[Dict[str, Any]],
        onboarding: Optional[UserOnboarding]
    ) -> Dict[str, Any]:
        available_items = [it for it in items if it["is_data_available"]]
        if not available_items:
            return {
                "overall_level": "Unknown",
                "status_badge": "Data Unavailable",
                "status_color": "#9E9E9E",
                "glycemic_load_total": 0.0,
                "fiber_to_carb_ratio": 0.0,
                "high_impact_items": [],
                "protective_items": [],
                "summary": "Nutrition data unavailable for scanned items to assess glycemic impact.",
                "alternatives": ["Choose whole grains such as brown rice, oats, or quinoa instead of refined carbohydrates."]
            }

        total_carbs = sum(it["total_nutrition"]["carbs"] for it in available_items)
        total_fiber = sum(it["total_nutrition"]["fiber"] for it in available_items)
        total_sugar = sum(it["total_nutrition"]["sugar"] for it in available_items)
        total_gl = sum(it["glycemic_load"] for it in available_items)

        fiber_ratio = round((total_fiber / total_carbs), 2) if total_carbs > 0 else 0.0

        # High impact vs protective items
        high_impact = []
        protective = []

        for it in available_items:
            gi = it["glycemic_index"]
            carbs = it["total_nutrition"]["carbs"]
            sugar = it["total_nutrition"]["sugar"]
            fib = it["total_nutrition"]["fiber"]
            
            if (gi >= 70 or sugar >= 15.0 or (carbs >= 40.0 and fib <= 2.0)):
                high_impact.append({
                    "name": it["name"],
                    "carbs_g": carbs,
                    "sugar_g": sugar,
                    "glycemic_load": it["glycemic_load"],
                    "reason": "High fast-acting carbohydrates / elevated glycemic response"
                })
            elif fib >= 3.0 or it["total_nutrition"]["protein"] >= 15.0:
                protective.append({
                    "name": it["name"],
                    "fiber_g": fib,
                    "protein_g": it["total_nutrition"]["protein"],
                    "reason": "Rich in dietary fiber / protein; helps moderate blood glucose absorption"
                })

        # Tier classification
        # Low GL: <= 10, Medium: 11 - 19, High: >= 20 per meal / haul
        if total_gl >= 35 or fiber_ratio < 0.06:
            overall_level = "Elevated"
            status_badge = "Rapid Glucose Impact"
            status_color = "#E53935"
            summary = "Purchases contain refined carbohydrates with low dietary fiber. This profile may lead to rapid postprandial glucose fluctuations."
        elif total_gl >= 18 or fiber_ratio < 0.12:
            overall_level = "Moderate"
            status_badge = "Moderate Glycemic Response"
            status_color = "#FB8C00"
            summary = "Balanced carbohydrate choices detected with moderate glycemic load. Adding additional high-fiber greens or protein will further stabilize glucose response."
        else:
            overall_level = "Low"
            status_badge = "Stable Blood Sugar Control"
            status_color = "#2E7D32"
            summary = "Favorable glycemic profile detected. Complex carbohydrates and sufficient fiber promote prolonged satiety and stable blood glucose."

        # Medical personalization: check if user monitors diabetes
        user_conditions = (onboarding.medical_conditions or "").lower() if onboarding else ""
        user_goals = (onboarding.goals or "").lower() if onboarding else ""
        is_diabetic = "diabet" in user_conditions or "glucose" in user_conditions or "sugar" in user_conditions

        alternatives = [
            "Substitute polished white rice or maida with fiber-rich brown rice, red rice, or quinoa.",
            "Pair carbohydrate-heavy dishes with non-starchy green vegetables (broccoli, spinach, cucumber) to slow gastric emptying.",
            "Choose whole fruits instead of fruit juices or sweetened beverages to preserve dietary fiber."
        ]
        if is_diabetic:
            summary += " [Personalized Alert] Based on your health profile, monitoring portion sizes of high-GL items is strongly recommended."

        return {
            "overall_level": overall_level,
            "status_badge": status_badge,
            "status_color": status_color,
            "total_carbs_g": round(total_carbs, 1),
            "total_sugar_g": round(total_sugar, 1),
            "total_fiber_g": round(total_fiber, 1),
            "fiber_to_carb_ratio": fiber_ratio,
            "glycemic_load_total": round(total_gl, 1),
            "high_impact_items": high_impact,
            "protective_items": protective,
            "summary": summary,
            "alternatives": alternatives,
            "is_personalized_for_diabetes": is_diabetic
        }

    # ── Module B: Sodium & Cardiovascular Health ──────────────────────────────

    def _compute_sodium_cardiovascular(
        self,
        items: List[Dict[str, Any]],
        onboarding: Optional[UserOnboarding]
    ) -> Dict[str, Any]:
        available_items = [it for it in items if it["is_data_available"]]
        if not available_items:
            return {
                "overall_level": "Unknown",
                "status_badge": "Data Unavailable",
                "status_color": "#9E9E9E",
                "total_sodium_mg": 0.0,
                "daily_limit_mg": 2000.0,
                "sodium_percentage": 0,
                "high_sodium_items": [],
                "summary": "Sodium information unavailable for scanned items.",
                "alternatives": ["Use natural seasonings like lemon, cumin, and garlic to enhance flavor with less salt."]
            }

        total_sodium = sum(it["total_nutrition"]["sodium"] for it in available_items)

        # Check for hypertension profile
        user_conditions = (onboarding.medical_conditions or "").lower() if onboarding else ""
        is_hypertensive = "hyper" in user_conditions or "bp" in user_conditions or "blood pressure" in user_conditions or "heart" in user_conditions
        
        daily_limit = REFERENCE_VALUES["daily_sodium_htn_limit"] if is_hypertensive else REFERENCE_VALUES["daily_sodium_limit"]
        pct_of_limit = min(200, round((total_sodium / daily_limit) * 100))

        high_sodium_items = []
        for it in available_items:
            sod = it["total_nutrition"]["sodium"]
            if sod >= 400.0:
                high_sodium_items.append({
                    "name": it["name"],
                    "sodium_mg": round(sod, 1),
                    "pct_daily_limit": round((sod / daily_limit) * 100, 1),
                    "status": "High Sodium (> 400 mg)"
                })

        if total_sodium > daily_limit:
            overall_level = "High Risk"
            status_badge = "Exceeds Daily Sodium Limit"
            status_color = "#D32F2F"
            summary = f"Total estimated sodium ({round(total_sodium)} mg) exceeds the recommended daily ceiling of {int(daily_limit)} mg. Frequent high-sodium intake is linked with elevated blood pressure."
        elif total_sodium >= (daily_limit * 0.7):
            overall_level = "Elevated"
            status_badge = "Approaching Daily Sodium Limit"
            status_color = "#FB8C00"
            summary = f"Estimated sodium intake ({round(total_sodium)} mg) represents {pct_of_limit}% of daily reference intake. Consider balancing remaining meals with low-sodium whole foods."
        elif total_sodium >= (daily_limit * 0.3):
            overall_level = "Moderate"
            status_badge = "Moderate Sodium Contribution"
            status_color = "#1976D2"
            summary = f"Estimated sodium content ({round(total_sodium)} mg) is within standard single-haul bounds ({pct_of_limit}% of daily limit)."
        else:
            overall_level = "Optimal"
            status_badge = "Heart-Healthy Low Sodium"
            status_color = "#2E7D32"
            summary = f"Low sodium profile detected ({round(total_sodium)} mg, {pct_of_limit}% of limit). Supports cardiovascular health and healthy fluid balance."

        if is_hypertensive:
            summary += " [Personalized Alert] Strict 1,500 mg daily ceiling applied based on your declared cardiovascular profile."

        alternatives = [
            "Opt for naturally low-sodium staples and season with lemon, black pepper, turmeric, and fresh coriander instead of added salt.",
            "Rinse canned legumes and vegetables with cold water to remove up to 40% of surface sodium.",
            "Replace pre-packaged instant seasonings and sauces with freshly prepared herbs and aromatics."
        ]

        return {
            "overall_level": overall_level,
            "status_badge": status_badge,
            "status_color": status_color,
            "total_sodium_mg": round(total_sodium, 1),
            "daily_limit_mg": daily_limit,
            "sodium_percentage": pct_of_limit,
            "high_sodium_items": high_sodium_items,
            "summary": summary,
            "alternatives": alternatives,
            "is_personalized_for_hypertension": is_hypertensive
        }

    # ── Module C: Allergen & Dietary Restriction Screening ─────────────────────

    def _compute_allergen_screening(
        self,
        items: List[Dict[str, Any]],
        onboarding: Optional[UserOnboarding]
    ) -> Dict[str, Any]:
        raw_allergies = (onboarding.allergies or "") if onboarding else ""
        raw_diet = (onboarding.food_preference or "") if onboarding else ""

        # Normalize declared allergies into a set
        declared_allergies = set()
        for piece in re.split(r'[,;/|]', raw_allergies.lower()):
            clean = piece.strip()
            if clean and clean not in ("none", "no", "n/a", "nil"):
                declared_allergies.add(clean)

        is_vegetarian = any(term in raw_diet.lower() for term in ["veg", "vegetarian", "vegan"]) and "non" not in raw_diet.lower()
        is_vegan = "vegan" in raw_diet.lower()

        warnings = []
        item_allergen_map = []

        for it in items:
            name = it["name"]
            name_lower = name.lower()
            detected_for_item = []

            # 1. Check against Allergen Taxonomy
            for allergen_key, info in ALLERGEN_TAXONOMY.items():
                matched_kw = None
                for kw in info["keywords"]:
                    if re.search(r'\b' + re.escape(kw) + r'\b', name_lower) or kw in name_lower:
                        matched_kw = kw
                        break
                
                # Check DB allergen column as well
                db_all = (it.get("db_allergen") or "").lower()
                is_db_match = allergen_key in db_all or any(kw in db_all for kw in info["keywords"])

                if matched_kw or is_db_match:
                    display_type = info["display"]
                    is_user_allergic = any(
                        allergen_key in da or da in allergen_key or any(kw in da for kw in info["keywords"])
                        for da in declared_allergies
                    )

                    confidence = "Confirmed via Database Flag" if is_db_match else "Inferred from Food Name / Ingredients"
                    severity = "CRITICAL_TRIGGER" if is_user_allergic else "INFORMATIONAL"

                    warning_entry = {
                        "item_name": name,
                        "allergen_type": display_type,
                        "matched_trigger": matched_kw or db_all,
                        "confidence": confidence,
                        "severity": severity,
                        "is_user_declared": is_user_allergic,
                        "message": (
                            f"[ALLERGEN ALERT] Contains {display_type} ({matched_kw or 'flagged in database'}), which matches your declared allergy profile!"
                            if is_user_allergic
                            else f"[INFO] Contains {display_type} ({matched_kw or 'ingredient flag'})."
                        )
                    }
                    detected_for_item.append(display_type)
                    if is_user_allergic:
                        warnings.append(warning_entry)

            # 2. Check Dietary Restrictions (Vegetarian / Vegan)
            if is_vegetarian or is_vegan:
                non_veg_match = None
                for nvk in NON_VEG_KEYWORDS:
                    if re.search(r'\b' + re.escape(nvk) + r'\b', name_lower):
                        non_veg_match = nvk
                        break
                if it.get("db_veg") is False or non_veg_match:
                    warnings.append({
                        "item_name": name,
                        "allergen_type": "Dietary Preference Conflict",
                        "matched_trigger": non_veg_match or "Non-Vegetarian classification",
                        "confidence": "Database & Name Classification",
                        "severity": "PREFERENCE_MISMATCH",
                        "is_user_declared": True,
                        "message": f"[DIET WARNING] Non-Vegetarian item detected ('{name}'), which conflicts with your declared {raw_diet} preference."
                    })

            item_allergen_map.append({
                "name": name,
                "detected_allergens": detected_for_item if detected_for_item else ["None detected from name"]
            })

        # Overall Status
        has_critical = any(w["severity"] == "CRITICAL_TRIGGER" for w in warnings)
        has_mismatch = any(w["severity"] == "PREFERENCE_MISMATCH" for w in warnings)

        if has_critical:
            overall_status = "Allergen Warning"
            status_badge = "Declared Allergen Detected"
            status_color = "#D32F2F"
            summary = "One or more purchased items contain ingredients matching your declared food allergy profile."
        elif has_mismatch:
            overall_status = "Dietary Conflict"
            status_badge = "Dietary Preference Mismatch"
            status_color = "#FB8C00"
            summary = f"Items detected that conflict with your declared {raw_diet} lifestyle."
        else:
            overall_status = "Clean Screen"
            status_badge = "No Declared Allergens Flagged"
            status_color = "#2E7D32"
            summary = "No declared allergens or dietary conflicts detected in scanned items. (Always inspect physical packaging for allergen statements)."

        return {
            "overall_status": overall_status,
            "status_badge": status_badge,
            "status_color": status_color,
            "declared_allergies": list(declared_allergies) if declared_allergies else ["None declared in profile"],
            "declared_diet": raw_diet if raw_diet else "Standard",
            "warnings": warnings,
            "item_breakdown": item_allergen_map,
            "summary": summary,
            "safety_disclaimer": "Never rely solely on digital screening for severe anaphylactic allergies. Pantrics screens item names and database taxonomy; physical packaging must always be checked for cross-contact notices."
        }

    # ── Module D: Nutritional Balance Analysis ────────────────────────────────

    def _compute_nutritional_balance(
        self,
        items: List[Dict[str, Any]],
        onboarding: Optional[UserOnboarding]
    ) -> Dict[str, Any]:
        available_items = [it for it in items if it["is_data_available"]]
        if not available_items:
            return {
                "balance_score": 50,
                "macro_ratios": {"protein": 25, "carbs": 50, "fat": 25},
                "strengths": ["Item tracking initiated."],
                "gaps": ["Nutritional breakdown unavailable for scanned items."],
                "missing_food_groups": ["Fresh Produce", "Whole Grains", "Lean Protein"],
                "summary": "Nutrition data unavailable to calculate macronutrient balance."
            }

        tot_cal = sum(it["total_nutrition"]["calories"] for it in available_items)
        tot_prot = sum(it["total_nutrition"]["protein"] for it in available_items)
        tot_carb = sum(it["total_nutrition"]["carbs"] for it in available_items)
        tot_fat = sum(it["total_nutrition"]["fat"] for it in available_items)
        tot_fib = sum(it["total_nutrition"]["fiber"] for it in available_items)
        tot_sug = sum(it["total_nutrition"]["sugar"] for it in available_items)

        carb_cal = tot_carb * 4.0
        prot_cal = tot_prot * 4.0
        fat_cal = tot_fat * 9.0
        macro_sum_cal = carb_cal + prot_cal + fat_cal or 1.0

        p_ratio = round((prot_cal / macro_sum_cal) * 100)
        c_ratio = round((carb_cal / macro_sum_cal) * 100)
        f_ratio = max(0, 100 - (p_ratio + c_ratio))

        strengths = []
        gaps = []
        missing_groups = []

        # Analyze strengths
        if p_ratio >= 20:
            strengths.append(f"Strong protein density ({p_ratio}% of total macro calories), promoting muscle maintenance and satiety.")
        if tot_fib >= 10:
            strengths.append(f"Good dietary fiber content ({round(tot_fib, 1)} g), supporting healthy digestion and gut microbiome.")
        if tot_sug <= 15:
            strengths.append("Low added sugar profile, minimizing insulin spikes and inflammatory load.")
        if not strengths:
            strengths.append("Provides immediate caloric and macronutrient energy to fuel daily activity.")

        # Analyze gaps
        if tot_fib < 8:
            gaps.append(f"Low dietary fiber ({round(tot_fib, 1)} g vs 28 g daily recommendation).")
            missing_groups.append("Leafy Greens & Fiber-Rich Vegetables")
        if p_ratio < 15:
            gaps.append(f"Protein contribution ({p_ratio}%) is below optimal satiety thresholds (target 20-30%).")
            missing_groups.append("Quality Protein Sources (Lentils, Eggs, Paneer, Fish)")
        if c_ratio > 65:
            gaps.append(f"Carbohydrate dominance ({c_ratio}% of calories), which may lead to faster hunger return.")
        if tot_sug > 30:
            gaps.append(f"Elevated simple sugar content ({round(tot_sug, 1)} g exceeds recommended single-meal limits).")

        # Check category representation
        categories = set(it["category"].lower() for it in available_items)
        if not any("fruit" in c or "veg" in c or "produce" in c for c in categories):
            if "Fresh Fruits & Vegetables" not in missing_groups:
                missing_groups.append("Fresh Fruits & Vegetables")
        if not any("grain" in c or "bread" in c or "rice" in c for c in categories):
            missing_groups.append("Whole Complex Grains")

        # Balance Score calculation
        score = 75
        if p_ratio >= 20: score += 10
        elif p_ratio < 12: score -= 10

        if tot_fib >= 10: score += 10
        elif tot_fib < 4: score -= 10

        if tot_sug > 35: score -= 15
        elif tot_sug < 15: score += 5

        balance_score = max(35, min(96, score))

        return {
            "balance_score": balance_score,
            "macronutrients": {
                "calories": round(tot_cal),
                "protein_g": round(tot_prot, 1),
                "carbs_g": round(tot_carb, 1),
                "fat_g": round(tot_fat, 1),
                "fiber_g": round(tot_fib, 1),
                "sugar_g": round(tot_sug, 1),
            },
            "macro_distribution_pct": {
                "protein": p_ratio,
                "carbs": c_ratio,
                "fat": f_ratio,
            },
            "strengths": strengths,
            "gaps": gaps if gaps else ["Macronutrient distribution aligns with standard baseline parameters."],
            "missing_food_groups": missing_groups if missing_groups else ["Well-rounded food group diversity."],
            "summary": f"Your current purchase profile provides a {p_ratio}% Protein / {c_ratio}% Carbs / {f_ratio}% Fat balance score of {balance_score}/100."
        }

    # ── Module E: Personalized Health Recommendations ─────────────────────────

    def _generate_personalized_recommendations(
        self,
        items: List[Dict[str, Any]],
        onboarding: Optional[UserOnboarding],
        glycemic_data: Dict[str, Any],
        sodium_data: Dict[str, Any],
        allergen_data: Dict[str, Any],
        balance_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        recs = []
        user_goals = (onboarding.goals or "Eat Healthy").lower() if onboarding else "eat healthy"
        diet_pref = (onboarding.food_preference or "").lower() if onboarding else ""
        is_veg = "veg" in diet_pref and "non" not in diet_pref

        # 1. Goal: Gain Muscle
        if "muscle" in user_goals or "gain" in user_goals:
            prot_g = balance_data.get("macronutrients", {}).get("protein_g", 0)
            if is_veg:
                recs.append({
                    "category": "Protein & Muscle Synthesis",
                    "title": "Boost Plant & Dairy Protein Targets",
                    "description": f"Currently tracking {prot_g}g protein. To optimize hypertrophy on a vegetarian lifestyle, incorporate paneer, Greek yogurt, sprouted lentils, or edamame into each meal.",
                    "impact": "High Impact",
                    "action_tag": "Muscle Goal",
                    "suggested_swap": "Pair rice with Dal Makhani or Paneer Bhurji"
                })
            else:
                recs.append({
                    "category": "Protein & Muscle Synthesis",
                    "title": "Target Lean Muscle Protein Synthesis",
                    "description": f"Currently tracking {prot_g}g protein. Ensure a 25-35g protein bolus every 3-4 hours using chicken breast, eggs, fish, or whey protein to maximize muscle protein synthesis (MPS).",
                    "impact": "High Impact",
                    "action_tag": "Muscle Goal",
                    "suggested_swap": "Add 2 boiled eggs or 100g grilled chicken to carb meals"
                })

        # 2. Goal: Lose Weight / Caloric Management
        if "lose" in user_goals or "weight" in user_goals:
            recs.append({
                "category": "Satiety & Energy Balance",
                "title": "Prioritize High-Volume, Low-Calorie Vegetables",
                "description": "Increase portion sizes of leafy greens, cucumbers, and cauliflower. These provide high gastric volume and satiety with minimal caloric density.",
                "impact": "High Impact",
                "action_tag": "Weight Management",
                "suggested_swap": "Replace half of rice portion with cauliflower rice or steamed broccoli"
            })

        # 3. Glycemic / Blood Sugar Coaching
        if glycemic_data.get("overall_level") in ("Elevated", "Moderate"):
            recs.append({
                "category": "Glycemic & Energy Stability",
                "title": "Buffer Carbohydrates with Fiber & Protein",
                "description": "Refined carbohydrate items were identified. Always consume vegetables or protein before starch to delay gastric emptying and prevent rapid blood sugar spikes.",
                "impact": "High Impact",
                "action_tag": "Blood Sugar Control",
                "suggested_swap": "Switch white rice to brown basmati rice or quinoa"
            })

        # 4. Sodium & Heart Health Coaching
        if sodium_data.get("overall_level") in ("High Risk", "Elevated"):
            recs.append({
                "category": "Cardiovascular Health",
                "title": "Moderate High-Sodium Processed Ingredients",
                "description": f"Purchased items account for {sodium_data.get('sodium_percentage')}% of your daily sodium ceiling. Experiment with citrus zest, cumin, and garlic to flavor meals naturally.",
                "impact": "Preventative",
                "action_tag": "Heart Health",
                "suggested_swap": "Use low-sodium broth or home-ground spices instead of pre-packaged tastemakers"
            })

        # 5. Allergen Warning Action
        critical_allergens = [w for w in allergen_data.get("warnings", []) if w.get("severity") == "CRITICAL_TRIGGER"]
        if critical_allergens:
            first_w = critical_allergens[0]
            recs.append({
                "category": "Allergen Safety Alert",
                "title": f"Verify {first_w.get('allergen_type')} Exposure",
                "description": f"'{first_w.get('item_name')}' contains or may contain {first_w.get('allergen_type')}. Please verify kitchen prep or product packaging to prevent unintended allergic reactions.",
                "impact": "Critical Priority",
                "action_tag": "Safety Warning",
                "suggested_swap": "Request allergen-safe / substitution option from vendor"
            })

        # 6. General Eat Healthy / Balanced Lifestyle
        if len(recs) < 3:
            recs.append({
                "category": "Dietary Balance",
                "title": "Adopt the Balanced Plate Blueprint",
                "description": "Aim for 1/2 of your plate as colorful vegetables, 1/4 as clean protein, and 1/4 as complex, minimally-processed carbohydrates for optimal metabolic wellness.",
                "impact": "General Wellness",
                "action_tag": "Lifestyle Balance",
                "suggested_swap": "Add a raw seasonal vegetable salad to your lunch and dinner"
            })

        return recs

    # ── Historical Trends ─────────────────────────────────────────────────────

    def _compute_historical_summary(
        self,
        db: Session,
        user_id: int,
        current_receipt_id: Optional[int]
    ) -> Dict[str, Any]:
        receipts = (
            db.query(Receipt)
            .filter(Receipt.user_id == user_id)
            .order_by(Receipt.receipt_id.desc())
            .limit(5)
            .all()
        )
        if not receipts or len(receipts) <= 1:
            return {
                "has_trend": False,
                "history_points": [],
                "message": "Upload additional receipts to unlock weekly and multi-haul nutrition trend tracking."
            }

        points = []
        for r in reversed(receipts):
            points.append({
                "receipt_id": r.receipt_id,
                "date": r.date or f"Haul #{r.receipt_id}",
                "merchant": (r.merchant_name or "Store").split(",")[0],
                "total_amount": float(r.total_amount or 0.0),
                "is_current": r.receipt_id == current_receipt_id
            })

        return {
            "has_trend": True,
            "total_hauls_recorded": len(receipts),
            "history_points": points,
            "message": f"Tracking health indicators across your latest {len(receipts)} grocery and canteen hauls."
        }


# Singleton instance
health_intelligence_service = HealthIntelligenceService()
