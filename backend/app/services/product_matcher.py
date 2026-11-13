import os
import logging
import re
import difflib
from sqlalchemy import text
from app.database.postgres_client import SessionLocal, FoodItem, Nutrition, HealthIndicators, POSTGRES_URL

logger = logging.getLogger(__name__)

# Common receipt descriptors / qualifiers to strip before matching
_STRIP_WORDS = {
    "green", "red", "yellow", "white", "black", "fresh", "organic", "large",
    "small", "medium", "mini", "baby", "jumbo", "whole", "sliced", "diced",
    "frozen", "canned", "dried", "raw", "cooked", "brushed", "loose",
    "bunch", "bag", "pack", "pkt", "kg", "g", "lb", "oz", "ea",
    "cavendish", "iceberg", "romaine", "grape", "cherry", "snow", "special",
    "net", "each", "per", "approx",
}

# Items that are not real food items (noise from OCR)
_GARBAGE_NAMES = {
    "item", "special", "", "net", "total", "subtotal", "sub", "tax",
    "change", "cash", "card", "eftpos", "visa", "mastercard", "amex",
    "gst", "rounding", "balance", "tender", "receipt", "qty",
}

# Indian Grocery Brand and Abbreviation Mapping
_BRAND_STRIP_LIST = [
    "gowardhan", "aul", "goodzife", "goodlife", "double horse", "amul", 
    "britannia", "parle", "haldiram", "mtr", "aashirvaad", "kissan", "maggi",
    "yippee", "patanjali", "dabur", "himalaya", "fortune", "tata", "gemini"
]

_ABBREV_MAPPING = {
    "ic cr": "ice cream",
    "juic": "juice",
    "chee": "cheese",
    "chilly": "pepper",
    "hysrid": "hybrid",
    "idiy": "rice noodles",
    "kdsesrt": "",
    "hkawrice": "rice",
}

_CATEGORY_HINTS = {
    "cow": "milk",
    "tide": "detergent",
    "surf": "detergent",
    "ariel": "detergent",
    "pepsodent": "toothpaste",
    "colgate": "toothpaste",
    "baginoroast": "roasted beans"
}

# Major animal protein terms to prevent cross-category false positive matches
ANIMAL_PROTEINS = {
    "tuna", "salmon", "mackerel", "sardine", "crab", "shrimp", "prawn", "clam", "oyster",
    "beef", "pork", "bacon", "ham", "sausage", "lamb", "mutton", "anchovy", "halibut",
    "cod", "tilapia", "catfish", "squid", "octopus", "lobster"
}

PACKING_PATTERNS = [
    " in water", " in oil", " in brine", " in juice", " packed in water",
    " in light syrup", " in heavy syrup"
]

STOP_WORDS = {
    "the", "and", "for", "with", "canned", "drained", "solids", "pack", "pkt", "net",
    "each", "per", "approx", "kroger", "brand", "style", "item", "fresh"
}

def clean_tokens(text: str) -> set:
    words = re.findall(r'[a-z0-9]+', text.lower())
    expanded = []
    for w in words:
        if w == "veg": expanded.extend(["veg", "vegetable"])
        elif w in ("bottle", "bottled"): expanded.extend(["bottle", "bottled"])
        else: expanded.append(w)
    return set(expanded)

def _is_valid_match(query: str, candidate: str, score: float, threshold: float = 0.55) -> bool:
    """
    Semantic gatekeeper: verifies that a database match is actually relevant to the queried item.
    Rejects packaging traps (e.g. 'water bottle' matching 'tuna canned in water') and protein mismatches.
    """
    if score < threshold:
        return False

    q_tokens = clean_tokens(query)
    c_tokens = clean_tokens(candidate)

    # 1. Reject Animal Protein / Meat Mismatch
    # If candidate is a meat/fish and query does not explicitly mention that protein
    for protein in ANIMAL_PROTEINS:
        if protein in c_tokens and protein not in q_tokens:
            return False

    # 2. Reject Packing Medium False Positive
    c_lower = candidate.lower()
    for pat in PACKING_PATTERNS:
        if pat in c_lower:
            # Extract substantive ingredients from candidate excluding packing terms
            non_packing = c_tokens - {"in", "water", "oil", "brine", "juice", "syrup", "light", "heavy", "canned", "drained", "solids", "kroger", "brand"}
            if non_packing and not non_packing.intersection(q_tokens):
                return False

    # 3. Reject if no substantive content word overlaps
    common = q_tokens.intersection(c_tokens)
    substantive = [t for t in common if len(t) >= 3 and t not in STOP_WORDS]
    if not substantive:
        return False

    return True

def _normalize(name: str) -> str:
    """
    Normalize a receipt item name for better fuzzy matching using a Rule Engine:
    - Lowercase
    - Expand known OCR abbreviations
    - Strip known Indian grocery brand names
    - Add category hints (e.g., cow -> milk)
    - Strip common receipt qualifiers (GREEN, CAVENDISH, BRUSHED, etc.)
    - Remove non-alphanumeric chars
    """
    name = name.lower().strip()
    
    # 1. Expand Abbreviations
    for abbr, expansion in _ABBREV_MAPPING.items():
        if abbr in name:
            name = name.replace(abbr, expansion)
            
    # 2. Add Category Hints
    for hint, addition in _CATEGORY_HINTS.items():
        if hint in name and addition not in name:
            name = f"{name} {addition}"
            
    # 3. Strip Brands
    for brand in _BRAND_STRIP_LIST:
        if brand in name:
            name = name.replace(brand, "")
            
    # 4. Strip non-alphanumeric and receipt qualifiers
    name = re.sub(r"[^a-z\s]", "", name)
    tokens = [t for t in name.split() if t not in _STRIP_WORDS]
    
    if not tokens:
        tokens = name.split() # Fallback if everything was stripped
        
    return " ".join(tokens).strip()


def _is_postgres(url: str) -> bool:
    return url and not url.startswith("sqlite")


class ProductMatcher:
    def __init__(self):
        self.is_initialized = False
        self.use_pg_trgm = _is_postgres(POSTGRES_URL)
        # Fallback: in-memory product list for SQLite
        self._fallback_items = []
        self._fallback_names = []

    def initialize(self):
        if self.is_initialized:
            return

        postgres_url = os.environ.get("POSTGRES_URL", "")
        if postgres_url and not postgres_url.startswith("sqlite"):
            db = SessionLocal()
            try:
                db.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
                db.commit()
                self.use_pg_trgm = True
                logger.info("pg_trgm extension enabled. Using PostgreSQL fuzzy matching.")
            except Exception as e:
                logger.warning(f"Could not enable pg_trgm: {e}. Falling back to SQLite matching.")
                db.rollback()
                self.use_pg_trgm = False
            finally:
                db.close()
        else:
            self.use_pg_trgm = False

        if not self.use_pg_trgm:
            self._load_fallback_items()

        self.is_initialized = True
        logger.info("ProductMatcher initialization complete.")

    def _load_fallback_items(self):
        """Load items for in-memory Semantic NLP matching if cached locally."""
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        try:
            from sentence_transformers import SentenceTransformer, util
            self.util = util
            logger.info("Loading SentenceTransformer (all-MiniLM-L6-v2)...")
            self.model = SentenceTransformer('all-MiniLM-L6-v2', local_files_only=True)
            db = SessionLocal()
            try:
                self._fallback_items = db.query(FoodItem).all()
                self._fallback_names = [_normalize(f.canonical_name) for f in self._fallback_items]
                self._fallback_embeddings = self.model.encode(self._fallback_names, convert_to_tensor=True)
                logger.info("Embeddings cached successfully.")
            finally:
                db.close()
        except Exception as e:
            logger.info(f"SentenceTransformer not loaded or offline ({e}). Using optimized fuzzy token matching.")
            return

    def match_item(self, item_name: str, similarity_threshold: float = 0.55):
        """
        Match a receipt item name to the closest food item in the database.
        Returns a dict with food details, nutrition, and health indicators, or None.
        Enforces strict semantic validation so non-food or mismatched items are not falsely linked.
        """
        if not self.is_initialized:
            self.initialize()

        if not item_name or item_name.strip().lower() in _GARBAGE_NAMES:
            return None

        normalized_query = _normalize(item_name)
        if not normalized_query:
            return None

        if self.use_pg_trgm:
            res = self._match_pg_trgm(item_name, normalized_query, similarity_threshold)
            if res:
                return res

        return self._match_sqlite(item_name, normalized_query, similarity_threshold)

    def _match_sqlite(self, original_name: str, normalized_query: str, threshold: float = 0.55):
        """SQLite compatible matching using score-based fuzzy token & substring matching."""
        db = SessionLocal()
        try:
            items = db.query(FoodItem).all()
            if not items:
                return None

            candidates = []
            query_tokens = clean_tokens(normalized_query)

            for item in items:
                cname = (item.canonical_name or '').lower()
                dname = (item.display_name or '').lower()
                norm_cname = _normalize(cname)
                c_tokens = clean_tokens(norm_cname)

                score = 0.0
                if normalized_query == norm_cname or normalized_query == cname:
                    score = 1.0
                elif normalized_query == dname or (dname and normalized_query == _normalize(dname)):
                    score = 0.95
                elif normalized_query in cname or cname in normalized_query:
                    ratio = min(len(normalized_query), len(cname)) / max(len(normalized_query), len(cname))
                    score = 0.70 + (ratio * 0.25)
                elif dname and (normalized_query in dname or dname in normalized_query):
                    ratio = min(len(normalized_query), len(dname)) / max(len(normalized_query), len(dname))
                    score = 0.65 + (ratio * 0.25)
                else:
                    common = query_tokens.intersection(c_tokens)
                    if common:
                        substantive = [t for t in common if len(t) >= 3 and t not in STOP_WORDS]
                        if substantive:
                            jaccard = len(common) / len(query_tokens.union(c_tokens))
                            score = 0.40 + (jaccard * 0.50)
                    else:
                        ratio = difflib.SequenceMatcher(None, normalized_query, norm_cname).ratio()
                        if ratio > 0.65:
                            score = ratio * 0.80

                if score >= threshold:
                    candidates.append((score, item))

            candidates.sort(key=lambda x: x[0], reverse=True)

            for score, best_item in candidates:
                if _is_valid_match(original_name, best_item.canonical_name, score, threshold):
                    nut = db.query(Nutrition).filter(Nutrition.food_id == best_item.food_id).first()
                    h = db.query(HealthIndicators).filter(HealthIndicators.food_id == best_item.food_id).first()

                    return {
                        "food_id": best_item.food_id,
                        "matched_name": best_item.canonical_name,
                        "display_name": best_item.display_name,
                        "category": best_item.category,
                        "subcategory": best_item.subcategory,
                        "serving_size": float(best_item.serving_size) if best_item.serving_size else None,
                        "serving_unit": best_item.serving_unit,
                        "nutrition": {
                            "calories_kcal": float(nut.calories_kcal) if nut and nut.calories_kcal is not None else None,
                            "protein_g": float(nut.protein_g) if nut and nut.protein_g is not None else None,
                            "carbohydrates_g": float(nut.carbohydrates_g) if nut and nut.carbohydrates_g is not None else None,
                            "fat_g": float(nut.fat_g) if nut and nut.fat_g is not None else None,
                            "fiber_g": float(nut.fiber_g) if nut and nut.fiber_g is not None else None,
                            "sugar_g": float(nut.sugar_g) if nut and nut.sugar_g is not None else None,
                        },
                        "health": {
                            "health_score": h.health_score if h else None,
                            "is_processed": h.is_processed if h else False,
                        }
                    }

            return None
        except Exception as e:
            logger.error(f"Error in _match_sqlite for '{original_name}': {e}")
            return None
        finally:
            db.close()

    def _match_pg_trgm(self, original_name: str, normalized_query: str, threshold: float):
        """
        Use PostgreSQL pg_trgm to find the best matching food item.
        Joins nutrition + healthindicators to return rich data.
        Enforces _is_valid_match semantic validation to prevent cross-category false positives.
        """
        db = SessionLocal()
        try:
            sql = text("""
                SELECT
                    f.food_id,
                    f.canonical_name,
                    f.display_name,
                    f.category,
                    f.subcategory,
                    f.serving_size,
                    f.serving_unit,
                    n.calories_kcal,
                    n.protein_g,
                    n.carbohydrates_g,
                    n.fat_g,
                    n.fiber_g,
                    n.sugar_g,
                    n.sodium_mg,
                    n.calcium_mg,
                    n.iron_mg,
                    n.potassium_mg,
                    n.vitamin_c_mg,
                    n.vitamin_a_ug,
                    h.health_score,
                    h.processed_level,
                    h.is_processed,
                    h.high_protein,
                    h.high_fiber,
                    h.high_sugar,
                    h.high_fat,
                    h.high_sodium,
                    h.vegetarian,
                    h.vegan,
                    h.gluten_free,
                    h.allergen,
                    similarity(f.canonical_name, :query) AS sim
                FROM fooditem f
                LEFT JOIN nutrition n ON f.food_id = n.food_id
                LEFT JOIN healthindicators h ON f.food_id = h.food_id
                WHERE similarity(f.canonical_name, :query) >= :threshold
                ORDER BY sim DESC
                LIMIT 5
            """)

            rows = db.execute(sql, {"query": normalized_query, "threshold": threshold}).fetchall()

            for row in rows:
                sim_score = float(row.sim)
                if _is_valid_match(original_name, row.canonical_name, sim_score, threshold):
                    logger.info(
                        f"pg_trgm verified match (sim={sim_score:.2f}): "
                        f"'{original_name}' → '{row.canonical_name}'"
                    )
                    return self._row_to_dict(row)

            logger.debug(f"No pg_trgm match passed semantic validation for '{original_name}'")
            return None
        except Exception as e:
            logger.error(f"Error matching item '{original_name}': {e}")
            return None
        finally:
            db.close()

    def _match_semantic(self, original_name: str, normalized_query: str, threshold: float = 0.55):
        """Fallback: in-memory Semantic NLP matching."""
        if not self._fallback_items or not hasattr(self, 'model'):
            return None

        query_embedding = self.model.encode(normalized_query, convert_to_tensor=True)
        cos_scores = self.util.cos_sim(query_embedding, self._fallback_embeddings)[0]
        
        import torch
        top_k = min(5, len(self._fallback_items))
        top_indices = torch.topk(cos_scores, k=top_k).indices.tolist()

        for idx in top_indices:
            score = cos_scores[idx].item()
            food = self._fallback_items[idx]
            if _is_valid_match(original_name, food.canonical_name, score, threshold):
                logger.info(f"Semantic match (score={score:.2f}): '{original_name}' -> '{food.canonical_name}'")
                return {
                    "food_id": food.food_id,
                    "matched_name": food.canonical_name,
                    "display_name": food.display_name,
                    "category": food.category,
                }
            
        return None

    @staticmethod
    def _row_to_dict(row):
        """Convert a SQLAlchemy result row to a clean dict for the API response."""
        def _safe_float(val):
            if val is None:
                return None
            return float(val)

        return {
            "food_id": row.food_id,
            "matched_name": row.canonical_name,
            "display_name": row.display_name,
            "category": row.category,
            "subcategory": row.subcategory,
            "serving_size": _safe_float(row.serving_size),
            "serving_unit": row.serving_unit,
            "nutrition": {
                "calories_kcal": _safe_float(row.calories_kcal),
                "protein_g": _safe_float(row.protein_g),
                "carbohydrates_g": _safe_float(row.carbohydrates_g),
                "fat_g": _safe_float(row.fat_g),
                "fiber_g": _safe_float(row.fiber_g),
                "sugar_g": _safe_float(row.sugar_g),
                "sodium_mg": _safe_float(row.sodium_mg),
                "calcium_mg": _safe_float(row.calcium_mg),
                "iron_mg": _safe_float(row.iron_mg),
                "potassium_mg": _safe_float(row.potassium_mg),
                "vitamin_c_mg": _safe_float(row.vitamin_c_mg),
                "vitamin_a_ug": _safe_float(row.vitamin_a_ug),
            },
            "health": {
                "health_score": row.health_score,
                "processed_level": row.processed_level,
                "is_processed": row.is_processed,
                "high_protein": row.high_protein,
                "high_fiber": row.high_fiber,
                "high_sugar": row.high_sugar,
                "high_fat": row.high_fat,
                "high_sodium": row.high_sodium,
                "vegetarian": row.vegetarian,
                "vegan": row.vegan,
                "gluten_free": row.gluten_free,
                "allergen": row.allergen,
            },
        }

# Singleton instance
product_matcher = ProductMatcher()
