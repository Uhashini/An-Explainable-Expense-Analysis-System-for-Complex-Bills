from PIL import Image
import io
import os
import cv2
import numpy as np
import logging
import requests
from typing import Optional, Dict, Any, Union
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
    Supports offloading to remote Hugging Face AI microservice (ZeroGPU) via Gradio Client / REST,
    with automatic fallback to the local pipeline.
    """
    def __init__(self):
        self.classifier = InputClassifier()
        self.preprocessor = PreprocessingService()
        self.corrector = PerspectiveCorrector()
        self.ocr = OCREngine(lang='en')
        self.voting = VotingEngine()
        self.layoutlm = LayoutLMService()
        self._hf_client = None

    def _get_hf_space_id(self, hf_url: str) -> str:
        """Derive the canonical HF Space identifier ('Uhashini/pantrix-ai-engine')."""
        if not hf_url:
            return "Uhashini/pantrix-ai-engine"
        if "uhashini-pantrix-ai-engine" in hf_url.lower():
            return "Uhashini/pantrix-ai-engine"
        if "/" in hf_url and not hf_url.startswith("http"):
            return hf_url
        return "Uhashini/pantrix-ai-engine"

    def _extract_via_gradio(self, image_bytes: bytes, hf_url: str, hf_token: Optional[str]) -> Optional[dict]:
        """Extract receipt data using the official Gradio Client for ZeroGPU Spaces."""
        import tempfile
        import os
        import json
        try:
            from gradio_client import Client, handle_file
        except ImportError:
            logger.debug("gradio_client not installed; skipping Gradio client route.")
            return None

        space_id = self._get_hf_space_id(hf_url)
        try:
            if self._hf_client is None:
                logger.info(f"Initializing Gradio Client for Space: {space_id}")
                try:
                    self._hf_client = Client(space_id, hf_token=hf_token)
                except Exception as id_err:
                    base_url = hf_url.split("/extract")[0].rstrip("/") if "/extract" in hf_url else hf_url.rstrip("/")
                    logger.info(f"Connecting Gradio Client via Space URL: {base_url}")
                    self._hf_client = Client(base_url, hf_token=hf_token)

            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
                f.write(image_bytes)
                tmp_path = f.name

            try:
                result = None
                # Gradio spaces may register the prediction function under /extract, /predict, fn_index=0, or default
                for api_target in ["/extract", "/predict", None]:
                    try:
                        logger.info(f"Calling Gradio Space endpoint (api_name={api_target})...")
                        if api_target:
                            result = self._hf_client.predict(handle_file(tmp_path), api_name=api_target)
                        else:
                            result = self._hf_client.predict(handle_file(tmp_path))
                        if result is not None:
                            logger.info(f"Gradio extraction succeeded via api_name={api_target}")
                            break
                    except Exception as call_err:
                        logger.debug(f"Gradio prediction with api_name={api_target} failed: {call_err}")
                        continue

                # If named routes failed, try primary fn_index 0
                if result is None:
                    try:
                        logger.info("Attempting Gradio prediction with fn_index=0...")
                        result = self._hf_client.predict(handle_file(tmp_path), fn_index=0)
                    except Exception as fn_err:
                        logger.debug(f"Gradio fn_index=0 failed: {fn_err}")

                if result is None:
                    return None

                resp_json = None
                if isinstance(result, str):
                    if os.path.isfile(result):
                        with open(result, "r", encoding="utf-8") as rf:
                            resp_json = json.load(rf)
                    else:
                        try:
                            resp_json = json.loads(result)
                        except Exception:
                            resp_json = {"raw_output": result}
                elif isinstance(result, (list, tuple)) and len(result) > 0:
                    first = result[0]
                    if isinstance(first, str) and os.path.isfile(first):
                        with open(first, "r", encoding="utf-8") as rf:
                            resp_json = json.load(rf)
                    elif isinstance(first, dict):
                        resp_json = first
                    else:
                        resp_json = {"data": result}
                elif isinstance(result, dict):
                    resp_json = result

                if resp_json:
                    if "status" in resp_json and "data" in resp_json:
                        return resp_json
                    elif "data" in resp_json:
                        return {"filename": "upload.jpg", "status": "success", "data": resp_json["data"]}
                    elif "receipt_info" in resp_json:
                        return {"filename": "upload.jpg", "status": "success", "data": resp_json}
                    return {"filename": "upload.jpg", "status": "success", "data": resp_json}

            finally:
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Gradio Space client call failed: {e}")
        return None

    def _call_gradio_rest_api(self, base_url: str, image_bytes: bytes, hf_token: Optional[str]) -> Optional[dict]:
        """Gradio 4+ REST Protocol: 1) Upload file -> 2) Call queue -> 3) Fetch event SSE."""
        import json
        headers = {}
        if hf_token:
            headers["Authorization"] = f"Bearer {hf_token}"

        clean_base = base_url.split("/extract")[0].rstrip("/") if "/extract" in base_url else base_url.rstrip("/")

        try:
            # 1. Upload file to /gradio_api/upload
            upload_url = f"{clean_base}/gradio_api/upload"
            files = {"files": ("receipt.jpg", image_bytes, "image/jpeg")}
            up_resp = requests.post(upload_url, files=files, headers=headers, timeout=60)
            if up_resp.status_code != 200:
                logger.debug(f"Gradio upload returned {up_resp.status_code}: {up_resp.text[:100]}")
                return None

            uploaded_data = up_resp.json()
            server_path = uploaded_data[0] if isinstance(uploaded_data, list) else uploaded_data

            # 2. Call endpoint /gradio_api/call/extract or /gradio_api/call/predict
            for api_name in ["extract", "predict"]:
                call_url = f"{clean_base}/gradio_api/call/{api_name}"
                payload = {
                    "data": [
                        {
                            "path": server_path,
                            "meta": {"_type": "gradio.FileData"}
                        }
                    ]
                }
                call_resp = requests.post(call_url, json=payload, headers=headers, timeout=60)
                if call_resp.status_code == 200:
                    call_json = call_resp.json()
                    event_id = call_json.get("event_id")
                    if not event_id:
                        continue

                    # 3. Stream event completion
                    event_url = f"{clean_base}/gradio_api/call/{api_name}/{event_id}"
                    res_resp = requests.get(event_url, headers=headers, stream=True, timeout=90)
                    if res_resp.status_code == 200:
                        for line in res_resp.iter_lines():
                            if not line:
                                continue
                            line_str = line.decode("utf-8")
                            if line_str.startswith("data:"):
                                raw_val = line_str[5:].strip()
                                try:
                                    parsed = json.loads(raw_val)
                                    if isinstance(parsed, list) and len(parsed) > 0:
                                        item = parsed[0]
                                        if isinstance(item, dict):
                                            if "status" in item and "data" in item:
                                                return item
                                            elif "receipt_info" in item:
                                                return {"filename": "upload.jpg", "status": "success", "data": item}
                                            return {"filename": "upload.jpg", "status": "success", "data": item}
                                except Exception:
                                    continue
        except Exception as rest_err:
            logger.debug(f"Gradio REST protocol attempt failed: {rest_err}")
        return None

    def extract_structured_data(self, image_bytes: bytes, preprocess: bool = True) -> dict:
        """
        Full extraction flow:
        1. If HF_AI_URL is configured, offload to remote GPU Space (via Gradio Client or Gradio REST).
        2. Fallback to local CPU/GPU pipeline: Classify -> Preprocess -> Correct -> OCR -> Vote -> LayoutLM.
        """
        if not image_bytes or len(image_bytes) == 0:
            raise ValueError("Received empty image bytes (length 0).")

        # ── 1. Remote Hugging Face AI Engine Offload ──────────────────────────
        hf_url = getattr(settings, "HF_AI_URL", None) or os.getenv("HF_AI_URL")
        hf_token = getattr(settings, "HF_TOKEN", None) or os.getenv("HF_TOKEN")

        if hf_url:
            # 1a. Attempt official Gradio Client (best for Gradio / ZeroGPU spaces)
            gradio_res = self._extract_via_gradio(image_bytes, hf_url, hf_token)
            if gradio_res:
                return gradio_res

            # 1b. Attempt Gradio 4 REST Protocol (upload -> call -> stream)
            rest_res = self._call_gradio_rest_api(hf_url, image_bytes, hf_token)
            if rest_res:
                return rest_res

            logger.warning("Remote HF AI Engine did not return valid output. Falling back to local OCR pipeline.")

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
