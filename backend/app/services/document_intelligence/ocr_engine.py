"""Phase 2: Document Intelligence Services - OCR Engine"""

import io
from typing import Tuple, List, Dict, Optional
from PIL import Image
import pytesseract
from app.core.config import settings
from app.core.exceptions import OCRException
from app.utils.logger import logger


class OCREngine:
    """Tesseract-based OCR engine for text and bounding box extraction."""

    def __init__(self):
        """Initialize OCR engine."""
        if settings.TESSERACT_PATH:
            pytesseract.pytesseract.pytesseract_cmd = settings.TESSERACT_PATH
        logger.info("OCR Engine initialized")

    def extract_text(self, image_path: str) -> str:
        """Extract text from receipt image using Tesseract.
        
        Args:
            image_path: Path to receipt image
            
        Returns:
            Extracted text from image
            
        Raises:
            OCRException: If OCR processing fails
        """
        try:
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image)
            logger.info(f"Successfully extracted text from {image_path}")
            return text
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            raise OCRException(f"Failed to extract text from image: {e}")

    def extract_text_with_boxes(self, image_path: str) -> Tuple[str, List[Dict]]:
        """Extract text and bounding boxes from receipt image.
        
        Args:
            image_path: Path to receipt image
            
        Returns:
            Tuple of (extracted_text, bounding_boxes)
            bounding_boxes: List of dicts with keys: text, x0, y0, x1, y1, confidence
            
        Raises:
            OCRException: If OCR processing fails
        """
        try:
            image = Image.open(image_path)
            
            # Extract text
            text = pytesseract.image_to_string(image)
            
            # Extract detailed data with bounding boxes
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            # Process bounding boxes
            bounding_boxes = []
            for i in range(len(data['text'])):
                if int(data['conf'][i]) > 0:  # Only confident detections
                    bbox = {
                        'text': data['text'][i],
                        'x0': int(data['left'][i]),
                        'y0': int(data['top'][i]),
                        'x1': int(data['left'][i]) + int(data['width'][i]),
                        'y1': int(data['top'][i]) + int(data['height'][i]),
                        'confidence': int(data['conf'][i]) / 100.0
                    }
                    bounding_boxes.append(bbox)
            
            logger.info(f"Extracted {len(bounding_boxes)} bounding boxes from {image_path}")
            return text, bounding_boxes
            
        except Exception as e:
            logger.error(f"OCR box extraction failed: {e}")
            raise OCRException(f"Failed to extract text and boxes from image: {e}")

    def extract_from_bytes(self, image_bytes: bytes) -> Tuple[str, List[Dict]]:
        """Extract text and boxes from image bytes.
        
        Args:
            image_bytes: Image data as bytes
            
        Returns:
            Tuple of (extracted_text, bounding_boxes)
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            text = pytesseract.image_to_string(image)
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            bounding_boxes = []
            for i in range(len(data['text'])):
                if int(data['conf'][i]) > 0:
                    bbox = {
                        'text': data['text'][i],
                        'x0': int(data['left'][i]),
                        'y0': int(data['top'][i]),
                        'x1': int(data['left'][i]) + int(data['width'][i]),
                        'y1': int(data['top'][i]) + int(data['height'][i]),
                        'confidence': int(data['conf'][i]) / 100.0
                    }
                    bounding_boxes.append(bbox)
            
            return text, bounding_boxes
            
        except Exception as e:
            logger.error(f"OCR from bytes failed: {e}")
            raise OCRException(f"Failed to extract from image bytes: {e}")

    def preprocess_image(self, image_path: str, output_path: Optional[str] = None) -> Image.Image:
        """Preprocess image for better OCR accuracy.
        
        Applies: grayscale conversion, contrast enhancement, noise reduction
        
        Args:
            image_path: Path to input image
            output_path: Optional path to save preprocessed image
            
        Returns:
            Preprocessed PIL Image
        """
        try:
            from PIL import ImageEnhance, ImageFilter
            
            image = Image.open(image_path)
            
            # Convert to grayscale
            image = image.convert('L')
            
            # Enhance contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(2.0)
            
            # Enhance brightness
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(1.2)
            
            # Reduce noise
            image = image.filter(ImageFilter.MedianFilter(size=3))
            
            if output_path:
                image.save(output_path)
                logger.info(f"Preprocessed image saved to {output_path}")
            
            return image
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            raise OCRException(f"Failed to preprocess image: {e}")
