"""Unit tests for data validators."""

import pytest
from app.utils.validators import DataValidator


class TestEmailValidation:
    """Tests for email validation."""
    
    def test_valid_email(self):
        """Test valid email addresses."""
        valid_emails = [
            "user@example.com",
            "john.doe@company.co.uk",
            "test123@test-domain.org"
        ]
        for email in valid_emails:
            assert DataValidator.validate_email(email)
    
    def test_invalid_email(self):
        """Test invalid email addresses."""
        invalid_emails = [
            "plain_text",
            "missing@.com",
            "@nodomain.com",
            "space @domain.com"
        ]
        for email in invalid_emails:
            assert not DataValidator.validate_email(email)


class TestNumericValidation:
    """Tests for numeric validation."""
    
    def test_valid_numeric(self):
        """Test valid numeric values."""
        assert DataValidator.validate_numeric(0) is True
        assert DataValidator.validate_numeric(-10) is True
        assert DataValidator.validate_numeric(3.14) is True
    
    def test_numeric_with_bounds(self):
        """Test numeric validation with min/max bounds."""
        assert DataValidator.validate_numeric(5, min_val=0, max_val=10) is True
        assert DataValidator.validate_numeric(0, min_val=0) is True
        assert DataValidator.validate_numeric(11, min_val=0, max_val=10) is False
    
    def test_invalid_numeric(self):
        """Test invalid numeric values."""
        assert DataValidator.validate_numeric("abc") is False
        assert DataValidator.validate_numeric(None) is False


class TestReceiptValidation:
    """Tests for receipt data validation."""
    
    def test_valid_receipt(self, test_receipt_data):
        """Test validation of valid receipt."""
        errors = DataValidator.validate_receipt_data(test_receipt_data)
        assert len(errors) == 0
    
    def test_missing_required_field(self, test_receipt_data):
        """Test validation with missing required field."""
        del test_receipt_data["total"]
        errors = DataValidator.validate_receipt_data(test_receipt_data)
        assert any("Missing required field" in error for error in errors)
    
    def test_empty_line_items(self, test_receipt_data):
        """Test validation with empty line items."""
        test_receipt_data["line_items"] = []
        errors = DataValidator.validate_receipt_data(test_receipt_data)
        assert any("at least one" in error for error in errors)


class TestNumericConsistency:
    """Tests for numeric consistency checks."""
    
    def test_consistent_total(self, test_receipt_data):
        """Test consistent receipt totals."""
        items = test_receipt_data["line_items"]
        subtotal = test_receipt_data["subtotal"]
        tax = test_receipt_data["tax"]
        total = test_receipt_data["total"]
        
        is_consistent = DataValidator.check_numeric_consistency(items, subtotal, tax, total)
        assert is_consistent
    
    def test_inconsistent_total(self, test_receipt_data):
        """Test inconsistent receipt totals."""
        items = test_receipt_data["line_items"]
        subtotal = test_receipt_data["subtotal"]
        tax = 100  # Wrong tax amount
        total = test_receipt_data["total"]
        
        is_consistent = DataValidator.check_numeric_consistency(items, subtotal, tax, total)
        assert not is_consistent
