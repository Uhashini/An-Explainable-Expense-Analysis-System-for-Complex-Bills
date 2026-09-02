"""
SM-01 — Category-wise Spending Distribution

Groups receipt items by category, sums spending per category,
calculates each category's share (%) of total spend, and identifies
the highest-spending category.

Edge cases handled:
  • Empty receipt → total_spending = 0, empty categories list,
    highest_category with amount 0.
  • Missing / blank category → bucketed as "Uncategorized".
  • Ties for highest category → first category alphabetically wins.
"""

from collections import defaultdict
from typing import List

from app.services.modes.save_money.schemas import (
    CategorySpend,
    CategorySpendingResult,
    ReceiptItem,
)


def get_category_spending(items: List[ReceiptItem]) -> CategorySpendingResult:
    """Compute category-wise spending distribution.

    Args:
        items: List of parsed receipt line-items.

    Returns:
        CategorySpendingResult with totals, per-category breakdown, and the
        highest-spending category.
    """
    # ── Accumulate spend per category ────────────────────────────────────
    category_totals: dict[str, float] = defaultdict(float)
    for item in items:
        cat = (item.category or "").strip() or "Uncategorized"
        effective_price = item.price * (item.quantity if item.quantity else 1)
        category_totals[cat] += effective_price

    total_spending = sum(category_totals.values())

    # ── Build sorted list (descending by amount, alpha on tie) ───────────
    sorted_cats = sorted(
        category_totals.items(),
        key=lambda kv: (-kv[1], kv[0]),
    )

    categories: List[CategorySpend] = []
    for cat, amount in sorted_cats:
        pct = round((amount / total_spending) * 100, 1) if total_spending else 0.0
        categories.append(CategorySpend(category=cat, amount=amount, percentage=pct))

    # ── Highest category (first in sorted list, or a zero sentinel) ──────
    if categories:
        highest_category = categories[0]
    else:
        highest_category = CategorySpend(category="N/A", amount=0, percentage=0)

    return CategorySpendingResult(
        total_spending=total_spending,
        categories=categories,
        highest_category=highest_category,
    )
