import re
import difflib
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

class TokenCleaner:
    """
    LayoutLMv3-aligned OCR token splitting, spacing recovery, and domain vocabulary correction engine.
    Ensures OCR output is atomic (word-level tokens with accurate bounding boxes) and free of optical typos.
    """
    COMMON_VOCAB = {
        "TOTAL", "SUBTOTAL", "CASH", "CHANGE", "TAX", "DISCOUNT", "PRICE", "ITEMS",
        "QTY", "PAY", "CRISPY", "CHICKEN", "DONUT", "BREAD", "SALT", "POPCORN", "SEDANG",
        "CREAMCHEESE", "FRANKFURT", "SAUSAGE", "ROLL", "AMOUNT", "DUE", "PAID", "BALANCE", "DATE", "TIME"
    }

    @classmethod
    def correct_token(cls, token: str) -> str:
        """
        Applies domain vocabulary recovery and optical character confusion correction.
        """
        # 1. Numeric price optical confusion recovery (e.g., 5C,000 -> 50,000, 1O.OO -> 10.00)
        if (any(c.isdigit() for c in token) or any(c in '.,' for c in token)) and not token.isalpha():
            allowed_confusions = set("COoDSlIiZzB,.-/+$")
            if all(c.isdigit() or c in allowed_confusions for c in token) and any(c in "COoDSlIiZzB" for c in token):
                recovered = token
                for char, replacement in [('C', '0'), ('O', '0'), ('o', '0'), ('D', '0'), ('S', '5'), ('s', '5'), ('l', '1'), ('I', '1'), ('i', '1'), ('Z', '2'), ('z', '2'), ('B', '8')]:
                    recovered = recovered.replace(char, replacement)
                if any(c.isdigit() for c in recovered):
                    return recovered

        # 2. Fix embedded digit in word (e.g., Sa1t -> Salt or T0tal -> Total)
        if len(token) >= 3 and not any(c in '.,' for c in token) and not token.isdigit():
            cleaned = token.replace('1', 'l').replace('0', 'o').replace('5', 's').replace('2', 'z')
            if cleaned.isalpha() and cleaned != token:
                token = cleaned

        # 3. Fuzzy match against common vocabulary if alphabetical
        if token.isalpha() and len(token) >= 4:
            upper = token.upper()
            if upper not in cls.COMMON_VOCAB:
                matches = difflib.get_close_matches(upper, cls.COMMON_VOCAB, n=1, cutoff=0.72)
                if matches:
                    match = matches[0]
                    if token.istitle():
                        return match.title()
                    elif token.islower():
                        return match.lower()
                    else:
                        return match
        return token

    @classmethod
    def split_and_clean_tokens(cls, words: List[str], boxes: List[List[int]]) -> Tuple[List[str], List[List[int]]]:
        """
        Splits space-merged, syntax-merged, or alphanumeric-merged OCR tokens into clean word units for LayoutLMv3.
        Proportionally distributes bounding boxes across split tokens based on character width.
        """
        new_words = []
        new_boxes = []
        
        for text, box in zip(words, boxes):
            if not text or not box or len(box) != 4:
                continue
                
            # Expand concatenated formatting before whitespace split
            t = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
            t = re.sub(r'^(\d+)([a-zA-Z])', r'\1 \2', t)
            t = re.sub(r'([a-zA-Z]+)([\d.,]+)$', r'\1 \2', t)
            t = re.sub(r'([a-zA-Z]):', r'\1 :', t)
            t = re.sub(r':([a-zA-Z]|\d{3,}|\d{1}$)', r': \1', t)
            
            parts = t.split()
            if not parts:
                continue
                
            x1, y1, x2, y2 = box
            w = x2 - x1
            total_chars = sum(len(p) for p in parts) + max(0, len(parts) - 1)
            if total_chars == 0:
                total_chars = 1
                
            curr_x = x1
            for idx, part in enumerate(parts):
                part_w = int(w * (len(part) / total_chars))
                part_box = [curr_x, y1, curr_x + part_w, y2]
                
                sub_tokens = []
                if len(part) >= 10 and part.upper().endswith("BREAD") and not part.upper() == "BREAD":
                    sub1 = part[:-5]
                    sub2 = part[-5:]
                    sub_tokens = [(sub1, len(sub1)), (sub2, 5)]
                else:
                    sub_tokens = [(part, len(part))]
                    
                sub_x = curr_x
                for sub_text, sub_len in sub_tokens:
                    sub_w = int(part_w * (sub_len / max(1, len(part))))
                    sub_box = [sub_x, y1, sub_x + sub_w, y2]
                    
                    cleaned_text = cls.correct_token(sub_text)
                    new_words.append(cleaned_text)
                    new_boxes.append(sub_box)
                    sub_x += sub_w
                    
                space_w = int(w * (1 / total_chars)) if len(parts) > 1 else 0
                curr_x += part_w + space_w
                
        return new_words, new_boxes
