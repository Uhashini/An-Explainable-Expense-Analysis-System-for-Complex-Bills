"""Custom exceptions for the Smart Receipt Analysis system."""


class SmartReceiptException(Exception):
    """Base exception for Smart Receipt Analysis system."""

    pass


class OCRException(SmartReceiptException):
    """Exception raised during OCR processing."""

    pass


class LayoutModelException(SmartReceiptException):
    """Exception raised during LayoutLMv3 model inference."""

    pass


class ValidationException(SmartReceiptException):
    """Exception raised during data validation."""

    pass


class CategorizationException(SmartReceiptException):
    """Exception raised during item categorization."""

    pass


class AnomalyDetectionException(SmartReceiptException):
    """Exception raised during anomaly detection."""

    pass


class ExplanabilityException(SmartReceiptException):
    """Exception raised during explanation generation."""

    pass


class DatabaseException(SmartReceiptException):
    """Exception raised during database operations."""

    pass


class ModeException(SmartReceiptException):
    """Exception raised during mode-specific analysis."""

    pass


class ForecastingException(SmartReceiptException):
    """Exception raised during forecasting operations."""

    pass


class RecipeException(SmartReceiptException):
    """Exception raised during recipe generation."""

    pass
