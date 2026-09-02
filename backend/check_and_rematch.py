import os
from sqlalchemy.orm import Session
from app.database.postgres_client import SessionLocal, ReceiptItem, FoodItem
from app.services.product_matcher import product_matcher

def check_and_rematch():
    db = SessionLocal()
    db.expire_on_commit = False
    try:
        print("Checking database for receipt item matching statistics...")
        total_items = db.query(ReceiptItem).count()
        matched_items = db.query(ReceiptItem).filter(ReceiptItem.matched_food_id != None).count()
        unmatched_items = db.query(ReceiptItem).filter(ReceiptItem.matched_food_id == None).all()
        
        print(f"\n--- Statistics ---")
        print(f"Total Receipt Items: {total_items}")
        print(f"Matched Items: {matched_items}")
        print(f"Unmatched Items: {len(unmatched_items)}")
        
        if len(unmatched_items) == 0:
            print("\nAll receipt items are successfully matched! No action needed.")
            return

        print("\n--- Unmatched Items ---")
        for item in unmatched_items[:10]:
            print(f" - {item.name}")
            
        if len(unmatched_items) > 10:
            print(f"   ... and {len(unmatched_items) - 10} more.")

        print(f"\nAttempting to rematch {len(unmatched_items)} items using the latest Product Matcher (Sentence Transformer)...")
        
        updated_count = 0
        for index, item in enumerate(unmatched_items):
            if not item.name:
                continue
                
            match = product_matcher.match_item(item.name)
            if match and match.get("food_id"):
                item.matched_food_id = match["food_id"]
                updated_count += 1
                
                # Commit immediately to keep the Neon connection alive!
                try:
                    db.commit()
                except Exception as e:
                    print(f"Error committing item {item.name}: {e}")
                    db.rollback()
                    
            if (index + 1) % 10 == 0:
                print(f"Processed {index + 1} / {len(unmatched_items)}...")
                
        if updated_count > 0:
            print(f"\nSuccessfully found matches for {updated_count} items!")
        else:
            print("\nCould not find any new matches for the unmatched items.")
            
    except Exception as e:
        print(f"\nError connecting to database or processing items: {e}")
        if "Connection refused" in str(e):
            print("\n>>> It looks like your Neon PostgreSQL database is asleep. Please go to your Neon console to wake it up! <<<")
    finally:
        db.close()

if __name__ == "__main__":
    check_and_rematch()
