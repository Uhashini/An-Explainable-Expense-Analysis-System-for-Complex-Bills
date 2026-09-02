"""
Save Money Mode — Orchestrator

Chains SM-01 → SM-02 → SM-03 into a single pipeline.
SM-03 is only executed when a monthly budget is supplied.
"""

from typing import List, Optional

from app.services.modes.save_money.budget_utilization import get_budget_utilization
from app.services.modes.save_money.category_spending import get_category_spending
from app.services.modes.save_money.item_breakdown import get_item_breakdown
from app.services.modes.save_money.schemas import (
    ReceiptItem,
    SaveMoneyResult,
)


def run_save_money_analysis(
    items: List[ReceiptItem],
    monthly_budget: Optional[float] = None,
    previous_spend: float = 0.0,
    top_n: Optional[int] = None,
) -> SaveMoneyResult:
    """Run the full Save Money analysis pipeline.

    Pipeline:
        1. SM-01  — category-wise spending distribution
        2. SM-02  — item-wise spending breakdown
        3. SM-03  — budget utilization (skipped if ``monthly_budget`` is None)

    Args:
        items:           Parsed receipt line-items.
        monthly_budget:  Optional monthly grocery budget.
        previous_spend:  Accumulated spend earlier in the month (default 0).
        top_n:           If set, SM-02 returns only the top N items.

    Returns:
        SaveMoneyResult combining all three sub-results.
    """
    # ── SM-01 ────────────────────────────────────────────────────────────
    category_result = get_category_spending(items)

    # ── SM-02 ────────────────────────────────────────────────────────────
    item_result = get_item_breakdown(items, top_n=top_n)

    # ── SM-03 (optional) ────────────────────────────────────────────────
    budget_result = None
    if monthly_budget is not None:
        budget_result = get_budget_utilization(
            monthly_budget=monthly_budget,
            current_receipt_total=category_result.total_spending,
            previous_spend=previous_spend,
        )

    return SaveMoneyResult(
        category_spending=category_result,
        item_breakdown=item_result,
        budget_utilization=budget_result,
    )
