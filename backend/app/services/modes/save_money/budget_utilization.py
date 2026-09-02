"""
SM-03 — Budget Utilization Analysis

Compares actual spending (previous + current receipt) against the
user's monthly grocery budget and assigns a status label.

Thresholds:
  • monthlyBudget == 0     → "No Budget Set"  (avoids divide-by-zero)
  • utilization  < 70%     → "✅ On Track"
  • 70% ≤ util  ≤ 90%     → "⚠ Near Budget Limit"
  • 90% < util  ≤ 100%    → "🔶 Almost Over Budget"
  • utilization  > 100%    → "🚫 Over Budget"

Edge cases handled:
  • monthlyBudget = 0 → special status, utilization = 0.
  • previousSpend defaults to 0 when not provided.
  • Negative remaining is valid (over-spend).
"""

from app.services.modes.save_money.schemas import BudgetUtilizationResult

# Status label constants
STATUS_NO_BUDGET = "No Budget Set"
STATUS_ON_TRACK = "✅ On Track"
STATUS_NEAR_LIMIT = "⚠ Near Budget Limit"
STATUS_ALMOST_OVER = "🔶 Almost Over Budget"
STATUS_OVER_BUDGET = "🚫 Over Budget"


def _resolve_status(utilization: float, budget_is_zero: bool) -> str:
    """Map utilization percentage to a human-readable status string."""
    if budget_is_zero:
        return STATUS_NO_BUDGET
    if utilization < 70:
        return STATUS_ON_TRACK
    if utilization <= 90:
        return STATUS_NEAR_LIMIT
    if utilization <= 100:
        return STATUS_ALMOST_OVER
    return STATUS_OVER_BUDGET


def get_budget_utilization(
    monthly_budget: float,
    current_receipt_total: float,
    previous_spend: float = 0.0,
) -> BudgetUtilizationResult:
    """Compute budget utilization against monthly grocery budget.

    Args:
        monthly_budget:        The user's declared monthly grocery budget.
        current_receipt_total:  Total from the current receipt
                                (typically ``CategorySpendingResult.total_spending``).
        previous_spend:         Accumulated spend earlier in the month
                                (defaults to 0).

    Returns:
        BudgetUtilizationResult with total_spent, remaining, utilization %,
        and a status label.
    """
    total_spent = previous_spend + current_receipt_total
    remaining = monthly_budget - total_spent

    budget_is_zero = monthly_budget == 0
    if budget_is_zero:
        utilization = 0.0
    else:
        utilization = round((total_spent / monthly_budget) * 100, 1)

    status = _resolve_status(utilization, budget_is_zero)

    return BudgetUtilizationResult(
        total_spent=total_spent,
        remaining=remaining,
        utilization=utilization,
        status=status,
    )
