# Bill & Receipt Intelligence System: Project Proposal

## 1. Problem Statement
Imagine returning home from a weekend grocery run. You spent $120. You open your favorite budgeting app, type in the total amount, and categorize it as "Groceries." Later that evening, you open your fitness app and manually search for the protein content of the chicken and lentils you bought, logging them one by one. The next day, trying to eat healthier, you wonder if you've been buying too much processed food lately, but the only way to know is to dig through your pantry and read the labels.

This is the modern consumer's dilemma: we generate rich, item-level data every time we check out at the supermarket, but the moment that receipt is printed, the data dies. Current personal finance applications only care about the final transaction total, completely discarding the actual items purchased. To understand the "why" behind their spending, diet, and fitness, users are forced to perform exhausting manual data entry across multiple disconnected apps. 

There is currently no unified system capable of taking a single grocery bill, understanding exactly what was bought, and instantly translating those items into actionable financial, nutritional, and fitness insights.

## 2. Motivation (Why use our system?)
What exactly compels a user to adopt this system? **The elimination of manual data entry and fragmented app usage.** 

By simply uploading a single grocery bill, the user unlocks a 360-degree view of their lifestyle without manually typing out every item they bought. They don't just see a generic "You spent $100 at the supermarket." Instead, they see personalized, LLM-explained insights:
- **Save Money:** "You overspent by $15 this week because you bought name-brand items instead of store brands."
- **Eat Healthy:** "Your processed food ratio is 10% higher than last week due to the frozen pizzas."
- **Gain Muscle:** "This grocery run only covers 60% of your weekly protein target; consider adding eggs or lentils."

The system empowers users to make immediate, informed behavioral changes by acting as a financial advisor, nutritionist, and fitness planner all at once, driven by the receipt data they already have.

## 3. Target Users
The system targets mobile-first consumers who regularly purchase groceries and want to optimize their lifestyle without the cognitive load of manual tracking. Primary segments include:
- **Budget-Conscious Households:** Users trying to reduce grocery spend, track price fluctuations, and identify savings opportunities.
- **Health-Focused Individuals:** Users wanting to monitor their dietary balance, processed food intake, and nutritional diversity.
- **Fitness Enthusiasts:** Gym-goers and athletes who need to ensure they are buying enough protein and the right macronutrients to support their training.
- **Hostel/PG Residents:** Students or young professionals managing a strict, fixed monthly budget for food and supplies.

## 4. Project Objectives
1. **Intelligent Item-Level Extraction:** Develop a document intelligence pipeline utilizing OCR and LayoutLMv3 to accurately extract structured line-item data (merchant, item name, quantity, price) from uploaded grocery bills.
2. **Interactive Receipt Reconstruction:** Reconstruct the scanned receipt in a digital interface, allowing users to easily review and edit any misclassified or incorrectly extracted items before saving, ensuring 100% data fidelity.
3. **Multi-Dimensional Behavioral Analysis:** Construct user baselines to analyze the validated receipt data across three simultaneous modes: Financial (Save Money), Nutritional (Eat Healthy), and Fitness (Gain Muscle).
4. **LLM-Driven Explainability:** Integrate a Large Language Model (LLM) to generate clear, hallucination-controlled, natural language explanations and actionable recommendations for the insights derived in all three modes.
5. **Unified Dashboard Experience:** Deliver a seamless insights page where users can instantly view their financial, health, and fitness metrics derived from a single receipt upload.

## 5. Functional Requirements
- **Image Upload:** The system must allow users to upload images of grocery receipts (JPEG/PNG) via a mobile or web interface.
- **OCR & Semantic Extraction:** The system must utilize OCR and LayoutLMv3 to extract text and classify it into semantic receipt entities (store name, item name, prices, totals).
- **Editable Digital Receipt UI:** The system must render the extracted data into an editable tabular UI, allowing the user to seamlessly correct item names, prices, or quantities before final submission.
- **Tri-Mode Insight Generation:** Upon saving the receipt, the system must process the data and simultaneously generate analytical insights for three distinct modes: Save Money, Eat Healthy, and Gain Muscle.
- **LLM Explanation Engine:** The system must generate human-readable explanations and customized recommendations for each of the three modes using an LLM API.
- **Data Persistence:** The system must store the corrected receipt data and historical user baselines to track trends and improve future anomaly detection.

## 6. Non-Functional Requirements
- **Usability & Frictionless Editing:** The receipt editing interface must be highly intuitive, mobile-responsive, and require minimal clicks to correct an item, ensuring user retention despite initial OCR inaccuracies.
- **Performance & Latency:** The initial OCR extraction and digital reconstruction should complete within a few seconds (e.g., < 5s) to maintain user engagement. The subsequent LLM insight generation can load asynchronously on the insights page.
- **Accuracy:** The underlying extraction model (LayoutLMv3) must achieve a high baseline F1 score to minimize the amount of manual editing the user has to do.
- **Explainability & Trust:** AI-generated recommendations must be transparent, logically sound, and directly tied to the specific items present in the uploaded receipt to build user trust.
- **Scalability:** The backend architecture (FastAPI) must efficiently handle concurrent image processing and asynchronous LLM API requests.
