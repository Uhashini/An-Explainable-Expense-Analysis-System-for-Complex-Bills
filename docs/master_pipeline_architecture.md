# Master System Architecture: The Complete Pipeline (With Sub-Stages)

This document explains the entire Bill & Receipt Intelligence System from the moment the user takes a photo to the moment they receive their insights, broken down into absolute chronological stages and their technical sub-stages.

---

## Stage 1: Image Upload & Preprocessing
**What it does:** Cleans and flattens the uploaded photo of the receipt to make it perfectly readable for the AI.

### Sub-Stage 1.1: Image Ingestion & Source Classification
* **Input:** Raw user upload bytes (JPEG/PNG).
* **Output:** Decoded OpenCV image matrix (Color BGR as a NumPy `np.ndarray`).
* **Why:** The system loads the image bytes into a mathematical matrix so OpenCV can manipulate the pixels.
* **Tool Used:** FastAPI + OpenCV (`cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)`).

### Sub-Stage 1.2: Lighting Normalization (CLAHE)
* **Input:** Raw color image (`np.ndarray`).
* **Output:** Image with balanced lighting and sharp contrast (`np.ndarray`).
* **Why:** Mobile photos often have shadows. OCR fails if the background is too dark or uneven.
* **Tool Used:** **OpenCV** (`cv2.cvtColor()` to convert to LAB space, `cv2.createCLAHE().apply()` to equalize the L-channel, then convert back to BGR).
* **Example:** A receipt under a harsh kitchen shadow becomes evenly bright.

### Sub-Stage 1.3: Geometric Perspective De-warping
* **Input:** Contrast-enhanced image (`np.ndarray`).
* **Output:** A perfectly flat, top-down rectangular image (`np.ndarray`).
* **Why:** Users take photos at angles (skewed). AI expects text to run horizontally.
* **Tool Used:** **OpenCV** (`cv2.Canny()` for edges, `cv2.findContours()` for the paper shape, `cv2.approxPolyDP()` to find the 4 corners, `cv2.getPerspectiveTransform()`, and `cv2.warpPerspective()`).
* **Example:** A trapezoid-shaped photo taken from an angle is mathematically stretched into a perfect flat rectangle.

### Sub-Stage 1.4: Unsharp Masking (Sharpening)
* **Input:** Flattened image (`np.ndarray`).
* **Output:** A crisper image with enhanced text boundaries (`np.ndarray`).
* **Why:** Preserves thin, faded thermal digits (like '4' and '0') from blurring out before OCR extraction.
* **Tool Used:** **OpenCV** (`cv2.GaussianBlur()` followed by `cv2.addWeighted()` for subtraction).

---

## Stage 2: Optical Character Recognition (OCR)
**What it does:** Reads the text from the flattened image and finds exactly where it is located on the paper.

### Sub-Stage 2.1: Text Box Detection
* **Input:** Flattened image.
* **Output:** Polygon boundaries (boxes) around text areas.
* **Why:** Before reading letters, the AI must find the clusters of ink.
* **Tool Used:** **PaddleOCR DB-Net** (Called via `PaddleOCR.ocr(image_path, cls=True)`).

### Sub-Stage 2.2: Text Recognition
* **Input:** Cropped images of the detected text boxes.
* **Output:** Raw text strings (e.g., "MILK", "2.99").
* **Why:** To convert the ink pixels into digital characters.
* **Tool Used:** **PaddleOCR CRNN-CTC** (Handled automatically within the same `ocr()` method call).
* **Example:** The model looks inside the box at pixels (100, 450) and types out "TOTAL".

---

## Stage 3: Coordinate Normalization & Cleaning
**What it does:** Fixes typical OCR glitches and standardizes the spatial coordinates.

### Sub-Stage 3.1: Token Separation (Optical Recovery)
* **Input:** Raw OCR text strings.
* **Output:** Cleaned, separated strings.
* **Why:** Supermarket thermal printers often squish words together, confusing downstream AI.
* **Tool Used:** Custom Python Logic (`TokenCleaner.split_and_clean_tokens(words, boxes)`).
* **Example:** The system sees "APPLEJUICE", and splits it into "APPLE" and "JUICE".

### Sub-Stage 3.2: Coordinate Scaling
* **Input:** Original pixel bounding boxes (e.g., based on a 4K camera).
* **Output:** Normalized coordinates on a universal 0–1000 scale.
* **Why:** The semantic AI model needs to understand layout regardless of whether the user uploaded a 1080p or 4K photo.
* **Tool Used:** Python Math (`clip(1000 * pixel_coord / image_dimension)`).

---

## Stage 4: Semantic Entity Extraction
**What it does:** Understands what each extracted word actually *means* (Is it a price? An item? A date?).

### Sub-Stage 4.1: Multimodal Embedding & Token Classification
* **Input:** Cleaned words, their 0-1000 coordinates, and image patches.
* **Output:** Words labeled with semantic categories (e.g., `menu.nm`, `menu.price`).
* **Why:** To structure the random text into a logical tabular receipt format.
* **Tool Used:** **LayoutLMv3** (`LayoutLMService.predict_entities(image, words, boxes)`).

### Sub-Stage 4.2: Y-Axis Clustering
* **Input:** Labeled entities.
* **Output:** Entities grouped into horizontal rows representing line items.
* **Why:** AI evaluates items left-to-right, but columns on grocery receipts can be misaligned.
* **Tool Used:** Custom Y-Axis Spatial Clustering (`LayoutLMService.parse_receipt_entities()`).
* **Example:** The model correctly aligns "Milk" as an Item Name and "2.99" as a Price into a single row object.

---

## Stage 5: Receipt Reconstruction & User Validation
**What it does:** Rebuilds the receipt digitally and lets the user correct any AI mistakes.

### Sub-Stage 5.1: Digital Table Rendering
* **Input:** AI-labeled text rows.
* **Output:** A digital receipt UI displayed on the user's screen.
* **Why:** To show the user what the AI extracted.
* **Tool Used:** React Native Frontend mapping data from `OCRService.extract_structured_data()`.

### Sub-Stage 5.2: User Edit Validation
* **Input:** User corrections on the UI.
* **Output:** 100% accurate, user-verified JSON receipt payload.
* **Why:** AI is never perfect. Letting the user edit the receipt guarantees perfect data before we run sensitive financial or health calculations.
* **Example:** The AI read "Nilk". The user taps it, types "Milk", and hits save.

---

## Stage 6: Food Item Database Matching
**What it does:** Links the raw receipt text to official nutritional data in the database.

### Sub-Stage 6.1: Syntactic Fuzzy Matching
* **Input:** User-validated item names (e.g., "Bannana").
* **Output:** A matched `food_id` or a failure trigger.
* **Why:** To catch typos, pluralization, or minor OCR glitches quickly.
* **Tool Used:** **RapidFuzz** (`rapidfuzz.process.extractOne(query, database_list, scorer=rapidfuzz.fuzz.ratio)`).

### Sub-Stage 6.2: Semantic Neural Matching
* **Input:** Item names that failed the fuzzy match (e.g., "Ground Beef").
* **Output:** A matched `food_id` based on meaning.
* **Why:** To match items that are spelled completely differently but mean the same thing.
* **Tool Used:** **SentenceTransformers** (`model.encode()` followed by `util.cos_sim(ocr_embedding, db_embeddings)`).
* **Example:** "Ground Beef" correctly matches to "Minced Meat" in the database.

---

## Stage 7: Behavioral Baseline Calculation
**What it does:** Updates the user's historical "normal" behavior based on this new receipt.

### Sub-Stage 7.1: Historical Fetch
* **Input:** User ID.
* **Output:** Chronological list of past receipt totals.
* **Why:** Baselines require past context.

### Sub-Stage 7.2: EWMA Baseline Update
* **Input:** Current receipt totals + Historical baseline.
* **Output:** A newly updated rolling average (baseline).
* **Why:** To detect anomalies (like overspending), we must first dynamically calculate what "normal" looks like today.
* **Tool Used:** **Pandas** (`pandas.DataFrame.ewm(alpha=0.3).mean()`).
* **Example:** The user usually spends $50. Today they spent $100. EWMA smoothly adjusts their new baseline up to $65.

---

## Stage 8: Multi-Mode Analytics Engine
**What it does:** Analyzes the receipt data simultaneously across Save Money, Eat Healthy, and Gain Muscle modes.

### Sub-Stage 8.1: Deterministic Math Calculations
* **Input:** Linked receipt items, Nutritional Data.
* **Output:** Basic metric arrays (e.g., Total Protein = 185g, Vitamin Coverage = 75%).
* **Why:** To calculate the foundational data required for the dashboards.
* **Tool Used:** Standard Python dictionaries and summation loops.

### Sub-Stage 8.2: Anomaly Detection (Machine Learning)
* **Input:** Processed metrics + EWMA Baselines.
* **Output:** Triggered anomaly flags (e.g., "True/False: Did they overspend?").
* **Why:** To proactively alert the user when their behavior deviates from their norm.
* **Tool Used:** 
  - **Isolation Forest:** `sklearn.ensemble.IsolationForest(contamination=0.1).fit_predict()`.
  - **Change Point Detection:** `ruptures.Pelt().predict(time_series)`.

### Sub-Stage 8.3: Explaining the Anomaly (XAI)
* **Input:** The Isolation Forest anomaly trigger.
* **Output:** A mathematical breakdown of exactly which features caused the anomaly.
* **Why:** Telling a user "You are anomalous" is useless. They need to know *what* they bought that caused it.
* **Tool Used:** **SHAP** (`shap.TreeExplainer(model).shap_values(X)`).
* **Example:** SHAP determines that 90% of this week's $40 overspend was caused by buying name-brand frozen pizzas.

---

## Stage 9: Natural Language (LLM) Insight Generation
**What it does:** Translates the raw analytical numbers, Isolation Forest flags, and SHAP scores into friendly advice.

### Sub-Stage 9.1: Prompt Construction
* **Input:** Raw JSON outputs from Stage 8.
* **Output:** A structured text prompt containing the user's data context.
* **Why:** An LLM needs structured context to avoid hallucinating facts.
* **Tool Used:** Python formatted strings (`f-strings` or Jinja2).

### Sub-Stage 9.2: LLM Inference & Delivery
* **Input:** The structured prompt.
* **Output:** Plain English insights and recommendations displayed on the user's dashboard.
* **Why:** Users understand stories and direct advice much better than raw data and percentages.
* **Tool Used:** **Free LLM Integrations**. Because the model only translates data and doesn't do math, small or free-tier models are perfect:
  - *Cloud Free Tier:* **Gemini 1.5 Flash API** (Generous free tier for students/developers) or **Groq API** (running Llama 3 for free at ultra-high speeds).
  - *Local/Offline:* **Ollama** running **Llama 3 (8B)** or **Phi-3** locally on the server (100% free and private).
* **Example:** *"You overspent by $40 this week. SHAP analysis shows this was heavily driven by frozen pizzas. Try swapping to fresh ingredients next time to save money and eat healthier!"*
