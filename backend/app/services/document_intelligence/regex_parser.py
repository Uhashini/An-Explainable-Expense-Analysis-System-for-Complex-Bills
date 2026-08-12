import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class RegexParser:
    """
    High-reliability semantic parser using pattern matching and positional heuristics.
    Acts as the primary fallback when LayoutLMv3 is disabled or low confidence.
    """

    def __init__(self):
        # Compiled patterns for efficiency
        self.date_patterns = [
            re.compile(r'\d{2}/\d{2}/\d{2,4}'),
            re.compile(r'\d{2}-\d{2}-\d{2,4}'),
            re.compile(r'\d{2}\.\d{2}\.\d{2,4}'),
            re.compile(r'\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}', re.I)
        ]
        
        self.total_keywords = [
            "total", "net amount", "grand total", "amount due", "balance due", "pay this amount"
        ]
        
        self.currency_pattern = re.compile(r'(\d+[.,]\d{2})')

    def parse(self, words: List[str], boxes: List[List[int]]) -> Dict[str, Any]:
        """
        Extracts key fields from normalized OCR results.
        """
        extracted = {
            "merchant_name": self._extract_merchant(words, boxes),
            "date": self._extract_date(words),
            "total_amount": self._extract_total(words, boxes),
            "items": self._extract_items(words, boxes)
        }
        return extracted

    def _extract_merchant(self, words: List[str], boxes: List[List[int]]) -> str:
        """
        Heuristic: Merchant name is in the top header area and consists of valid alphabetic text.
        Filters out timestamps, prices, dates, decorative characters, and receipt keywords.
        """
        if not words: return ""
        
        ignore_keywords = {"date", "time", "wed", "thu", "fri", "sat", "sun", "mon", "tue",
                           "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
                           "receipt", "tax", "invoice", "cashier", "chk", "tbl", "guest", "tel", "phone", "gst", "reg"}
        
        top_candidates = []
        for i, (word, box) in enumerate(zip(words, boxes)):
            if box[1] > 180: # Beyond top 18%
                continue
                
            clean_word = word.strip()
            # Skip decorative lines or purely non-alphanumeric noise (e.g. ***************)
            if not re.search(r'[a-zA-Z]', clean_word) or set(clean_word).issubset(set("-*=_.,/#:$@!")):
                continue
                
            # Skip currency symbols or price amounts ($4.66, 12.00)
            if self.currency_pattern.search(clean_word) or any(char in clean_word for char in "$£€RpRM"):
                continue
                
            # Skip dates or timestamps (06/01/2016)
            if any(p.search(clean_word) for p in self.date_patterns) or re.search(r'\d{1,2}:\d{2}', clean_word):
                continue
                
            # Skip common receipt metadata keywords or weight descriptors (0.778kg)
            if clean_word.lower() in ignore_keywords or re.search(r'\d+kg|\d+g|\d+ml|\d+l|net', clean_word.lower()):
                continue
                
            top_candidates.append(clean_word)
            if len(top_candidates) >= 4:
                break
                
        merchant_str = " ".join(top_candidates).strip()
        return merchant_str if len(merchant_str) >= 2 else ""

    def _extract_date(self, words: List[str]) -> str:
        """
        Finds the first string matching a date pattern.
        """
        for word in words:
            for pattern in self.date_patterns:
                match = pattern.search(word)
                if match:
                    return match.group()
        return ""

    def _extract_total(self, words: List[str], boxes: List[List[int]]) -> float:
        """
        Looks for 'total' keywords and finds the nearest currency-like number below or to the right.
        """
        full_text_lower = " ".join(words).lower()
        
        # Strategy 1: Find keywords and look for numbers in the same neighborhood
        for i, word in enumerate(words):
            if any(kw in word.lower() for kw in self.total_keywords):
                # Search the next 5 words for a number
                for j in range(i + 1, min(i + 6, len(words))):
                    match = self.currency_pattern.search(words[j])
                    if match:
                        try:
                            val = match.group().replace(",", ".")
                            return float(val)
                        except:
                            continue
        
        # Strategy 2: Largest currency-like number at the bottom half
        prices = []
        for i, word in enumerate(words):
            if boxes[i][1] > 500: # Bottom half
                match = self.currency_pattern.search(word)
                if match:
                    try:
                        val = float(match.group().replace(",", "."))
                        prices.append(val)
                    except:
                        continue
        
        return max(prices) if prices else 0.0

    def _extract_items(self, words: List[str], boxes: List[List[int]]) -> List[Dict[str, Any]]:
        """
        Groups words into horizontal lines and attempts to extract line items with prices.
        """
        if not words: return []
        
        # Group words by line based on y-coordinates
        lines = []
        for word, box in zip(words, boxes):
            y_center = (box[1] + box[3]) / 2
            matched = False
            for line in lines:
                if abs(line["avg_y"] - y_center) < 20: # Tolerance for same line
                    line["words"].append({"text": word, "box": box})
                    line["avg_y"] = sum((w["box"][1] + w["box"][3])/2 for w in line["words"]) / len(line["words"])
                    matched = True
                    break
            if not matched:
                lines.append({"avg_y": y_center, "words": [{"text": word, "box": box}]})
                
        # Sort lines vertically
        lines.sort(key=lambda x: x["avg_y"])
        
        items = []
        for line in lines:
            # Sort words in the line horizontally
            line["words"].sort(key=lambda x: x["box"][0])
            line_text = [w["text"] for w in line["words"]]
            
            # Skip likely non-item lines
            full_line_lower = " ".join(line_text).lower()
            if any(kw in full_line_lower for kw in ["total", "subtotal", "tax", "cash", "change", "visa", "mastercard"]):
                continue
                
            # Try to find price (usually the last or second to last token with numbers/decimals)
            price_val = 0.0
            name_tokens = []
            qty = 1
            
            for token in line_text:
                match = self.currency_pattern.search(token)
                if match and len(token) <= 8 and not name_tokens: # if price comes first? unlikely
                    pass
                elif match:
                    try:
                        price_val = float(match.group().replace(",", "."))
                    except:
                        pass
                else:
                    # heuristic for quantity like '2x' or '3' at start
                    if not name_tokens and re.match(r'^\d+x?$', token.lower()):
                        try:
                            qty_str = token.lower().replace('x', '')
                            if qty_str: qty = int(qty_str)
                        except:
                            pass
                    else:
                        name_tokens.append(token)
                        
            # If we found a price and some name tokens, consider it an item
            name = " ".join(name_tokens).strip()
            # Clean up trailing weird chars in name
            name = re.sub(r'[^\w\s]+$', '', name).strip()
            
            if name and price_val > 0 and len(name) > 2:
                items.append({
                    "name": name,
                    "quantity": qty,
                    "unit_price": price_val if qty <= 1 else round(price_val/qty, 2),
                    "total_price": price_val
                })
                
        return items

