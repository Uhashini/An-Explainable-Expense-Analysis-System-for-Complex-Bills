"""
Pydantic schemas for Save Money mode inputs and outputs.

Uses Pydantic v1 syntax to match the project's pinned dependency (pydantic<2.0.0).
Covers all 7 standardized Save Money analyses:
  • SM-01: Category Spending Distribution
  • SM-02: Item Breakdown
  • SM-03: Budget Utilization
  • SM-04: Weekly / Monthly Spending Trend
  • SM-05: Price Deviation Analysis
  • SM-06: Category Overspending & Isolation Forest Anomaly Detection (with SHAP)
  • SM-07: Purchase Frequency Analysis
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ─── Input Schemas ───────────────────────────────────────────────────────────

class ReceiptItem(BaseModel):
    """A single line-item from a parsed receipt."""
    name: str
    category: str = "Uncategorized"
    price: float
    quantity: Optional[float] = 1.0
    matched_food_id: Optional[int] = None
    food_id: Optional[int] = None


class Receipt(BaseModel):
    """A parsed receipt containing line-items and a date."""
    items: List[ReceiptItem]
    date: str


# ─── SM-01: Category Spending ───────────────────────────────────────────────

class CategorySpend(BaseModel):
    """Spending summary for a single category."""
    category: str
    amount: float
    percentage: float = Field(..., description="Percentage of total spend, rounded to 1 decimal")


class CategorySpendingResult(BaseModel):
    """SM-01 output: category-level spending distribution."""
    analysis_id: str = "SM-01"
    total_spending: float
    categories: List[CategorySpend]
    highest_category: CategorySpend


# ─── SM-02: Item Breakdown ──────────────────────────────────────────────────

class ItemExpense(BaseModel):
    """A single item with its effective price (unit_price × quantity)."""
    name: str
    price: float = Field(..., description="Effective cost: unit_price × quantity")
    unit_price: Optional[float] = None
    quantity: Optional[float] = 1.0
    category: Optional[str] = None


class ItemBreakdownResult(BaseModel):
    """SM-02 output: item-level spending sorted descending."""
    analysis_id: str = "SM-02"
    sorted_items: List[ItemExpense]
    highest_expense: ItemExpense


# ─── SM-03: Budget Utilization ──────────────────────────────────────────────

class BudgetUtilizationResult(BaseModel):
    """SM-03 output: budget vs. actual comparison."""
    analysis_id: str = "SM-03"
    monthly_budget: float = 0.0
    total_spent: float
    remaining: float
    utilization: float = Field(..., description="Percentage of budget used, rounded to 1 decimal")
    status: str


# ─── SM-04: Spending Trend ──────────────────────────────────────────────────

class MonthlySpendPoint(BaseModel):
    """A single month/week historical spending data point."""
    period: str
    amount: float
    is_anomaly: bool = False
    trend_val: Optional[float] = None


class SpendingTrendResult(BaseModel):
    """SM-04 output: multi-period spending trend."""
    analysis_id: str = "SM-04"
    previous_average: float
    current_spending: float
    change_percentage: float
    trend: str
    monthly_history: List[MonthlySpendPoint] = []
    weekly_history: Optional[List[Dict[str, Any]]] = []
    anomalies: List[str] = []


# ─── SM-05: Price Deviation ──────────────────────────────────────────────────

class PriceDeviationItem(BaseModel):
    """A single item's price deviation against historical averages."""
    item_name: str
    current_price: float
    historical_average: Optional[float] = None
    difference: float = 0.0
    change_percentage: float = 0.0
    status: str


class PriceDeviationResult(BaseModel):
    """SM-05 output: price deviations list."""
    analysis_id: str = "SM-05"
    price_deviation: List[PriceDeviationItem]


# ─── SM-06: Category Overspending / Anomalies (Isolation Forest + SHAP) ──────

class ShapContribution(BaseModel):
    """Feature importance attribution computed via SHAP."""
    category: str
    shap_value: float
    contribution_percentage: float
    current_spend: float
    historical_mean: float


class CategoryAnomalyItem(BaseModel):
    """Anomaly detection result with Isolation Forest and SHAP attribution."""
    category: str
    historical_average: float
    current_spending: float
    is_anomaly: bool
    shap_attribution: Optional[float] = None
    explanation: Optional[str] = None


class CategoryAnomaliesResult(BaseModel):
    """SM-06 output: Category anomaly report."""
    analysis_id: str = "SM-06"
    is_basket_anomalous: bool = False
    model_used: str = "Isolation Forest + SHAP"
    anomalous_categories: List[CategoryAnomalyItem] = []
    primary_contributor: Optional[str] = None
    shap_contributions: List[ShapContribution] = []
    summary_explanation: Optional[str] = None


# ─── SM-07: Purchase Frequency ──────────────────────────────────────────────

class PurchaseFrequencyItem(BaseModel):
    """Purchase recurrence metrics for a specific grocery item."""
    item_name: str
    purchase_count: int
    purchases_per_month: float
    purchases_per_week: float
    first_purchased: Optional[str] = None
    last_purchased: Optional[str] = None
    is_frequent_staple: bool = False
    category: Optional[str] = None


class PurchaseFrequencyResult(BaseModel):
    """SM-07 output: frequency of purchased goods across historical receipts."""
    analysis_id: str = "SM-07"
    total_unique_items: int = 0
    frequent_staples: List[PurchaseFrequencyItem] = []
    all_frequencies: List[PurchaseFrequencyItem] = []


# ─── Master Combined Output ─────────────────────────────────────────────────

class SaveMoneyResult(BaseModel):
    """Combined output of all 7 Save Money analyses."""
    category_spending: CategorySpendingResult
    item_breakdown: ItemBreakdownResult
    budget_utilization: Optional[BudgetUtilizationResult] = None
    spending_trend: Optional[SpendingTrendResult] = None
    price_deviation: Optional[PriceDeviationResult] = None
    category_anomalies: Optional[CategoryAnomaliesResult] = None
    purchase_frequency: Optional[PurchaseFrequencyResult] = None
