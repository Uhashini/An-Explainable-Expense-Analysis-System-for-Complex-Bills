import logging
import os
import re
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

        # 1. Split space-merged and alphanumeric-merged tokens to match CORD format
        words, boxes = self._split_merged_tokens(words, boxes)

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
            # Retrieve predictions for the first batch
            predictions = logits.argmax(-1)[0].tolist()
            
            # Map predictions back to words using word_ids
            # word_ids maps each token index in the input sequence to its corresponding original word index.
            word_ids = encoding.word_ids(batch_index=0)
            
            # Initialize all word labels as "O" (Outside)
            word_predictions = ["O"] * len(words)
            
            # For each word, use the prediction from its first subtoken
            seen_words = set()
            for token_idx, word_idx in enumerate(word_ids):
                if word_idx is not None and word_idx not in seen_words:
                    if token_idx < len(predictions):
                        label_id = predictions[token_idx]
                        label = self.model.config.id2label.get(label_id, "O")
                        if word_idx < len(word_predictions):
                            word_predictions[word_idx] = label
                            seen_words.add(word_idx)
            
            results = []
            for i, word in enumerate(words):
                label = word_predictions[i]
                
                # Heuristic overrides for rare/confused categories
                word_upper = word.upper().strip()
                
                # 1. Override date tokens to 'receipt.date'
                if re.match(r'^\d{2}[/-]\d{2}[/-]\d{2,4}$', word_upper) or re.match(r'^\d{4}[/-]\d{2}[/-]\d{2}$', word_upper):
                    label = "receipt.date"
                # 2. Override unit price expressions to 'menu.unitprice'
                elif word_upper in ("NET", "@", "NET@") or any(u in word_upper for u in ["/KG", "/LB", "/G", "/EA", "/OZ"]) or word_upper.startswith("NET@"):
                    label = "menu.unitprice"
                # 3. Override loyalty and discount expressions
                elif "LOYALTY" in word_upper:
                    label = "loyalty_discount"
                elif any(kw in word_upper for kw in ["DISC", "DISCOUNT", "PROMO", "POTONGAN", "SAVINGS"]):
                    label = "sub_total.discount_price"
                # Override to discount if it's a negative amount starts with - or within ( )
                elif label == "O" and (word.startswith("-") or (word.startswith("(") and word.endswith(")"))):
                    cleaned_val = "".join(filter(lambda x: x.isdigit() or x in ".,", word))
                    if cleaned_val:
                        label = "sub_total.discount_price"
                
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
            "items": [],
            "discounts": []
        }

        # Y-axis spatial row clustering for line items
        menu_tokens = [ent for ent in entities if ent.get("entity", "").startswith("menu.")]
        if menu_tokens:
            menu_tokens.sort(key=lambda e: ((e["bbox"][1] + e["bbox"][3]) / 2, e["bbox"][0]))
            rows = []
            for token in menu_tokens:
                y_center = (token["bbox"][1] + token["bbox"][3]) / 2
                matched = False
                for row in rows:
                    if abs(y_center - row["avg_y"]) < 28: # Within same horizontal text line
                        row["tokens"].append(token)
                        row["avg_y"] = sum((t["bbox"][1] + t["bbox"][3]) / 2 for t in row["tokens"]) / len(row["tokens"])
                        matched = True
                        break
                if not matched:
                    rows.append({"avg_y": y_center, "tokens": [token]})
            
            for row in rows:
                row_tokens = sorted(row["tokens"], key=lambda t: t["bbox"][0])
                names, price_val, unit_price, qty = [], 0.0, 0.0, 1
                for t in row_tokens:
                    lbl, txt = t.get("entity"), t.get("text", "").strip()
                    if lbl in ("menu.nm", "menu.sub_nm"):
                        if txt not in ("$", "-", "@"): names.append(txt)
                    elif lbl in ("menu.price", "menu.discountprice"):
                        try:
                            val_str = "".join(filter(lambda x: x.isdigit() or x in ".,", txt))
                            if val_str: price_val = float(val_str.replace(",", "."))
                        except ValueError: pass
                    elif lbl == "menu.cnt":
                        try: qty = int(re.sub(r'[^\d]', '', txt) or 1)
                        except ValueError: pass
                if names or price_val > 0:
                    item_name = " ".join(names).strip() or "Item"
                    if not any(char.isalpha() for char in item_name) and price_val == 0.0:
                        continue
                    if price_val > 0: unit_price = price_val / max(1, qty)
                    parsed["items"].append({"name": item_name, "quantity": qty, "unit_price": unit_price, "total_price": price_val})

        # Extract discounts and loyalty programs
        disc_tokens = [ent for ent in entities if ent.get("entity", "") in ("loyalty_discount", "sub_total.discount_price", "discount")]
        if disc_tokens:
            disc_name = " ".join(t["text"] for t in disc_tokens if not t["text"].startswith("-") and not any(c.isdigit() for c in t["text"])).strip() or "Loyalty / Discount"
            disc_val = 0.0
            for t in disc_tokens:
                if t["text"].startswith("-") or any(c.isdigit() for c in t["text"]):
                    try:
                        val_str = "".join(filter(lambda x: x.isdigit() or x in ".,", t["text"]))
                        if val_str: disc_val = float(val_str.replace(",", "."))
                    except ValueError: pass
            if disc_val > 0 or disc_name:
                parsed["discounts"].append({"name": disc_name, "amount": -abs(disc_val) if disc_val > 0 else 0.0})

        # Extract total amount from total.total_price entities (excluding dates with slashes)
        total_candidates = []
        for ent in entities:
            if ent.get("entity") == "total.total_price":
                try:
                    txt = ent.get("text", "")
                    if "/" not in txt and "-" not in txt:
                        val_str = "".join(filter(lambda x: x.isdigit() or x in ".,", txt))
                        if val_str: total_candidates.append(float(val_str.replace(",", ".")))
                except ValueError: pass
        if total_candidates:
            parsed["total_amount"] = max(total_candidates)

        # Filter out line items before passing tokens to RegexParser for merchant name fallback
        non_item_words, non_item_boxes = [], []
        if len(entities) == len(words) == len(boxes):
            for ent, w, b in zip(entities, words, boxes):
                lbl = ent.get("entity", "O")
                if not (lbl.startswith("menu.") or lbl.startswith("sub_total.") or lbl == "total.total_price"):
                    non_item_words.append(w); non_item_boxes.append(b)
        else:
            non_item_words, non_item_boxes = words, boxes

        regex_results = self.regex_fallback.parse(non_item_words if non_item_words else words, non_item_boxes if non_item_boxes else boxes)
        parsed["merchant_name"] = regex_results.get("merchant_name", "")

        full_regex = self.regex_fallback.parse(words, boxes)
        parsed["date"] = full_regex.get("date", "")
        if parsed["total_amount"] == 0.0:
            parsed["total_amount"] = full_regex.get("total_amount", 0.0)

        return parsed

    def _split_merged_tokens(self, words: List[str], boxes: List[List[int]]) -> tuple[List[str], List[List[int]]]:
        """
        Splits space-merged or alphanumeric-merged OCR tokens to align with CORD dataset tokenization.
        Distributes bounding boxes horizontally based on character length.
        """
        new_words = []
        new_boxes = []
        
        # Regex pattern to match alphabetical prefix followed by numeric suffix (e.g., "Qty1.00")
        pattern = re.compile(r'^([a-zA-Z]+)([\d.,]+)$')
        
        for word, box in zip(words, boxes):
            parts = word.split()
            if not parts:
                continue
                
            if len(parts) == 1:
                sub_word = parts[0]
                match = pattern.match(sub_word)
                if match:
                    part1, part2 = match.groups()
                    x1, y1, x2, y2 = box
                    w = x2 - x1
                    split_point = x1 + int(w * (len(part1) / len(sub_word)))
                    new_words.extend([part1, part2])
                    new_boxes.extend([[x1, y1, split_point, y2], [split_point, y1, x2, y2]])
                else:
                    new_words.append(sub_word)
                    new_boxes.append(box)
            else:
                x1, y1, x2, y2 = box
                w = x2 - x1
                total_chars = sum(len(p) for p in parts) + (len(parts) - 1)
                
                curr_x = x1
                for idx, part in enumerate(parts):
                    part_w = int(w * (len(part) / total_chars))
                    part_box = [curr_x, y1, curr_x + part_w, y2]
                    
                    match = pattern.match(part)
                    if match:
                        part1, part2 = match.groups()
                        split_w = int(part_w * (len(part1) / len(part)))
                        new_words.extend([part1, part2])
                        new_boxes.extend([
                            [curr_x, y1, curr_x + split_w, y2],
                            [curr_x + split_w, y1, curr_x + part_w, y2]
                        ])
                    else:
                        new_words.append(part)
                        new_boxes.append(part_box)
                        
                    space_w = int(w * (1 / total_chars))
                    curr_x += part_w + space_w
                    
        return new_words, new_boxes
