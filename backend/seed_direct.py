import sys
import os
import random
from datetime import datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure app is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database.postgres_client import Receipt, ReceiptItem

# Create engine directly, bypassing DNS issue by injecting IP
# Using the resolved IPv4 address from earlier: 13.58.18.166
url = "postgresql://neondb_owner:npg_LedJynfCp5N2@ep-icy-fog-axpqqjrj-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
engine = create_engine(url, connect_args={'hostaddr': '13.58.18.166'})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_data(user_id=2):
    db = SessionLocal()
    
    print("Seeding receipts for past 12 months using direct IPv4...")
    
    base_spending = 1500.0
    items_pool = [
        {"name": "Milk", "price": "60.0", "rate": "60", "quantity": "1"},
        {"name": "Bread", "price": "40.0", "rate": "40", "quantity": "1"},
        {"name": "Eggs", "price": "120.0", "rate": "120", "quantity": "1"},
        {"name": "Chicken", "price": "250.0", "rate": "250", "quantity": "1"},
        {"name": "Rice 5kg", "price": "500.0", "rate": "500", "quantity": "1"},
        {"name": "Apples", "price": "200.0", "rate": "200", "quantity": "1"},
        {"name": "Oil 1L", "price": "180.0", "rate": "180", "quantity": "1"}
    ]
    
    for i in range(12, 0, -1):
        past_date = datetime.now() - relativedelta(months=i)
        date_str = past_date.strftime("%Y-%m-%d %H:%M:%S")
        
        # Calculate random total. Add an anomaly 3 months ago
        if i == 3:
            total = base_spending * 2.5 
        else:
            total = base_spending * random.uniform(0.8, 1.2)
            
        receipt = Receipt(
            user_id=user_id,
            merchant_name="SuperMart",
            date=date_str,
            total_amount=round(total, 2)
        )
        db.add(receipt)
        db.commit()
        db.refresh(receipt)
        
        num_items = random.randint(2, 5)
        for _ in range(num_items):
            item_data = random.choice(items_pool)
            r_item = ReceiptItem(
                receipt_id=receipt.receipt_id,
                name=item_data["name"],
                quantity=item_data["quantity"],
                rate=item_data["rate"],
                price=item_data["price"]
            )
            db.add(r_item)
            
        db.commit()
        
    print("Seed complete!")

if __name__ == "__main__":
    seed_data(user_id=2)
