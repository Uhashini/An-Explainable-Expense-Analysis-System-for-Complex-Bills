import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.postgres_client import init_db

print("Initializing database tables...")
try:
    init_db()
    print("Successfully created tables!")
except Exception as e:
    print(f"Error initializing database: {e}")
