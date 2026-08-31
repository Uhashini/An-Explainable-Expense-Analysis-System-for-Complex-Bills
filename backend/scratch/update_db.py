import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

db_url = os.environ.get('POSTGRES_URL')

def update_db():
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()

    print("Adding password_hash to UserProfile...")
    try:
        cursor.execute("ALTER TABLE UserProfile ADD COLUMN password_hash VARCHAR(255);")
        print("Successfully added password_hash to UserProfile.")
    except psycopg2.errors.DuplicateColumn:
        print("password_hash column already exists.")
    except Exception as e:
        print(f"Error adding password_hash: {e}")

    print("Creating UserOnboarding table...")
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS UserOnboarding (
                onboarding_id SERIAL PRIMARY KEY,
                user_id INT UNIQUE NOT NULL REFERENCES UserProfile(user_id) ON DELETE CASCADE,
                height VARCHAR(50),
                weight VARCHAR(50),
                activity_level VARCHAR(50),
                food_preference VARCHAR(100),
                allergies VARCHAR(255),
                medical_conditions VARCHAR(255),
                goals VARCHAR(255),
                household_size VARCHAR(50),
                shopping_frequency VARCHAR(50),
                city VARCHAR(100)
            );
        """)
        print("Successfully created UserOnboarding table.")
    except Exception as e:
        print(f"Error creating UserOnboarding table: {e}")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    update_db()
