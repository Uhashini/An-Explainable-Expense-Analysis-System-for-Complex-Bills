import os
from sqlalchemy import create_engine, Column, Integer, BigInteger, String, Boolean, Float, Numeric, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv

load_dotenv()
POSTGRES_URL = os.environ.get("POSTGRES_URL", "sqlite:///./pantrix.db")

if POSTGRES_URL.startswith("sqlite"):
    engine = create_engine(POSTGRES_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(
        POSTGRES_URL,
        pool_pre_ping=True,     # Test connections before use (fixes Neon idle drops)
        pool_recycle=300,       # Recycle connections every 5 minutes
        pool_size=5,
        max_overflow=10,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UserProfile(Base):
    __tablename__ = "userprofile"
    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255))
    age = Column(Integer)
    gender = Column(String(20))

class UserOnboarding(Base):
    __tablename__ = "useronboarding"
    onboarding_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("userprofile.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    height = Column(String(50))
    weight = Column(String(50))
    activity_level = Column(String(50))
    food_preference = Column(String(100))
    allergies = Column(String(255))
    medical_conditions = Column(String(255))
    goals = Column(String(255))
    household_size = Column(String(50))
    shopping_frequency = Column(String(50))
    city = Column(String(100))

# ---------- Food / Nutrition tables (match existing PostgreSQL schema) ----------

class FoodItem(Base):
    __tablename__ = "fooditem"
    food_id = Column(Integer, primary_key=True, index=True)
    canonical_name = Column(String(255), nullable=False)
    display_name = Column(String(255))
    category = Column(String(100))
    subcategory = Column(String(100))
    brand = Column(String(100))
    barcode = Column(String(50))
    serving_size = Column(Numeric(10, 2))
    serving_unit = Column(String(20))
    fdc_id = Column(BigInteger)

    # Relationships
    nutrition = relationship("Nutrition", back_populates="food_item", uselist=False)
    health_indicators = relationship("HealthIndicators", back_populates="food_item", uselist=False)

class Nutrition(Base):
    __tablename__ = "nutrition"
    nutrition_id = Column(Integer, primary_key=True, index=True)
    food_id = Column(Integer, ForeignKey("fooditem.food_id"), nullable=False)
    calories_kcal = Column(Numeric(10, 2))
    protein_g = Column(Numeric(10, 2))
    carbohydrates_g = Column(Numeric(10, 2))
    fat_g = Column(Numeric(10, 2))
    fiber_g = Column(Numeric(10, 2))
    sugar_g = Column(Numeric(10, 2))
    sodium_mg = Column(Numeric(10, 2))
    calcium_mg = Column(Numeric(10, 2))
    iron_mg = Column(Numeric(10, 2))
    potassium_mg = Column(Numeric(10, 2))
    vitamin_c_mg = Column(Numeric(10, 2))
    vitamin_a_ug = Column(Numeric(10, 2))

    food_item = relationship("FoodItem", back_populates="nutrition")

class HealthIndicators(Base):
    __tablename__ = "healthindicators"
    health_id = Column(Integer, primary_key=True, index=True)
    food_id = Column(Integer, ForeignKey("fooditem.food_id"), nullable=False)
    processed_level = Column(String(6))
    is_processed = Column(Boolean)
    high_protein = Column(Boolean)
    high_fiber = Column(Boolean)
    high_sugar = Column(Boolean)
    high_fat = Column(Boolean)
    high_sodium = Column(Boolean)
    vegetarian = Column(Boolean)
    vegan = Column(Boolean)
    gluten_free = Column(Boolean)
    allergen = Column(String(100))
    health_score = Column(Integer)

    food_item = relationship("FoodItem", back_populates="health_indicators")

class AlternativeRecommendation(Base):
    __tablename__ = "alternativerecommendation"
    recommendation_id = Column(Integer, primary_key=True, index=True)
    food_id = Column(Integer, ForeignKey("fooditem.food_id"), nullable=False)
    alternative_food_id = Column(Integer, ForeignKey("fooditem.food_id"), nullable=False)
    recommendation_type = Column(String(13))
    recommendation_reason = Column(Text)

class Receipt(Base):
    __tablename__ = "receipt"
    receipt_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("userprofile.user_id", ondelete="CASCADE"), nullable=False)
    merchant_name = Column(String(255))
    date = Column(String(50))
    total_amount = Column(Float)
    
class ReceiptItem(Base):
    __tablename__ = "receiptitem"
    item_id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipt.receipt_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255))
    matched_food_id = Column(Integer, ForeignKey("fooditem.food_id"), nullable=True)
    quantity = Column(String(50))
    rate = Column(String(50))
    price = Column(String(50))

# Legacy Product model (kept for SQLite backwards compatibility)
class Product(Base):
    __tablename__ = "product"
    product_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, unique=True)
    category = Column(String(100))
    health_score = Column(Integer)
    nutritional_info = Column(String(255))
    calories = Column(Integer)

class RawReceipt(Base):
    __tablename__ = "rawreceipts"
    raw_id = Column(Integer, primary_key=True, index=True)
    ocr_payload = Column(Text)

class AnalysisResult(Base):
    __tablename__ = "analysisresults"
    analysis_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    receipt_id = Column(Integer, nullable=True)
    trend_data = Column(Text)
    price_deviations = Column(Text)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
