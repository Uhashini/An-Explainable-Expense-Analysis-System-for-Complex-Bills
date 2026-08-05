CREATE TYPE processed_level_enum AS ENUM ('LOW','MEDIUM','HIGH','ULTRA');
CREATE TYPE recommendation_type_enum AS ENUM
('HEALTHIER','CHEAPER','LOWER_CALORIE','OTHER');

CREATE TABLE UserProfile (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    age INT CHECK (age>=0),
    gender VARCHAR(20)
);

CREATE TABLE UserBudget (
    budget_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES UserProfile(user_id) ON DELETE CASCADE,
    weekly_budget DECIMAL(12,2),
    monthly_budget DECIMAL(12,2)
);

CREATE TABLE RawReceipts (
    raw_receipt_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES UserProfile(user_id) ON DELETE CASCADE,
    image_path VARCHAR(255),
    ocr_text TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Receipts (
    receipt_id SERIAL PRIMARY KEY,
    raw_receipt_id INT UNIQUE REFERENCES RawReceipts(raw_receipt_id) ON DELETE CASCADE,
    merchant_name VARCHAR(255),
    purchase_date DATE,
    total_amount DECIMAL(12,2)
);

CREATE TABLE FoodItem (
    food_id SERIAL PRIMARY KEY,
    canonical_name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    barcode VARCHAR(50),
    serving_size DECIMAL(10,2),
    serving_unit VARCHAR(20)
);

CREATE TABLE Nutrition (
    nutrition_id SERIAL PRIMARY KEY,
    food_id INT UNIQUE NOT NULL REFERENCES FoodItem(food_id) ON DELETE CASCADE,
    calories_kcal DECIMAL(10,2),
    protein_g DECIMAL(10,2),
    carbohydrates_g DECIMAL(10,2),
    fat_g DECIMAL(10,2),
    fiber_g DECIMAL(10,2),
    sugar_g DECIMAL(10,2),
    sodium_mg DECIMAL(10,2),
    calcium_mg DECIMAL(10,2),
    iron_mg DECIMAL(10,2),
    potassium_mg DECIMAL(10,2),
    vitamin_c_mg DECIMAL(10,2),
    vitamin_a_ug DECIMAL(10,2)
);

CREATE TABLE HealthIndicators (
    health_id SERIAL PRIMARY KEY,
    food_id INT UNIQUE NOT NULL REFERENCES FoodItem(food_id) ON DELETE CASCADE,
    processed_level processed_level_enum,
    is_processed BOOLEAN,
    high_protein BOOLEAN,
    high_fiber BOOLEAN,
    high_sugar BOOLEAN,
    high_fat BOOLEAN,
    high_sodium BOOLEAN,
    vegetarian BOOLEAN,
    vegan BOOLEAN,
    gluten_free BOOLEAN,
    allergen VARCHAR(100),
    health_score INT CHECK (health_score BETWEEN 0 AND 100)
);

CREATE TABLE AlternativeRecommendation (
    recommendation_id SERIAL PRIMARY KEY,
    food_id INT NOT NULL REFERENCES FoodItem(food_id) ON DELETE CASCADE,
    alternative_food_id INT REFERENCES FoodItem(food_id) ON DELETE SET NULL,
    recommendation_type recommendation_type_enum,
    recommendation_reason TEXT
);

CREATE TABLE ReceiptItems (
    item_id SERIAL PRIMARY KEY,
    receipt_id INT NOT NULL REFERENCES Receipts(receipt_id) ON DELETE CASCADE,
    food_id INT REFERENCES FoodItem(food_id) ON DELETE SET NULL,
    ocr_item_name VARCHAR(255),
    quantity DECIMAL(10,2),
    unit_price DECIMAL(12,2),
    total_price DECIMAL(12,2)
);

CREATE TABLE ReceiptFeatures (
    feature_id SERIAL PRIMARY KEY,
    receipt_id INT UNIQUE NOT NULL REFERENCES Receipts(receipt_id) ON DELETE CASCADE,
    category_spending JSON,
    healthy_food_ratio DECIMAL(5,2),
    processed_food_ratio DECIMAL(5,2),
    total_calories INT
);

CREATE TABLE AnalysisResults (
    analysis_id SERIAL PRIMARY KEY,
    receipt_id INT UNIQUE NOT NULL REFERENCES Receipts(receipt_id) ON DELETE CASCADE,
    spending_anomaly BOOLEAN,
    nutrition_score DECIMAL(5,2),
    budget_status VARCHAR(50),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_receiptitems_food ON ReceiptItems(food_id);
CREATE INDEX idx_receiptitems_receipt ON ReceiptItems(receipt_id);
CREATE INDEX idx_rawreceipts_user ON RawReceipts(user_id);
CREATE INDEX idx_receipts_date ON Receipts(purchase_date);