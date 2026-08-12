import os
import sys
from sqlalchemy import text
from dotenv import load_dotenv

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv()
POSTGRES_URL = os.environ.get("POSTGRES_URL", "")

if POSTGRES_URL.startswith("sqlite") or not POSTGRES_URL:
    print("Error: You are currently using SQLite. This migration script requires PostgreSQL with pgvector support.")
    print("Please update your POSTGRES_URL in .env to point to a PostgreSQL database.")
    sys.exit(1)

from app.database.postgres_client import SessionLocal, Product
from sentence_transformers import SentenceTransformer

def migrate():
    db = SessionLocal()
    
    print("Enabling extensions...")
    try:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        db.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
        db.commit()
    except Exception as e:
        print(f"Failed to create extensions: {e}")
        db.rollback()
        
    print("Adding embedding column if not exists...")
    try:
        db.execute(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS embedding vector(384);"))
        db.commit()
    except Exception as e:
        print(f"Warning: Could not alter table. If the column already exists, this is fine: {e}")
        db.rollback()

    print("Loading SentenceTransformer model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    print("Fetching products without embeddings...")
    products = db.query(Product).filter(Product.embedding.is_(None)).all()
    
    if not products:
        print("No products need embeddings updated.")
        db.close()
        return

    print(f"Generating embeddings for {len(products)} products. This may take a moment...")
    
    for p in products:
        emb = model.encode(p.name).tolist()
        p.embedding = emb
        
    print("Saving to database...")
    db.commit()
    print("Migration complete!")
    db.close()

if __name__ == "__main__":
    migrate()
