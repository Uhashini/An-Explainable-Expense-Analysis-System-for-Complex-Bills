import logging
import re
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
        """Load items for in-memory Semantic NLP matching."""
        try:
            from sentence_transformers import SentenceTransformer, util
            self.util = util
            logger.info("Loading SentenceTransformer (all-MiniLM-L6-v2)...")
            # Load the lightweight semantic model
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception as e:
            logger.warning(f"SentenceTransformer not loaded ({e}). Using SQLite substring & pattern matching.")
            return

        db = SessionLocal()
        try:
            self._fallback_items = db.query(FoodItem).all()
            self._fallback_names = [_normalize(f.canonical_name) for f in self._fallback_items]
            logger.info(f"Computing embeddings for {len(self._fallback_names)} food items...")
            self._fallback_embeddings = self.model.encode(self._fallback_names, convert_to_tensor=True)
            logger.info("Embeddings cached successfully.")
        finally:
            db.close()

    def match_item(self, item_name: str, similarity_threshold: float = 0.20):
        """
        Match a receipt item name to the closest food item in the database.
        Returns a dict with food details, nutrition, and health indicators, or None.
        """
        if not self.is_initialized:
            self.initialize()

        # Skip garbage/noise names
        if item_name.strip().lower() in _GARBAGE_NAMES:
            return None

        normalized_query = _normalize(item_name)
        if not normalized_query:
            return None

        if self.use_pg_trgm:
            res = self._match_pg_trgm(item_name, normalized_query, similarity_threshold)
            if res:
                return res

        return self._match_sqlite(item_name, normalized_query)

    def _match_sqlite(self, original_name: str, normalized_query: str):
        """SQLite compatible matching using python substring & query matching."""
        db = SessionLocal()
        try:
            items = db.query(FoodItem).all()
            for item in items:
                cname = (item.canonical_name or '').lower()
                dname = (item.display_name or '').lower()
                if normalized_query in cname or cname in normalized_query or (dname and normalized_query in dname):
                    nut = item.nutrition
                    h = item.health_indicators
                    return {
                        "food_id": item.food_id,
                        "matched_name": item.canonical_name,
                        "display_name": item.display_name,
                        "category": item.category,
                        "subcategory": item.subcategory,
                        "serving_size": float(item.serving_size) if item.serving_size else None,
                        "serving_unit": item.serving_unit,
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
                WHERE similarity(f.canonical_name, :query) > :threshold
                ORDER BY sim DESC
                LIMIT 1
            """)

            result = db.execute(sql, {"query": normalized_query, "threshold": threshold}).fetchone()

            if not result:
                logger.debug(f"No pg_trgm match for '{original_name}' (normalized: '{normalized_query}')")
                return None

            logger.info(
                f"pg_trgm match (sim={float(result.sim):.2f}): "
                f"'{original_name}' → '{result.canonical_name}'"
            )

            return self._row_to_dict(result)
        except Exception as e:
            logger.error(f"Error matching item '{original_name}': {e}")
            return None
        finally:
            db.close()

    def _match_semantic(self, original_name: str, normalized_query: str, threshold: float = 0.4):
        """Fallback: in-memory Semantic NLP matching."""
        if not self._fallback_items or not hasattr(self, 'model'):
            return None

        # Encode the query
        query_embedding = self.model.encode(normalized_query, convert_to_tensor=True)
        
        # Compute cosine similarity against all food items
        cos_scores = self.util.cos_sim(query_embedding, self._fallback_embeddings)[0]
        
        import torch
        best_match_idx = torch.argmax(cos_scores).item()
        best_match_score = cos_scores[best_match_idx].item()
        
        if best_match_score >= threshold:
            food = self._fallback_items[best_match_idx]
            logger.info(f"Semantic match (score={best_match_score:.2f}): '{original_name}' -> '{food.canonical_name}'")
            return {
                "food_id": food.food_id,
                "matched_name": food.canonical_name,
                "display_name": food.display_name,
                "category": food.category,
            }
            
        logger.debug(f"No semantic match for '{original_name}' (best score: {best_match_score:.2f})")
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
