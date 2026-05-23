"""Constants and enumerations for the Smart Receipt Analysis system."""

from enum import Enum
from typing import Dict, List


class AnalysisMode(str, Enum):
    """Goal-adaptive analysis modes."""
    SAVE_MONEY = "save_money"
    EAT_HEALTHY = "eat_healthy"
    GAIN_MUSCLE = "gain_muscle"
    SMART_INSIGHTS = "smart_insights"


class AnomalySeverity(str, Enum):
    """Severity levels for anomaly alerts."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ItemCategory(str, Enum):
    """Product categories for receipt items."""
    SNACKS = "snacks"
    DAIRY = "dairy"
    STAPLES = "staples"
    FRUITS = "fruits"
    VEGETABLES = "vegetables"
    PROTEIN = "protein"
    GRAINS = "grains"
    BEVERAGES = "beverages"
    FROZEN = "frozen"
    CONDIMENTS = "condiments"
    OTHER = "other"


# Mode Definitions with Core Questions
MODE_DEFINITIONS: Dict[AnalysisMode, Dict] = {
    AnalysisMode.SAVE_MONEY: {
        "core_question": "How do I reduce spend?",
        "description": "Financial Intelligence",
        "features": [
            "Cost deviations",
            "Brand shifts",
            "Missed offers",
            "Budget trajectory",
        ],
    },
    AnalysisMode.EAT_HEALTHY: {
        "core_question": "Is my diet balanced?",
        "description": "Nutritional Intelligence",
        "features": [
            "Processed food ratio",
            "Fruit/vegetable intake",
            "Nutritional diversity",
            "Macronutrient balance",
        ],
    },
    AnalysisMode.GAIN_MUSCLE: {
        "core_question": "Am I eating for performance?",
        "description": "Fitness Intelligence",
        "features": [
            "Protein sufficiency",
            "Calorie adequacy",
            "Macronutrient breakdown",
            "Consistency check",
        ],
    },
    AnalysisMode.SMART_INSIGHTS: {
        "core_question": "What patterns exist?",
        "description": "Behavioral Pattern Intelligence",
        "features": [
            "Category trends",
            "Frequency shifts",
            "Spend distribution",
            "New category detection",
        ],
    },
}

# Nutritional Thresholds
NUTRITION_THRESHOLDS = {
    "processed_food_ratio_max": 0.30,  # 30% max processed food
    "fruit_vegetable_ratio_min": 0.20,  # 20% min fruits/vegetables
    "protein_target_g_per_kg": 2.0,  # grams per kg body weight for muscle gain
    "fiber_daily_min_g": 25,  # minimum daily fiber in grams
    "sodium_daily_max_mg": 2300,  # maximum daily sodium
}

# Anomaly Detection Triggers
ANOMALY_TRIGGERS = {
    "financial": {
        "zscore_threshold": 2.0,  # 2 sigma above baseline
        "ewma_deviation": 0.50,  # 50% deviation from EWMA
    },
    "nutritional": {
        "processed_food_spike": 0.15,  # 15% above baseline
        "vegetable_drop": 0.30,  # 30% below baseline
    },
    "fitness": {
        "protein_gap_percent": 0.20,  # 20% below target
        "consistency_gap_weeks": 1,  # protein sources dropped for >1 week
    },
    "behavioral": {
        "new_category_detected": True,
        "category_frequency_change": 0.40,  # 40% change in frequency
        "bill_value_spike": 2.0,  # 2x normal spend
    },
}

# Category Mappings for Smart Categorization
CATEGORY_KEYWORDS: Dict[ItemCategory, List[str]] = {
    ItemCategory.SNACKS: [
        "chips",
        "wafers",
        "biscuit",
        "cookie",
        "crackers",
        "makhana",
        "nuts",
        "popcorn",
    ],
    ItemCategory.DAIRY: [
        "milk",
        "yogurt",
        "curd",
        "paneer",
        "cheese",
        "butter",
        "ghee",
        "cream",
    ],
    ItemCategory.STAPLES: [
        "rice",
        "wheat",
        "flour",
        "dal",
        "lentils",
        "pulses",
        "beans",
        "oil",
    ],
    ItemCategory.FRUITS: [
        "apple",
        "banana",
        "orange",
        "mango",
        "grapes",
        "strawberry",
        "papaya",
    ],
    ItemCategory.VEGETABLES: [
        "carrot",
        "spinach",
        "tomato",
        "onion",
        "potato",
        "broccoli",
        "cauliflower",
        "cucumber",
    ],
    ItemCategory.PROTEIN: [
        "egg",
        "chicken",
        "fish",
        "mutton",
        "meat",
        "tofu",
        "soya",
        "paneer",
    ],
    ItemCategory.GRAINS: [
        "bread",
        "oats",
        "cereal",
        "cornflakes",
        "ragi",
        "quinoa",
    ],
    ItemCategory.BEVERAGES: [
        "water",
        "juice",
        "coffee",
        "tea",
        "milk",
        "smoothie",
        "coke",
        "sprite",
    ],
    ItemCategory.FROZEN: [
        "ice cream",
        "frozen vegetables",
        "frozen fruit",
        "frozen meals",
    ],
    ItemCategory.CONDIMENTS: [
        "salt",
        "pepper",
        "spice",
        "masala",
        "sauce",
        "ketchup",
        "mayo",
    ],
}

# Nutritional Data Templates (to be populated from Neo4j)
COMMON_ITEMS_NUTRITION = {
    "egg": {"protein_g": 6.3, "calories": 78, "category": ItemCategory.PROTEIN},
    "paneer_100g": {
        "protein_g": 25,
        "calories": 265,
        "category": ItemCategory.PROTEIN,
    },
    "chicken_100g": {"protein_g": 31, "calories": 165, "category": ItemCategory.PROTEIN},
    "milk_200ml": {"protein_g": 6.6, "calories": 134, "category": ItemCategory.DAIRY},
    "yogurt_100g": {"protein_g": 3.5, "calories": 59, "category": ItemCategory.DAIRY},
    "dal_cooked_100g": {
        "protein_g": 9,
        "calories": 101,
        "category": ItemCategory.STAPLES,
    },
    "rice_cooked_100g": {
        "protein_g": 2.7,
        "calories": 130,
        "category": ItemCategory.STAPLES,
    },
    "bread_1_slice": {
        "protein_g": 4,
        "calories": 77,
        "category": ItemCategory.GRAINS,
    },
    "banana_1": {"protein_g": 1.1, "calories": 89, "category": ItemCategory.FRUITS},
    "chips_30g": {"protein_g": 2, "calories": 157, "category": ItemCategory.SNACKS},
    "makhana_30g": {
        "protein_g": 9.7,
        "calories": 106,
        "category": ItemCategory.SNACKS,
    },
}

# Anomaly Severity Mapping
SEVERITY_RANGES = {
    AnomalySeverity.LOW: (0.5, 0.65),
    AnomalySeverity.MEDIUM: (0.65, 0.8),
    AnomalySeverity.HIGH: (0.8, 0.92),
    AnomalySeverity.CRITICAL: (0.92, 1.0),
}

# Recommendation Confidence Levels
CONFIDENCE_THRESHOLDS = {
    "high": 0.85,
    "medium": 0.70,
    "low": 0.50,
}
