# PANTRIX Complete API Documentation

**Base URL:** `http://localhost:8000/api/v1`  
**Interactive Swagger UI:** `http://localhost:8000/docs`  
**ReDoc Spec:** `http://localhost:8000/redoc`

---

## 📋 Endpoint Summary Table

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System health and version check |
| `GET` | `/` | Web UI root dashboard |
| **Receipts** | | |
| `POST` | `/api/v1/receipts/upload` | Upload receipt image, run PaddleOCR + LayoutLMv3, match items |
| `POST` | `/api/v1/receipts/match-products` | Bulk match receipt item strings with food DB |
| `POST` | `/api/v1/receipts/save` | Persist receipt & item breakdown to database |
| `GET` | `/api/v1/receipts/check-matches` | Check total count of unmatched items |
| `POST` | `/api/v1/receipts/run-rematch` | Execute background re-matching job for unmatched items |
| `GET` | `/api/v1/receipts/user/{user_id}` | Fetch all receipts for a given user |
| `GET` | `/api/v1/receipts/{receipt_id}` | Fetch receipt details, items, & 2D bounding boxes |
| `POST` | `/api/v1/receipts/analyze-save-money` | Run Save-Money cost optimization on a receipt |
| **Analytics** | | |
| `POST` | `/api/v1/analytics/calculate` | Calculate price deviations & spending trends |
| `GET` | `/api/v1/analytics/receipt/{receipt_id}` | Retrieve cached analytics result for a receipt |
| **Gain Muscle** | | |
| `GET` | `/api/v1/gain-muscle/{user_id}` | Compute protein availability, quality, cost efficiency, & trends |
| `GET` | `/api/v1/gain-muscle/{user_id}/recommendations` | Get dynamic high-protein recommendations |
| **Products** | | |
| `GET` | `/api/v1/products/{product_id}` | Get product details & nutrition info by ID |
| **Auth & Profile** | | |
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Authenticate user |
| `POST` | `/api/v1/auth/onboarding` | Save onboarding fitness goals & dietary preferences |
| `GET` | `/api/v1/auth/me/{user_id}` | Get user profile info |
| `PUT` | `/api/v1/auth/me/{user_id}` | Update user profile & goals |
| **Demo** | | |
| `POST` | `/api/v1/demo/process-receipt` | Process sample receipt for live web demo |

---

## 1. System & Web UI Routes

### `GET /health`
Returns backend service health status and version.

* **Response (200 OK):**
  ```json
  { "status": "healthy", "version": "0.1.0" }
  ```

### `GET /`
Serves the static web dashboard interface (`index.html`).

---

## 2. Receipt Extraction & Processing (`/receipts`)

### `POST /api/v1/receipts/upload`
Uploads a receipt image (JPEG, PNG, WEBP), performs PaddleOCR + LayoutLMv3 extraction, and auto-matches extracted item names against the food nutrition database.

* **Content-Type:** `multipart/form-data`
* **Form Field:** `file` (File binary)
* **Response (200 OK):**
  ```json
  {
    "status": "success",
    "filename": "receipt_01.jpg",
    "data": {
      "receipt_info": {
        "merchant_name": "SMART BAZAAR",
        "date": "2026-09-14",
        "total_amount": 45.50,
        "items": [
          {
            "name": "MILK 1L",
            "quantity": 2,
            "unit_price": 3.50,
            "total_price": 7.00,
            "food_id": "FOOD_102",
            "matched_name": "Whole Milk 1L",
            "category": "Dairy",
            "nutrition": { "calories": 149, "protein_g": 8.0, "carbs_g": 12.0, "fat_g": 8.0 }
          }
        ]
      },
      "words": ["SMART", "BAZAAR", "MILK", "7.00"],
      "boxes": [[10, 20, 100, 40], ...],
      "image_size": { "width": 800, "height": 1200 }
    }
  }
  ```

---

### `POST /api/v1/receipts/match-products`
Enhances a list of raw receipt items by matching them against the food database.

* **Request Body:**
  ```json
  {
    "items": [{ "name": "Oat Milk 1L", "quantity": 1, "total_price": 4.20 }]
  }
  ```
* **Response (200 OK):** Array of items enriched with `food_id`, `category`, `nutrition`, and `health` scores.

---

### `POST /api/v1/receipts/save`
Persists extracted receipt data and items into PostgreSQL.

* **Request Body:**
  ```json
  {
    "user_id": 1,
    "merchant_name": "Smart Bazaar",
    "total_amount": 45.50,
    "date": "2026-09-14",
    "items": [
      { "name": "MILK 1L", "quantity": 2, "price": 7.00, "food_id": "FOOD_102" }
    ]
  }
  ```
* **Response (200 OK):** `{ "status": "success", "receipt_id": 42 }`

---

### `GET /api/v1/receipts/check-matches`
Checks the number of items in the database missing product matches.

* **Response (200 OK):**
  ```json
  { "status": "success", "unmatched_count": 14 }
  ```

---

### `POST /api/v1/receipts/run-rematch`
Triggers a background job to re-match all unmatched items against updated database food rules.

* **Response (200 OK):**
  ```json
  { "status": "success", "rematched_items": 12 }
  ```

---

### `GET /api/v1/receipts/user/{user_id}`
Retrieves all receipts saved by a specific user.

* **Response (200 OK):** List of user receipts with line items.

---

### `GET /api/v1/receipts/{receipt_id}`
Retrieves complete receipt details, raw OCR bounding boxes, and item breakdown by ID.

---

### `POST /api/v1/receipts/analyze-save-money`
Runs the "Save Money" cost-optimization analysis engine on a specific receipt.

* **Request Body:** `{ "receipt_id": 42 }`
* **Response (200 OK):** Price deviation analysis, store price comparisons, and cheaper alternative recommendations.

---

## 3. Financial & Nutritional Analytics (`/analytics`)

### `POST /api/v1/analytics/calculate`
Calculates financial spend trends, price deviations, and nutritional statistics across receipt items in parallel.

* **Request Body:**
  ```json
  {
    "user_id": 1,
    "receipt_id": 42,
    "items": [
      { "name": "Chicken Breast", "quantity": 1, "price": 12.50, "category": "Poultry" }
    ]
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "trend": { "monthly_spend": 320.00, "top_category": "Poultry" },
      "price_deviations": [
        { "item": "Chicken Breast", "paid_price": 12.50, "avg_market_price": 10.00, "deviation_pct": 25.0 }
      ]
    }
  }
  ```

---

### `GET /api/v1/analytics/receipt/{receipt_id}`
Retrieves cached analysis results for a specific receipt ID.

---

## 4. Muscle Gain & High-Protein Mode (`/gain-muscle`)

### `GET /api/v1/gain-muscle/{user_id}`
Returns complete Gain Muscle metrics (**GM-01** Protein Availability, **GM-02** Protein Quality, **GM-03** Protein Cost Efficiency, and **GM-05** Protein Trend) for a user.

* **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "protein_availability": { "total_protein_g": 450.0, "daily_avg_g": 64.2 },
      "protein_quality": { "complete_protein_ratio": 0.85 },
      "protein_cost_efficiency": { "avg_cost_per_10g_protein": 0.42 },
      "protein_trend": { "weekly_change_pct": 12.5 }
    }
  }
  ```

---

### `GET /api/v1/gain-muscle/{user_id}/recommendations`
Generates high-protein product recommendations excluding foods already purchased by the user.

* **Query Parameters:** `top_n` (default: 6)
* **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": [
      { "food_id": "FOOD_301", "name": "Greek Yogurt 500g", "protein_per_dollar": "24.5g/$", "category": "Dairy" }
    ]
  }
  ```

---

## 5. Food Products (`/products`)

### `GET /api/v1/products/{product_id}`
Retrieves complete nutritional and category profile for a specific food item ID.

---

## 6. Auth & User Profile (`/auth`)

### `POST /api/v1/auth/register`
Registers a new user account.

* **Request Body:** `{ "email": "user@example.com", "password": "secretpassword", "name": "John Doe" }`

### `POST /api/v1/auth/login`
Authenticates user and returns access token.

* **Request Body:** `{ "email": "user@example.com", "password": "secretpassword" }`

### `POST /api/v1/auth/onboarding`
Saves user onboarding profile (dietary preferences, fitness goals, budget target).

### `GET /api/v1/auth/me/{user_id}`
Retrieves profile and fitness target settings for a user.

### `PUT /api/v1/auth/me/{user_id}`
Updates user profile settings and budget preferences.

---

## 7. Web Demo Playground (`/demo`)

### `POST /api/v1/demo/process-receipt`
Processes a sample receipt image for live web interface demonstrations.

---

## 8. HTTP Error Handling

| Code | Status | Meaning |
| :--- | :--- | :--- |
| **200** | OK | Request succeeded |
| **201** | Created | Resource (user / receipt) created successfully |
| **400** | Bad Request | Invalid payload format or non-image upload |
| **401** | Unauthorized | Invalid or missing authentication credentials |
| **404** | Not Found | Resource (user_id / receipt_id / product_id) not found |
| **500** | Internal Server Error | Deep learning inference or database execution error |
