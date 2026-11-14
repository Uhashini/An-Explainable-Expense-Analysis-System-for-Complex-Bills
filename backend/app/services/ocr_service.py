from PIL import Image
import io
import os
import cv2
import numpy as np
import logging
import requests
from app.core.config import settings
from app.services.document_intelligence import (
    PreprocessingService,
    PerspectiveCorrector,
    OCREngine,
    VotingEngine,
    InputClassifier,
    LayoutLMService,
    TokenCleaner
)

logger = logging.getLogger(__name__)

class OCRService:
    """
    Coordinator service that ties together the modular document intelligence pipeline.
    Supports offloading to remote Hugging Face AI microservice (GPU) with local fallback.
    """
    def __init__(self):
        self.classifier = InputClassifier()
        self.preprocessor = PreprocessingService()
        self.corrector = PerspectiveCorrector()
        self.ocr = OCREngine(lang='en')
        self.voting = VotingEngine()
        self.layoutlm = LayoutLMService()

    def extract_structured_data(self, image_bytes: bytes, preprocess: bool = True) -> dict:
        """
        Full extraction flow:
        1. If HF_AI_URL is configured, offload to remote GPU Zero Space.
        2. Fallback to local CPU/GPU pipeline: Classify -> Preprocess -> Correct -> OCR -> Vote -> LayoutLM.
        """
        if not image_bytes or len(image_bytes) == 0:
            raise ValueError("Received empty image bytes (length 0).")

        # ── 1. Remote Hugging Face AI Engine Offload ──────────────────────────
        hf_url = getattr(settings, "HF_AI_URL", None) or os.getenv("HF_AI_URL")
        if hf_url:
            try:
                logger.info(f"Offloading receipt extraction to remote HF Space: {hf_url}")
                hf_token = getattr(settings, "HF_TOKEN", None) or os.getenv("HF_TOKEN")

                # Parse origin to satisfy Starlette / Gradio CSRF origin verification
                parsed_origin = hf_url.split("/extract")[0].rstrip("/") if "/extract" in hf_url else hf_url.rstrip("/")
                headers = {
                    "Origin": parsed_origin,
                    "Referer": f"{parsed_origin}/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                }
                if hf_token:
                    headers["Authorization"] = f"Bearer {hf_token}"

                files = {"file": ("receipt.jpg", image_bytes, "image/jpeg")}
                response = requests.post(hf_url, files=files, headers=headers, timeout=90)

                # If CSRF protection blocks multipart form, retry with JSON payload or alternative field
                if response.status_code == 403 and "Cross-site POST" in response.text:
                    logger.info("Multipart form submission blocked by CSRF; retrying with JSON base64 payload...")
                    import base64
                    b64_img = base64.b64encode(image_bytes).decode("utf-8")
                    json_headers = {
                        "Content-Type": "application/json",
                        "Origin": parsed_origin,
                        "Referer": f"{parsed_origin}/",
                    }
                    if hf_token:
                        json_headers["Authorization"] = f"Bearer {hf_token}"
                    response = requests.post(
                        hf_url,
                        json={"image": b64_img, "image_bytes": b64_img, "file": b64_img},
                        headers=json_headers,
                        timeout=90
                    )

                if response.status_code == 200:
                    resp_json = response.json()
                    if isinstance(resp_json, dict):
                        if "status" in resp_json and "data" in resp_json:
                            return resp_json
                        elif "data" in resp_json:
                            return {"filename": "upload.jpg", "status": "success", "data": resp_json["data"]}
                        elif "receipt_info" in resp_json:
                            return {"filename": "upload.jpg", "status": "success", "data": resp_json}
                        return {"filename": "upload.jpg", "status": "success", "data": resp_json}
                else:
                    logger.warning(
                        f"HF Space returned HTTP {response.status_code}: {response.text[:200]}. "
                        "Falling back to local OCR pipeline."
                    )
            except Exception as hf_err:
                logger.warning(
                    f"Remote HF Engine call failed ({hf_err}). Seamlessly falling back to local OCR pipeline."
                )

        # ── 2. Local Document Intelligence Pipeline ───────────────────────────
        try:
            # 1. Convert bytes to OpenCV format
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError(f"OpenCV failed to decode the image. Received {len(image_bytes)} bytes. It might be corrupted or sent in an incorrect format.")
                
            orig_h, orig_w = img.shape[:2]

            # Resize large images to dramatically speed up PaddleOCR on CPU
            max_dim = 1000
            if max(orig_h, orig_w) > max_dim:
                scale = max_dim / max(orig_h, orig_w)
                new_width = int(orig_w * scale)
                new_height = int(orig_h * scale)
                img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)

            # 2. Preprocess & Correct Perspective
            if preprocess:
                enhanced = self.preprocessor.apply_clahe(img)
                corrected = self.corrector.detect_and_correct(enhanced)
            else:
                corrected = img
            new_h, new_w = corrected.shape[:2]

            # 3. OCR Extraction (run on corrected clean image, fallback to sharpened if sparse)
            raw_results = self.ocr.extract_text(corrected)
            if not raw_results or len(raw_results) < 3:
                ocr_input = self.preprocessor.denoise_and_sharpen(corrected) if preprocess else corrected
                raw_results = self.ocr.extract_text(ocr_input)
            
            words = []
            boxes = []
            
            for res in raw_results:
                text = res["text"]
                bbox = res["bbox"] # [tl, tr, br, bl]
                
                # Normalize bounding box for LayoutLMv3 (0-1000)
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
            
            # Apply LayoutLMv3 token alignment and domain OCR error recovery
            words, boxes = TokenCleaner.split_and_clean_tokens(words, boxes)
            
            # 4. Semantic Entity Classification (Phase 3)
            entities = []
            receipt_data = {}
            if words:
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
        except Exception as e:
            logger.error(f"Structured OCR extraction failed: {str(e)}")
            raise

# Create a singleton instance
ocr_service = OCRService()
