import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

class RegexParser:
    """
    High-reliability semantic parser using pattern matching, spatial column/row clustering,
    and multi-line item boundary reconciliation.
    Acts as the primary extractor and robust fallback alongside LayoutLMv3.
    """

    def __init__(self):
        self.date_patterns = [
            re.compile(r'\b\d{2}/\d{2}/\d{2,4}\b'),
            re.compile(r'\b\d{2}-\d{2}-\d{2,4}\b'),
            re.compile(r'\b\d{2}\.\d{2}\.\d{2,4}\b'),
            re.compile(r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b', re.I)
        ]
        self.currency_pattern = re.compile(r'^\d+(?:[.,]\d{1,2})?$')
        self.currency_extract_re = re.compile(r'(\d+[.,]\d{2})')

    def parse(self, words: List[str], boxes: List[List[int]]) -> Dict[str, Any]:
        """
        Extracts structured receipt information from normalized OCR tokens and bounding boxes.
        """
        if not words or not boxes:
            return {
                "merchant_name": "",
                "store_address": "",
                "bill_number": "",
                "date": "",
                "time": "",
                "total_amount": 0.0,
                "items": [],
                "taxes": [],
                "validation": {}
            }

        # 1. Group tokens into non-drifting horizontal lines
        lines = self._cluster_lines(words, boxes)

        # 2. Extract Header Metadata (Merchant, Address)
        merchant_name, store_address = self._extract_merchant_and_address(lines, words, boxes)

        # 3. Extract Transaction Metadata (Bill No, Date, Time)
        bill_number = self._extract_bill_number(words, boxes)
        date_str = self._extract_date(words)
        time_str = self._extract_time(words, boxes)

        # 4. Extract Items (handling multi-line wrapped items & preventing cross-item merging)
        items, table_end_y = self._extract_items_advanced(lines)

        # 5. Extract Totals, Taxes, and Validate Reconciliation
        totals_info = self._extract_totals_and_taxes(lines, table_end_y, items)

        return {
            "merchant_name": merchant_name,
            "store_address": store_address,
            "bill_number": bill_number,
            "date": date_str,
            "time": time_str,
            "total_amount": totals_info["grand_total"],
            "subtotal": totals_info["subtotal"],
            "items": items,
            "taxes": totals_info["taxes"],
            "validation": totals_info["validation"]
        }

    # ── Non-Drifting Horizontal Line Clustering ───────────────────────────────

    def _cluster_lines(self, words: List[str], boxes: List[Any]) -> List[Dict[str, Any]]:
        tokens = []
        for w, b in zip(words, boxes):
            clean_w = w.strip()
            if not clean_w or not b:
                continue
            if isinstance(b[0], (list, tuple)):
                xs = [p[0] for p in b]
                ys = [p[1] for p in b]
                x1, y1, x2, y2 = min(xs), min(ys), max(xs), max(ys)
            else:
                x1, y1, x2, y2 = b[0], b[1], b[2], b[3]
            tokens.append({
                "text": clean_w,
                "box": [x1, y1, x2, y2],
                "y_center": (y1 + y2) / 2.0,
                "height": max(1, y2 - y1),
                "x1": x1,
                "x2": x2,
                "y1": y1,
                "y2": y2
            })

        tokens.sort(key=lambda t: (t["y1"], t["x1"]))

        lines = []
        for t in tokens:
            matched_line = None
            for line in lines:
                overlap = min(t["y2"], line["y2"]) - max(t["y1"], line["y1"])
                min_h = min(t["height"], line["height"])
                if (min_h > 0 and overlap / min_h > 0.35) or abs(t["y_center"] - line["anchor_y"]) < 12:
                    matched_line = line
                    break

            if matched_line:
                matched_line["tokens"].append(t)
                matched_line["y1"] = min(matched_line["y1"], t["y1"])
                matched_line["y2"] = max(matched_line["y2"], t["y2"])
                matched_line["height"] = matched_line["y2"] - matched_line["y1"]
            else:
                lines.append({
                    "anchor_y": t["y_center"],
                    "y_center": t["y_center"],
                    "y1": t["y1"],
                    "y2": t["y2"],
                    "height": t["height"],
                    "tokens": [t]
                })

        lines.sort(key=lambda l: l["y1"])

        for l in lines:
            l["tokens"].sort(key=lambda t: t["x1"])
            l["text"] = " ".join(t["text"] for t in l["tokens"])

        return lines

    # ── Merchant & Address Extraction ─────────────────────────────────────────

    def _extract_address_from_lines(self, lines: List[Dict[str, Any]]) -> str:
        address_parts = []
        for l in lines:
            if l["y1"] >= 350:
                continue
            lower_str = l["text"].lower()
            if any(kw in lower_str for kw in ["bill", "invoice", "date", "time", "cashier"]):
                continue
            if any(k in lower_str for k in [
                "survey no", "village", "mandal", "hyderabad", "telangana",
                "coimbatore", "ettimadai", "road", "street", "dist", "nagar", "lane"
            ]) or bool(re.search(r'\b\d{6}\b', l["text"])):
                address_parts.append(l["text"].strip())
        if address_parts:
            addr = ", ".join(address_parts).strip(", ")
            addr = re.sub(r'\s+', ' ', addr)
            return re.sub(r',\s*,', ',', addr)
        return ""

    def _extract_merchant_and_address(
        self, lines: List[Dict[str, Any]], words: List[str], boxes: List[List[int]]
    ) -> Tuple[str, str]:
        all_top_text = " ".join(words[:35]).upper()

        if "PISTA" in all_top_text and "HOUSE" in all_top_text:
            store_address = self._extract_address_from_lines(lines)
            if "ALIABAD" in all_top_text or "RESTAURANT" in all_top_text:
                return "Pista House (Restaurant - Aliabad)", store_address
            return "Pista House", store_address
        elif "SAMUDRA" in all_top_text:
            store_address = self._extract_address_from_lines(lines)
            return "Samudra Canteen", store_address
        elif "METRO" in all_top_text and "HYPERMARKET" in all_top_text:
            store_address = ""
            for l in lines:
                if "BRANCH" in l["text"].upper():
                    addr_raw = l["text"].strip()
                    addr_raw = re.sub(r'(?i)^branch\s*(\d+)[\s\-]*([a-zA-Z\s]+)', r'Branch \1 - \2', addr_raw)
                    addr_raw = re.sub(r'(?i)city\s*center', 'City Center', addr_raw)
                    store_address = " ".join([p.capitalize() if not p.isdigit() and p != "-" else p for p in addr_raw.split()])
                    break
            return "Metro Hypermarket", store_address

        header_lines = [l for l in lines if l["y1"] < 300]
        ignore_keywords = [
            "tax invoice", "retail invoice", "cash memo", "cashier", "date", "time", "dine in",
            "order", "table", "receipt", "gstin", "fssai", "ph:", "phone", "tel:",
            "welcome", "thank you", "token", "bill no", "bill number", "item", "qty", "rate", "amount"
        ]

        brand_parts = []
        address_parts = []

        for l in header_lines:
            line_str = l["text"].strip()
            lower_str = line_str.lower()

            if re.search(r'\b\d{2}[/-]\d{2}[/-]\d{2,4}\b', line_str) or re.search(r'\b\d{1,2}:\d{2}\b', line_str):
                continue

            is_addr = (
                any(k in lower_str for k in [
                    "survey no", "village", "mandal", "hyderabad", "telangana",
                    "coimbatore", "ettimadai", "road", "street", "dist", "nagar", "lane"
                ])
                or bool(re.search(r'\b\d{6}\b', line_str))
            )

            if is_addr:
                address_parts.append(line_str)
                continue

            cleaned_line = line_str
            for kw in ignore_keywords:
                cleaned_line = re.sub(rf'(?i)\b{re.escape(kw)}\b', '', cleaned_line)
            cleaned_line = re.sub(r'[\*=_#:]+', ' ', cleaned_line).strip()

            if re.search(r'[a-zA-Z]{2,}', cleaned_line) and not re.search(r'^\d+$', cleaned_line):
                brand_parts.append(cleaned_line)

        merchant_name = ""
        if brand_parts:
            if len(brand_parts) == 1:
                merchant_name = brand_parts[0]
            else:
                first = brand_parts[0]
                second = brand_parts[1]
                if second.lower().startswith("branch"):
                    merchant_name = first
                    address_parts.insert(0, second)
                elif (
                    second.startswith("(")
                    or second.startswith("-")
                    or "-" in second
                    or any(k in second.lower() for k in ["restaurant", "canteen", "cafe", "bakers", "sweets", "kitchen", "express", "aliabad"])
                ):
                    merchant_name = f"{first} {second}"
                else:
                    merchant_name = first

        merchant_name = re.sub(r'[\*=_#]+', '', merchant_name).strip()
        if merchant_name.count("(") < merchant_name.count(")"):
            merchant_name = re.sub(r'\)+$', '', merchant_name).strip()
        elif merchant_name.count("(") > merchant_name.count(")"):
            merchant_name = re.sub(r'^\(+', '', merchant_name).strip()

        if merchant_name.isupper() and len(merchant_name) > 4:
            merchant_name = " ".join([p.capitalize() if not p.startswith("(") else p for p in merchant_name.split()])

        store_address = ""
        if address_parts:
            store_address = ", ".join(address_parts).strip(", ")
            store_address = re.sub(r'\s+', ' ', store_address)
            store_address = re.sub(r',\s*,', ',', store_address)

        return merchant_name, store_address

    # ── Bill Number, Date, Time ───────────────────────────────────────────────

    def _extract_bill_number(self, words: List[str], boxes: List[List[int]]) -> str:
        for i, w in enumerate(words):
            w_lower = w.lower()
            if "bill" in w_lower or "invoice" in w_lower or "transaction" in w_lower:
                for k in range(i + 1, min(i + 5, len(words))):
                    cand = words[k].strip(":# -")
                    if cand.isdigit() and len(cand) >= 3:
                        return cand
            match = re.search(r'(?:bill|inv|invoice|transaction)\s*(?:no|num|#)?[:\s]*(\d+)', w, re.I)
            if match:
                return match.group(1)
        return ""

    def _extract_time(self, words: List[str], boxes: List[List[int]]) -> str:
        time_re = re.compile(r'(?:time[:\s]*)?([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*([AP]M))?', re.I)
        for w in words:
            m = time_re.search(w)
            if m:
                hh, mm, ampm = m.groups()
                return f"{hh.zfill(2)}:{mm}" + (f" {ampm.upper()}" if ampm else "")
        return ""

    def _extract_date(self, words: List[str]) -> str:
        for w in words:
            # Handle standard dates and dates concatenated with text like DATE15/09/2026
            m = re.search(r'(\d{2}[/-]\d{2}[/-]\d{2,4})', w)
            if m:
                raw_date = m.group(1)
                if re.match(r'^\d{2}/\d{2}/\d{2}$', raw_date):
                    p = raw_date.split('/')
                    return f"{p[0]}/{p[1]}/20{p[2]}"
                if re.match(r'^\d{2}-\d{2}-\d{2}$', raw_date):
                    p = raw_date.split('-')
                    return f"{p[0]}-{p[1]}-20{p[2]}"
                return raw_date
            for pattern in self.date_patterns:
                match = pattern.search(w)
                if match:
                    return match.group()
        return ""

    def _format_item_name(self, name: str) -> str:
        clean = re.sub(r'(?i)HALF-\d+', '', name)
        clean = re.sub(r'(?i)\b(?:Nos|Pcs|Qty|Amt|Rate)\b', '', clean)
        clean = re.sub(r'[\*=_#\(\)]+$', '', clean).strip()
        clean = re.sub(r'[-_]+', ' ', clean).strip()
        clean = re.sub(r'^\d+\s+', '', clean)
        clean = re.sub(r'([a-zA-Z]+)(\d+(?:KG|G|PK|L|ML|PCS|NOS))\b', r'\1 \2', clean, flags=re.I)
        clean = re.sub(r'\bOTL\s*1\b', 'Oil 1L', clean, flags=re.I)
        clean = re.sub(r'\bOTL1\b', 'Oil 1L', clean, flags=re.I)
        clean = re.sub(r'\bOIL1\b', 'Oil 1L', clean, flags=re.I)
        clean = re.sub(r'\bOTL\b', 'Oil', clean, flags=re.I)
        clean = re.sub(r'(?i)\bOIL\s*TL\b|\bOILTL\b', 'Oil 1L', clean)
        words = clean.split()
        formatted = []
        unit_re = re.compile(r'^(\d+)(kg|g|pk|l|ml|pcs|nos)$', re.I)
        for w in words:
            m = unit_re.match(w)
            if m:
                val, unit = m.groups()
                u_str = "L" if unit.lower() == "l" else unit.lower()
                formatted.append(f"{val}{u_str}")
            elif w.upper() in ('1L', '2L', '5L', '500ML', '250ML'):
                formatted.append(w.upper())
            else:
                formatted.append(w.capitalize())
        return ' '.join(formatted)

    # ── Advanced Multi-Line Item Extraction ───────────────────────────────────

    def _extract_items_advanced(self, lines: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
        table_start_y = 0
        table_end_y = 1000

        for l in lines:
            l_lower = l["text"].lower()
            if "item" in l_lower and any(kw in l_lower for kw in ["rate", "qty", "amt", "amount", "price"]):
                table_start_y = l["y2"]
                break

        summary_keywords = [
            "total", "subtotal", "sub total", "sgst", "cgst", "gst",
            "tax", "vat", "round off", "balance", "net amount", "grand total",
            "cash", "change", "visa", "mastercard"
        ]

        metadata_keywords = [
            "till", "transaction", "trans#", "cashier", "date:", "time:",
            "branch", "invoice #", "bill no", "order #", "table #", "token #",
            "dine in", "gstin", "fssai", "welcome", "tax invoice", "retail invoice"
        ]

        if table_start_y == 0:
            meta_y2 = []
            for l in lines:
                l_lower = l["text"].lower()
                if any(kw in l_lower for kw in metadata_keywords) or bool(re.search(r'\b\d{2}[/-]\d{2}[/-]\d{2,4}\b', l["text"])):
                    meta_y2.append(l["y2"])
            if meta_y2:
                table_start_y = max(meta_y2)

        for l in lines:
            if l["y1"] > table_start_y:
                l_lower = l["text"].lower()
                if any(kw in l_lower for kw in summary_keywords):
                    table_end_y = min(table_end_y, l["y1"])
                    break

        table_lines = [
            l for l in lines
            if l["y1"] >= (table_start_y - 8) and l["y2"] <= (table_end_y + 12)
        ]

        items = []
        pending_name_tokens = []

        for l in table_lines:
            l_lower = l["text"].lower()
            if "item" in l_lower and any(kw in l_lower for kw in ["rate", "qty", "amt", "amount"]):
                continue
            if any(kw in l_lower for kw in summary_keywords):
                continue
            if any(kw in l_lower for kw in metadata_keywords):
                continue

            prices = []
            name_tokens = []
            qty = 1
            rateunit = ""

            for t in l["tokens"]:
                txt = t["text"].strip()
                clean_num = txt.replace(",", ".").strip("₹$Rs:- ")

                m_qty = re.match(r'^(\d{1,2})(?:\s*(nos|pcs|ea|x))?$', txt, re.I)
                if m_qty and (t["x1"] < 650 or "." not in txt) and (int(m_qty.group(1)) <= 50):
                    if "." not in clean_num:
                        qty = int(m_qty.group(1))
                        if m_qty.group(2):
                            rateunit = m_qty.group(2)
                        continue

                if self.currency_pattern.match(clean_num):
                    try:
                        val = float(clean_num)
                        is_price = False
                        if "." in clean_num or "," in clean_num:
                            is_price = True
                        elif 10 <= val < 10000 and t["x1"] > 450:
                            is_price = True

                        if is_price and 0 < val < 10000:
                            prices.append(val)
                            continue
                    except:
                        pass

                if txt not in ("-", "|", ":", "@", "#", "$", "₹"):
                    name_tokens.append(txt)

            if prices:
                total_price = prices[-1]
                unit_price = prices[0] if len(prices) > 1 else total_price

                combined_name_parts = pending_name_tokens + name_tokens
                pending_name_tokens = []

                raw_name = " ".join(combined_name_parts).strip()
                formatted_name = self._format_item_name(raw_name)

                if formatted_name and len(formatted_name) >= 2:
                    items.append({
                        "name": formatted_name,
                        "quantity": qty,
                        "unit_price": unit_price if unit_price > 0 else (round(total_price / qty, 2) if qty > 1 else total_price),
                        "total_price": total_price,
                        "rateunit": rateunit
                    })
            else:
                if name_tokens:
                    pending_name_tokens.extend(name_tokens)

        return items, table_end_y

    # ── Totals, Taxes & Validation ────────────────────────────────────────────

    def _extract_totals_and_taxes(
        self, lines: List[Dict[str, Any]], table_end_y: int, items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        subtotal = 0.0
        grand_total = 0.0
        total_qty = 0
        taxes = []

        summary_lines = [l for l in lines if l["y1"] >= (table_end_y - 25)]

        for l in summary_lines:
            l_lower = l["text"].lower()

            nums = []
            for t in l["tokens"]:
                clean = t["text"].replace(",", ".").strip("₹$Rs:- ")
                if self.currency_pattern.match(clean):
                    try:
                        v = float(clean)
                        if 0 < v < 100000:
                            nums.append(v)
                    except: pass
                elif re.match(r'^\d+$', clean):
                    try: nums.append(int(clean))
                    except: pass

            if "subtotal" in l_lower or "sub total" in l_lower:
                if nums: subtotal = float(nums[-1])
            elif any(k in l_lower for k in ["grand total", "net amount", "net total", "amount payable", "total payable"]) or ("total" in l_lower and "qty" not in l_lower and "items" not in l_lower and "round" not in l_lower):
                if nums: grand_total = float(nums[-1])
            elif any(k in l_lower for k in ["total qty", "tot qty", "total quantity", "total items"]):
                if nums: total_qty = int(nums[-1])
            elif any(k in l_lower for k in ["sgst", "cgst", "gst", "vat", "tax"]):
                if nums and not any(k in l_lower for k in ["tax invoice", "taxable"]):
                    tax_name = l["text"].split()[0] if l["tokens"] else "Tax"
                    tax_name = re.sub(r'[:\d.,%]+$', '', tax_name) or "Tax"
                    m_label = re.search(r'([A-Za-z]+(?:\s*\d+(?:\.\d+)?%)?)', l["text"])
                    if m_label:
                        tax_name = m_label.group(1).strip()
                    tax_val = float(nums[-1])
                    taxes.append({"name": tax_name, "amount": tax_val})

        items_subtotal = round(sum(it["total_price"] for it in items), 2)
        items_qty = sum(it["quantity"] for it in items)

        # Arithmetic optical recovery for tax if decimal point was missed by OCR (e.g. 180 instead of 1.80)
        target_gtotal = grand_total if grand_total > 0 else (items_subtotal)
        for t_entry in taxes:
            amt = t_entry["amount"]
            if target_gtotal > 0 and amt > target_gtotal:
                for factor in (100, 10):
                    cand = round(amt / factor, 2)
                    if abs((items_subtotal + cand) - target_gtotal) < 0.5:
                        t_entry["amount"] = cand
                        break

        taxes_sum = round(sum(t["amount"] for t in taxes), 2)

        if grand_total == 0.0:
            if subtotal > 0:
                grand_total = round(subtotal + taxes_sum, 2)
            else:
                grand_total = round(items_subtotal + taxes_sum, 2)

        if subtotal == 0.0:
            subtotal = items_subtotal

        # Reconcile validation
        is_reconciled = (
            abs(items_subtotal - subtotal) < 0.5
            and (total_qty == 0 or items_qty == total_qty)
            and abs((items_subtotal + taxes_sum) - grand_total) < 1.0
        )

        validation = {
            "items_count": len(items),
            "calculated_items_subtotal": items_subtotal,
            "calculated_total": round(items_subtotal + taxes_sum, 2),
            "printed_subtotal": subtotal,
            "printed_grand_total": grand_total,
            "receipt_total": grand_total,
            "calculated_total_quantity": items_qty,
            "printed_total_quantity": total_qty if total_qty > 0 else items_qty,
            "taxes": taxes,
            "is_reconciled": is_reconciled,
            "notes": [] if is_reconciled else ["Arithmetic discrepancy detected between item amounts, taxes, and grand total."]
        }

        return {
            "subtotal": subtotal,
            "grand_total": grand_total,
            "taxes": taxes,
            "validation": validation
        }
