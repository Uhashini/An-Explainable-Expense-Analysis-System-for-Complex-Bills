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


def _normalize(name: str) -> str:
    """
    Normalize a receipt item name for better fuzzy matching:
    - Lowercase
    - Strip common receipt qualifiers (GREEN, CAVENDISH, BRUSHED, etc.)
    - Remove non-alphanumeric chars
    - Collapse whitespace
    """
    name = name.lower().strip()
    name = re.sub(r"[^a-z\s]", "", name)
    tokens = [t for t in name.split() if t not in _STRIP_WORDS]
    if not tokens:
        tokens = name.split()
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

        logger.info("Initializing ProductMatcher...")

        if self.use_pg_trgm:
            # Enable pg_trgm extension
            db = SessionLocal()
            try:
                db.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
                db.commit()
                logger.info("pg_trgm extension enabled. Using PostgreSQL fuzzy matching.")
            except Exception as e:
                logger.warning(f"Could not enable pg_trgm: {e}. Falling back to in-memory matching.")
                db.rollback()
                self.use_pg_trgm = False
            finally:
                db.close()

        if not self.use_pg_trgm:
            # Load all food items into memory for RapidFuzz matching
            self._load_fallback_items()

        self.is_initialized = True
        logger.info("ProductMatcher initialization complete.")

    def _load_fallback_items(self):
        """Load items for in-memory RapidFuzz matching (SQLite fallback)."""
        from rapidfuzz import process, fuzz
        self._fuzz_process = process
        self._fuzz = fuzz

        db = SessionLocal()
        try:
            self._fallback_items = db.query(FoodItem).all()
            self._fallback_names = [_normalize(f.canonical_name) for f in self._fallback_items]
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
            return self._match_pg_trgm(item_name, normalized_query, similarity_threshold)
        else:
            return self._match_rapidfuzz(item_name, normalized_query)

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

    def _match_rapidfuzz(self, original_name: str, normalized_query: str, threshold: float = 55.0):
        """Fallback: in-memory RapidFuzz matching for SQLite."""
        if not self._fallback_items:
            return None

        match_result = self._fuzz_process.extractOne(
            normalized_query,
            self._fallback_names,
            scorer=self._fuzz.WRatio
        )
        if match_result:
            matched_name, score, idx = match_result
            if score >= threshold:
                food = self._fallback_items[idx]
                logger.info(f"RapidFuzz match (score={score:.0f}): '{original_name}' → '{food.canonical_name}'")
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
