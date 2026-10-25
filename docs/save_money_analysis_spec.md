# Save Money Mode: Technical Analysis Specifications

The **Save Money Mode** evaluates the user's spending habits, tracks budgets, and utilizes machine learning (Isolation Forest + SHAP) to detect and explain financial anomalies. The engine computes 7 distinct analytical metrics (SM-01 to SM-07) for each uploaded receipt.

---

## SM-01: Category-wise Spending Distribution
Calculates the total amount spent per category and its percentage of the total receipt value.

**Input:** `ReceiptItems` (list of extracted items with their assigned categories and prices).
**Processing:** Group items by category, sum their prices, and calculate the percentage relative to the grand total.

**Output JSON:**
```json
{
  "analysis_type": "SM-01",
  "receipt_id": "R001",
  "categories": [
    {
      "name": "Dairy",
      "amount": 320,
      "percentage": 35.6
    },
    {
      "name": "Fruits",
      "amount": 210,
      "percentage": 23.4
    },
    {
      "name": "Vegetables",
      "amount": 180,
      "percentage": 20.0
    }
  ],
  "highest_category": "Dairy",
  "total_spending": 899
}
```

---

## SM-02: Item-wise Spending Breakdown
Breaks down the spending for individual items to identify the most expensive purchases on the receipt.

**Input:** `ReceiptItems`.
**Processing:** Sort items by descending price to highlight the largest individual expenses.

**Output JSON:**
```json
{
  "analysis_type": "SM-02",
  "receipt_id": "R001",
  "items": [
    {
      "name": "Olive Oil 1L",
      "amount": 450,
      "percentage_of_total": 50.05
    },
    {
      "name": "Cheddar Cheese",
      "amount": 250,
      "percentage_of_total": 27.80
    }
  ]
}
```

---

## SM-03: Budget Utilization Analysis
Evaluates how the current purchase impacts the user's predefined grocery budget.

**Input:** `Current receipt total`, `User's monthly/weekly budget target`, `Historical spend this cycle`.
**Processing:** Add the new receipt total to the previously spent amount and calculate the remaining budget and utilization percentage.

**Output JSON:**
```json
{
  "analysis_type": "SM-03",
  "receipt_id": "R001",
  "budget": 3000,
  "spent": 2450,
  "remaining": 550,
  "utilization_percent": 81.7,
  "status": "Within Budget"
}
```

---

## SM-04: Weekly/Monthly Spending Trend
Analyzes the spending trajectory by comparing current cumulative spending against historical averages.

**Input:** `Historical receipts up to the current receipt`.
**Processing:** Calculate the moving average of previous periods and compare it to the current period's total.

**Output JSON:**
```json
{
  "analysis_type": "SM-04",
  "receipt_id": "R001",
  "current_spending": 2650,
  "previous_average": 2410,
  "change_percent": 9.95,
  "trend": "Increasing"
}
```

---

## SM-05: Price Deviation Analysis
Detects specific items whose current price is unusually higher than what the user historically pays (e.g., inflation, missing a discount, or switching to a premium brand).

**Input:** `Current receipt items`, `Historical purchase database`.
**Processing:** 
1. For each item on the receipt, fetch past purchase prices (e.g., Milk: 65, 67, 66, 66, 65).
2. Calculate the historical average, lowest, and highest prices.
3. Compare the current price (e.g., 79) to the historical average (66).
4. If the difference exceeds a predefined threshold, flag the item.

**Output JSON:**
```json
{
  "analysis_type": "SM-05",
  "receipt_id": "R001",
  "price_deviations": [
    {
      "item": "Milk",
      "historical_average": 66,
      "current_price": 79,
      "difference": 13,
      "percentage": 19.7,
      "status": "Higher than usual"
    },
    {
      "item": "Cheese",
      "historical_average": 245,
      "current_price": 250,
      "difference": 5,
      "percentage": 2.0,
      "status": "Normal"
    }
  ]
}
```

---

## SM-06: Category Overspending Detection (Anomaly & SHAP)
Determines whether the macro-spending pattern of the current receipt is abnormal compared to the user's historical shopping behavior.

**Input:** `Current receipt`, `Historical receipts`.
**Processing:**
1. Aggregate the spending for the current receipt into categories (Dairy: 980, Fruit: 320, etc.).
2. Represent the receipt as a continuous feature vector: `[Dairy, Fruit, Vegetables, Grain, Snacks, Beverage, Frozen]`.
3. Pass the vector into an **Isolation Forest** trained on the user's historical receipt vectors.
4. If the Isolation Forest predicts an anomaly, run **SHAP (Shapley Additive Explanations)** to explain exactly which category feature contributed the most to the anomaly score.

**Output JSON:**
```json
{
  "analysis_type": "SM-06",
  "receipt_id": "R001",
  "is_anomaly": true,
  "anomaly_score": 0.91,
  "overspent_categories": [
    {
      "category": "Dairy",
      "expected": 320,
      "actual": 980,
      "difference": 660
    }
  ],
  "shap_explanation": [
    {
      "feature": "Dairy Spending",
      "impact": 0.73
    },
    {
      "feature": "Snack Spending",
      "impact": 0.08
    }
  ]
}
```

---

## SM-07: Purchase Frequency Analysis
Identifies the grocery items that are purchased most frequently over time, mapping out the user's recurring staple shopping patterns.

**Input:** `Current receipt`, `Historical receipts`.
**Processing:** 
1. Iterate through all historical receipts and read all purchased items.
2. Update the absolute purchase count for each item.
3. Calculate the monthly frequency rate.
4. Rank the items by purchase frequency.

**Output JSON:**
```json
{
  "analysis_type": "SM-07",
  "receipt_id": "R001",
  "frequent_items": [
    {
      "item": "Milk",
      "purchase_count": 18,
      "monthly_frequency": 6.0
    },
    {
      "item": "Bread",
      "purchase_count": 14,
      "monthly_frequency": 4.7
    },
    {
      "item": "Eggs",
      "purchase_count": 12,
      "monthly_frequency": 4.0
    }
  ]
}
```
