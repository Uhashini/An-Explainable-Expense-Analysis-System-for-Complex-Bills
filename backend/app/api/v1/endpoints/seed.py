"""
Seed endpoint - populates demo receipts for uhashini@gmail.com.
Triggered automatically by the frontend on first load (idempotent).
"""

import hashlib
import logging
from typing import Optional
import bcrypt

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.postgres_client import (
    get_db, UserProfile, Receipt, ReceiptItem, FoodItem
)

logger = logging.getLogger(__name__)
router = APIRouter()

SEED_RECEIPTS = [
    {
        "merchant_name": "Whole Foods Market",
        "date": "2024-01-08",
        "items": [
            {"name": "Whole milk", "quantity": "1", "rate": "3.99", "price": "3.99"},
            {"name": "Large eggs", "quantity": "12", "rate": "0.32", "price": "3.89"},
            {"name": "Chicken breast", "quantity": "2", "rate": "6.49", "price": "12.98"},
            {"name": "Broccoli", "quantity": "1", "rate": "2.29", "price": "2.29"},
            {"name": "Brown rice", "quantity": "1", "rate": "3.49", "price": "3.49"},
            {"name": "Olive oil", "quantity": "1", "rate": "8.99", "price": "8.99"},
        ],
    },
    {
        "merchant_name": "Trader Joe's",
        "date": "2024-01-22",
        "items": [
            {"name": "Greek yogurt", "quantity": "2", "rate": "2.49", "price": "4.98"},
            {"name": "Spinach", "quantity": "1", "rate": "3.29", "price": "3.29"},
            {"name": "Salmon fillet", "quantity": "1", "rate": "11.99", "price": "11.99"},
            {"name": "Sweet potato", "quantity": "3", "rate": "1.09", "price": "3.27"},
            {"name": "Almonds", "quantity": "1", "rate": "6.49", "price": "6.49"},
        ],
    },
    {
        "merchant_name": "Kroger",
        "date": "2024-02-05",
        "items": [
            {"name": "Cheddar cheese", "quantity": "1", "rate": "4.79", "price": "4.79"},
            {"name": "Oatmeal", "quantity": "1", "rate": "3.99", "price": "3.99"},
            {"name": "Banana", "quantity": "6", "rate": "0.29", "price": "1.74"},
            {"name": "Orange juice", "quantity": "1", "rate": "4.49", "price": "4.49"},
            {"name": "Ground beef", "quantity": "1", "rate": "7.99", "price": "7.99"},
            {"name": "Whole wheat bread", "quantity": "1", "rate": "3.29", "price": "3.29"},
            {"name": "Butter", "quantity": "1", "rate": "4.49", "price": "4.49"},
        ],
    },
    {
        "merchant_name": "Walmart Supercenter",
        "date": "2024-02-19",
        "items": [
            {"name": "White rice", "quantity": "1", "rate": "2.48", "price": "2.48"},
            {"name": "Frozen peas", "quantity": "2", "rate": "1.78", "price": "3.56"},
            {"name": "Tuna canned", "quantity": "3", "rate": "1.29", "price": "3.87"},
            {"name": "Peanut butter", "quantity": "1", "rate": "3.48", "price": "3.48"},
            {"name": "Apple", "quantity": "4", "rate": "0.89", "price": "3.56"},
            {"name": "Carrot", "quantity": "2", "rate": "1.29", "price": "2.58"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2024-03-11",
        "items": [
            {"name": "Turkey breast", "quantity": "1", "rate": "9.99", "price": "9.99"},
            {"name": "Quinoa", "quantity": "1", "rate": "5.99", "price": "5.99"},
            {"name": "Blueberry", "quantity": "1", "rate": "3.99", "price": "3.99"},
            {"name": "Almond milk", "quantity": "1", "rate": "3.49", "price": "3.49"},
            {"name": "Kale", "quantity": "1", "rate": "2.99", "price": "2.99"},
            {"name": "Lentils", "quantity": "1", "rate": "2.79", "price": "2.79"},
            {"name": "Honey", "quantity": "1", "rate": "5.49", "price": "5.49"},
        ],
    },
    {
        "merchant_name": "Target",
        "date": "2024-03-28",
        "items": [
            {"name": "Cottage cheese", "quantity": "1", "rate": "3.99", "price": "3.99"},
            {"name": "Strawberry", "quantity": "1", "rate": "3.49", "price": "3.49"},
            {"name": "Chicken thigh", "quantity": "2", "rate": "4.49", "price": "8.98"},
            {"name": "Tomato", "quantity": "3", "rate": "0.79", "price": "2.37"},
            {"name": "Pasta", "quantity": "2", "rate": "1.49", "price": "2.98"},
        ],
    },
    {
        "merchant_name": "Costco",
        "date": "2024-04-06",
        "items": [
            {"name": "Salmon fillet", "quantity": "4", "rate": "10.99", "price": "43.96"},
            {"name": "Large eggs", "quantity": "36", "rate": "0.25", "price": "8.99"},
            {"name": "Chicken breast", "quantity": "6", "rate": "5.99", "price": "35.94"},
            {"name": "Greek yogurt", "quantity": "12", "rate": "1.89", "price": "22.68"},
            {"name": "Almonds", "quantity": "3", "rate": "5.99", "price": "17.97"},
        ],
    },
    {
        "merchant_name": "Trader Joe's",
        "date": "2024-04-21",
        "items": [
            {"name": "Avocado", "quantity": "3", "rate": "1.49", "price": "4.47"},
            {"name": "Sourdough bread", "quantity": "1", "rate": "3.99", "price": "3.99"},
            {"name": "Cheddar cheese", "quantity": "1", "rate": "5.49", "price": "5.49"},
            {"name": "Broccoli", "quantity": "2", "rate": "1.99", "price": "3.98"},
            {"name": "Mozzarella cheese", "quantity": "1", "rate": "4.99", "price": "4.99"},
            {"name": "Cherry tomato", "quantity": "1", "rate": "2.99", "price": "2.99"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2024-05-09",
        "items": [
            {"name": "Tuna steak", "quantity": "2", "rate": "9.99", "price": "19.98"},
            {"name": "Asparagus", "quantity": "1", "rate": "3.49", "price": "3.49"},
            {"name": "Brown rice", "quantity": "2", "rate": "3.49", "price": "6.98"},
            {"name": "Olive oil", "quantity": "1", "rate": "9.99", "price": "9.99"},
            {"name": "Greek yogurt", "quantity": "3", "rate": "2.49", "price": "7.47"},
        ],
    },
    {
        "merchant_name": "Kroger",
        "date": "2024-05-24",
        "items": [
            {"name": "Whole milk", "quantity": "2", "rate": "3.99", "price": "7.98"},
            {"name": "Orange", "quantity": "4", "rate": "0.89", "price": "3.56"},
            {"name": "Ground turkey", "quantity": "1", "rate": "5.99", "price": "5.99"},
            {"name": "Spinach", "quantity": "2", "rate": "2.99", "price": "5.98"},
            {"name": "Oatmeal", "quantity": "2", "rate": "3.79", "price": "7.58"},
            {"name": "Peanut butter", "quantity": "1", "rate": "3.99", "price": "3.99"},
        ],
    },
    {
        "merchant_name": "Walmart Supercenter",
        "date": "2024-06-08",
        "items": [
            {"name": "Watermelon", "quantity": "1", "rate": "6.98", "price": "6.98"},
            {"name": "Corn", "quantity": "6", "rate": "0.50", "price": "3.00"},
            {"name": "Ground beef", "quantity": "2", "rate": "6.98", "price": "13.96"},
            {"name": "Potato", "quantity": "5", "rate": "0.69", "price": "3.45"},
            {"name": "Butter", "quantity": "2", "rate": "4.28", "price": "8.56"},
            {"name": "Cheddar cheese", "quantity": "2", "rate": "4.48", "price": "8.96"},
        ],
    },
    {
        "merchant_name": "Costco",
        "date": "2024-06-23",
        "items": [
            {"name": "Shrimp", "quantity": "2", "rate": "14.99", "price": "29.98"},
            {"name": "Brown rice", "quantity": "5", "rate": "3.20", "price": "16.00"},
            {"name": "Frozen broccoli", "quantity": "3", "rate": "2.99", "price": "8.97"},
            {"name": "Peanut butter", "quantity": "2", "rate": "7.99", "price": "15.98"},
            {"name": "Large eggs", "quantity": "24", "rate": "0.26", "price": "6.24"},
        ],
    },
    {
        "merchant_name": "Trader Joe's",
        "date": "2024-07-12",
        "items": [
            {"name": "Peach", "quantity": "4", "rate": "0.99", "price": "3.96"},
            {"name": "Blueberry", "quantity": "2", "rate": "3.99", "price": "7.98"},
            {"name": "Salmon fillet", "quantity": "2", "rate": "10.99", "price": "21.98"},
            {"name": "Quinoa", "quantity": "2", "rate": "5.49", "price": "10.98"},
            {"name": "Almond milk", "quantity": "2", "rate": "3.29", "price": "6.58"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2024-07-28",
        "items": [
            {"name": "Kale", "quantity": "2", "rate": "2.99", "price": "5.98"},
            {"name": "Cherry tomato", "quantity": "2", "rate": "3.49", "price": "6.98"},
            {"name": "Turkey breast", "quantity": "2", "rate": "8.99", "price": "17.98"},
            {"name": "Sweet potato", "quantity": "4", "rate": "1.09", "price": "4.36"},
            {"name": "Lentils", "quantity": "2", "rate": "2.49", "price": "4.98"},
            {"name": "Honey", "quantity": "1", "rate": "6.99", "price": "6.99"},
        ],
    },
    {
        "merchant_name": "Target",
        "date": "2024-08-10",
        "items": [
            {"name": "Chicken breast", "quantity": "3", "rate": "6.99", "price": "20.97"},
            {"name": "Whole wheat bread", "quantity": "2", "rate": "3.49", "price": "6.98"},
            {"name": "Banana", "quantity": "8", "rate": "0.29", "price": "2.32"},
            {"name": "Cottage cheese", "quantity": "2", "rate": "3.79", "price": "7.58"},
            {"name": "Orange juice", "quantity": "1", "rate": "4.99", "price": "4.99"},
        ],
    },
    {
        "merchant_name": "Kroger",
        "date": "2024-08-26",
        "items": [
            {"name": "Pork chop", "quantity": "2", "rate": "5.99", "price": "11.98"},
            {"name": "Zucchini", "quantity": "3", "rate": "1.29", "price": "3.87"},
            {"name": "Bell pepper", "quantity": "3", "rate": "1.49", "price": "4.47"},
            {"name": "Canned beans", "quantity": "3", "rate": "1.19", "price": "3.57"},
            {"name": "Pasta", "quantity": "3", "rate": "1.29", "price": "3.87"},
            {"name": "Olive oil", "quantity": "1", "rate": "8.49", "price": "8.49"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2024-09-14",
        "items": [
            {"name": "Apple", "quantity": "6", "rate": "0.99", "price": "5.94"},
            {"name": "Pomegranate", "quantity": "2", "rate": "2.99", "price": "5.98"},
            {"name": "Oatmeal", "quantity": "2", "rate": "4.29", "price": "8.58"},
            {"name": "Almond butter", "quantity": "1", "rate": "8.99", "price": "8.99"},
            {"name": "Broccoli", "quantity": "3", "rate": "2.29", "price": "6.87"},
        ],
    },
    {
        "merchant_name": "Walmart Supercenter",
        "date": "2024-10-05",
        "items": [
            {"name": "Whole milk", "quantity": "2", "rate": "3.78", "price": "7.56"},
            {"name": "Large eggs", "quantity": "12", "rate": "0.33", "price": "3.96"},
            {"name": "Ground beef", "quantity": "2", "rate": "6.48", "price": "12.96"},
            {"name": "Potato", "quantity": "5", "rate": "0.68", "price": "3.40"},
            {"name": "Onion", "quantity": "3", "rate": "0.79", "price": "2.37"},
            {"name": "Garlic", "quantity": "2", "rate": "0.89", "price": "1.78"},
        ],
    },
    {
        "merchant_name": "Costco",
        "date": "2024-10-19",
        "items": [
            {"name": "Chicken breast", "quantity": "8", "rate": "5.79", "price": "46.32"},
            {"name": "Greek yogurt", "quantity": "12", "rate": "1.99", "price": "23.88"},
            {"name": "Salmon fillet", "quantity": "3", "rate": "10.99", "price": "32.97"},
            {"name": "Almonds", "quantity": "4", "rate": "5.49", "price": "21.96"},
            {"name": "Frozen peas", "quantity": "4", "rate": "1.88", "price": "7.52"},
        ],
    },
    {
        "merchant_name": "Trader Joe's",
        "date": "2024-11-03",
        "items": [
            {"name": "Turkey breast", "quantity": "3", "rate": "9.49", "price": "28.47"},
            {"name": "Sweet potato", "quantity": "6", "rate": "0.99", "price": "5.94"},
            {"name": "Cranberry", "quantity": "2", "rate": "3.49", "price": "6.98"},
            {"name": "Spinach", "quantity": "2", "rate": "2.99", "price": "5.98"},
            {"name": "Whole wheat bread", "quantity": "2", "rate": "3.79", "price": "7.58"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2024-11-23",
        "items": [
            {"name": "Pumpkin", "quantity": "1", "rate": "5.99", "price": "5.99"},
            {"name": "Quinoa", "quantity": "2", "rate": "5.99", "price": "11.98"},
            {"name": "Cheddar cheese", "quantity": "2", "rate": "5.49", "price": "10.98"},
            {"name": "Brussel sprout", "quantity": "1", "rate": "3.49", "price": "3.49"},
            {"name": "Lentils", "quantity": "2", "rate": "2.79", "price": "5.58"},
            {"name": "Butter", "quantity": "2", "rate": "4.99", "price": "9.98"},
        ],
    },
    {
        "merchant_name": "Costco",
        "date": "2024-12-07",
        "items": [
            {"name": "Beef ribeye steak", "quantity": "2", "rate": "18.99", "price": "37.98"},
            {"name": "Shrimp", "quantity": "3", "rate": "14.49", "price": "43.47"},
            {"name": "Salmon fillet", "quantity": "4", "rate": "10.49", "price": "41.96"},
            {"name": "Large eggs", "quantity": "36", "rate": "0.24", "price": "8.64"},
            {"name": "Butter", "quantity": "4", "rate": "4.79", "price": "19.16"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2024-12-22",
        "items": [
            {"name": "Walnut", "quantity": "2", "rate": "7.99", "price": "15.98"},
            {"name": "Cranberry", "quantity": "3", "rate": "3.99", "price": "11.97"},
            {"name": "Mozzarella cheese", "quantity": "2", "rate": "5.49", "price": "10.98"},
            {"name": "Avocado", "quantity": "4", "rate": "1.49", "price": "5.96"},
            {"name": "Honey", "quantity": "2", "rate": "6.49", "price": "12.98"},
        ],
    },
    {
        "merchant_name": "Trader Joe's",
        "date": "2025-01-11",
        "items": [
            {"name": "Greek yogurt", "quantity": "4", "rate": "2.49", "price": "9.96"},
            {"name": "Oatmeal", "quantity": "2", "rate": "4.29", "price": "8.58"},
            {"name": "Blueberry", "quantity": "2", "rate": "4.49", "price": "8.98"},
            {"name": "Almond milk", "quantity": "2", "rate": "3.49", "price": "6.98"},
            {"name": "Peanut butter", "quantity": "1", "rate": "4.29", "price": "4.29"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2025-03-15",
        "items": [
            {"name": "Chicken breast", "quantity": "4", "rate": "7.29", "price": "29.16"},
            {"name": "Broccoli", "quantity": "3", "rate": "2.49", "price": "7.47"},
            {"name": "Brown rice", "quantity": "2", "rate": "3.79", "price": "7.58"},
            {"name": "Olive oil", "quantity": "1", "rate": "10.99", "price": "10.99"},
            {"name": "Greek yogurt", "quantity": "4", "rate": "2.79", "price": "11.16"},
        ],
    },
    {
        "merchant_name": "Kroger",
        "date": "2025-06-20",
        "items": [
            {"name": "Salmon fillet", "quantity": "2", "rate": "12.99", "price": "25.98"},
            {"name": "Asparagus", "quantity": "2", "rate": "3.99", "price": "7.98"},
            {"name": "Quinoa", "quantity": "2", "rate": "6.29", "price": "12.58"},
            {"name": "Strawberry", "quantity": "2", "rate": "3.99", "price": "7.98"},
            {"name": "Large eggs", "quantity": "12", "rate": "0.39", "price": "4.68"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2025-09-08",
        "items": [
            {"name": "Turkey breast", "quantity": "2", "rate": "10.99", "price": "21.98"},
            {"name": "Sweet potato", "quantity": "4", "rate": "1.29", "price": "5.16"},
            {"name": "Lentils", "quantity": "3", "rate": "2.99", "price": "8.97"},
            {"name": "Kale", "quantity": "2", "rate": "3.29", "price": "6.58"},
            {"name": "Almond butter", "quantity": "1", "rate": "9.99", "price": "9.99"},
            {"name": "Honey", "quantity": "1", "rate": "7.49", "price": "7.49"},
        ],
    },
    {
        "merchant_name": "Costco",
        "date": "2026-01-12",
        "items": [
            {"name": "Chicken breast", "quantity": "8", "rate": "6.49", "price": "51.92"},
            {"name": "Salmon fillet", "quantity": "4", "rate": "12.49", "price": "49.96"},
            {"name": "Large eggs", "quantity": "36", "rate": "0.29", "price": "10.44"},
            {"name": "Greek yogurt", "quantity": "12", "rate": "2.09", "price": "25.08"},
            {"name": "Almonds", "quantity": "3", "rate": "6.49", "price": "19.47"},
        ],
    },
    {
        "merchant_name": "Whole Foods Market",
        "date": "2026-05-17",
        "items": [
            {"name": "Avocado", "quantity": "4", "rate": "1.79", "price": "7.16"},
            {"name": "Quinoa", "quantity": "2", "rate": "6.49", "price": "12.98"},
            {"name": "Blueberry", "quantity": "3", "rate": "4.99", "price": "14.97"},
            {"name": "Mozzarella cheese", "quantity": "2", "rate": "5.99", "price": "11.98"},
            {"name": "Olive oil", "quantity": "1", "rate": "11.99", "price": "11.99"},
            {"name": "Broccoli", "quantity": "3", "rate": "2.69", "price": "8.07"},
        ],
    },
    {
        "merchant_name": "Trader Joe's",
        "date": "2026-09-03",
        "items": [
            {"name": "Ground beef", "quantity": "2", "rate": "7.99", "price": "15.98"},
            {"name": "Cheddar cheese", "quantity": "2", "rate": "5.99", "price": "11.98"},
            {"name": "Whole milk", "quantity": "2", "rate": "4.29", "price": "8.58"},
            {"name": "Brown rice", "quantity": "2", "rate": "3.99", "price": "7.98"},
            {"name": "Carrot", "quantity": "3", "rate": "1.49", "price": "4.47"},
            {"name": "Onion", "quantity": "3", "rate": "0.89", "price": "2.67"},
            {"name": "Garlic", "quantity": "2", "rate": "0.99", "price": "1.98"},
        ],
    },
]


def _find_or_create_user(db):
    from sqlalchemy import func
    user = db.query(UserProfile).filter(
        func.lower(UserProfile.email) == "uhashini@gmail.com"
    ).first()
    if not user:
        raw_pwd = "Demo@1234"
        pre_hash = hashlib.sha256(raw_pwd.encode()).hexdigest().encode()
        hashed = bcrypt.hashpw(pre_hash, bcrypt.gensalt()).decode()
        user = UserProfile(
            name="Uhashini",
            email="uhashini@gmail.com",
            password_hash=hashed,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _get_food_id_map(db):
    rows = db.query(FoodItem.food_id, FoodItem.canonical_name, FoodItem.display_name).all()
    mapping = {}
    for food_id, canonical_name, display_name in rows:
        if canonical_name:
            mapping[canonical_name.lower().strip()] = food_id
        if display_name:
            mapping[display_name.lower().strip()] = food_id
    return mapping


def _match_food_id(item_name, food_map):
    key = item_name.lower().strip()
    if key in food_map:
        return food_map[key]
    tokens = key.split()
    for k, fid in food_map.items():
        k_tokens = k.split()
        if any(t in k_tokens for t in tokens):
            return fid
    return None


@router.post("/populate", tags=["Seed"])
def populate_demo_receipts(db: Session = Depends(get_db)):
    try:
        user = _find_or_create_user(db)
        existing_count = db.query(Receipt).filter(Receipt.user_id == user.user_id).count()
        if existing_count >= 5:
            return {
                "status": "already_populated",
                "message": f"User already has {existing_count} receipts. Skipping seed.",
                "user_id": user.user_id,
            }
        food_map = _get_food_id_map(db)
        inserted_receipts = 0
        for rec_data in SEED_RECEIPTS:
            items = rec_data["items"]
            total = round(sum(float(i["price"]) for i in items), 2)
            receipt = Receipt(
                user_id=user.user_id,
                merchant_name=rec_data["merchant_name"],
                date=rec_data["date"],
                total_amount=total,
            )
            db.add(receipt)
            db.flush()
            for item in items:
                food_id = _match_food_id(item["name"], food_map)
                db_item = ReceiptItem(
                    receipt_id=receipt.receipt_id,
                    name=item["name"],
                    matched_food_id=food_id,
                    quantity=item["quantity"],
                    rate=item["rate"],
                    price=item["price"],
                )
                db.add(db_item)
            inserted_receipts += 1
        db.commit()
        return {
            "status": "success",
            "message": f"Successfully seeded {inserted_receipts} receipts.",
            "user_id": user.user_id,
            "receipts_inserted": inserted_receipts,
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}


@router.get("/status", tags=["Seed"])
def seed_status(db: Session = Depends(get_db)):
    from sqlalchemy import func
    user = db.query(UserProfile).filter(
        func.lower(UserProfile.email) == "uhashini@gmail.com"
    ).first()
    if not user:
        return {"status": "no_user", "receipts": 0}
    count = db.query(Receipt).filter(Receipt.user_id == user.user_id).count()
    return {"status": "ok", "user_id": user.user_id, "receipts": count}
