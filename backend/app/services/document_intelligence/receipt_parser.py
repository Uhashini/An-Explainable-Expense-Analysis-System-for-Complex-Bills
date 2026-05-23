"""Phase 2: Document Intelligence Services - Receipt Parser Orchestrator"""

from typing import Dict, List, Tuple
from PIL import Image
import io
from datetime import datetime
from app.services.document_intelligence.ocr_engine import OCREngine
from app.services.document_intelligence.layout_model import LayoutLMv3Model
from app.core.exceptions import LayoutModelException
from app.utils.logger import logger


class ReceiptParser:
    """Orchestrates OCR and LayoutLMv3 pipeline for receipt processing."""

    def __init__(self):
        """Initialize OCR engine and LayoutLMv3 model."""
        self.ocr_engine = OCREngine()
        self.layout_model = LayoutLMv3Model()
        logger.info("Receipt Parser initialized")

    def parse_receipt_image(self, image_path: str) -> Dict:
        """End-to-end receipt parsing pipeline.
        
        Pipeline: Image → Tesseract OCR → LayoutLMv3 → Structured Bill
        
        Args:
            image_path: Path to receipt image
            
        Returns:
            Structured receipt data dictionary
            
        Raises:
            LayoutModelException: If processing fails
        """
        try:
            logger.info(f"Starting receipt parsing for {image_path}")
            
            # Step 1: Extract text and bounding boxes with Tesseract
            raw_text, bounding_boxes = self.ocr_engine.extract_text_with_boxes(image_path)
            logger.info(f"OCR: Extracted {len(bounding_boxes)} words")
            
            # Step 2: Load image for LayoutLMv3
            image = Image.open(image_path)
            
            # Step 3: Run LayoutLMv3 entity extraction
            entities = self.layout_model.extract_entities(image, raw_text, bounding_boxes)
            logger.info(f"LayoutLMv3: Extracted entities")
            
            # Step 4: Parse line items
            line_items = self.layout_model.parse_line_items(entities)
            
            # Step 5: Construct structured bill
            structured_bill = {
                "merchant_name": entities.get("merchant", "Unknown"),
                "receipt_date": entities.get("date", datetime.utcnow().isoformat()),
                "line_items": line_items,
                "subtotal": entities.get("subtotal", 0.0),
                "tax": entities.get("tax", 0.0),
                "total": entities.get("total", 0.0),
                "raw_text": raw_text,
                "bounding_boxes": bounding_boxes,
                "extraction_confidence": entities.get("confidence", 0.0),
                "processing_status": "completed"
            }
            
            logger.info(f"Receipt parsing completed successfully")
            return structured_bill
            
        except Exception as e:
            logger.error(f"Receipt parsing failed: {e}")
            raise LayoutModelException(f"Receipt parsing failed: {e}")

    def parse_receipt_bytes(self, image_bytes: bytes) -> Dict:
        """Parse receipt from image bytes.
        
        Args:
            image_bytes: Receipt image as bytes
            
        Returns:
            Structured receipt data dictionary
        """
        try:
            logger.info("Parsing receipt from bytes")
            
            # Extract text and boxes
            raw_text, bounding_boxes = self.ocr_engine.extract_from_bytes(image_bytes)
            
            # Load image
            image = Image.open(io.BytesIO(image_bytes))
            
            # Extract entities
            entities = self.layout_model.extract_entities(image, raw_text, bounding_boxes)
            
            # Parse line items
            line_items = self.layout_model.parse_line_items(entities)
            
            # Construct structured bill
            structured_bill = {
                "merchant_name": entities.get("merchant", "Unknown"),
                "receipt_date": entities.get("date", datetime.utcnow().isoformat()),
                "line_items": line_items,
                "subtotal": entities.get("subtotal", 0.0),
                "tax": entities.get("tax", 0.0),
                "total": entities.get("total", 0.0),
                "raw_text": raw_text,
                "bounding_boxes": bounding_boxes,
                "extraction_confidence": entities.get("confidence", 0.0),
                "processing_status": "completed"
            }
            
            logger.info("Receipt parsing from bytes completed")
            return structured_bill
            
        except Exception as e:
            logger.error(f"Receipt parsing from bytes failed: {e}")
            raise LayoutModelException(f"Receipt parsing from bytes failed: {e}")

    def batch_parse_receipts(self, image_paths: List[str]) -> List[Dict]:
        """Parse multiple receipts in batch.
        
        Args:
            image_paths: List of receipt image paths
            
        Returns:
            List of structured receipt dictionaries
        """
        try:
            results = []
            for i, image_path in enumerate(image_paths, 1):
                logger.info(f"Processing batch item {i}/{len(image_paths)}")
                result = self.parse_receipt_image(image_path)
                results.append(result)
            
            logger.info(f"Batch parsing completed: {len(results)} receipts")
            return results
            
        except Exception as e:
            logger.error(f"Batch parsing failed: {e}")
            raise LayoutModelException(f"Batch parsing failed: {e}")
