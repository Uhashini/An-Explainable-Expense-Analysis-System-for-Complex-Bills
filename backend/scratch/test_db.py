import os
import sys
from dotenv import load_dotenv
from sqlalchemy import text
from app.database.postgres_client import engine

def test_connection():
    load_dotenv()
    print("POSTGRES_URL:", os.environ.get("POSTGRES_URL"))
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("Connection successful!", result.scalar())
    except Exception as e:
        print("Connection failed!", str(e))
        sys.exit(1)

if __name__ == "__main__":
    test_connection()
