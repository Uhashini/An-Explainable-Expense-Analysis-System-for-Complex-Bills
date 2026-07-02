import logging
import os
from typing import List, Dict, Any, Optional
import numpy as np

from .regex_parser import RegexParser

logger = logging.getLogger(__name__)

class LayoutLMService:
    """
    Microsoft LayoutLMv3 Service for Multimodal Document Understanding.
    Classifies OCR tokens into semantic entities.
    """

    def __init__(self, model_name: str = "microsoft/layoutlmv3-base"):
        """
        Initializes the LayoutLMv3 processor and model lazily.
        Checks for fine-tuned checkpoints locally before falling back to default.
        """
        self.enabled = False
        self.regex_fallback = RegexParser()
        
        # Check potential local paths for fine-tuned weights
        model_paths = [
            "./layoutlmv3-finetuned",
            "./layoutlmv3-smoke-test",
            model_name
        ]
        
        selected_path = None
        for path in model_paths:
            if path == model_name or os.path.exists(path):
                selected_path = path
                break
                
        try:
            from transformers import LayoutLMv3Processor, LayoutLMv3ForTokenClassification
            import torch
            
            logger.info(f"Loading LayoutLMv3 model from path: {selected_path}")
            self.processor = LayoutLMv3Processor.from_pretrained(selected_path, apply_ocr=False)
            self.model = LayoutLMv3ForTokenClassification.from_pretrained(selected_path)
            
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

        # CORD entity parsing logic
        current_item = None
        
        for ent in entities:
            label = ent.get("entity", "O")
            text = ent.get("text", "")
            
            # menu.nm = Item name, menu.cnt = Quantity, menu.price = Price
            if label == "menu.nm":
                if current_item is None:
                    current_item = {"name": text, "quantity": 1, "unit_price": 0.0, "total_price": 0.0}
                else:
                    current_item["name"] += f" {text}"
            elif label == "menu.cnt":
                if current_item is not None:
                    try:
                        current_item["quantity"] = int(text)
                    except ValueError:
                        pass
            elif label == "menu.price":
                if current_item is not None:
                    try:
                        val = "".join(filter(lambda x: x.isdigit() or x in ".,", text))
                        if val:
                            current_item["total_price"] = float(val.replace(",", "."))
                            # Set unit price as total_price / quantity if possible
                            current_item["unit_price"] = current_item["total_price"] / max(1, current_item["quantity"])
                            parsed["items"].append(current_item)
                            current_item = None
                    except:
                        pass
            elif label == "total.total_price":
                try:
                    val = "".join(filter(lambda x: x.isdigit() or x in ".,", text))
                    if val:
                        parsed["total_amount"] = float(val.replace(",", "."))
                except:
                    pass
                    
        # Append remaining item if any
        if current_item is not None and current_item.get("name"):
            parsed["items"].append(current_item)

        # CORD dataset does not label merchant name and date.
        # We always run RegexParser to extract them from raw OCR tokens.
        regex_results = self.regex_fallback.parse(words, boxes)
        parsed["merchant_name"] = regex_results.get("merchant_name", "")
        parsed["date"] = regex_results.get("date", "")
        
        # If AI didn't catch total_amount, use Regex parser fallback
        if parsed["total_amount"] == 0.0:
            parsed["total_amount"] = regex_results.get("total_amount", 0.0)

        return parsed
