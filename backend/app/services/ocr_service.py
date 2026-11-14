import os
import io
import tempfile
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class OCRService:
    """
    Coordinator service that ties together document intelligence.
    Supports either:
    1. Remote Hugging Face AI Microservice (ZeroGPU accelerated, lightweight memory footprint for Render)
    2. Local PaddleOCR + Microsoft LayoutLMv3 pipeline (for local offline execution)
    """
    def __init__(self):
        self.use_remote = os.getenv("USE_REMOTE_OCR", "true").lower() in ("true", "1", "yes")
        self.hf_space_id = os.getenv("HF_SPACE_ID", "Uhashini/pantrix-ai-engine")
        self.hf_token = os.getenv("HF_TOKEN")
        self._local_initialized = False
        self._hf_client = None
        self.classifier = None
        self.preprocessor = None
        self.corrector = None
        self.ocr = None
        self.voting = None
        self.layoutlm = None
        
        if self.use_remote:
            logger.info(f"OCRService initialized with Remote Hugging Face Space: {self.hf_space_id}")
        else:
            self._ensure_local_pipeline()

    def _get_hf_client(self):
        if self._hf_client is None:
            try:
                from gradio_client import Client
                self._hf_client = Client(self.hf_space_id, hf_token=self.hf_token)
                logger.info(f"Connected to Hugging Face Space: {self.hf_space_id}")
            except Exception as e:
                logger.error(f"Failed to connect to Hugging Face Space: {e}")
                self._hf_client = None
        return self._hf_client

    def _ensure_local_pipeline(self):
        if not self._local_initialized:
            try:
                from app.services.document_intelligence import (
                    PreprocessingService,
                    PerspectiveCorrector,
                    OCREngine,
                    VotingEngine,
                    InputClassifier,
                    LayoutLMService,
                    TokenCleaner
                )
                self.TokenCleaner = TokenCleaner
                self.classifier = InputClassifier()
                self.preprocessor = PreprocessingService()
                self.corrector = PerspectiveCorrector()
                self.ocr = OCREngine(lang='en')
                self.voting = VotingEngine()
                self.layoutlm = LayoutLMService()
                self._local_initialized = True
                logger.info("Local OCR + LayoutLM pipeline initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize local OCR pipeline: {e}")

    def extract_structured_data(self, image_bytes: bytes, preprocess=True) -> dict:
        """
        Extract structured receipt data either via remote Hugging Face Space or local pipeline.
        """
        if not image_bytes or len(image_bytes) == 0:
            raise ValueError("Received empty image bytes (length 0).")

        # 1. Attempt Remote Inference via Hugging Face ZeroGPU Space
        if self.use_remote:
            try:
                client = self._get_hf_client()
                if client is not None:
                    from gradio_client import handle_file
                    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
                        tf.write(image_bytes)
                        tf_path = tf.name
                    
                    try:
                        logger.info(f"Dispatching extraction to Hugging Face Space {self.hf_space_id}...")
                        result = client.predict(
                            image=handle_file(tf_path),
                            api_name="/predict"
                        )
                        if isinstance(result, dict) and result.get("status") == "success":
                            logger.info("Successfully received structured receipt data from Hugging Face Space.")
                            return result
                    finally:
                        if os.path.exists(tf_path):
                            try:
                                os.remove(tf_path)
                            except Exception:
                                pass
            except Exception as remote_err:
                logger.warning(f"Remote HF Space extraction failed ({remote_err}). Falling back to local pipeline.")

        # 2. Local Fallback Execution
        self._ensure_local_pipeline()
        import cv2
        import numpy as np

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"OpenCV failed to decode image ({len(image_bytes)} bytes).")

        orig_h, orig_w = img.shape[:2]
        max_dim = 1000
        if max(orig_h, orig_w) > max_dim:
            scale = max_dim / max(orig_h, orig_w)
            new_width = int(orig_w * scale)
            new_height = int(orig_h * scale)
            img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)

        if preprocess and self.preprocessor and self.corrector:
            enhanced = self.preprocessor.apply_clahe(img)
            corrected = self.corrector.detect_and_correct(enhanced)
        else:
            corrected = img
        new_h, new_w = corrected.shape[:2]

        raw_results = self.ocr.extract_text(corrected) if self.ocr else []
        if not raw_results or len(raw_results) < 3:
            if preprocess and self.preprocessor and self.ocr:
                ocr_input = self.preprocessor.denoise_and_sharpen(corrected)
                raw_results = self.ocr.extract_text(ocr_input)

        words = []
        boxes = []
        for res in raw_results:
            text = res["text"]
            bbox = res["bbox"]
            tl = bbox[0]
            br = bbox[2]
            def clip(v):
                return max(0, min(1000, int(v)))
            x1 = clip(1000 * tl[0] / new_w)
            y1 = clip(1000 * tl[1] / new_h)
            x2 = clip(1000 * br[0] / new_w)
            y2 = clip(1000 * br[1] / new_h)
            words.append(text)
            boxes.append([x1, y1, x2, y2])

        if hasattr(self, "TokenCleaner"):
            words, boxes = self.TokenCleaner.split_and_clean_tokens(words, boxes)

        entities = []
        receipt_data = {}
        if words and self.layoutlm:
            entities = self.layoutlm.predict_entities(corrected, words, boxes)
            receipt_data = self.layoutlm.parse_receipt_entities(entities, words, boxes)

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

ocr_service = OCRService()
