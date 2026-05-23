"""Phase 2: Document Intelligence Services - LayoutLMv3 Model"""

from typing import Dict, List, Optional
import torch
from transformers import AutoProcessor, AutoModelForTokenClassification
from PIL import Image
from app.core.config import settings
from app.core.exceptions import LayoutModelException
from app.utils.logger import logger


class LayoutLMv3Model:
    """LayoutLMv3 model for structured receipt understanding."""

    def __init__(self):
        """Initialize LayoutLMv3 model and processor."""
        try:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            logger.info(f"Using device: {self.device}")
            
            # Load pretrained processor
            self.processor = AutoProcessor.from_pretrained(settings.LAYOUTLMV3_MODEL_PATH)
            
            # Load model - use checkpoint if available, else use base model
            model_path = settings.LAYOUTLMV3_CHECKPOINT or settings.LAYOUTLMV3_MODEL_PATH
            self.model = AutoModelForTokenClassification.from_pretrained(model_path)
            self.model.to(self.device)
            self.model.eval()
            
            logger.info(f"LayoutLMv3 model loaded from {model_path}")
            
        except Exception as e:
            logger.error(f"Failed to initialize LayoutLMv3 model: {e}")
            raise LayoutModelException(f"Model initialization failed: {e}")

    def extract_entities(self, image: Image.Image, text: str, 
                        bounding_boxes: List[Dict]) -> Dict:
        """Extract structured entities from receipt using LayoutLMv3.
        
        Args:
            image: PIL Image of receipt
            text: Raw OCR text
            bounding_boxes: List of bounding boxes from OCR
            
        Returns:
            Dict containing extracted entities with confidences
            
        Raises:
            LayoutModelException: If model inference fails
        """
        try:
            # Prepare inputs for LayoutLMv3
            # LayoutLMv3 expects normalized bounding boxes and word tokens
            
            # For now, return a placeholder structure
            # Full implementation requires fine-tuning on CORD dataset
            entities = {
                "merchant": None,
                "date": None,
                "items": [],
                "subtotal": None,
                "tax": None,
                "total": None,
                "confidence": 0.0
            }
            
            logger.info("LayoutLMv3 entity extraction completed")
            return entities
            
        except Exception as e:
            logger.error(f"LayoutLMv3 extraction failed: {e}")
            raise LayoutModelException(f"Entity extraction failed: {e}")

    def parse_line_items(self, entities: Dict) -> List[Dict]:
        """Parse line items from extracted entities.
        
        Args:
            entities: Entities extracted by model
            
        Returns:
            List of line item dictionaries
        """
        try:
            line_items = []
            
            # Extract line items from entities
            for item in entities.get("items", []):
                line_item = {
                    "name": item.get("name"),
                    "quantity": item.get("quantity", 1),
                    "unit_price": item.get("unit_price", 0.0),
                    "total_price": item.get("total_price", 0.0),
                    "confidence": item.get("confidence", 0.0)
                }
                line_items.append(line_item)
            
            logger.info(f"Parsed {len(line_items)} line items")
            return line_items
            
        except Exception as e:
            logger.error(f"Line item parsing failed: {e}")
            raise LayoutModelException(f"Failed to parse line items: {e}")

    def batch_process(self, images: List[Image.Image], 
                     texts: List[str], batch_size: int = 4) -> List[Dict]:
        """Process multiple receipts in batches.
        
        Args:
            images: List of PIL Images
            texts: List of OCR texts
            batch_size: Batch size for processing
            
        Returns:
            List of entity extraction results
        """
        try:
            results = []
            
            for i in range(0, len(images), batch_size):
                batch_images = images[i:i+batch_size]
                batch_texts = texts[i:i+batch_size]
                
                # Process batch
                batch_results = []
                for image, text in zip(batch_images, batch_texts):
                    result = self.extract_entities(image, text, [])
                    batch_results.append(result)
                
                results.extend(batch_results)
            
            logger.info(f"Batch processed {len(results)} receipts")
            return results
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            raise LayoutModelException(f"Batch processing failed: {e}")
