"""
SM-07 — Purchase Frequency Analysis

Tracks how frequently each grocery item is purchased across historical receipts.
Identifies recurring grocery staples, repurchase velocity, and purchase intervals.
"""

from typing import List, Optional, Dict, Any
from collections import defaultdict
from datetime import datetime, date
from sqlalchemy.orm import Session

from app.database.postgres_client import Receipt, ReceiptItem as DBReceiptItem, FoodItem
from app.services.modes.save_money.schemas import (
    ReceiptItem as SchemaReceiptItem,
    PurchaseFrequencyResult,
    PurchaseFrequencyItem,
)


def _normalize_name(name: str) -> str:
    """Normalize item name for robust grouping across OCR variations."""
    if not name:
        return "Unknown Item"
    cleaned = name.strip().lower()
    # Remove excessive punctuation
    for char in [",", ".", "-", "_", "/", "\\", "(", ")", "[", "]"]:
        cleaned = cleaned.replace(char, " ")
    return " ".join(cleaned.split()).title()


def get_purchase_frequency(
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    current_items: Optional[List[SchemaReceiptItem]] = None,
    exclude_receipt_id: Optional[int] = None,
    historical_receipts: Optional[List[Any]] = None,
    historical_items: Optional[List[Any]] = None,
) -> PurchaseFrequencyResult:
    """Compute grocery item purchase frequency and identify recurring staples.

    Args:
        db: Database session.
        user_id: User ID.
        current_items: Line items in the current receipt being analyzed.
        exclude_receipt_id: Optional receipt ID to exclude.
        historical_receipts: Optional pre-fetched receipt objects.
        historical_items: Optional pre-fetched item objects.

    Returns:
        PurchaseFrequencyResult with recurring staples and item frequencies.
    """
    if (db is None and historical_receipts is None) or user_id is None:
        return PurchaseFrequencyResult(
            analysis_id="SM-07",
            total_unique_items=0,
            frequent_staples=[],
            all_frequencies=[],
        )

    # ── 1. Fetch or use pre-fetched receipts ─────────────────────────────
    if historical_receipts is not None:
        receipts = [
            r for r in historical_receipts
            if not exclude_receipt_id or getattr(r, "receipt_id", None) != exclude_receipt_id
        ]
        db_items = [
            it for it in (historical_items or [])
            if not exclude_receipt_id or getattr(it, "receipt_id", None) != exclude_receipt_id
        ]
    else:
        receipt_query = db.query(Receipt).filter(Receipt.user_id == user_id)
        if exclude_receipt_id:
            receipt_query = receipt_query.filter(Receipt.receipt_id != exclude_receipt_id)
        
        receipts = receipt_query.all()
        receipt_ids = [r.receipt_id for r in receipts]
        db_items: List[DBReceiptItem] = []
        if receipt_ids:
            db_items = (
                db.query(DBReceiptItem)
                .filter(DBReceiptItem.receipt_id.in_(receipt_ids))
                .all()
            )

    if not receipts and not current_items:
        return PurchaseFrequencyResult(
            analysis_id="SM-07",
            total_unique_items=0,
            frequent_staples=[],
            all_frequencies=[],
        )

    receipt_map = {getattr(r, "receipt_id", None): r for r in receipts if getattr(r, "receipt_id", None) is not None}

    # ── 3. Group purchases by normalized identity ────────────────────────
    # Key: normalized_name or matched_food_id
    item_history = defaultdict(lambda: {
        "display_name": "",
        "category": "Uncategorized",
        "dates": [],
        "count": 0,
        "matched_food_id": None,
    })

    for item in db_items:
        r_id = getattr(item, "receipt_id", None)
        r = receipt_map.get(r_id) if r_id is not None else None
        r_date = getattr(r, "date", None) if r else None
        
        # Determine normalized key
        raw_name = str(getattr(item, "name", "Item"))
        norm_name = _normalize_name(raw_name)
        matched_fid = getattr(item, "matched_food_id", None)
        key = f"food_{matched_fid}" if matched_fid else norm_name
        
        entry = item_history[key]
        if not entry["display_name"]:
            entry["display_name"] = norm_name
            entry["matched_food_id"] = matched_fid
            item_cat = getattr(item, "category", None)
            if item_cat:
                entry["category"] = str(item_cat)
        
        entry["count"] += 1
        if r_date:
            entry["dates"].append(r_date)

    # Include items from current receipt into frequency count
    if current_items:
        today_date = date.today()
        for c_item in current_items:
            raw_c_name = str(c_item.name) if c_item.name is not None else "Item"
            norm_name = _normalize_name(raw_c_name)
            key = f"food_{c_item.matched_food_id}" if c_item.matched_food_id else norm_name
            entry = item_history[key]
            if not entry["display_name"]:
                entry["display_name"] = norm_name
                entry["matched_food_id"] = c_item.matched_food_id
                entry["category"] = str(c_item.category) if c_item.category else "Uncategorized"
            entry["count"] += 1
            entry["dates"].append(today_date)

    # ── 4. Calculate time span for frequency rates ───────────────────────
    all_dates = []
    for entry in item_history.values():
        all_dates.extend([d for d in entry["dates"] if d])

    parsed_dates = []
    for d in all_dates:
        if isinstance(d, (datetime, date)):
            parsed_dates.append(d if isinstance(d, date) else d.date())
        elif isinstance(d, str):
            try:
                dt = datetime.strptime(d[:10], "%Y-%m-%d").date()
                parsed_dates.append(dt)
            except Exception:
                pass

    if parsed_dates:
        min_date = min(parsed_dates)
        max_date = max(parsed_dates)
        days_span = max((max_date - min_date).days, 1)
        months_span = max(days_span / 30.4375, 1.0)
        weeks_span = max(days_span / 7.0, 1.0)
    else:
        months_span = 1.0
        weeks_span = 1.0

    # ── 5. Build frequency item records ──────────────────────────────────
    frequency_list: List[PurchaseFrequencyItem] = []

    for entry in item_history.values():
        count = entry["count"]
        per_month = round(count / months_span, 1)
        per_week = round(count / weeks_span, 1)

        dates_sorted = sorted([d for d in entry["dates"] if d], key=str)
        first_p = str(dates_sorted[0]) if dates_sorted else None
        last_p = str(dates_sorted[-1]) if dates_sorted else None

        # Frequent staple threshold: >= 2 purchases or rate >= 1.0/month
        is_staple = count >= 2 or per_month >= 1.0

        frequency_list.append(
            PurchaseFrequencyItem(
                item_name=entry["display_name"],
                purchase_count=count,
                purchases_per_month=per_month,
                purchases_per_week=per_week,
                first_purchased=first_p,
                last_purchased=last_p,
                is_frequent_staple=is_staple,
                category=entry["category"],
            )
        )

    # Sort by purchase count descending, then rate descending
    frequency_list.sort(key=lambda x: (-x.purchase_count, -x.purchases_per_month, x.item_name))

    staples = [item for item in frequency_list if item.is_frequent_staple]

    return PurchaseFrequencyResult(
        analysis_id="SM-07",
        total_unique_items=len(frequency_list),
        frequent_staples=staples[:10],  # Top 10 frequent staples
        all_frequencies=frequency_list,
    )
