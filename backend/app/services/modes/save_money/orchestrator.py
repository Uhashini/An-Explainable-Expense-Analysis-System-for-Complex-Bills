"""
Save Money Mode — Orchestrator

Orchestrates all 7 Save Money analysis sub-modules:
  • SM-01: Category-wise Spending Distribution
  • SM-02: Item-wise Spending Breakdown
  • SM-03: Budget Utilization Analysis
  • SM-04: Weekly / Monthly Spending Trend
  • SM-05: Price Deviation Analysis
  • SM-06: Category Overspending & Anomaly Detection (Isolation Forest + SHAP)
  • SM-07: Purchase Frequency Analysis

Executes independent analytics concurrently via thread pool workers to minimize latency.
"""

from typing import List, Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from app.services.modes.save_money.category_spending import get_category_spending
from app.services.modes.save_money.item_breakdown import get_item_breakdown
from app.services.modes.save_money.budget_utilization import get_budget_utilization
from app.services.modes.save_money.spending_trend import get_spending_trend
from app.services.modes.save_money.price_deviation import get_price_deviations
from app.services.modes.save_money.category_anomalies import detect_category_anomalies
from app.services.modes.save_money.purchase_frequency import get_purchase_frequency
from app.services.modes.save_money.schemas import (
    ReceiptItem,
    SaveMoneyResult,
    CategorySpendingResult,
    ItemBreakdownResult,
    BudgetUtilizationResult,
    SpendingTrendResult,
    PriceDeviationResult,
    CategoryAnomaliesResult,
    PurchaseFrequencyResult,
)


def run_save_money_analysis(
    items: List[ReceiptItem],
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    monthly_budget: Optional[float] = None,
    previous_spend: float = 0.0,
    top_n: Optional[int] = None,
    exclude_receipt_id: Optional[int] = None,
) -> SaveMoneyResult:
    """Run the complete 7-part Save Money analysis pipeline concurrently.

    Pipeline:
        1. SM-01: Category-wise spending distribution
        2. SM-02: Item-wise spending breakdown
        3. SM-03: Budget utilization (if monthly_budget is supplied)
        4. SM-04: Weekly / monthly spending trend (if db & user_id)
        5. SM-05: Price deviation analysis (if db & user_id)
        6. SM-06: Category anomalies with Isolation Forest + SHAP (if db & user_id)
        7. SM-07: Purchase frequency analysis (if db & user_id)

    Args:
        items: Parsed and validated receipt line-items.
        db: Database session.
        user_id: User ID for historical comparisons.
        monthly_budget: User grocery budget.
        previous_spend: Prior grocery spend earlier this month.
        top_n: Limit for SM-02 top items.
        exclude_receipt_id: Receipt ID to exclude from historical sets.

    Returns:
        SaveMoneyResult combining all 7 sub-analysis results.
    """
    # ── Instant in-memory analyses (SM-01 & SM-02) ───────────────────────
    category_result: CategorySpendingResult = get_category_spending(items)
    item_result: ItemBreakdownResult = get_item_breakdown(items, top_n=top_n)

    # ── SM-03 Budget Utilization ─────────────────────────────────────────
    budget_result: Optional[BudgetUtilizationResult] = None
    if monthly_budget is not None:
        try:
            budget_result = get_budget_utilization(
                monthly_budget=monthly_budget,
                current_receipt_total=category_result.total_spending,
                previous_spend=previous_spend,
            )
        except Exception as e:
            print(f"[SaveMoney] Error in SM-03: {e}")

    # ── Asynchronous/Concurrent Execution for DB & ML Analyses ───────────
    spending_trend_res: Optional[SpendingTrendResult] = None
    price_dev_res: Optional[PriceDeviationResult] = None
    cat_anomalies_res: Optional[CategoryAnomaliesResult] = None
    purch_freq_res: Optional[PurchaseFrequencyResult] = None

    if db is not None and user_id is not None:
        from app.database.postgres_client import Receipt, ReceiptItem as DBReceiptItem, FoodItem
        
        # 1. Single batch database query for all user receipts
        receipt_query = db.query(Receipt).filter(Receipt.user_id == user_id)
        if exclude_receipt_id:
            receipt_query = receipt_query.filter(Receipt.receipt_id != exclude_receipt_id)
        historical_receipts = receipt_query.all()
        receipt_ids = [r.receipt_id for r in historical_receipts]

        # 2. Single batch database query for all user receipt items with category
        historical_items = []
        if receipt_ids:
            historical_items = (
                db.query(
                    DBReceiptItem.receipt_id,
                    DBReceiptItem.name,
                    DBReceiptItem.price,
                    DBReceiptItem.quantity,
                    DBReceiptItem.matched_food_id,
                    FoodItem.category,
                )
                .outerjoin(FoodItem, DBReceiptItem.matched_food_id == FoodItem.food_id)
                .filter(DBReceiptItem.receipt_id.in_(receipt_ids))
                .all()
            )

        items_dicts = [item.dict() for item in items]

        def _task_sm04():
            try:
                return get_spending_trend(
                    db=None,
                    user_id=user_id,
                    current_spending=category_result.total_spending,
                    current_receipt_id=exclude_receipt_id,
                    items_data=items_dicts,
                    historical_receipts=historical_receipts,
                )
            except Exception as e:
                print(f"[SaveMoney] Error in SM-04: {e}")
                return None

        def _task_sm05():
            try:
                return get_price_deviations(
                    db=None,
                    user_id=user_id,
                    items_data=items,
                    exclude_receipt_id=exclude_receipt_id,
                    historical_items=historical_items,
                )
            except Exception as e:
                print(f"[SaveMoney] Error in SM-05: {e}")
                return None

        def _task_sm06():
            try:
                return detect_category_anomalies(
                    db=None,
                    user_id=user_id,
                    current_items=items_dicts,
                    exclude_receipt_id=exclude_receipt_id,
                    historical_receipts=historical_receipts,
                    historical_items=historical_items,
                )
            except Exception as e:
                print(f"[SaveMoney] Error in SM-06: {e}")
                return None

        def _task_sm07():
            try:
                return get_purchase_frequency(
                    db=None,
                    user_id=user_id,
                    current_items=items,
                    exclude_receipt_id=exclude_receipt_id,
                    historical_receipts=historical_receipts,
                    historical_items=historical_items,
                )
            except Exception as e:
                print(f"[SaveMoney] Error in SM-07: {e}")
                return None

        # Execute concurrent tasks in parallel thread workers
        with ThreadPoolExecutor(max_workers=4) as executor:
            fut_sm04 = executor.submit(_task_sm04)
            fut_sm05 = executor.submit(_task_sm05)
            fut_sm06 = executor.submit(_task_sm06)
            fut_sm07 = executor.submit(_task_sm07)

            spending_trend_res = fut_sm04.result()
            price_dev_res = fut_sm05.result()
            cat_anomalies_res = fut_sm06.result()
            purch_freq_res = fut_sm07.result()

    return SaveMoneyResult(
        category_spending=category_result,
        item_breakdown=item_result,
        budget_utilization=budget_result,
        spending_trend=spending_trend_res,
        price_deviation=price_dev_res,
        category_anomalies=cat_anomalies_res,
        purchase_frequency=purch_freq_res,
    )
