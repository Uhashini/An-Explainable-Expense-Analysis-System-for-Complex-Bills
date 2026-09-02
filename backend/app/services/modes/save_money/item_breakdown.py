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

    Tie-breaking behaviour:
        If multiple items share the highest effective price, the one
        appearing **first** in the original ``items`` list is returned
        as ``highest_expense``.
    """
    # ── Build effective-price list ──────────────────────────────────────
    expenses: List[ItemExpense] = [
        ItemExpense(name=item.name, price=_effective_price(item))
        for item in items
    ]

    # Stable sort descending by price (preserves original order on ties)
    sorted_items = sorted(expenses, key=lambda e: -e.price)

    # ── Highest expense (overall, not affected by topN) ─────────────────
    if sorted_items:
        highest_expense = sorted_items[0]
    else:
        highest_expense = ItemExpense(name="N/A", price=0)

    # ── Apply optional topN slice ───────────────────────────────────────
    if top_n is not None and top_n > 0:
        sorted_items = sorted_items[:top_n]

    return ItemBreakdownResult(
        sorted_items=sorted_items,
        highest_expense=highest_expense,
    )
