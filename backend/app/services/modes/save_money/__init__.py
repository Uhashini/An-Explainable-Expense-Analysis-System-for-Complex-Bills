"""
Save Money Mode — composable analysis functions for grocery receipt spending.

Sub-features:
  SM-01: Category-wise Spending Distribution
  SM-02: Item-wise Spending Breakdown
  SM-03: Budget Utilization Analysis
  SM-04: Weekly / Monthly Spending Trend
  SM-05: Price Deviation Analysis
  SM-06: Category Anomalies / Overspending (Isolation Forest + SHAP)
  SM-07: Purchase Frequency Analysis

Each function is independently importable and testable.
The `run_save_money_analysis` orchestrator chains all sub-modules concurrently.
"""

from app.services.modes.save_money.category_spending import get_category_spending
from app.services.modes.save_money.item_breakdown import get_item_breakdown
from app.services.modes.save_money.budget_utilization import get_budget_utilization
from app.services.modes.save_money.spending_trend import get_spending_trend
from app.services.modes.save_money.price_deviation import get_price_deviations
from app.services.modes.save_money.category_anomalies import detect_category_anomalies, get_category_anomalies
from app.services.modes.save_money.purchase_frequency import get_purchase_frequency
from app.services.modes.save_money.orchestrator import run_save_money_analysis

__all__ = [
    "get_category_spending",
    "get_item_breakdown",
    "get_budget_utilization",
    "get_spending_trend",
    "get_price_deviations",
    "detect_category_anomalies",
    "get_category_anomalies",
    "get_purchase_frequency",
    "run_save_money_analysis",
]
