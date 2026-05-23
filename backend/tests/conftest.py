"""Test configuration and fixtures."""

import pytest
from app.core.config import settings
from app.utils.validators import DataValidator


@pytest.fixture
def test_receipt_data():
    """Fixture for test receipt data."""
    return {
        "receipt_id": "test_receipt_001",
        "merchant_name": "Local Grocery",
        "receipt_date": "2026-05-23",
        "line_items": [
            {
                "name": "Eggs",
                "quantity": 12,
                "unit_price": 6.5,
                "total_price": 78.0,
                "category": "protein"
            },
            {
                "name": "Milk",
                "quantity": 2,
                "unit_price": 50,
                "total_price": 100.0,
                "category": "dairy"
            },
            {
                "name": "Chips",
                "quantity": 3,
                "unit_price": 30,
                "total_price": 90.0,
                "category": "snacks"
            }
        ],
        "subtotal": 268.0,
        "tax": 13.4,
        "total": 281.4
    }


@pytest.fixture
def test_user_data():
    """Fixture for test user data."""
    return {
        "user_id": "test_user_001",
        "username": "testuser",
        "email": "testuser@example.com",
        "name": "Test User",
        "weight_kg": 70,
        "monthly_budget": 6000
    }


def test_validator_email():
    """Test email validation."""
    assert DataValidator.validate_email("valid@example.com") is True
    assert DataValidator.validate_email("invalid.email") is False


def test_validator_numeric():
    """Test numeric validation."""
    assert DataValidator.validate_numeric(10) is True
    assert DataValidator.validate_numeric(10, min_val=5, max_val=15) is True
    assert DataValidator.validate_numeric(20, min_val=5, max_val=15) is False
