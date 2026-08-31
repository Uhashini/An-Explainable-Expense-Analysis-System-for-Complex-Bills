from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.database.postgres_client import get_db, FoodItem, Nutrition, HealthIndicators

router = APIRouter()

@router.get("/{product_id}", tags=["Products"])
def get_product(product_id: int, db: Session = Depends(get_db)):
    food = db.query(FoodItem).filter(FoodItem.food_id == product_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")
        
    nutrition = db.query(Nutrition).filter(Nutrition.food_id == product_id).first()
    health = db.query(HealthIndicators).filter(HealthIndicators.food_id == product_id).first()
    
    def _safe_float(val):
        return float(val) if val is not None else None

    return {
        "status": "success",
        "data": {
            "food_id": food.food_id,
            "name": food.canonical_name,
            "category": food.category,
            "subcategory": food.subcategory,
            "serving_size": _safe_float(food.serving_size),
            "serving_unit": food.serving_unit,
            "nutrition": {
                "calories_kcal": _safe_float(nutrition.calories_kcal) if nutrition else None,
                "protein_g": _safe_float(nutrition.protein_g) if nutrition else None,
                "carbohydrates_g": _safe_float(nutrition.carbohydrates_g) if nutrition else None,
                "fat_g": _safe_float(nutrition.fat_g) if nutrition else None,
                "fiber_g": _safe_float(nutrition.fiber_g) if nutrition else None,
                "sugar_g": _safe_float(nutrition.sugar_g) if nutrition else None,
                "sodium_mg": _safe_float(nutrition.sodium_mg) if nutrition else None,
                "calcium_mg": _safe_float(nutrition.calcium_mg) if nutrition else None,
                "iron_mg": _safe_float(nutrition.iron_mg) if nutrition else None,
                "potassium_mg": _safe_float(nutrition.potassium_mg) if nutrition else None,
                "vitamin_c_mg": _safe_float(nutrition.vitamin_c_mg) if nutrition else None,
                "vitamin_a_ug": _safe_float(nutrition.vitamin_a_ug) if nutrition else None,
            },
            "health": {
                "health_score": health.health_score if health else None,
                "processed_level": health.processed_level if health else None,
                "is_processed": health.is_processed if health else None,
                "high_protein": health.high_protein if health else None,
                "high_fiber": health.high_fiber if health else None,
                "high_sugar": health.high_sugar if health else None,
                "high_fat": health.high_fat if health else None,
                "high_sodium": health.high_sodium if health else None,
                "vegetarian": health.vegetarian if health else None,
                "vegan": health.vegan if health else None,
                "gluten_free": health.gluten_free if health else None,
                "allergen": health.allergen if health else None,
            }
        }
    }
