# Pipeline Integration: Database Matching & Baseline Modeling

After the frontend reconstructs the digital receipt using the layout parsed by LayoutLMv3, the raw text must be mapped to the standardized `FoodDatabase`, and historical baselines must be established before executing the analytical modes (Save Money, Eat Healthy, Gain Muscle). 

This document outlines the final two architectural bridges that conclude the pipeline.

---

## 1. Food Item Resolution Engine (NLP Mapping)
**Purpose:** Raw OCR text (e.g., `"ZUCHINNI GREEN"`, `"ORGNC APPL"`, `"CHK BRST"`) cannot be directly analyzed for nutrition. This engine maps the messy, abbreviated receipt strings to canonical database entities (e.g., `Zucchini`, `Apple`, `Chicken Breast`).

### How It Works (Two-Stage Pipeline)
When the user clicks "Save" on the reconstructed receipt, the backend processes each item name (`menu.nm`) through a two-stage NLP pipeline:

#### Stage 1: Syntactic Matching (RapidFuzz)
- **Algorithm:** RapidFuzz utilizes Levenshtein distance (fuzzy string matching) to calculate how many character edits are needed to transform the OCR string into a database item.
- **Use Case:** Perfect for catching OCR glitches, spelling mistakes, or pluralization (e.g., matching `"BANNANA"` to `"Banana"`).
- **Logic:** If the RapidFuzz similarity score exceeds a strict threshold (e.g., `> 85%`), the match is accepted immediately. 

#### Stage 2: Semantic Matching (SentenceTransformers)
- **Algorithm:** If fuzzy matching fails (score `< 85%`), the system falls back to a Semantic Model (e.g., `all-MiniLM-L6-v2` via HuggingFace `SentenceTransformers`). 
- **Use Case:** Perfect for matching items that are spelled completely differently but mean the same thing (e.g., matching `"Ground Beef 80/20"` to `"Minced Meat"`, or `"Skim Liquid"` to `"Skim Milk"`).
- **Logic:** The model converts the OCR string into a dense vector embedding. It computes the **Cosine Similarity** against pre-calculated embeddings of all FoodDatabase items. The item with the highest cosine similarity is selected.

**Output:** Every item is now assigned a definitive `food_id`, unlocking access to Protein, Calories, Vitamins, and NOVA classifications required for the EH and GM analysis modes.

---

## 2. Behavioral Baseline Engine: EWMA
**Purpose:** Before the system can tell a user they are "overspending" (SM-06) or their dietary habits are "declining" (EH-09), it must know what is *normal* for that specific user. 

### What is EWMA?
**EWMA (Exponentially Weighted Moving Average)** is **NOT** a machine learning model. It is a deterministic statistical formula. Unlike a simple average (which treats a receipt from 2 years ago equally to a receipt from yesterday), EWMA gives exponentially more weight to recent behavior, allowing the baseline to adapt dynamically as the user's lifestyle changes.

### The Formula
$$ S_t = \alpha \cdot X_t + (1 - \alpha) \cdot S_{t-1} $$

- **$S_t$**: The new calculated baseline.
- **$X_t$**: The value of the current receipt (e.g., total spent, or total calories).
- **$S_{t-1}$**: The previous historical baseline.
- **$\alpha$ (Alpha)**: The smoothing factor (a constant between 0 and 1, usually set around `0.3`). A higher alpha reacts faster to recent changes; a lower alpha is smoother and more resistant to sudden spikes.

### Dependencies & Implementation
- **What it depends on:** EWMA strictly requires the user's chronologically sorted historical receipt data. It cannot be calculated on a user's very first receipt (which serves as the initial $S_0$).
- **Where it is written:** Because it is a mathematical formula, it does not require a heavy ML framework like PyTorch. It is implemented purely in code as a backend utility function (e.g., inside `backend/app/services/analysis/baseline_calculator.py`). It can be implemented using native Python math or efficiently via Pandas (`pandas.DataFrame.ewm`).

### Role in the Pipeline
Once the EWMA baseline is calculated for a user's spending or nutrition, that baseline is fed into the analytical modes (like the Isolation Forest in SM-06 or Change Point Detection in EH-09) to accurately determine if the current receipt represents a true anomaly or just a natural shift in their rolling average.

---
**Conclusion:** With the raw OCR mapped cleanly to the `FoodDatabase` via RapidFuzz/SentenceTransformers, and the user's historical baseline updated via the EWMA formula, the structured data is perfectly primed to be passed into the Save Money, Eat Healthy, and Gain Muscle analytical engines. This concludes the core pipeline architecture.
