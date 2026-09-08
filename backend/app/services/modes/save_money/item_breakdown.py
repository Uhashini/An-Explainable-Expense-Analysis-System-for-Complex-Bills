"""
SM-02 — Item-wise Spending Breakdown

Sorts individual receipt items descending by effective price
(price × quantity) to surface the most expensive purchases.

Tie-breaking:  When two items have the same effective price,
``highest_expense`` returns the **first** item encountered in the
original list.  This is documented and deterministic.

Edge cases handled:
  • Empty receipt → empty sorted_items, highest_expense with price 0.
  • Zero-price items → included in the list (sorted to bottom).
  • Duplicate item names → all kept (they are distinct line-items).
  • ``topN`` parameter → slices sorted list to first N items.
"""

from typing import List, Optional

from app.services.modes.save_money.schemas import (
    ItemBreakdownResult,
    ItemExpense,
    ReceiptItem,
)


def _effective_price(item: ReceiptItem) -> float:
    """Compute unit_price × quantity (defaults quantity to 1)."""
    return item.price * (item.quantity if item.quantity else 1)


def get_item_breakdown(
    items: List[ReceiptItem],
    top_n: Optional[int] = None,
) -> ItemBreakdownResult:
    """Compute item-wise spending breakdown.

    Args:
        items:  List of parsed receipt line-items.
        top_n:  If provided, return only the top N most expensive items.
                ``highest_expense`` is always the overall most expensive
                item regardless of ``top_n``.

    Returns:
        ItemBreakdownResult with the sorted item list and the single
        highest-expense item.
    """
    total_spending = sum(_effective_price(item) for item in items)

    # ── Build effective-price list ──────────────────────────────────────
    expenses: List[ItemExpense] = []
    for item in items:
        eff_price = _effective_price(item)
        pct = round((eff_price / total_spending) * 100, 1) if total_spending > 0 else 0.0
        expenses.append(
            ItemExpense(
                name=item.name,
                price=round(eff_price, 2),
                unit_price=round(item.price, 2) if item.price is not None else round(eff_price, 2),
                quantity=item.quantity if item.quantity is not None else 1.0,
                category=item.category or "Uncategorized",
                percentage=pct,
            )
        )

    # Stable sort descending by price (preserves original order on ties)
    sorted_items = sorted(expenses, key=lambda e: -e.price)

    # ── Highest expense (overall, not affected by topN) ─────────────────
    if sorted_items:
        highest_expense = sorted_items[0]
    else:
        highest_expense = ItemExpense(name="N/A", price=0.0, percentage=0.0)

    # ── Apply optional topN slice ───────────────────────────────────────
    if top_n is not None and top_n > 0:
        sorted_items = sorted_items[:top_n]

    return ItemBreakdownResult(
        sorted_items=sorted_items,
        highest_expense=highest_expense,
    )
