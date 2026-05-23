from PIL import Image
import io
import cv2
import numpy as np
import logging
from app.services.document_intelligence import (
    PreprocessingService,
    PerspectiveCorrector,
    OCREngine,
    VotingEngine,
    InputClassifier,
    LayoutLMService
)

logger = logging.getLogger(__name__)

class OCRService:
    """
    Coordinator service that ties together the modular document intelligence pipeline.
    Replaces the legacy Tesseract implementation.
    """
    def __init__(self):
        self.classifier = InputClassifier()
        self.preprocessor = PreprocessingService()
        self.corrector = PerspectiveCorrector()
        self.ocr = OCREngine(lang='en')
        self.voting = VotingEngine()
        self.layoutlm = LayoutLMService()

    def extract_structured_data(self, image_bytes: bytes) -> dict:
        """
        Full production-grade extraction flow:
        Classify -> Preprocess -> Correct -> OCR -> Vote -> Semantic Mapping (LayoutLM).
        """
        try:
            # 1. Convert bytes to OpenCV format
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            orig_h, orig_w = img.shape[:2]

            # 2. Preprocess & Correct Perspective
            enhanced = self.preprocessor.apply_clahe(img)
            corrected = self.corrector.detect_and_correct(enhanced)
            new_h, new_w = corrected.shape[:2]

            # 3. OCR Extraction
            raw_results = self.ocr.extract_text(corrected)
            
            words = []
            boxes = []
            
            for res in raw_results:
                text = res["text"]
                bbox = res["bbox"] # [tl, tr, br, bl]
                
                # Normalize bounding box for LayoutLMv3 (0-1000)
                tl = bbox[0]
                br = bbox[2]
                
                x1 = int(1000 * (tl[0] / new_w))
                y1 = int(1000 * (tl[1] / new_h))
                x2 = int(1000 * (br[0] / new_w))
                y2 = int(1000 * (br[1] / new_h))
                
                words.append(text)
                boxes.append([x1, y1, x2, y2])
            
            # 4. Semantic Entity Classification (Phase 3)
            entities = []
            receipt_data = {}
            if words:
                entities = self.layoutlm.predict_entities(corrected, words, boxes)
                receipt_data = self.layoutlm.parse_receipt_entities(entities)
            
            return {
                "filename": "upload.jpg",
                "status": "success",
                "data": {
                    "words": words,
                    "boxes": boxes,
                    "entities": entities,
                    "receipt_info": receipt_data,
                    "image_size": {"width": orig_w, "height": orig_h}
                }
            }
        except Exception as e:
            logger.error(f"Structured OCR extraction failed: {str(e)}")
            raise

# Create a singleton instance
ocr_service = OCRService()
