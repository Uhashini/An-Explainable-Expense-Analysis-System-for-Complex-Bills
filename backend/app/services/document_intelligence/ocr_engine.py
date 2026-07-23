import os
# CRITICAL: These must be set BEFORE any paddle imports
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_use_onednn"] = "0"

from paddleocr import PaddleOCR
import numpy as np
import logging
from typing import List, Dict, Any, Union
import paddle
import cv2

logger = logging.getLogger(__name__)

class OCREngine:
    """
    Production-grade OCR service using PaddleOCR as the primary backbone.
    Optimized for multi-language receipts and complex layouts (tables).
    """

    def __init__(self, lang: str = 'en', use_angle_cls: bool = True):
        """
        Initializes the PaddleOCR engine.
        - lang: Language code (e.g., 'en', 'ch', 'fr').
        - use_angle_cls: Enables text orientation detection (useful for rotated receipts).
        """
        self.use_angle_cls = use_angle_cls
        try:
            # Note: The first time this runs, it will download the model weights (~100MB)
            self.engine = PaddleOCR(
                use_angle_cls=True,
                lang="en",

                det_limit_side_len=960,

                det_db_thresh=0.3,
                det_db_box_thresh=0.6,
                det_db_unclip_ratio=1.5,

                use_dilation=False,

                drop_score=0.5
            )
            logger.info(f"PaddleOCR initialized with language: {lang}")
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            raise

    def extract_text(self, image: Union[str, np.ndarray]) -> List[Dict[str, Any]]:
        """
        Extracts structured text data from an image.
        Returns a list of dictionaries containing text, confidence, and bounding box.
        """
        try:
            # Perform OCR inference
            scale = 1.0
            if isinstance(image, np.ndarray):
                h, w = image.shape[:2]

            if max(h, w) < 1500:
                scale = 2.0
                image = cv2.resize(
                    image,
                    None,
                    fx=scale,
                    fy=scale,
                    interpolation=cv2.INTER_CUBIC
                )
            result = self.engine.ocr(image,cls=self.use_angle_cls)
            
            # PaddleOCR returns a list of pages, each page is a list of [bbox, (text, confidence)]
            if not result or result[0] is None:
                return []

            structured_results = []
            for line in result[0]:
                # PaddleOCR reports coordinates in the resized image. Convert
                # them back to the caller's image coordinate system so the
                # production service can normalize using its original size.
                bbox = [[point[0] / scale, point[1] / scale] for point in line[0]]
                text, confidence = line[1]
                
                structured_results.append({
                    "text": text,
                    "confidence": float(confidence),
                    "bbox": bbox,
                    "width": abs(bbox[1][0] - bbox[0][0]),
                    "height": abs(bbox[2][1] - bbox[0][1])
                })
            structured_results.sort(
                key=lambda x: (
                    x["bbox"][0][1],   # y
                    x["bbox"][0][0]    # x
                )
            )
            return structured_results
        except Exception as e:
            logger.error(f"OCR Inference error: {e}")
            return []

    def get_full_text(self, results: List[Dict[str, Any]]) -> str:
        """
        Reconstructs the full text from structured results.
        """
        return "\n".join([item["text"] for item in results])

    def filter_by_confidence(self, results: List[Dict[str, Any]], threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Filters out low-confidence OCR results.
        """
        return [item for item in results if item["confidence"] >= threshold]
