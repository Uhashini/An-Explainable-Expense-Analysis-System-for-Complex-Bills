"""
Unit tests for Save Money mode — SM-01, SM-02, SM-03, and the orchestrator.

Uses the sample receipt data from the spec to validate expected outputs,
plus edge-case tests for each module.
"""

import pytest

from app.services.modes.save_money.schemas import ReceiptItem
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
from app.services.modes.save_money.orchestrator import run_save_money_analysis


# ─── Shared fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def sample_items():
    """The spec's sample receipt items."""
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
        assert abs(total_pct - 100.0) < 0.5  # rounding tolerance

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
        """When two categories have the same total, the alphabetically first wins."""
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

    def test_top_n_highest_expense_unaffected(self, sample_items):
        """highest_expense is always the global #1, even with topN."""
        result = get_item_breakdown(sample_items, top_n=1)
        assert result.highest_expense.name == "Rice"

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

    def test_duplicate_names_preserved(self):
        items = [
            ReceiptItem(name="Milk", category="Dairy", price=60),
            ReceiptItem(name="Milk", category="Dairy", price=80),
        ]
        result = get_item_breakdown(items)
        assert len(result.sorted_items) == 2
        assert result.highest_expense.price == 80

    def test_quantity_multiplied(self):
        items = [
            ReceiptItem(name="Eggs", category="Protein", price=10, quantity=12),
        ]
        result = get_item_breakdown(items)
        assert result.sorted_items[0].price == 120

    def test_tie_returns_first_encountered(self):
        """On tie, the item appearing first in the original list wins."""
        items = [
            ReceiptItem(name="First", category="A", price=100),
            ReceiptItem(name="Second", category="B", price=100),
        ]
        result = get_item_breakdown(items)
        assert result.highest_expense.name == "First"


# ═════════════════════════════════════════════════════════════════════════════
#  SM-03  Budget Utilization Analysis
# ═════════════════════════════════════════════════════════════════════════════

class TestBudgetUtilization:
    """Tests for get_budget_utilization (SM-03)."""

    def test_sample_data(self):
        """Spec's expected result: 2800 spent, 200 remaining, 93.3%, ⚠."""
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

    def test_near_limit_boundary_70(self):
        result = get_budget_utilization(
            monthly_budget=1000,
            current_receipt_total=700,
            previous_spend=0,
        )
        assert result.utilization == 70.0
        assert result.status == STATUS_NEAR_LIMIT

    def test_near_limit_boundary_90(self):
        result = get_budget_utilization(
            monthly_budget=1000,
            current_receipt_total=900,
            previous_spend=0,
        )
        assert result.utilization == 90.0
        assert result.status == STATUS_NEAR_LIMIT

    def test_almost_over_boundary_91(self):
        result = get_budget_utilization(
            monthly_budget=1000,
            current_receipt_total=910,
            previous_spend=0,
        )
        assert result.utilization == 91.0
        assert result.status == STATUS_ALMOST_OVER

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

    def test_previous_spend_defaults_to_zero(self):
        result = get_budget_utilization(
            monthly_budget=1000,
            current_receipt_total=500,
        )
        assert result.total_spent == 500

    def test_negative_remaining(self):
        result = get_budget_utilization(
            monthly_budget=500,
            current_receipt_total=600,
            previous_spend=100,
        )
        assert result.remaining == -200


# ═════════════════════════════════════════════════════════════════════════════
#  Orchestrator — run_save_money_analysis
# ═════════════════════════════════════════════════════════════════════════════

class TestOrchestrator:
    """Tests for run_save_money_analysis."""

    def test_full_pipeline_sample_data(self, sample_items):
        result = run_save_money_analysis(
            items=sample_items,
            monthly_budget=3000,
            previous_spend=1800,
        )
        # SM-01
        assert result.category_spending.total_spending == 1000
        assert result.category_spending.highest_category.category == "Grains"
        assert result.category_spending.highest_category.amount == 350

        # SM-02
        assert result.item_breakdown.highest_expense.name == "Rice"
        assert result.item_breakdown.highest_expense.price == 300

        # SM-03 — feeds SM-01 total (1000) into budget calc
        assert result.budget_utilization is not None
        assert result.budget_utilization.total_spent == 2800
        assert result.budget_utilization.remaining == 200
        assert result.budget_utilization.utilization == 93.3
        assert result.budget_utilization.status == STATUS_ALMOST_OVER

    def test_pipeline_without_budget(self, sample_items):
        result = run_save_money_analysis(items=sample_items)
        assert result.category_spending.total_spending == 1000
        assert result.item_breakdown.highest_expense.name == "Rice"
        assert result.budget_utilization is None

    def test_pipeline_with_top_n(self, sample_items):
        result = run_save_money_analysis(items=sample_items, top_n=3)
        assert len(result.item_breakdown.sorted_items) == 3

    def test_pipeline_empty_receipt(self):
        result = run_save_money_analysis(items=[], monthly_budget=1000)
        assert result.category_spending.total_spending == 0
        assert result.item_breakdown.sorted_items == []
        assert result.budget_utilization.total_spent == 0
        assert result.budget_utilization.status == STATUS_ON_TRACK
