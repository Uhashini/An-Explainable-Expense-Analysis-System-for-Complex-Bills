import os
import numpy as np
import logging
from typing import List, Dict, Any, Union
import cv2

logger = logging.getLogger(__name__)


class OCREngine:
    """
    Production-grade OCR service using PaddleOCR as the primary backbone,
    with automatic Tesseract fallback when PaddleOCR is unavailable (e.g. macOS ARM).
    """

    def __init__(self, lang: str = 'en', use_angle_cls: bool = True):
        """
        Initializes the OCR engine lazily.
        - lang: Language code (e.g., 'en', 'ch', 'fr').
        - use_angle_cls: Enables text orientation detection (useful for rotated receipts).
        """
        self.lang = lang
        self.use_angle_cls = use_angle_cls
        self.engine = None        # PaddleOCR engine (primary)
        self._tesseract = None    # pytesseract module (fallback)
        self._initialized = False

    def _ensure_engine(self):
        if self._initialized:
            return self.engine is not None or self._tesseract is not None

        # CRITICAL: These must be set BEFORE any paddle imports
        os.environ["FLAGS_enable_pir_api"] = "0"
        os.environ["FLAGS_use_onednn"] = "0"
        os.environ["FLAGS_use_mkldnn"] = "0"
        os.environ["PADDLE_DISABLE_ONEDNN"] = "1"

        # ── Try PaddleOCR first ────────────────────────────────────────────────
        try:
            from paddleocr import PaddleOCR
            self.engine = PaddleOCR(
                use_angle_cls=self.use_angle_cls,
                lang=self.lang,
                enable_mkldnn=False,
                det_limit_side_len=960,
                det_db_thresh=0.3,
                det_db_box_thresh=0.6,
                det_db_unclip_ratio=1.5,
                use_dilation=False,
                drop_score=0.5,
            )
            logger.info(f"PaddleOCR initialized with language: {self.lang}")
        except ImportError:
            logger.warning("PaddleOCR is not installed. Trying Tesseract fallback.")
            self.engine = None
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            self.engine = None

        # ── Tesseract fallback ────────────────────────────────────────────────
        if self.engine is None:
            try:
                import pytesseract
                pytesseract.get_tesseract_version()   # raises if binary missing
                self._tesseract = pytesseract
                logger.info("Tesseract OCR loaded as fallback backend.")
            except Exception as te:
                self._tesseract = None
                logger.warning(f"Tesseract fallback also unavailable: {te}")

        self._initialized = True
        return self.engine is not None or self._tesseract is not None

    # ── Tesseract helper ───────────────────────────────────────────────────────
    def _extract_with_tesseract(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Use pytesseract image_to_data to get word-level bounding boxes."""
        import pytesseract
        from pytesseract import Output

        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        data = pytesseract.image_to_data(
            rgb,
            output_type=Output.DICT,
            lang='eng',
            config='--psm 4',
        )

        results = []
        for i, text in enumerate(data['text']):
            text = text.strip()
            conf = int(data['conf'][i])
            if not text or conf < 30:
                continue
            x, y, bw, bh = (
                data['left'][i],
                data['top'][i],
                data['width'][i],
                data['height'][i],
            )
            bbox = [
                [x,      y],
                [x + bw, y],
                [x + bw, y + bh],
                [x,      y + bh],
            ]
            results.append({
                "text":       text,
                "confidence": conf / 100.0,
                "bbox":       bbox,
                "width":      bw,
                "height":     bh,
            })

        results.sort(key=lambda r: (r["bbox"][0][1], r["bbox"][0][0]))
        return results

    # ── Main extraction ────────────────────────────────────────────────────────
    def extract_text(self, image: Union[str, np.ndarray]) -> List[Dict[str, Any]]:
        """
        Extracts structured text data from an image.
        Returns a list of dicts with keys: text, confidence, bbox, width, height.
        """
        if not self._ensure_engine():
            logger.warning("OCREngine has no active OCR backend.")
            return []

        # ── Tesseract path ─────────────────────────────────────────────────────
        if self.engine is None and self._tesseract is not None:
            img = image
            if isinstance(image, str) and os.path.exists(image):
                img = cv2.imread(image)
            if img is None:
                return []
            return self._extract_with_tesseract(img)

        # ── PaddleOCR path ────────────────────────────────────────────────────
        try:
            scale = 1.0
            if isinstance(image, np.ndarray):
                h, w = image.shape[:2]
                if max(h, w) < 600:
                    scale = 2.0
                    image = cv2.resize(image, None, fx=scale, fy=scale,
                                       interpolation=cv2.INTER_CUBIC)
            elif isinstance(image, str) and os.path.exists(image):
                img_loaded = cv2.imread(image)
                if img_loaded is not None:
                    h, w = img_loaded.shape[:2]
                    if max(h, w) < 600:
                        scale = 2.0
                        image = cv2.resize(img_loaded, None, fx=scale, fy=scale,
                                           interpolation=cv2.INTER_CUBIC)

            result = self.engine.ocr(image, cls=self.use_angle_cls)

            if not result or result[0] is None:
                return []

            structured_results = []
            for line in result[0]:
                bbox = [[point[0] / scale, point[1] / scale] for point in line[0]]
                text, confidence = line[1]
                structured_results.append({
                    "text":       text,
                    "confidence": float(confidence),
                    "bbox":       bbox,
                    "width":      abs(bbox[1][0] - bbox[0][0]),
                    "height":     abs(bbox[2][1] - bbox[0][1]),
                })

            structured_results.sort(key=lambda x: (x["bbox"][0][1], x["bbox"][0][0]))
            return structured_results

        except Exception as e:
            logger.error(f"OCR Inference error: {e}")
            return []

    def get_full_text(self, results: List[Dict[str, Any]]) -> str:
        """Reconstructs the full text from structured results."""
        return "\n".join([item["text"] for item in results])

    def filter_by_confidence(self, results: List[Dict[str, Any]],
                             threshold: float = 0.5) -> List[Dict[str, Any]]:
        """Filters out low-confidence OCR results."""
        return [item for item in results if item["confidence"] >= threshold]
