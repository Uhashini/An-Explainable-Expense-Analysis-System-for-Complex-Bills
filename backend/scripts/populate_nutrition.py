#!/usr/bin/env python3
from __future__ import annotations
"""
populate_nutrition.py
---------------------
Reads food_nutrient.csv and nutrient.csv from the USDA FoodData Central
foundation food export, pivots the long-form nutrient rows into one wide
Nutrition row per food, and inserts into the Nutrition table in Neon PostgreSQL.

Prerequisite: run populate_food.py first — it creates _fdc_id_map.json.

Usage (run from backend/ directory):
    python scripts/populate_nutrition.py

Dependencies:
    pip install psycopg2-binary pandas python-dotenv
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR  = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_DIR    = Path("/Users/priyadarshinianand/Downloads/FoodData_Central_foundation_food_csv_2026-04-30")

FOOD_NUTRIENT_CSV = DATA_DIR / "food_nutrient.csv"
NUTRIENT_CSV      = DATA_DIR / "nutrient.csv"
FDC_MAP_PATH      = BACKEND_DIR / "scripts" / "_fdc_id_map.json"

BATCH_SIZE = 500

# ---------------------------------------------------------------------------
# Nutrient name → target column mapping.
# Keys are LOWERCASE substrings that appear in the USDA nutrient name.
# The first match wins (order matters for ambiguous names).
# ---------------------------------------------------------------------------

NUTRIENT_MAP: dict[str, str] = {
    # Energy — prefer "energy" with unit KCAL; kJ row is filtered out later
    "energy":            "calories_kcal",
    # Protein
    "protein":           "protein_g",
    # Carbohydrate
    "carbohydrate":      "carbohydrates_g",
    # Fat
    "total lipid (fat)": "fat_g",
    # Fiber
    "fiber, total dietary": "fiber_g",
    # Sugars — "sugars, total" preferred over "sugars, added"
    "sugars, total":     "sugar_g",
    # Minerals
    "sodium, na":        "sodium_mg",
    "calcium, ca":       "calcium_mg",
    "iron, fe":          "iron_mg",
    "potassium, k":      "potassium_mg",
    # Vitamins
    "vitamin c, total":  "vitamin_c_mg",
    "vitamin a, rae":    "vitamin_a_ug",
}

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
# fdc_id → food_id mapping
# ---------------------------------------------------------------------------

def load_fdc_map() -> dict[str, int]:
    """Load the side-car map produced by populate_food.py."""
    if not FDC_MAP_PATH.exists():
        log.error(
            "Side-car map not found at %s. "
            "Run populate_food.py first.",
            FDC_MAP_PATH,
        )
        sys.exit(1)
    mapping = json.loads(FDC_MAP_PATH.read_text())
    log.info("Loaded fdc_id map — %d entries.", len(mapping))
    return mapping  # {str(fdc_id): food_id}


# ---------------------------------------------------------------------------
# CSV loading & pivoting
# ---------------------------------------------------------------------------

def resolve_nutrient_column(name: str) -> Optional[str]:
    """
    Return the target Nutrition column for a USDA nutrient name,
    or None if the nutrient is not in our mapping.
    Matching is case-insensitive and uses substring search.
    """
    name_lower = name.lower().strip()
    for key, col in NUTRIENT_MAP.items():
        if key in name_lower:
            return col
    return None


def load_and_pivot() -> pd.DataFrame:
    """
    Load food_nutrient.csv and nutrient.csv, join them, filter to nutrients
    we care about, then pivot to a wide DataFrame (one row per fdc_id).

    Returns a DataFrame with columns:
        fdc_id, calories_kcal, protein_g, …, vitamin_a_ug
    """
    log.info("Loading %s …", NUTRIENT_CSV)
    nutr_df = pd.read_csv(NUTRIENT_CSV, dtype=str, keep_default_na=False)
    nutr_df.columns = nutr_df.columns.str.strip().str.lower()
    # Map nutrient id → target column name
    nutr_df["target_col"] = nutr_df["name"].apply(resolve_nutrient_column)
    nutr_df = nutr_df[nutr_df["target_col"].notna()].copy()
    log.info("Relevant nutrient types found: %d", len(nutr_df))

    log.info("Loading %s (this may take a moment) …", FOOD_NUTRIENT_CSV)
    fn_df = pd.read_csv(FOOD_NUTRIENT_CSV, dtype=str, keep_default_na=False)
    fn_df.columns = fn_df.columns.str.strip().str.lower()

    # Join food_nutrient with our filtered nutrient list
    joined = fn_df.merge(
        nutr_df[["id", "target_col", "unit_name"]],
        left_on="nutrient_id",
        right_on="id",
        how="inner",
    )
    log.info("Joined rows (filtered): %d", len(joined))

    # Convert amount to float
    joined["amount"] = pd.to_numeric(joined["amount"], errors="coerce")

    # For Energy, keep only KCAL rows (drop kJ)
    energy_mask = joined["target_col"] == "calories_kcal"
    joined = joined[~(energy_mask & (joined["unit_name"].str.upper() == "KJ"))].copy()

    # Deduplicate: keep first occurrence per (fdc_id, target_col)
    joined = joined.drop_duplicates(subset=["fdc_id", "target_col"], keep="first")

    # Pivot to wide format
    log.info("Pivoting to wide format …")
    wide = joined.pivot(index="fdc_id", columns="target_col", values="amount").reset_index()

    # Ensure all expected columns exist (fill with NaN if nutrient absent)
    all_cols = list(NUTRIENT_MAP.values())
    for col in all_cols:
        if col not in wide.columns:
            wide[col] = np.nan

    wide = wide[["fdc_id"] + all_cols]
    log.info("Wide table: %d food rows × %d nutrient columns", len(wide), len(all_cols))
    return wide


# ---------------------------------------------------------------------------
# Row building
# ---------------------------------------------------------------------------

def nan_or_decimal(val) -> Optional[float]:
    """Return None for NaN, else a Python float (psycopg2 maps to DECIMAL)."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return float(val)


INSERT_SQL = """
    INSERT INTO nutrition
        (food_id, calories_kcal, protein_g, carbohydrates_g, fat_g,
         fiber_g, sugar_g, sodium_mg, calcium_mg, iron_mg,
         potassium_mg, vitamin_c_mg, vitamin_a_ug)
    VALUES %s
    ON CONFLICT (food_id) DO NOTHING
"""


def build_and_insert(conn, wide: pd.DataFrame, fdc_map: dict[str, int]) -> None:
    rows_to_insert: list[tuple] = []
    skipped = 0

    for _, row in wide.iterrows():
        fdc_id_str = str(row["fdc_id"]).strip()
        food_id    = fdc_map.get(fdc_id_str)
        if food_id is None:
            skipped += 1
            continue

        rows_to_insert.append((
            food_id,
            nan_or_decimal(row.get("calories_kcal")),
            nan_or_decimal(row.get("protein_g")),
            nan_or_decimal(row.get("carbohydrates_g")),
            nan_or_decimal(row.get("fat_g")),
            nan_or_decimal(row.get("fiber_g")),
            nan_or_decimal(row.get("sugar_g")),
            nan_or_decimal(row.get("sodium_mg")),
            nan_or_decimal(row.get("calcium_mg")),
            nan_or_decimal(row.get("iron_mg")),
            nan_or_decimal(row.get("potassium_mg")),
            nan_or_decimal(row.get("vitamin_c_mg")),
            nan_or_decimal(row.get("vitamin_a_ug")),
        ))

    log.info(
        "Rows to insert: %d | Skipped (no food_id match): %d",
        len(rows_to_insert), skipped,
    )

    total = len(rows_to_insert)
    with conn:
        with conn.cursor() as cur:
            for start in range(0, total, BATCH_SIZE):
                batch = rows_to_insert[start : start + BATCH_SIZE]
                execute_values(cur, INSERT_SQL, batch)
                done = min(start + BATCH_SIZE, total)
                if done % (BATCH_SIZE * 5) == 0 or done >= total:
                    log.info("  … %d / %d rows inserted", done, total)

    log.info("Transaction committed.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("=== populate_nutrition.py START ===")

    fdc_map = load_fdc_map()
    wide    = load_and_pivot()

    conn = get_connection()
    try:
        build_and_insert(conn, wide, fdc_map)
    except Exception as exc:
        log.exception("ERROR — rolling back: %s", exc)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()
        log.info("Connection closed.")

    log.info("=== populate_nutrition.py DONE ===")


if __name__ == "__main__":
    main()
