# Eat Healthy Mode: Technical Analysis Specifications

The **Eat Healthy Mode** evaluates the nutritional value and dietary quality of a user's grocery receipt. It combines deterministic rule-based nutritional calculations with machine learning (Change Point Detection) to track long-term dietary patterns. The engine computes 8 distinct analytical metrics (EH-01 to EH-08) for each uploaded receipt.

---

## EH-01: Food Group Distribution Analysis
Analyzes the distribution of purchased items across fundamental food groups and calculates a diversity score.

**Input:** `ReceiptItems`, `FoodDatabase`.
**Processing:** 
1. Group purchased items by predefined food groups (e.g., Grains, Dairy, Fruits, Protein, Vegetables).
2. Calculate the item distribution percentage: `(Group Item Count / Total Item Count) * 100`.
3. Calculate Food-Group Diversity: `(Unique Groups Purchased / Total Defined Groups) * 100`.

**Output JSON:**
```json
{
  "analysis_type": "EH-01",
  "receipt_id": "R001",
  "food_groups": [
    {
      "name": "Grains",
      "item_count": 2,
      "percentage": 40.0
    },
    {
      "name": "Dairy",
      "item_count": 1,
      "percentage": 20.0
    },
    {
      "name": "Fruits",
      "item_count": 1,
      "percentage": 20.0
    },
    {
      "name": "Protein",
      "item_count": 1,
      "percentage": 20.0
    },
    {
      "name": "Vegetables",
      "item_count": 0,
      "percentage": 0.0
    }
  ],
  "unique_groups": 4,
  "total_groups": 5,
  "diversity_score": 80.0
}
```

---

## EH-02: Macronutrient Distribution Analysis
Calculates the absolute macro-nutrient weight (grams) and total calorie breakdown for the entire grocery basket.

**Input:** `ReceiptItems` (quantity), `FoodDatabase` (protein_per_unit, carbs_per_unit, fat_per_unit, calories_per_unit).
**Processing:** 
1. Multiply per-unit macros by the purchased quantity for each item.
2. Aggregate total Protein (g), Carbohydrates (g), and Fat (g).
3. Convert macros to calories: `Protein × 4`, `Carbs × 4`, `Fat × 9`.
4. Calculate the percentage distribution of calories by macronutrient type.

**Output JSON:**
```json
{
  "analysis_type": "EH-02",
  "receipt_id": "R001",
  "result_json": {
    "total_protein_g": 82.5,
    "total_carbohydrates_g": 245.0,
    "total_fat_g": 68.2,
    "protein_calories": 330.0,
    "carbohydrate_calories": 980.0,
    "fat_calories": 613.8,
    "total_calories": 1923.8,
    "distribution": {
      "protein_percent": 17.2,
      "carbohydrate_percent": 51.0,
      "fat_percent": 31.9
    }
  }
}
```

---

## EH-03: Micronutrient Coverage Analysis
Evaluates the presence of essential vitamins and minerals against a predefined required baseline.

**Input:** `ReceiptItems`, `FoodDatabase` (Vitamins & Minerals profile).
**Processing:** 
1. Map each item to its constituent vitamins and minerals (e.g., Spinach → Vitamin A, C, Iron).
2. Combine nutrients across the whole receipt.
3. Calculate Coverage %: `(Available Nutrients / Required Nutrients) * 100`.

**Output JSON:**
```json
{
  "analysis_type": "EH-03",
  "receipt_id": "R001",
  "result_json": {
    "vitamin_coverage_percent": 75.0,
    "mineral_coverage_percent": 80.0,
    "overall_coverage_percent": 77.5,
    "covered": ["Vitamin A", "Vitamin C", "Vitamin B12", "Iron", "Calcium"],
    "missing": ["Vitamin E", "Magnesium"]
  }
}
```

---

## EH-04: Ultra-Processed Food Analysis
Utilizes the NOVA classification system to assess the level of food processing in the basket.

**Input:** `ReceiptItems`, `FoodDatabase` (NOVA class mapping 1-4).
**Processing:** 
1. Fetch the NOVA class for each item (NOVA 1: Unprocessed, NOVA 2: Ingredients, NOVA 3: Processed, NOVA 4: Ultra-Processed).
2. Group items by class.
3. Calculate Total Processed Food % `(NOVA 3 + 4 / Total) * 100`.
4. Calculate Ultra-Processed Food % `(NOVA 4 / Total) * 100`.

**Output JSON:**
```json
{
  "analysis_type": "EH-04",
  "receipt_id": "R001",
  "result_json": {
    "nova_distribution": {
      "nova_1": 45,
      "nova_2": 10,
      "nova_3": 20,
      "nova_4": 25
    },
    "processed_food_percent": 45.0,
    "ultra_processed_percent": 25.0,
    "whole_food_percent": 45.0,
    "ultra_processed_items": [
      "Instant Noodles",
      "Soft Drink",
      "Packaged Cookies"
    ]
  }
}
```

---

## EH-05: Healthy Basket Score
A single summary indicator grading the overall dietary quality of the receipt. **Crucial:** This module does not recalculate data; it strictly consumes the outputs of EH-01 through EH-04.

**Input:** Outputs of `EH-01`, `EH-02`, `EH-03`, `EH-04`.
**Processing:** 
1. Normalize selected indicators to a 0–100 scale.
2. Apply a rule-based weighted formula to ensure explainability:
   `Basket Score = (Diversity × 0.20) + (Micronutrient Coverage × 0.30) + (Macro Balance × 0.25) + (Processing Quality × 0.25)`.

**Output JSON:**
```json
{
  "analysis_type": "EH-05",
  "receipt_id": "R001",
  "result_json": {
    "healthy_score": 74,
    "grade": "B",
    "components": {
      "food_group_diversity": 80,
      "micronutrient_coverage": 70,
      "macronutrient_balance": 85,
      "processing_quality": 60
    }
  }
}
```

---

## EH-06: Nutrient Gap Detection
Translates analytical data into actionable gaps by pinpointing exactly what is missing from the diet.

**Input:** Outputs of `EH-01`, `EH-03`, `FoodDatabase`.
**Processing:** 
1. Extract nutrients with low coverage directly from EH-03.
2. Extract missing food groups (count = 0) from EH-01.
3. Apply a predefined threshold to formulate the gap summary.

**Output JSON:**
```json
{
  "analysis_type": "EH-06",
  "receipt_id": "R001",
  "result_json": {
    "nutrient_gaps": [
      {
        "nutrient": "Vitamin D",
        "coverage_percent": 45
      },
      {
        "nutrient": "Magnesium",
        "coverage_percent": 30
      }
    ],
    "missing_food_groups": ["Whole Grains"]
  }
}
```

---

## EH-07: Healthy Food Swap Recommendations
Rule-based recommendation engine that identifies poor nutritional choices and suggests healthier alternatives found in the user's local context/database.

**Input:** `ReceiptItems`, `FoodDatabase` (Alternative mapping schema).
**Processing:** 
1. Identify items with poor traits using EH-02/EH-04.
2. Query the FoodDatabase for alternatives comparing protein, sugar, sodium, and NOVA processing level.
3. Select the best alternative and formulate a human-readable reason. *Only generate swaps when a meaningful alternative exists.*

**Output JSON:**
```json
{
  "analysis_type": "EH-07",
  "receipt_id": "R001",
  "result_json": {
    "swaps": [
      {
        "current_item": "White Bread",
        "recommended_item": "Whole Wheat Bread",
        "reason": "Higher fiber and lower processing",
        "improvement": "Better nutritional quality"
      },
      {
        "current_item": "Sugary Cereal",
        "recommended_item": "Oats",
        "reason": "Lower sugar and less processed"
      }
    ]
  }
}
```

---

## EH-08: Dietary Pattern Change Detection (ML)
Machine learning module utilizing **Change Point Detection** to identify sustained behavioral shifts in the user's dietary habits over a long-term time series, avoiding the noise of single anomalous receipts.

**Input:** `Historical Receipts`, Outputs of `EH-01`, `EH-04`, `EH-05`.
**Processing:** 
1. Build a time-series feature vector for each historical receipt/week (e.g., `[Date, HealthyScore, NOVA4%, Fruits%, Vegetables%, Protein%]`).
2. Run a Change Point Detection algorithm on the time series array.
3. If a change point is found, compare the recent baseline to the prior baseline to classify the pattern as `Improving`, `Stable`, or `Declining`.

**Output JSON:**
```json
{
  "analysis_type": "EH-08",
  "receipt_id": "R010",
  "result_json": {
    "status": "Improving",
    "change_point_detected": true,
    "indicators": {
      "healthy_score_change_percent": 18.4,
      "processed_food_change_percent": -22.5,
      "fruit_vegetable_change_percent": 15.2
    },
    "main_change": "Improved dietary quality"
  }
}
```
