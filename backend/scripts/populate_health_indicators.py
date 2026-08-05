#!/usr/bin/env python3
from __future__ import annotations
"""
populate_health_indicators.py
------------------------------
Reads nutrition rows already stored in PostgreSQL (inserted by
populate_nutrition.py) and computes / inserts one HealthIndicators row
for every food.

Usage (run from backend/ directory):
    python scripts/populate_health_indicators.py

Dependencies:
    pip install psycopg2-binary python-dotenv
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR  = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent

BATCH_SIZE = 500

# Category keyword lists (all lower-case for case-insensitive comparison)
MEDIUM_KEYWORDS = [
    "snack", "chips", "cookie", "candy", "cola", "soft drink",
    "instant", "processed", "frozen",
]
ULTRA_KEYWORDS = [
    "fast food", "ready meal", "ultra processed",
]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

def get_connection() -> psycopg2.extensions.connection:
    load_dotenv(BACKEND_DIR / ".env")
    db_url = os.getenv("POSTGRES_URL")
    if not db_url:
        log.error("POSTGRES_URL not found in .env — aborting.")
        sys.exit(1)
    log.info("Connecting to PostgreSQL …")
    return psycopg2.connect(db_url)


# ---------------------------------------------------------------------------
# Health logic helpers
# ---------------------------------------------------------------------------

def classify_processed_level(category: Optional[str]) -> str:
    """
    Return 'LOW', 'MEDIUM', or 'ULTRA' based on category keywords.
    ULTRA is checked first (higher specificity), then MEDIUM, else LOW.
    """
    if not category:
        return "LOW"
    cat_lower = category.lower()
    for kw in ULTRA_KEYWORDS:
        if kw in cat_lower:
            return "ULTRA"
    for kw in MEDIUM_KEYWORDS:
        if kw in cat_lower:
            return "MEDIUM"
    return "LOW"


def safe_float(val) -> Optional[float]:
    """Return None if val is None, else float."""
    return None if val is None else float(val)


def compute_indicators(row: dict) -> tuple:
    """
    Given a dict of nutrition + food fields, compute and return a tuple
    matching the INSERT column order:

        (food_id, processed_level, is_processed,
         high_protein, high_fiber, high_sugar, high_fat, high_sodium,
         vegetarian, vegan, gluten_free, allergen, health_score)
    """
    food_id  = row["food_id"]
    category = row.get("category")

    protein  = safe_float(row.get("protein_g"))
    fiber    = safe_float(row.get("fiber_g"))
    sugar    = safe_float(row.get("sugar_g"))
    fat      = safe_float(row.get("fat_g"))
    sodium   = safe_float(row.get("sodium_mg"))

    # Boolean flags (None if data is missing)
    high_protein = (protein >= 15)  if protein  is not None else None
    high_fiber   = (fiber   >= 5)   if fiber    is not None else None
    high_sugar   = (sugar   >= 20)  if sugar    is not None else None
    high_fat     = (fat     >= 17)  if fat      is not None else None
    high_sodium  = (sodium  >= 400) if sodium   is not None else None

    # Processed level
    processed_level = classify_processed_level(category)
    is_processed    = processed_level != "LOW"

    # Health score
    score = 100
    if high_sugar:   score -= 20
    if high_fat:     score -= 20
    if high_sodium:  score -= 20
    if high_protein: score += 10
    if high_fiber:   score += 10
    score = max(0, min(100, score))  # clamp

    # Dietary flags: USDA Foundation Foods does not reliably contain this data
    vegetarian  = None
    vegan       = None
    gluten_free = None
    allergen    = None

    return (
        food_id,
        processed_level,
        is_processed,
        high_protein,
        high_fiber,
        high_sugar,
        high_fat,
        high_sodium,
        vegetarian,
        vegan,
        gluten_free,
        allergen,
        score,
    )


# ---------------------------------------------------------------------------
# Fetch nutrition + food data from DB
# ---------------------------------------------------------------------------

FETCH_SQL = """
    SELECT
        f.food_id,
        f.category,
        n.protein_g,
        n.fiber_g,
        n.sugar_g,
        n.fat_g,
        n.sodium_mg
    FROM fooditem f
    JOIN nutrition  n ON n.food_id = f.food_id
    -- Exclude foods that already have a HealthIndicators row
    WHERE f.food_id NOT IN (SELECT food_id FROM healthindicators)
    ORDER BY f.food_id
"""


def fetch_nutrition_rows(cur) -> list[dict]:
    log.info("Fetching nutrition + food data from DB …")
    cur.execute(FETCH_SQL)
    cols = [desc[0] for desc in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    log.info("Rows fetched: %d", len(rows))
    return rows


# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------

INSERT_SQL = """
    INSERT INTO healthindicators
        (food_id, processed_level, is_processed,
         high_protein, high_fiber, high_sugar, high_fat, high_sodium,
         vegetarian, vegan, gluten_free, allergen, health_score)
    VALUES %s
    ON CONFLICT (food_id) DO NOTHING
"""


def insert_indicators(conn, rows: list[dict]) -> None:
    # Compute all indicator tuples
    log.info("Computing health indicators …")
    tuples = [compute_indicators(r) for r in rows]
    log.info("Rows to insert: %d", len(tuples))

    total = len(tuples)
    with conn:
        with conn.cursor() as cur:
            for start in range(0, total, BATCH_SIZE):
                batch = tuples[start : start + BATCH_SIZE]
                execute_values(cur, INSERT_SQL, batch)
                done = min(start + BATCH_SIZE, total)
                if done % (BATCH_SIZE * 5) == 0 or done >= total:
                    log.info("  … %d / %d rows inserted", done, total)

    log.info("Transaction committed.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("=== populate_health_indicators.py START ===")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            rows = fetch_nutrition_rows(cur)

        if not rows:
            log.info("No new rows to insert — HealthIndicators is already up to date.")
        else:
            insert_indicators(conn, rows)

    except Exception as exc:
        log.exception("ERROR — rolling back: %s", exc)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()
        log.info("Connection closed.")

    log.info("=== populate_health_indicators.py DONE ===")


if __name__ == "__main__":
    main()
