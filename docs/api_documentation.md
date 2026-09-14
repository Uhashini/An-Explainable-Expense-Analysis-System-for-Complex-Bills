# PANTRIX API Documentation

**Base URL:** `http://localhost:8000/api/v1`  
**Interactive Swagger UI:** `http://localhost:8000/docs`  
**ReDoc Spec:** `http://localhost:8000/redoc`

---

## 1. Overview & Authentication

PANTRIX provides a RESTful FastAPI backend that converts receipt images into structured financial and nutritional analytics.

- **Request Format:** JSON (for data endpoints) or `multipart/form-data` (for image uploads).
- **Response Format:** Standard JSON.
- **Authentication:** Bearer JWT token in headers (for protected user endpoints):
  ```http
  Authorization: Bearer <your_jwt_token>
  ```

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
Manually triggers fuzzy matching of item names against the food database.

* **Request Body:**
  ```json
  {
    "items": [{ "name": "Oat Milk 1L", "quantity": 1, "total_price": 4.20 }]
  }
  ```
* **Response (200 OK):** Enriched array of items with matched nutrition metadata.

---

### `POST /api/v1/receipts/save`
Persists verified receipt data and item breakdown into PostgreSQL.

* **Request Body:** Standard receipt object (from `/upload` output).
* **Response (200 OK):**
  ```json
  { "status": "success", "receipt_id": 42, "message": "Receipt saved successfully" }
  ```

---

### `GET /api/v1/receipts/history`
Retrieves past uploaded receipts for the authenticated user.

* **Query Parameters:** `limit` (default: 20), `offset` (default: 0)
* **Response (200 OK):** List of saved receipt summaries.

---

### `GET /api/v1/receipts/{receipt_id}`
Retrieves complete receipt details, raw OCR bounding boxes, and item breakdown by ID.

---

## 3. Financial & Nutritional Analytics (`/analytics`)

### `GET /api/v1/analytics/dashboard`
Returns high-level summary KPIs (total spend, total calories, macro split).

* **Response (200 OK):**
  ```json
  {
    "total_spend": 342.50,
    "receipt_count": 12,
    "total_calories": 24500,
    "macronutrients": { "protein_g": 620, "carbs_g": 2100, "fat_g": 540 }
  }
  ```

---

### `GET /api/v1/analytics/spending-trends`
Categorizes spending over time (Monthly / Weekly).

* **Query Parameters:** `timeframe` (`weekly` | `monthly`), `category` (optional)
* **Response (200 OK):** Aggregated spend by category (e.g., Dairy, Produce, Snacks).

---

### `GET /api/v1/analytics/nutrition-breakdown`
Analyzes nutritional quality of grocery purchases.

* **Response (200 OK):** Food group distribution, processed food ratio, and macro density per dollar spent.

---

## 4. Special Modes: Gain Muscle (`/gain-muscle`)

### `GET /api/v1/gain-muscle/recommendations`
Provides high-protein budget efficiency recommendations based on past receipt data.

* **Response (200 OK):**
  ```json
  {
    "protein_per_dollar_rankings": [
      { "item_name": "Eggs 12-pack", "protein_per_dollar": "32.5g/$" },
      { "item_name": "Chicken Breast 1kg", "protein_per_dollar": "28.0g/$" }
    ],
    "suggestions": ["Replace sugar cereals with oats to increase protein density."]
  }
  ```

---

## 5. Food Product Search (`/products`)

### `GET /api/v1/products/search`
Searches the internal food database for nutrition profiles.

* **Query Parameters:** `q` (search term, e.g., `almond milk`)
* **Response (200 OK):** Array of matching food items.

---

## 6. Authentication (`/auth`)

| Endpoint | Method | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/signup` | `POST` | Register a new user | `{ "email", "password", "name" }` |
| `/api/v1/auth/login` | `POST` | Login user & get JWT | `{ "email", "password" }` |
| `/api/v1/auth/me` | `GET` | Get current user profile | Header: `Authorization: Bearer <token>` |

---

## 7. Demo & System Health (`/demo`, `/health`)

* `GET /health` — Health check endpoint (`{"status": "healthy"}`).
* `GET /api/v1/demo/sample-receipts` — List available sample test receipt images.
* `POST /api/v1/demo/process-sample` — Process a sample receipt without uploading a new file.

---

## 8. HTTP Error Codes

| Status Code | Meaning | Common Cause |
| :--- | :--- | :--- |
| **400 Bad Request** | Invalid Input | Uploaded file is not an image or missing required JSON fields. |
| **401 Unauthorized** | Authentication Failed | Missing or expired JWT token. |
| **404 Not Found** | Resource Missing | Invalid `receipt_id` or `food_id`. |
| **500 Internal Error** | Server Error | OCR or LayoutLMv3 inference error. |
