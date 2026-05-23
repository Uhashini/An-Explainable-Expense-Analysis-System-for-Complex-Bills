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
            "items": []
        }
        return extracted

    def _extract_merchant(self, words: List[str], boxes: List[List[int]]) -> str:
        """
        Heuristic: Merchant name is usually in the top 15% of the receipt and has larger font.
        """
        if not words: return ""
        
        # Look at the first 5-10 words that are in the upper section (y < 250 in 0-1000 scale)
        top_candidates = []
        for i, box in enumerate(boxes):
            if box[1] < 150: # Top 15%
                top_candidates.append(words[i])
            if len(top_candidates) > 5: break
            
        return " ".join(top_candidates).strip()

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
