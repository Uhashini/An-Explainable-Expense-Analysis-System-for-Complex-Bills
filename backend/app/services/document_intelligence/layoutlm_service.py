import logging
from typing import List, Dict, Any, Optional
import numpy as np

from .regex_parser import RegexParser

logger = logging.getLogger(__name__)

class LayoutLMService:
    """
    Microsoft LayoutLMv3 Service for Multimodal Document Understanding.
    Classifies OCR tokens into semantic entities (Merchant, Date, Total).
    """

    def __init__(self, model_name: str = "microsoft/layoutlmv3-base"):
        """
        Initializes the LayoutLMv3 processor and model lazily.
        """
        self.enabled = False
        self.regex_fallback = RegexParser()
        try:
            from transformers import LayoutLMv3Processor, LayoutLMv3ForTokenClassification
            import torch
            
            self.processor = LayoutLMv3Processor.from_pretrained(model_name, apply_ocr=False)
            self.model = LayoutLMv3ForTokenClassification.from_pretrained(model_name)
            
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model.to(self.device)
            self.torch = torch
            
            logger.info(f"LayoutLMv3 initialized on {self.device}")
            self.enabled = True
        except Exception as e:
            logger.warning(f"LayoutLMv3 disabled due to initialization error: {e}")

    def predict_entities(self, image: np.ndarray, words: List[str], boxes: List[List[int]]) -> List[Dict[str, Any]]:
        """
        Performs multimodal inference on OCR results.
        - boxes: Normalized [x1, y1, x2, y2] in 0-1000 range.
        """
        if not self.enabled:
            return []

        try:
            encoding = self.processor(
                image, 
                words, 
                boxes=boxes, 
                return_tensors="pt", 
                truncation=True, 
                padding="max_length"
            )
            
            # Move to device
            for k, v in encoding.items():
                encoding[k] = v.to(self.device)

            with self.torch.no_grad():
                outputs = self.model(**encoding)
            
            logits = outputs.logits
            predictions = logits.argmax(-1).squeeze().tolist()
            
            # Map predictions back to words
            # Note: This is a simplified mapping; real production uses sub-word alignment
            results = []
            for i, word in enumerate(words):
                # Using id2label from model config
                label_id = predictions[i] if i < len(predictions) else 0
                label = self.model.config.id2label.get(label_id, "O")
                
                results.append({
                    "text": word,
                    "bbox": boxes[i],
                    "entity": label
                })
            
            return results
        except Exception as e:
            logger.error(f"LayoutLM inference failed: {e}")
            return []

    def parse_receipt_entities(self, entities: List[Dict[str, Any]], words: List[str] = None, boxes: List[List[int]] = None) -> Dict[str, Any]:
        """
        Heuristic-based aggregation of LayoutLM token results into a structured receipt object.
        If AI is disabled or empty, falls back to Regex recognition.
        """
        if not entities and words and boxes:
            logger.info("Semantic AI disabled/empty. Falling back to RegexParser.")
            return self.regex_fallback.parse(words, boxes)

        parsed = {
            "merchant_name": "",
            "date": "",
            "total_amount": 0.0,
            "items": []
        }

        # Simplified greedy aggregation
        for ent in entities:
            label = ent.get("entity", "O")
            text = ent.get("text", "")
            
            if "COMPANY" in label or "MERCHANT" in label:
                parsed["merchant_name"] += f" {text}"
            elif "DATE" in label:
                parsed["date"] = text
            elif "TOTAL" in label:
                try:
                    # Basic numeric extraction from string
                    val = "".join(filter(lambda x: x.isdigit() or x in ".,", text))
                    if val:
                        parsed["total_amount"] = float(val.replace(",", "."))
                except:
                    pass
        
        parsed["merchant_name"] = parsed["merchant_name"].strip()
        
        # Secondary Merge: If AI missed critical fields, use Regex to fill the gaps
        if not parsed["merchant_name"] or parsed["total_amount"] == 0:
            logger.info("AI results incomplete. Supplementing with RegexParser.")
            regex_results = self.regex_fallback.parse(words, boxes)
            if not parsed["merchant_name"]: parsed["merchant_name"] = regex_results["merchant_name"]
            if not parsed["date"]: parsed["date"] = regex_results["date"]
            if parsed["total_amount"] == 0: parsed["total_amount"] = regex_results["total_amount"]

        return parsed
