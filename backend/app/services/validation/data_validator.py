"""Phase 3: Data Validation Service"""

from typing import Dict, List
from app.core.exceptions import ValidationException
from app.utils.validators import DataValidator
from app.utils.logger import logger


class DataValidationService:
    """Service for validating extracted receipt data."""

    @staticmethod
    def validate_receipt(receipt_data: Dict) -> Dict:
        """Validate receipt data and return validation results.
        
        Args:
            receipt_data: Receipt dictionary to validate
            
        Returns:
            Dict with 'is_valid' flag and list of 'errors'
            
        Raises:
            ValidationException: If critical validation fails
        """
        try:
            errors = DataValidator.validate_receipt_data(receipt_data)
            
            result = {
                "is_valid": len(errors) == 0,
                "errors": errors,
                "error_count": len(errors)
            }
            
            if not result["is_valid"]:
                logger.warning(f"Receipt validation failed: {errors}")
            else:
                logger.info("Receipt validation passed")
            
            return result
            
        except Exception as e:
            logger.error(f"Receipt validation failed: {e}")
            raise ValidationException(f"Receipt validation error: {e}")

    @staticmethod
    def validate_line_items(line_items: List[Dict]) -> Dict:
        """Validate line items.
        
        Args:
            line_items: List of line item dictionaries
            
        Returns:
            Dict with validation results
        """
        try:
            errors = []
            
            if not isinstance(line_items, list):
                errors.append("line_items must be a list")
                return {"is_valid": False, "errors": errors}
            
            if len(line_items) == 0:
                errors.append("At least one line item required")
                return {"is_valid": False, "errors": errors}
            
            for i, item in enumerate(line_items):
                # Check required fields
                required = ["name", "quantity", "unit_price", "total_price"]
                for field in required:
                    if field not in item:
                        errors.append(f"Item {i}: missing field '{field}'")
                
                # Validate numeric fields
                if not DataValidator.validate_numeric(item.get("quantity"), min_val=0.01):
                    errors.append(f"Item {i}: quantity must be positive")
                if not DataValidator.validate_numeric(item.get("unit_price"), min_val=0):
                    errors.append(f"Item {i}: unit_price must be non-negative")
                if not DataValidator.validate_numeric(item.get("total_price"), min_val=0):
                    errors.append(f"Item {i}: total_price must be non-negative")
            
            logger.info(f"Line items validation completed: {len(errors)} errors")
            return {"is_valid": len(errors) == 0, "errors": errors}
            
        except Exception as e:
            logger.error(f"Line items validation failed: {e}")
            raise ValidationException(f"Line items validation error: {e}")

    @staticmethod
    def check_consistency(items: List[Dict], subtotal: float, tax: float, 
                         total: float, tolerance: float = 0.01) -> Dict:
        """Check numeric consistency of receipt totals.
        
        Args:
            items: Line items
            subtotal: Receipt subtotal
            tax: Tax amount
            total: Total amount
            tolerance: Allowed difference due to rounding
            
        Returns:
            Dict with consistency check results
        """
        try:
            is_consistent = DataValidator.check_numeric_consistency(
                items, subtotal, tax, total, tolerance
            )
            
            calculated_subtotal = sum(item.get("total_price", 0) for item in items)
            calculated_total = calculated_subtotal + tax
            
            result = {
                "is_consistent": is_consistent,
                "expected_subtotal": calculated_subtotal,
                "actual_subtotal": subtotal,
                "expected_total": calculated_total,
                "actual_total": total,
                "difference": abs(calculated_total - total)
            }
            
            if not is_consistent:
                logger.warning(f"Consistency check failed: {result}")
            else:
                logger.info("Consistency check passed")
            
            return result
            
        except Exception as e:
            logger.error(f"Consistency check failed: {e}")
            raise ValidationException(f"Consistency check error: {e}")

    @staticmethod
    def normalize_receipt(receipt_data: Dict) -> Dict:
        """Normalize and clean receipt data.
        
        Args:
            receipt_data: Raw receipt data
            
        Returns:
            Cleaned receipt data
        """
        try:
            cleaned = {
                "merchant_name": str(receipt_data.get("merchant_name", "")).strip().title(),
                "receipt_date": receipt_data.get("receipt_date"),
                "line_items": receipt_data.get("line_items", []),
                "subtotal": float(receipt_data.get("subtotal", 0.0)),
                "tax": float(receipt_data.get("tax", 0.0)),
                "total": float(receipt_data.get("total", 0.0)),
                "raw_text": receipt_data.get("raw_text", ""),
            }
            
            # Clean line items
            cleaned_items = []
            for item in cleaned.get("line_items", []):
                cleaned_item = {
                    "name": str(item.get("name", "")).strip(),
                    "quantity": float(item.get("quantity", 1)),
                    "unit_price": float(item.get("unit_price", 0)),
                    "total_price": float(item.get("total_price", 0)),
                    "category": item.get("category", "other").lower()
                }
                cleaned_items.append(cleaned_item)
            
            cleaned["line_items"] = cleaned_items
            
            logger.info("Receipt normalization completed")
            return cleaned
            
        except Exception as e:
            logger.error(f"Receipt normalization failed: {e}")
            raise ValidationException(f"Receipt normalization error: {e}")
