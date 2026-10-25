# Gain Muscle Mode: Technical Analysis Specifications

The **Gain Muscle Mode** is designed for fitness enthusiasts focusing on macronutrient intake, specifically protein sufficiency, quality, and cost efficiency. This module bypasses machine learning in favor of deterministic nutritional calculations and time-series tracking. The engine computes 5 distinct analytical metrics (GM-01 to GM-05) for each uploaded receipt.

---

## GM-01: Protein Availability Analysis
Calculates the absolute amount of protein available in the purchased grocery basket and assesses overall protein density.

**Input:** `ReceiptItems` (Quantity, Price), `FoodDatabase` (Protein per 100g, Calories).
**Processing:** 
1. For every item, calculate Protein: `Quantity × Protein_per_100g`.
2. Sum to find the `Total Basket Protein`.
3. Calculate basket-level metrics: `Protein per ₹` and `Protein per 100 kcal`.

**Output JSON:**
```json
{
  "analysis_type": "GM-01",
  "receipt_id": "R001",
  "result_json": {
    "total_protein_g": 185,
    "basket_protein_per_rupee": 0.12,
    "basket_protein_per_100kcal": 7.5,
    "protein_sources": [
      {
        "item": "Chicken",
        "protein_g": 62
      },
      {
        "item": "Eggs",
        "protein_g": 36
      }
    ]
  }
}
```

---

## GM-02: Protein Quality Analysis
Evaluates the sources of protein purchased to determine which ones offer the best quality based on biological value and caloric density.

**Input:** `Protein Content` (from GM-01), `FoodDatabase` (Protein source type, Protein quality classification).
**Processing:** 
1. For each protein-containing item, calculate Protein Density: `Protein / Calories`.
2. Append the database's static protein-quality classification (e.g., High, Medium, Low based on amino acid profiles).

**Output JSON:**
```json
{
  "analysis_type": "GM-02",
  "receipt_id": "R001",
  "result_json": {
    "protein_sources": [
      {
        "item": "Eggs",
        "protein_density": 0.08,
        "quality": "High"
      },
      {
        "item": "Lentils",
        "protein_density": 0.07,
        "quality": "High"
      }
    ]
  }
}
```

---

## GM-03: Protein Cost Efficiency Analysis
Determines which foods give the user the most protein for the money spent, representing a strong intersection between Gain Muscle and Save Money modes.

**Input:** `Item Price` from ReceiptItems, `Protein Content` from FoodDatabase.
**Processing:** 
1. Calculate the efficiency ratio: `Total Protein Purchased / Item Price`.
2. Rank the items from highest protein-per-rupee to lowest.

**Output JSON:**
```json
{
  "analysis_type": "GM-03",
  "receipt_id": "R001",
  "result_json": {
    "cost_efficiency_ranking": [
      {
        "item": "Eggs",
        "protein_per_rupee": 0.45
      },
      {
        "item": "Chicken",
        "protein_per_rupee": 0.38
      },
      {
        "item": "Paneer",
        "protein_per_rupee": 0.21
      }
    ]
  }
}
```

---

## GM-04: High-Protein Food Recommendations
An internal rule-based recommendation engine that suggests foods the user should buy next time to optimize their muscle-building goals.

**Input:** `FoodDatabase` (food_name, protein_per_100g, calories_per_100g, reference_price, protein_quality).
**Processing:** 
1. Identify foods in the database with high protein density + good protein quality + good protein cost efficiency.
2. Filter out items the user is already buying efficiently.
3. Rank the recommended alternatives and provide a clear justification.

**Output JSON:**
```json
{
  "analysis_type": "GM-04",
  "receipt_id": "R001",
  "result_json": {
    "recommendations": [
      {
        "rank": 1,
        "item": "Eggs",
        "reason": "High quality, highly efficient (0.45g/₹)"
      },
      {
        "rank": 2,
        "item": "Chicken",
        "reason": "High quality, efficient (0.38g/₹)"
      },
      {
        "rank": 3,
        "item": "Lentils",
        "reason": "High density, cost effective plant-based source"
      },
      {
        "rank": 4,
        "item": "Greek Yogurt",
        "reason": "High protein density and excellent quality"
      }
    ]
  }
}
```

---

## GM-05: Protein Purchasing Trend Analysis
A time-series tracking module that monitors how the user's protein purchasing behavior changes over time. (No ML required; deterministic line-graph data).

**Input:** `Historical Receipts`, `Historical GM-01 Outputs`.
**Processing:** 
1. Aggregate the total protein purchased per receipt across historical months.
2. Track the frequency of protein-rich item purchases and total protein spending.
3. Output the time-series arrays for frontend line-graph rendering.

**Output JSON:**
```json
{
  "analysis_type": "GM-05",
  "receipt_id": "R001",
  "result_json": {
    "status": "Increasing",
    "trend_data": [
      {
        "month": "June",
        "total_protein_g": 420,
        "protein_spending": 1200
      },
      {
        "month": "July",
        "total_protein_g": 510,
        "protein_spending": 1450
      },
      {
        "month": "August",
        "total_protein_g": 680,
        "protein_spending": 1600
      }
    ]
  }
}
```
