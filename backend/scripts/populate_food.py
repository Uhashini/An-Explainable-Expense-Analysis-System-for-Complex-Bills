#!/usr/bin/env python3
from __future__ import annotations
"""
populate_food.py
----------------
Reads food.csv and food_category.csv from the USDA FoodData Central foundation
food export and populates the FoodItem table in Neon PostgreSQL.

Usage (run from backend/ directory):
    python scripts/populate_food.py

Dependencies:
    pip install psycopg2-binary pandas python-dotenv
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Resolve paths relative to this script file so it works regardless of cwd
SCRIPT_DIR   = Path(__file__).resolve().parent
BACKEND_DIR  = SCRIPT_DIR.parent
DATA_DIR     = Path("/Users/priyadarshinianand/Downloads/FoodData_Central_foundation_food_csv_2026-04-30")

FOOD_CSV          = DATA_DIR / "food.csv"
FOOD_CATEGORY_CSV = DATA_DIR / "food_category.csv"

# Side-car file: maps fdc_id → food_id so populate_nutrition.py can use it
FDC_MAP_PATH = BACKEND_DIR / "scripts" / "_fdc_id_map.json"

BATCH_SIZE = 1000

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
    """Load DATABASE_URL from .env and return a psycopg2 connection."""
    load_dotenv(BACKEND_DIR / ".env")
    db_url = os.getenv("POSTGRES_URL")
    if not db_url:
        log.error("POSTGRES_URL not found in .env — aborting.")
        sys.exit(1)
    log.info("Connecting to PostgreSQL …")
    return psycopg2.connect(db_url)


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def null_or_str(val) -> Optional[str]:
    """Return None for NaN / empty strings, otherwise a stripped string."""
    if pd.isna(val) or str(val).strip() == "":
        return None
    return str(val).strip()


def load_and_merge() -> pd.DataFrame:
    """
    Load food.csv and food_category.csv, merge on food_category_id → id,
    and return a clean DataFrame ready for insertion.
    """
    log.info("Loading %s …", FOOD_CSV)
    food_df = pd.read_csv(FOOD_CSV, dtype=str, keep_default_na=False)
    # Normalise column names (strip whitespace, lower)
    food_df.columns = food_df.columns.str.strip().str.lower()

    log.info("Loading %s …", FOOD_CATEGORY_CSV)
    cat_df = pd.read_csv(FOOD_CATEGORY_CSV, dtype=str, keep_default_na=False)
    cat_df.columns = cat_df.columns.str.strip().str.lower()

    log.info("food.csv rows: %d | food_category.csv rows: %d",
             len(food_df), len(cat_df))

    # Merge: food.food_category_id == food_category.id
    merged = food_df.merge(
        cat_df[["id", "description"]].rename(columns={"description": "category_description"}),
        left_on="food_category_id",
        right_on="id",
        how="left",
    )

    log.info("Merged rows: %d", len(merged))
    return merged


def build_rows(merged: pd.DataFrame) -> list[tuple]:
    """
    Convert the merged DataFrame into a list of tuples matching the
    FoodItem INSERT column order:
        (fdc_id, canonical_name, display_name, category, brand, barcode,
         serving_size, serving_unit)
    """
    rows = []
    for _, row in merged.iterrows():
        fdc_id         = null_or_str(row.get("fdc_id"))
        description    = null_or_str(row.get("description"))
        category       = null_or_str(row.get("category_description"))
        brand          = null_or_str(row.get("brand_owner", ""))
        barcode        = null_or_str(row.get("gtin_upc", ""))

        if not description:
            continue  # canonical_name is NOT NULL — skip rows without it

        rows.append((
            fdc_id,           # stored in a temp column we add below
            description,      # canonical_name
            description,      # display_name (same as description for USDA)
            category,         # category
            None,             # subcategory — not in USDA Foundation Foods
            brand,            # brand
            barcode,          # barcode
            None,             # serving_size — pulled from food_portion if needed
            None,             # serving_unit
        ))
    return rows


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

def ensure_fdc_id_column(cur) -> None:
    """
    Add fdc_id column to FoodItem if it doesn't already exist.
    This lets us join back from food_nutrient in script 2 without
    changing the canonical schema definition.
    """
    cur.execute("""
        ALTER TABLE fooditem
        ADD COLUMN IF NOT EXISTS fdc_id BIGINT UNIQUE;
    """)
    log.info("Ensured fdc_id column exists on FoodItem.")


INSERT_SQL = """
    INSERT INTO fooditem
        (fdc_id, canonical_name, display_name, category, subcategory,
         brand, barcode, serving_size, serving_unit)
    VALUES %s
    ON CONFLICT (canonical_name) DO NOTHING
"""


def insert_batches(cur, rows: list[tuple]) -> int:
    """Insert rows in batches; return total rows attempted."""
    total    = len(rows)
    inserted = 0

    for start in range(0, total, BATCH_SIZE):
        batch = rows[start : start + BATCH_SIZE]
        execute_values(cur, INSERT_SQL, batch)
        inserted += len(batch)

        if inserted % (BATCH_SIZE * 5) == 0 or inserted >= total:
            log.info("  … %d / %d rows processed", min(inserted, total), total)

    return total


# ---------------------------------------------------------------------------
# Side-car map: fdc_id → food_id
# ---------------------------------------------------------------------------

def save_fdc_map(cur) -> None:
    """
    Query FoodItem for (fdc_id, food_id) pairs and persist to a JSON file
    so that populate_nutrition.py can build the mapping without a schema change.
    """
    cur.execute("SELECT fdc_id, food_id FROM fooditem WHERE fdc_id IS NOT NULL;")
    rows = cur.fetchall()
    mapping = {str(fdc): fid for fdc, fid in rows}
    FDC_MAP_PATH.write_text(json.dumps(mapping))
    log.info("Saved fdc_id → food_id map (%d entries) to %s", len(mapping), FDC_MAP_PATH)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("=== populate_food.py START ===")

    # 1. Load & merge CSVs
    merged = load_and_merge()
    rows   = build_rows(merged)
    log.info("Rows to insert: %d", len(rows))

    # 2. Connect
    conn = get_connection()
    try:
        with conn:  # transaction — auto-commits or rolls back on exception
            with conn.cursor() as cur:

                # 3. Add fdc_id column if missing
                ensure_fdc_id_column(cur)

                # 4. Batch insert
                log.info("Inserting into FoodItem …")
                total = insert_batches(cur, rows)
                log.info("Insert phase complete — %d rows attempted.", total)

                # 5. Save side-car mapping
                save_fdc_map(cur)

        log.info("Transaction committed successfully.")

    except Exception as exc:
        log.exception("ERROR — rolling back: %s", exc)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()
        log.info("Connection closed.")

    log.info("=== populate_food.py DONE ===")


if __name__ == "__main__":
    main()
