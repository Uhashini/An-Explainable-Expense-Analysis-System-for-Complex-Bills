import logging
from typing import List, Dict, Any, Union, Optional
import numpy as np

logger = logging.getLogger(__name__)

class TrOCRFallback:
    """
    High-precision fallback OCR using Microsoft's TrOCR.
    Best for handwritten text or low-confidence regions identified by the primary engine.
    """

    def __init__(self, model_size: str = "base"):
        """
        Initializes the TrOCR model lazily.
        """
        self.enabled = False
        try:
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
            import torch
            
            model_name = f"microsoft/trocr-{model_size}-handwritten"
            self.processor = TrOCRProcessor.from_pretrained(model_name)
            self.model = VisionEncoderDecoderModel.from_pretrained(model_name)
            
            # Use GPU if available
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model.to(self.device)
            self.torch = torch
            
            logger.info(f"TrOCR {model_size} initialized on {self.device}")
            self.enabled = True
        except Exception as e:
            logger.warning(f"TrOCR fallback disabled due to missing dependencies (torch/shm.dll): {e}")

    def process_crop(self, image_crop: Union[np.ndarray, Any]) -> str:
        """
        Processes a small image crop (e.g., a single line or word) for high precision.
        """
        if not self.enabled:
            return ""

        try:
            from PIL import Image
            if isinstance(image_crop, np.ndarray):
                image_crop = Image.fromarray(image_crop).convert("RGB")
            
            # Prepare image for model
            pixel_values = self.processor(images=image_crop, return_tensors="pt").pixel_values
            pixel_values = pixel_values.to(self.device)

            # Generate text
            with self.torch.no_grad():
                generated_ids = self.model.generate(pixel_values)
            
            generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            return generated_text
        except Exception as e:
            logger.error(f"TrOCR processing error: {e}")
            return ""

    def fallback_on_low_confidence(self, full_image: np.ndarray, ocr_results: List[Dict[str, Any]], threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Iterates through OCR results and re-processes regions below the confidence threshold.
        """
        if not self.enabled:
            return ocr_results

        updated_results = []
        for res in ocr_results:
            if res["confidence"] < threshold:
                logger.info(f"Low confidence ({res['confidence']:.2f}) for '{res['text']}'. Triggering TrOCR fallback.")
                
                # Crop the image region (bbox format: [tl, tr, br, bl])
                bbox = np.array(res["bbox"], dtype=np.int32)
                min_x = max(0, np.min(bbox[:, 0]))
                max_x = min(full_image.shape[1], np.max(bbox[:, 0]))
                min_y = max(0, np.min(bbox[:, 1]))
                max_y = min(full_image.shape[0], np.max(bbox[:, 1]))
                
                crop = full_image[min_y:max_y, min_x:max_x]
                
                if crop.size > 0:
                    corrected_text = self.process_crop(crop)
                    if corrected_text:
                        res["text"] = corrected_text
                        res["confidence"] = 0.95  # Assign high confidence for successful TrOCR pass
                        res["is_fallback"] = True
            
            updated_results.append(res)
        
        return updated_results
