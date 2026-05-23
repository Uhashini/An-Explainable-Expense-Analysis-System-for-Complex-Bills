"""Validation utilities for data validation and checks."""

import re
from typing import Dict, List, Optional
from app.core.exceptions import ValidationException


class DataValidator:
    """Utility class for data validation."""

    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format."""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

    @staticmethod
    def validate_numeric(value: any, min_val: Optional[float] = None, 
                        max_val: Optional[float] = None) -> bool:
        """Validate numeric value with optional bounds."""
        try:
            num = float(value)
            if min_val is not None and num < min_val:
                return False
            if max_val is not None and num > max_val:
                return False
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def validate_receipt_data(receipt_dict: Dict) -> List[str]:
        """Validate receipt data for missing/invalid fields.
        
        Returns list of validation errors (empty if valid).
        """
        errors = []
        
        # Check required fields
        required_fields = ["merchant_name", "receipt_date", "line_items", "total"]
        for field in required_fields:
            if field not in receipt_dict or receipt_dict[field] is None:
                errors.append(f"Missing required field: {field}")
        
        # Validate line items
        if "line_items" in receipt_dict:
            if not isinstance(receipt_dict["line_items"], list):
                errors.append("line_items must be a list")
            elif len(receipt_dict["line_items"]) == 0:
                errors.append("Receipt must have at least one line item")
            else:
                for i, item in enumerate(receipt_dict["line_items"]):
                    if not all(k in item for k in ["name", "quantity", "unit_price", "total_price"]):
                        errors.append(f"Line item {i} missing required fields")
                    if not isinstance(item.get("quantity"), (int, float)):
                        errors.append(f"Line item {i} quantity must be numeric")
        
        # Validate total
        if "total" in receipt_dict:
            if not DataValidator.validate_numeric(receipt_dict["total"], min_val=0):
                errors.append("Total must be a positive number")
        
        return errors

    @staticmethod
    def validate_category(category: str, valid_categories: List[str]) -> bool:
        """Validate that category is in valid list."""
        return category in valid_categories

    @staticmethod
    def check_numeric_consistency(items: List[Dict], subtotal: float, 
                                  tax: float, total: float, tolerance: float = 0.01) -> bool:
        """Check if subtotal + tax = total within tolerance."""
        calculated_subtotal = sum(item.get("total_price", 0) for item in items)
        calculated_total = calculated_subtotal + tax
        
        return abs(calculated_total - total) <= tolerance
