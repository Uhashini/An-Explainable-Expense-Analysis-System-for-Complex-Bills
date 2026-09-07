"""
SM-05 — Price Deviation Analysis

Compares current item prices against the user's historical purchases for the same item.
Calculates historical average, current price, difference, change percentage,
and assigns 4-tier inflation/deviation alert tags.
"""

import re
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.database.postgres_client import Receipt, ReceiptItem as DBReceiptItem
from app.services.analytics_service import extract_float
from app.services.modes.save_money.schemas import (
    ReceiptItem as SchemaReceiptItem,
    PriceDeviationResult,
    PriceDeviationItem,
)


def _clean_name(name: str) -> str:
    """Sanitize and normalize food item name."""
    if not name:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    return " ".join(cleaned.split())


def get_price_deviations(
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    items_data: Optional[List[SchemaReceiptItem]] = None,
    exclude_receipt_id: Optional[int] = None,
    historical_items: Optional[List[Any]] = None,
) -> PriceDeviationResult:
    """SM-05: Price Deviation Analysis.

    Args:
        db: Database session.
        user_id: User ID.
        items_data: Current receipt items.
        exclude_receipt_id: Optional receipt ID to exclude.
        historical_items: Optional pre-fetched historical line item objects.

    Returns:
        PriceDeviationResult with item-by-item inflation and deviation metrics.
    """
    if (db is None and historical_items is None) or user_id is None or not items_data:
        return PriceDeviationResult(
            analysis_id="SM-05",
            price_deviation=[],
        )

    deviations: List[PriceDeviationItem] = []

    # ── 1. Collect all food IDs and normalized names ─────────────────────
    food_ids = [it.matched_food_id or it.food_id for it in items_data if (it.matched_food_id or it.food_id)]
    normalized_names = {_clean_name(it.name): it.name for it in items_data if it.name}

    # ── 2. Use pre-fetched items or query DB ─────────────────────────────
    if historical_items is not None:
        historical_rows = [
            it for it in historical_items 
            if not exclude_receipt_id or getattr(it, "receipt_id", None) != exclude_receipt_id
        ]
    else:
        query = (
            db.query(
                DBReceiptItem.matched_food_id,
                DBReceiptItem.name,
                DBReceiptItem.price,
                DBReceiptItem.quantity,
            )
            .join(Receipt, DBReceiptItem.receipt_id == Receipt.receipt_id)
            .filter(Receipt.user_id == user_id)
        )
        if exclude_receipt_id:
            query = query.filter(Receipt.receipt_id != exclude_receipt_id)

        historical_rows = query.all()

    # ── 3. Group historical unit prices by food_id and normalized name ───
    hist_food_id_prices: Dict[int, List[float]] = {fid: [] for fid in food_ids}
    hist_name_prices: Dict[str, List[float]] = {k: [] for k in normalized_names.keys()}

    for row in historical_rows:
        p = extract_float(str(row.price or 0))
        q = extract_float(str(row.quantity or 1)) or 1.0
        if p > 0:
            unit_p = p / q
            if row.matched_food_id and row.matched_food_id in hist_food_id_prices:
                hist_food_id_prices[row.matched_food_id].append(unit_p)
            
            raw_row_name = str(row.name) if row.name is not None else ""
            clean_n = _clean_name(raw_row_name)
            if clean_n in hist_name_prices:
                hist_name_prices[clean_n].append(unit_p)

    # Compute averages
    food_id_averages = {
        fid: sum(prices) / len(prices)
        for fid, prices in hist_food_id_prices.items()
        if prices
    }
    name_averages = {
        n: sum(prices) / len(prices)
        for n, prices in hist_name_prices.items()
        if prices
    }

    # ── 4. Evaluate each item in current receipt ─────────────────────────
    for item in items_data:
        food_name = item.name or "Item"
        current_raw_price = extract_float(str(item.price))
        if current_raw_price == 0:
            continue

        current_qty = extract_float(str(item.quantity or 1)) or 1.0
        # If item.price is already unit price, current_unit_price is current_raw_price
        current_unit_price = current_raw_price

        # Check matched food ID first, fallback to normalized name
        fid = item.matched_food_id or item.food_id
        avg_historical_price = None
        if fid and fid in food_id_averages:
            avg_historical_price = food_id_averages[fid]
        elif _clean_name(food_name) in name_averages:
            avg_historical_price = name_averages[_clean_name(food_name)]

        if avg_historical_price is None or avg_historical_price == 0:
            deviations.append(
                PriceDeviationItem(
                    item_name=food_name,
                    current_price=round(current_unit_price, 2),
                    historical_average=None,
                    difference=0.0,
                    change_percentage=0.0,
                    status="First time buying",
                )
            )
            continue

        diff = current_unit_price - avg_historical_price
        change_pct = (diff / avg_historical_price) * 100.0 if avg_historical_price > 0 else 0.0

        # 4-Tier Specification Logic
        if change_pct > 30.0:
            status = "Significant Increase 🔴"
        elif change_pct > 15.0:
            status = "High 🔴"
        elif change_pct > 5.0:
            status = "Slightly Higher 🟡"
        elif change_pct < -5.0:
            status = "Lower than usual 🟢"
        else:
            status = "Normal 🟢"

        deviations.append(
            PriceDeviationItem(
                item_name=food_name,
                current_price=round(current_unit_price, 2),
                historical_average=round(avg_historical_price, 2),
                difference=round(diff, 2),
                change_percentage=round(change_pct, 1),
                status=status,
            )
        )

    return PriceDeviationResult(
        analysis_id="SM-05",
        price_deviation=deviations,
    )
