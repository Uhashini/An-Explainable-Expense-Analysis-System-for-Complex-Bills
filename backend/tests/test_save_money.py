"""
Unit tests for Save Money mode — SM-01 through SM-07, and the orchestrator pipeline.

Covers:
  • SM-01: Category-wise Spending Distribution
  • SM-02: Item-wise Spending Breakdown
  • SM-03: Budget Utilization Analysis
  • SM-04: Weekly / Monthly Spending Trend Analysis
  • SM-05: Price Deviation Analysis
  • SM-06: Category Overspending / Isolation Forest & SHAP Anomaly Detection
  • SM-07: Purchase Frequency Analysis
  • Full Orchestrator Pipeline
"""

import pytest
from unittest.mock import MagicMock
from datetime import datetime, date

from app.services.modes.save_money.schemas import (
    ReceiptItem,
    CategorySpendingResult,
    ItemBreakdownResult,
    BudgetUtilizationResult,
    SpendingTrendResult,
    PriceDeviationResult,
    CategoryAnomaliesResult,
    PurchaseFrequencyResult,
)
from app.services.modes.save_money.category_spending import get_category_spending
from app.services.modes.save_money.item_breakdown import get_item_breakdown
from app.services.modes.save_money.budget_utilization import (
    get_budget_utilization,
    STATUS_NO_BUDGET,
    STATUS_ON_TRACK,
    STATUS_NEAR_LIMIT,
    STATUS_ALMOST_OVER,
    STATUS_OVER_BUDGET,
)
from app.services.modes.save_money.spending_trend import get_spending_trend
from app.services.modes.save_money.price_deviation import get_price_deviations
from app.services.modes.save_money.category_anomalies import detect_category_anomalies
from app.services.modes.save_money.purchase_frequency import get_purchase_frequency
from app.services.modes.save_money.orchestrator import run_save_money_analysis


# ─── Shared fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def sample_items():
    """Standard sample receipt items."""
    return [
        ReceiptItem(name="Milk", category="Dairy", price=140),
        ReceiptItem(name="Eggs", category="Protein", price=90),
        ReceiptItem(name="Chicken", category="Protein", price=160),
        ReceiptItem(name="Rice", category="Grains", price=300),
        ReceiptItem(name="Bread", category="Grains", price=50),
        ReceiptItem(name="Apples", category="Fruits", price=150),
        ReceiptItem(name="Instant Noodles", category="Processed", price=60),
        ReceiptItem(name="Drink", category="Processed", price=50),
    ]


# ═════════════════════════════════════════════════════════════════════════════
#  SM-01  Category-wise Spending Distribution
# ═════════════════════════════════════════════════════════════════════════════

class TestCategorySpending:
    """Tests for get_category_spending (SM-01)."""

    def test_total_spending(self, sample_items):
        result = get_category_spending(sample_items)
        assert result.total_spending == 1000

    def test_highest_category_is_grains(self, sample_items):
        result = get_category_spending(sample_items)
        assert result.highest_category.category == "Grains"
        assert result.highest_category.amount == 350

    def test_categories_sorted_descending(self, sample_items):
        result = get_category_spending(sample_items)
        amounts = [c.amount for c in result.categories]
        assert amounts == sorted(amounts, reverse=True)

    def test_percentages_sum_to_100(self, sample_items):
        result = get_category_spending(sample_items)
        total_pct = sum(c.percentage for c in result.categories)
        assert abs(total_pct - 100.0) < 0.5

    def test_each_category_percentage(self, sample_items):
        result = get_category_spending(sample_items)
        cat_map = {c.category: c.percentage for c in result.categories}
        assert cat_map["Grains"] == 35.0
        assert cat_map["Protein"] == 25.0
        assert cat_map["Fruits"] == 15.0
        assert cat_map["Dairy"] == 14.0
        assert cat_map["Processed"] == 11.0

    def test_empty_receipt(self):
        result = get_category_spending([])
        assert result.total_spending == 0
        assert result.categories == []
        assert result.highest_category.amount == 0

    def test_missing_category_bucketed_as_uncategorized(self):
        items = [
            ReceiptItem(name="Mystery", category="", price=50),
            ReceiptItem(name="Unknown", category="  ", price=30),
        ]
        result = get_category_spending(items)
        assert len(result.categories) == 1
        assert result.categories[0].category == "Uncategorized"
        assert result.categories[0].amount == 80

    def test_quantity_multiplied(self):
        items = [
            ReceiptItem(name="Yogurt", category="Dairy", price=40, quantity=3),
        ]
        result = get_category_spending(items)
        assert result.total_spending == 120

    def test_tie_for_highest_alphabetical(self):
        items = [
            ReceiptItem(name="A", category="Zebra", price=100),
            ReceiptItem(name="B", category="Alpha", price=100),
        ]
        result = get_category_spending(items)
        assert result.highest_category.category == "Alpha"


# ═════════════════════════════════════════════════════════════════════════════
#  SM-02  Item-wise Spending Breakdown
# ═════════════════════════════════════════════════════════════════════════════

class TestItemBreakdown:
    """Tests for get_item_breakdown (SM-02)."""

    def test_highest_expense_is_rice(self, sample_items):
        result = get_item_breakdown(sample_items)
        assert result.highest_expense.name == "Rice"
        assert result.highest_expense.price == 300

    def test_sorted_descending_by_price(self, sample_items):
        result = get_item_breakdown(sample_items)
        prices = [i.price for i in result.sorted_items]
        assert prices == sorted(prices, reverse=True)

    def test_all_items_present(self, sample_items):
        result = get_item_breakdown(sample_items)
        assert len(result.sorted_items) == 8

    def test_top_n_returns_subset(self, sample_items):
        result = get_item_breakdown(sample_items, top_n=3)
        assert len(result.sorted_items) == 3
        assert result.sorted_items[0].name == "Rice"

    def test_empty_receipt(self):
        result = get_item_breakdown([])
        assert result.sorted_items == []
        assert result.highest_expense.price == 0

    def test_zero_price_items_sorted_to_bottom(self):
        items = [
            ReceiptItem(name="Freebie", category="Promo", price=0),
            ReceiptItem(name="Paid", category="Snacks", price=50),
        ]
        result = get_item_breakdown(items)
        assert result.sorted_items[-1].name == "Freebie"
        assert result.highest_expense.name == "Paid"

    def test_multiple_items_with_same_price_order_preserved(self):
        items = [
            ReceiptItem(name="First", category="A", price=100),
            ReceiptItem(name="Second", category="B", price=100),
        ]
        result = get_item_breakdown(items)
        assert result.highest_expense.name == "First"
        assert len(result.sorted_items) == 2


# ═════════════════════════════════════════════════════════════════════════════
#  SM-03  Budget Utilization Analysis
# ═════════════════════════════════════════════════════════════════════════════

class TestBudgetUtilization:
    """Tests for get_budget_utilization (SM-03)."""

    def test_sample_data(self):
        result = get_budget_utilization(
            monthly_budget=3000,
            current_receipt_total=1000,
            previous_spend=1800,
        )
        assert result.total_spent == 2800
        assert result.remaining == 200
        assert result.utilization == 93.3
        assert result.status == STATUS_ALMOST_OVER

    def test_on_track(self):
        result = get_budget_utilization(
            monthly_budget=10000,
            current_receipt_total=500,
            previous_spend=0,
        )
        assert result.utilization == 5.0
        assert result.status == STATUS_ON_TRACK

    def test_near_limit(self):
        result = get_budget_utilization(
            monthly_budget=1000,
            current_receipt_total=750,
            previous_spend=0,
        )
        assert result.status == STATUS_NEAR_LIMIT

    def test_over_budget(self):
        result = get_budget_utilization(
            monthly_budget=1000,
            current_receipt_total=800,
            previous_spend=500,
        )
        assert result.total_spent == 1300
        assert result.remaining == -300
        assert result.utilization == 130.0
        assert result.status == STATUS_OVER_BUDGET

    def test_zero_budget(self):
        result = get_budget_utilization(
            monthly_budget=0,
            current_receipt_total=500,
        )
        assert result.utilization == 0.0
        assert result.status == STATUS_NO_BUDGET


# ═════════════════════════════════════════════════════════════════════════════
#  SM-04  Spending Trend Analysis
# ═════════════════════════════════════════════════════════════════════════════

class TestSpendingTrend:
    """Tests for get_spending_trend (SM-04)."""

    def test_first_receipt_no_history(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []
        result = get_spending_trend(db=mock_db, user_id=1, current_spending=1000)
        assert result.trend == "First Receipt! 🎉"
        assert result.previous_average == 0.0
        assert result.current_spending == 1000.0

    def test_increasing_trend(self):
        mock_db = MagicMock()
        r1 = MagicMock(date=date(2026, 1, 15), total_amount=500.0, receipt_id=1)
        r2 = MagicMock(date=date(2026, 2, 15), total_amount=550.0, receipt_id=2)
        mock_db.query.return_value.filter.return_value.all.return_value = [r1, r2]

        result = get_spending_trend(db=mock_db, user_id=1, current_spending=1000)
        assert result.previous_average == 525.0
        assert result.change_percentage > 5.0
        assert result.trend == "Increasing"

    def test_decreasing_trend(self):
        mock_db = MagicMock()
        r1 = MagicMock(date=date(2026, 1, 15), total_amount=1500.0, receipt_id=1)
        mock_db.query.return_value.filter.return_value.all.return_value = [r1]

        result = get_spending_trend(db=mock_db, user_id=1, current_spending=500)
        assert result.previous_average == 1500.0
        assert result.change_percentage < -5.0
        assert result.trend == "Decreasing"

    def test_stable_trend(self):
        mock_db = MagicMock()
        r1 = MagicMock(date=date(2026, 1, 15), total_amount=1000.0, receipt_id=1)
        mock_db.query.return_value.filter.return_value.all.return_value = [r1]

        result = get_spending_trend(db=mock_db, user_id=1, current_spending=1010)
        assert result.trend == "Stable"


# ═════════════════════════════════════════════════════════════════════════════
#  SM-05  Price Deviation Analysis
# ═════════════════════════════════════════════════════════════════════════════

class TestPriceDeviation:
    """Tests for get_price_deviations (SM-05)."""

    def test_first_time_buying_item(self):
        mock_db = MagicMock()
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = []
        items = [ReceiptItem(name="Organic Dragonfruit", category="Fruits", price=250)]
        
        result = get_price_deviations(db=mock_db, user_id=1, items_data=items)
        assert len(result.price_deviation) == 1
        assert result.price_deviation[0].status == "First time buying"
        assert result.price_deviation[0].historical_average is None

    def test_higher_than_usual_price(self):
        mock_db = MagicMock()
        # Historical milk average = ₹100
        row1 = MagicMock(matched_food_id=10, name="Milk 1L", price=100.0, quantity=1.0)
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = [row1]
        
        # Current milk price = ₹120 (+20% -> "High 🔴")
        items = [ReceiptItem(name="Milk 1L", category="Dairy", price=120, matched_food_id=10)]
        result = get_price_deviations(db=mock_db, user_id=1, items_data=items)
        assert len(result.price_deviation) == 1
        dev = result.price_deviation[0]
        assert dev.historical_average == 100.0
        assert dev.difference == 20.0
        assert dev.change_percentage == 20.0
        assert "High" in dev.status

    def test_lower_than_usual_price(self):
        mock_db = MagicMock()
        row1 = MagicMock(matched_food_id=10, name="Eggs 12pk", price=100.0, quantity=1.0)
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = [row1]

        # Current eggs price = ₹80 (-20% -> "Lower than usual 🟢")
        items = [ReceiptItem(name="Eggs 12pk", category="Protein", price=80, matched_food_id=10)]
        result = get_price_deviations(db=mock_db, user_id=1, items_data=items)
        dev = result.price_deviation[0]
        assert dev.change_percentage == -20.0
        assert "Lower than usual" in dev.status


# ═════════════════════════════════════════════════════════════════════════════
#  SM-06  Category Overspending & SHAP Anomaly Detection
# ═════════════════════════════════════════════════════════════════════════════

class TestCategoryAnomalies:
    """Tests for detect_category_anomalies (SM-06)."""

    def test_normal_spending_basket(self):
        mock_db = MagicMock()
        # Create baseline receipts with ₹200 dairy, ₹300 grains, ₹250 protein
        r_list = [MagicMock(receipt_id=i) for i in range(1, 6)]
        items_list = []
        for r in r_list:
            items_list.append(MagicMock(receipt_id=r.receipt_id, category="Dairy", price=200.0, quantity=1.0))
            items_list.append(MagicMock(receipt_id=r.receipt_id, category="Grains", price=300.0, quantity=1.0))

        mock_db.query.return_value.filter.return_value.all.side_effect = [r_list, items_list]

        current_items = [
            {"category": "Dairy", "price": 210.0, "quantity": 1.0},
            {"category": "Grains", "price": 290.0, "quantity": 1.0},
        ]
        result = detect_category_anomalies(db=mock_db, user_id=1, current_items=current_items)
        assert result.is_basket_anomalous is False
        assert len(result.shap_contributions) > 0

    def test_anomalous_spending_with_shap_attribution(self):
        mock_db = MagicMock()
        # Baseline receipts: Dairy ≈ ₹150, Grains ≈ ₹200
        r_list = [MagicMock(receipt_id=i) for i in range(1, 7)]
        items_list = []
        for r in r_list:
            items_list.append(MagicMock(receipt_id=r.receipt_id, category="Dairy", price=150.0, quantity=1.0))
            items_list.append(MagicMock(receipt_id=r.receipt_id, category="Grains", price=200.0, quantity=1.0))

        mock_db.query.return_value.filter.return_value.all.side_effect = [r_list, items_list]

        # Current receipt: massive surge in Dairy (₹900)
        current_items = [
            {"category": "Dairy", "price": 900.0, "quantity": 1.0},
            {"category": "Grains", "price": 200.0, "quantity": 1.0},
        ]
        result = detect_category_anomalies(db=mock_db, user_id=1, current_items=current_items)
        assert result.is_basket_anomalous is True
        assert result.primary_contributor == "Dairy"
        top_shap = result.shap_contributions[0]
        assert top_shap.category == "Dairy"
        assert top_shap.contribution_percentage > 50.0


# ═════════════════════════════════════════════════════════════════════════════
#  SM-07  Purchase Frequency Analysis
# ═════════════════════════════════════════════════════════════════════════════

class TestPurchaseFrequency:
    """Tests for get_purchase_frequency (SM-07)."""

    def test_purchase_frequency_staples_detection(self):
        mock_db = MagicMock()
        r1 = MagicMock(receipt_id=1, date=date(2026, 1, 10))
        r2 = MagicMock(receipt_id=2, date=date(2026, 2, 10))
        r3 = MagicMock(receipt_id=3, date=date(2026, 3, 10))

        item1 = MagicMock(receipt_id=1, name="Milk 1L", category="Dairy", matched_food_id=1)
        item2 = MagicMock(receipt_id=2, name="Milk 1L", category="Dairy", matched_food_id=1)
        item3 = MagicMock(receipt_id=3, name="Milk 1L", category="Dairy", matched_food_id=1)
        item4 = MagicMock(receipt_id=3, name="Brown Bread", category="Grains", matched_food_id=2)

        mock_db.query.return_value.filter.return_value.all.side_effect = [
            [r1, r2, r3],
            [item1, item2, item3, item4]
        ]

        result = get_purchase_frequency(db=mock_db, user_id=1, current_items=[])
        assert result.total_unique_items >= 2
        milk_stat = next((it for it in result.all_frequencies if "Milk" in it.item_name), None)
        assert milk_stat is not None
        assert milk_stat.purchase_count == 3
        assert milk_stat.is_frequent_staple is True


# ═════════════════════════════════════════════════════════════════════════════
#  Full Orchestrator Pipeline
# ═════════════════════════════════════════════════════════════════════════════

class TestOrchestratorPipeline:
    """Tests for run_save_money_analysis combining all 7 sub-analyses."""

    def test_full_pipeline_with_mocked_db(self, sample_items):
        mock_db = MagicMock()
        r1 = MagicMock(receipt_id=1, date=date(2026, 1, 10), total_amount=800.0)
        mock_db.query.return_value.filter.return_value.all.return_value = [r1]
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = []

        result = run_save_money_analysis(
            items=sample_items,
            db=mock_db,
            user_id=1,
            monthly_budget=3000,
            previous_spend=1800,
            top_n=3,
        )

        assert result.category_spending.analysis_id == "SM-01"
        assert result.item_breakdown.analysis_id == "SM-02"
        assert result.budget_utilization.analysis_id == "SM-03"
        assert result.spending_trend.analysis_id == "SM-04"
        assert result.price_deviation.analysis_id == "SM-05"
        assert result.category_anomalies.analysis_id == "SM-06"
        assert result.purchase_frequency.analysis_id == "SM-07"
