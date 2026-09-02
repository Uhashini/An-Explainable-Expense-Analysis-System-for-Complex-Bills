"""
Save Money Mode — composable analysis functions for grocery receipt spending.

Sub-features:
  SM-01: Category-wise Spending Distribution
  SM-02: Item-wise Spending Breakdown
  SM-03: Budget Utilization Analysis

Each function is independently importable and testable.
The `run_save_money_analysis` orchestrator chains all three.
"""

from app.services.modes.save_money.category_spending import get_category_spending
from app.services.modes.save_money.item_breakdown import get_item_breakdown
from app.services.modes.save_money.budget_utilization import get_budget_utilization
from app.services.modes.save_money.orchestrator import run_save_money_analysis

__all__ = [
    "get_category_spending",
    "get_item_breakdown",
    "get_budget_utilization",
    "run_save_money_analysis",
]
