"""
Pydantic schemas for Save Money mode inputs and outputs.

Uses Pydantic v1 syntax to match the project's pinned dependency (pydantic<2.0.0).
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ─── Input Schemas ───────────────────────────────────────────────────────────

class ReceiptItem(BaseModel):
    """A single line-item from a parsed receipt."""
    name: str
    category: str = "Uncategorized"
    price: float
    quantity: Optional[float] = None
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
    total_spending: float
    categories: List[CategorySpend]
    highest_category: CategorySpend

# ─── SM-02: Item Breakdown ──────────────────────────────────────────────────

class ItemExpense(BaseModel):
    """A single item with its effective price (price × quantity)."""
    name: str
    price: float = Field(..., description="Effective cost: unit_price × quantity")

class ItemBreakdownResult(BaseModel):
    """SM-02 output: item-level spending sorted descending."""
    sorted_items: List[ItemExpense]
    highest_expense: ItemExpense

# ─── SM-03: Budget Utilization ──────────────────────────────────────────────

class BudgetUtilizationResult(BaseModel):
    """SM-03 output: budget vs. actual comparison."""
    total_spent: float
    remaining: float
    utilization: float = Field(..., description="Percentage of budget used, rounded to 1 decimal")
    status: str
    
# ─── SM-07: Price Deviation ──────────────────────────────────────────────────

class PriceDeviationItem(BaseModel):
    """A single item's price deviation against historical averages."""
    item_name: str
    current_price: float
    historical_average: Optional[float]
    difference: float
    change_percentage: float
    status: str

class PriceDeviationResult(BaseModel):
    """SM-07 output: price deviations list."""
    analysis_id: str = "SM-07"
    price_deviation: List[PriceDeviationItem]

# ─── Orchestrator ───────────────────────────────────────────────────────────

class SaveMoneyResult(BaseModel):
    """Combined output of all Save Money analyses."""
    category_spending: CategorySpendingResult
    item_breakdown: ItemBreakdownResult
    budget_utilization: Optional[BudgetUtilizationResult] = None
    price_deviation: Optional[PriceDeviationResult] = None

