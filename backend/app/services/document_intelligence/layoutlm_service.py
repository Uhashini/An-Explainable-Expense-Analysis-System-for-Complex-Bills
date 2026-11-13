import logging
import os
import re
from typing import List, Dict, Any, Optional
import numpy as np

# Import torch and transformers at the module level to ensure clean DLL initialization on Windows
try:
    import torch
    from transformers import LayoutLMv3Processor, LayoutLMv3ForTokenClassification
    TRANSFORMERS_AVAILABLE = True
except Exception as e:
    TRANSFORMERS_AVAILABLE = False
    LayoutLMv3Processor = None
    LayoutLMv3ForTokenClassification = None
    torch = None

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
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
        candidate_paths = [
            os.path.join(backend_dir, "layoutlmv3-finetuned"),
            os.path.join(backend_dir, "layoutlmv3"),
            "./layoutlmv3-finetuned",
            "./layoutlmv3",
            os.path.join(backend_dir, "layoutlmv3-smoke-test"),
            "./layoutlmv3-smoke-test",
        ]
        
        self.model_name = model_name
        self.selected_path = None
        for path in candidate_paths:
            if os.path.isdir(path) and os.path.isfile(os.path.join(path, "config.json")):
                self.selected_path = os.path.abspath(path)
                break
        if not self.selected_path:
            self.selected_path = model_name

    def _ensure_model_loaded(self):
        if self.enabled:
            return True
        if not TRANSFORMERS_AVAILABLE:
            logger.warning("Transformers/PyTorch not available for LayoutLMv3.")
            return False
        try:
            logger.info(f"Loading LayoutLMv3 model from path: {self.selected_path}")
            self.processor = LayoutLMv3Processor.from_pretrained(self.selected_path, apply_ocr=False)
            self.model = LayoutLMv3ForTokenClassification.from_pretrained(self.selected_path)
            
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model.to(self.device)
            self.torch = torch
            
            logger.info(f"LayoutLMv3 initialized on {self.device}")
            self.enabled = True
            return True
        except Exception as e:
            logger.warning(f"LayoutLMv3 disabled due to initialization error: {e}")
            return False

    def predict_entities(self, image: np.ndarray, words: List[str], boxes: List[List[int]]) -> List[Dict[str, Any]]:
        """
        Performs multimodal inference on OCR results.
        - boxes: Normalized [x1, y1, x2, y2] in 0-1000 range.
        """
        if not self._ensure_model_loaded():
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
                padding=True
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

    def parse_receipt_entities(self, entities: List[Dict[str, Any]], words: List[str] = None, boxes: List[List[int]] = None, raw_results: Any = None, **kwargs) -> Dict[str, Any]:
        """
        Heuristic-based aggregation of LayoutLM token results into a structured receipt object.
        Reconciles with RegexParser for complete multi-line item, header, and validation accuracy.
        """
        if not entities and words and boxes:
            logger.info("Semantic AI disabled/empty. Falling back to RegexParser.")
            return self.regex_fallback.parse(words, boxes)

        parsed = {
            "merchant_name": "",
            "store_address": "",
            "bill_number": "",
            "date": "",
            "time": "",
            "total_amount": 0.0,
            "subtotal": 0.0,
            "items": [],
            "discounts": [],
            "taxes": [],
            "validation": {}
        }

        # Non-drifting horizontal line clustering for menu items
        menu_tokens = [ent for ent in entities if ent.get("entity", "").startswith("menu.")]
        if menu_tokens:
            menu_tokens.sort(key=lambda e: (e["bbox"][1], e["bbox"][0]))
            rows = []
            for token in menu_tokens:
                y_center = (token["bbox"][1] + token["bbox"][3]) / 2.0
                h = max(1, token["bbox"][3] - token["bbox"][1])
                matched = False
                for row in rows:
                    overlap = min(token["bbox"][3], row["y2"]) - max(token["bbox"][1], row["y1"])
                    min_h = min(h, row["height"])
                    if (min_h > 0 and overlap / min_h > 0.40) or abs(y_center - row["anchor_y"]) < 12:
                        row["tokens"].append(token)
                        row["y1"] = min(row["y1"], token["bbox"][1])
                        row["y2"] = max(row["y2"], token["bbox"][3])
                        row["height"] = row["y2"] - row["y1"]
                        matched = True
                        break
                if not matched:
                    rows.append({
                        "anchor_y": y_center,
                        "y1": token["bbox"][1],
                        "y2": token["bbox"][3],
                        "height": h,
                        "tokens": [token]
                    })
            
            rows.sort(key=lambda r: r["y1"])
            pending_names = []

            for row in rows:
                row_tokens = sorted(row["tokens"], key=lambda t: t["bbox"][0])
                names, price_val, unit_price, qty = [], 0.0, 0.0, 1
                rateunit = ""
                for t in row_tokens:
                    lbl, txt = t.get("entity"), t.get("text", "").strip()
                    if lbl in ("menu.nm", "menu.sub_nm"):
                        if txt not in ("$", "-", "@", "₹"): names.append(txt)
                    elif lbl in ("menu.price", "menu.discountprice"):
                        try:
                            val_str = "".join(filter(lambda x: x.isdigit() or x in ".,", txt))
                            if val_str: price_val = float(val_str.replace(",", "."))
                        except ValueError: pass
                    elif lbl == "menu.unitprice":
                        try:
                            val_str = "".join(filter(lambda x: x.isdigit() or x in ".,", txt))
                            if val_str: unit_price = float(val_str.replace(",", "."))
                            
                            unit_match = re.search(r'[A-Za-z]+', txt)
                            if unit_match:
                                rateunit = unit_match.group()
                        except ValueError: pass
                    elif lbl == "menu.cnt":
                        clean_cnt = "".join(filter(lambda x: x.isdigit() or x in ".,", txt))
                        if clean_cnt:
                            try:
                                qty = float(clean_cnt) if "." in clean_cnt else int(clean_cnt)
                            except ValueError:
                                qty = txt
                        unit_match = re.search(r'^[a-zA-Z]+$', txt)
                        if unit_match:
                            rateunit = unit_match.group()
                                
                if (price_val > 0 or unit_price > 0):
                    combined_names = pending_names + names
                    pending_names = []
                    item_name = " ".join(combined_names).strip() or "Item"
                    
                    # Filter out non-food tax & metadata lines
                    item_lower = item_name.lower()
                    non_food_kw = ["cgst", "sgst", "gst", "vat", "tax", "round", "subtotal", "sub total", "total", "fssai", "gstin", "dine in", "bill no", "token no"]
                    if any(kw in item_lower for kw in non_food_kw):
                        continue
                    if not any(char.isalpha() for char in item_name) and price_val == 0.0:
                        continue
                    
                    # Clean portion codes like HALF-85 and punctuation
                    item_name = re.sub(r'(?i)HALF-\d+', '', item_name).strip("- ")
                    item_name = re.sub(r'[-_]+', ' ', item_name).strip()
                    item_name = " ".join([p.capitalize() for p in item_name.split()])
                    
                    calc_total = price_val if price_val > 0 else (unit_price * (qty if isinstance(qty, (int, float)) and qty > 0 else 1))

                    parsed["items"].append({
                        "name": item_name, 
                        "quantity": qty, 
                        "unit_price": unit_price if unit_price > 0 else (round(calc_total / qty, 2) if isinstance(qty, (int, float)) and qty > 1 else calc_total), 
                        "total_price": calc_total,
                        "rateunit": rateunit
                    })
                else:
                    if names:
                        pending_names.extend(names)

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

        # Extract metadata from RegexParser
        full_regex = self.regex_fallback.parse(words, boxes)
        parsed["merchant_name"] = full_regex.get("merchant_name", "") or parsed.get("merchant_name", "")
        parsed["store_address"] = full_regex.get("store_address", "") or parsed.get("store_address", "")
        parsed["bill_number"] = full_regex.get("bill_number", "") or parsed.get("bill_number", "")
        parsed["date"] = parsed["date"] or full_regex.get("date", "")
        parsed["time"] = full_regex.get("time", "") or parsed.get("time", "")
        parsed["subtotal"] = full_regex.get("subtotal", 0.0)
        parsed["taxes"] = full_regex.get("taxes", [])
        parsed["validation"] = full_regex.get("validation", {})
        if parsed["total_amount"] == 0.0:
            parsed["total_amount"] = full_regex.get("total_amount", 0.0)

        # Reconcile items between Semantic AI and RegexParser
        regex_items = full_regex.get("items", [])
        regex_reconciled = full_regex.get("validation", {}).get("is_reconciled", False)
        ai_items = parsed.get("items", [])
        ai_sum = round(sum(it.get("total_price", 0.0) for it in ai_items), 2)
        regex_sum = round(sum(it.get("total_price", 0.0) for it in regex_items), 2)
        target_total = parsed.get("subtotal") or parsed.get("total_amount") or full_regex.get("subtotal") or full_regex.get("total_amount") or 0.0

        should_use_regex = False
        if not ai_items and regex_items:
            should_use_regex = True
        elif any(it.get("total_price", 0) >= 10000 or it.get("unit_price", 0) >= 10000 for it in ai_items):
            # Discard spurious entities tagged as item prices (e.g. transaction IDs or barcodes)
            should_use_regex = True
        elif len(regex_items) > len(ai_items):
            # RegexParser recovered more discrete items
            should_use_regex = True
        elif regex_reconciled:
            # RegexParser mathematically verified all items and taxes
            should_use_regex = True
        elif target_total > 0 and abs(regex_sum - target_total) < abs(ai_sum - target_total) - 1.0:
            should_use_regex = True

        if should_use_regex:
            logger.info(
                f"RegexParser successfully extracted and verified {len(regex_items)} items "
                f"(sum {regex_sum}) vs {len(ai_items)} items from Semantic AI. Using verified items."
            )
            parsed["items"] = regex_items

        # Clean merchant name if trailing unbalanced parenthesis
        if parsed.get("merchant_name"):
            m = parsed["merchant_name"]
            if m.count("(") < m.count(")"):
                parsed["merchant_name"] = re.sub(r'\)+$', '', m).strip()
            elif m.count("(") > m.count(")"):
                parsed["merchant_name"] = re.sub(r'^\(+', '', m).strip()

        return parsed

    def _split_merged_tokens(self, words: List[str], boxes: List[List[int]]) -> tuple[List[str], List[List[int]]]:
        """
        Splits space-merged or alphanumeric-merged OCR tokens to align with CORD dataset tokenization.
        Distributes bounding boxes horizontally based on character length.
        """
        new_words = []
        new_boxes = []
        
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
