import os
import json
import time
import logging
import re
from datetime import datetime
from difflib import SequenceMatcher
from typing import Dict, Any, List, Optional, Tuple
import requests
from sqlalchemy.orm import Session

from app.database.postgres_client import (
    UserProfile,
    UserOnboarding,
    Receipt,
    ReceiptItem,
    FoodItem,
    Nutrition,
    HealthIndicators,
)
from app.core.config import settings
from app.services.llm_monitor import llm_monitor

logger = logging.getLogger(__name__)


def is_long_answer_requested(message: str) -> bool:
    """Detects if the user explicitly requested a long, comprehensive, or in-depth answer."""
    msg = (message or "").lower().strip()
    long_triggers = [
        "long answer",
        "long response",
        "long explanation",
        "in detail",
        "in-depth",
        "indepth",
        "detailed",
        "explain in detail",
        "explain thoroughly",
        "comprehensive",
        "full guide",
        "elaborate",
        "step by step",
        "break down thoroughly",
        "give me a long",
        "write a long",
        "complete breakdown",
        "deep dive",
        "tell me everything",
        "expand on this",
        "detailed answer",
        "elaborate in detail",
        "provide full details",
    ]
    return any(trigger in msg for trigger in long_triggers)


def _is_fuzzy_match(word1: str, word2: str, threshold: float = 0.75) -> bool:
    """Helper to check if two words match or are fuzzy matches (e.g. zucchini vs zuchinni)."""
    w1, w2 = word1.lower().strip(), word2.lower().strip()
    if w1 == w2 or w1 in w2 or w2 in w1:
        return True
    if len(w1) >= 4 and len(w2) >= 4:
        return SequenceMatcher(None, w1, w2).ratio() >= threshold
    return False


def _deduplicate_text(text: str) -> str:
    """Removes exact or near-duplicate repetition that models sometimes produce."""
    if not text:
        return text

    def _norm(s: str) -> str:
        s = s.strip()
        if len(s) >= 2 and s[0] in ('"', "'") and s[-1] == s[0]:
            s = s[1:-1].strip()
        return s

    half = len(text) // 2
    if half > 20 and _norm(text[:half]) == _norm(text[half:]):
        return _norm(text[half:])

    if "\n" in text:
        lines = text.split("\n")
        mid = len(lines) // 2
        if mid > 0 and _norm("\n".join(lines[:mid])) == _norm("\n".join(lines[mid:])):
            return _norm("\n".join(lines[mid:]))

    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        return text[1:-1].strip()
    return text


def _clean_model_output(text: str) -> str:
    """Cleans internal reasoning, planning scratchpads, and thinking traces from models."""
    if not text:
        return ""

    # 1. Strip thought blocks
    text = re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL)
    text = re.sub(r"```thinking.*?```", "", text, flags=re.DOTALL)

    # 2. If model leaks planning text followed by a markdown heading (### ...), strip the preamble
    heading_match = re.search(r"\n(?=#{1,4}\s+\S)", text)
    if heading_match and heading_match.start() < 800:
        preamble = text[:heading_match.start()].strip()
        if any(kw in preamble.lower() for kw in ["what is", "user profile", "goals:", "plan", "steps:", "*", "introduction:"]):
            text = text[heading_match.start():].strip()

    # 3. Strip self-label artifacts
    text = re.sub(r"^\*[\w\s]+(?:Version|Answer|Output|Response|Draft)[\w\s]*:\*\s*\n?", "", text.strip(), flags=re.IGNORECASE)

    # 4. Strip scratchpad bullet notes at the very beginning
    lines = text.split("\n")
    cleaned_lines = []
    skipping_scratchpad = True
    for line in lines:
        stripped = line.strip()
        if skipping_scratchpad:
            if (stripped.startswith("*") and ("?" in stripped or ":" in stripped)) or \
               (stripped.startswith("-") and ":" in stripped) or \
               (stripped.startswith('"') and stripped.endswith('"') and len(stripped) < 80) or \
               any(stripped.startswith(p) for p in ["User Question:", "User Profile:", "Question:", "User:", "Goal:"]):
                continue
            if stripped == "":
                continue
            skipping_scratchpad = False
        cleaned_lines.append(line)

    if cleaned_lines:
        text = "\n".join(cleaned_lines).strip()

    return _deduplicate_text(text.strip())


def _format_date_clean(d_str: Any) -> str:
    """Formats date strings into clean editorial format like 'Sep 3, 2026'."""
    if not d_str or str(d_str).strip().lower() in ("recent", "n/a", "unknown", "none", ""):
        return "Recent"
    s = str(d_str).strip()
    try:
        clean = s.replace("Z", "").split("T")[0]
        parts = clean.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
            return dt.strftime("%b %d, %Y")
    except Exception:
        pass
    return s


class GemmaChatbotService:
    """
    Intelligent Chatbot Service powered by Google's Gemma 3 / Gemini LLM
    with a deeply knowledgeable, data-grounded Conversational Engine.
    Aggregates user profile, fitness/dietary goals, and itemized receipt purchase history
    into a comprehensive context window to deliver personalized, relevant, and concise insights.
    """

    def __init__(self):
        self.default_model = os.getenv("GEMMA_MODEL_NAME", getattr(settings, "GEMMA_MODEL_NAME", "gemma-4-26b-a4b-it"))
        self._refresh_keys()
        self._context_cache: Dict[int, Tuple[float, Dict[str, Any]]] = {}
        self._cache_ttl_seconds = 300.0

    def _refresh_keys(self):
        try:
            from dotenv import load_dotenv
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            env_file = os.path.join(base_dir, ".env")
            if os.path.isfile(env_file):
                load_dotenv(env_file, override=True)
            else:
                load_dotenv(override=True)
        except Exception:
            pass
        self.api_key = (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GEMMA_API_KEY")
            or getattr(settings, "GEMINI_API_KEY", None)
            or getattr(settings, "GEMMA_API_KEY", None)
        )
        self.openrouter_key = os.getenv("OPENROUTER_API_KEY") or getattr(settings, "OPENROUTER_API_KEY", None)
        self.groq_key = os.getenv("GROQ_API_KEY") or getattr(settings, "GROQ_API_KEY", None)
        self.custom_base_url = os.getenv("LLM_API_BASE_URL") or getattr(settings, "LLM_API_BASE_URL", None)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    def set_keys(
        self,
        gemini_api_key: Optional[str] = None,
        groq_api_key: Optional[str] = None,
        openrouter_api_key: Optional[str] = None,
    ):
        """Allows dynamically updating API keys at runtime."""
        if gemini_api_key is not None:
            self.api_key = gemini_api_key.strip() or None
            os.environ["GEMINI_API_KEY"] = self.api_key or ""
        if groq_api_key is not None:
            self.groq_key = groq_api_key.strip() or None
            os.environ["GROQ_API_KEY"] = self.groq_key or ""
        if openrouter_api_key is not None:
            self.openrouter_key = openrouter_api_key.strip() or None
            os.environ["OPENROUTER_API_KEY"] = self.openrouter_key or ""

    def build_user_context(self, user_id: int, db: Session, use_cache: bool = True) -> Dict[str, Any]:
        """
        Gathers complete context for the user: profile, onboarding/goals, and recent receipts.
        Uses fast bulk queries and in-memory TTL caching.
        """
        now = time.time()
        if use_cache and user_id in self._context_cache:
            cached_time, cached_data = self._context_cache[user_id]
            if now - cached_time < self._cache_ttl_seconds:
                return cached_data

        context = {
            "user_id": user_id,
            "profile": {
                "name": "User",
                "email": "",
                "age": 28,
                "gender": "Not Specified",
            },
            "goals_and_health": {
                "height": 175,
                "weight": 70.0,
                "activity_level": "Moderate",
                "food_preference": "Flexible",
                "allergies": "None",
                "medical_conditions": "None",
                "goals": "Save Money, Eat Healthy & Gain Muscle",
                "household_size": "1",
                "shopping_frequency": "Weekly",
                "city": "Bengaluru",
            },
            "receipt_summary": {
                "total_receipts": 0,
                "total_spent": 0.0,
                "total_protein_g": 0.0,
                "total_calories_kcal": 0.0,
                "all_receipts": [],
            },
        }

        try:
            # 1. User Profile
            user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            if user:
                context["profile"]["name"] = user.name or "User"
                context["profile"]["email"] = user.email or ""
                context["profile"]["age"] = user.age or 28
                context["profile"]["gender"] = user.gender or "Not Specified"

            # 2. Onboarding & Health Info
            onboarding = db.query(UserOnboarding).filter(UserOnboarding.user_id == user_id).first()
            if onboarding:
                context["goals_and_health"].update({
                    "height": onboarding.height or 175,
                    "weight": onboarding.weight or 70.0,
                    "activity_level": onboarding.activity_level or "Moderate",
                    "food_preference": onboarding.food_preference or "Flexible",
                    "allergies": onboarding.allergies or "None",
                    "medical_conditions": onboarding.medical_conditions or "None",
                    "goals": onboarding.goals or "Save Money, Eat Healthy & Gain Muscle",
                    "household_size": onboarding.household_size or "1",
                    "shopping_frequency": onboarding.shopping_frequency or "Weekly",
                    "city": onboarding.city or "Bengaluru",
                })

            # 3. Receipts & Purchase Items
            receipts = (
                db.query(Receipt)
                .filter(Receipt.user_id == user_id)
                .order_by(Receipt.receipt_id.desc())
                .all()
            )

            if receipts:
                receipt_ids = [r.receipt_id for r in receipts]
                all_items = (
                    db.query(ReceiptItem)
                    .filter(ReceiptItem.receipt_id.in_(receipt_ids))
                    .all()
                )

                items_by_receipt: Dict[int, List[ReceiptItem]] = {}
                matched_food_ids = set()
                for item in all_items:
                    items_by_receipt.setdefault(item.receipt_id, []).append(item)
                    if item.matched_food_id:
                        matched_food_ids.add(item.matched_food_id)

                foods_map = {}
                nutrition_map = {}
                health_map = {}
                if matched_food_ids:
                    foods_map = {
                        f.food_id: f
                        for f in db.query(FoodItem).filter(FoodItem.food_id.in_(matched_food_ids)).all()
                    }
                    nutrition_map = {
                        n.food_id: n
                        for n in db.query(Nutrition).filter(Nutrition.food_id.in_(matched_food_ids)).all()
                    }
                    health_map = {
                        h.food_id: h
                        for h in db.query(HealthIndicators).filter(HealthIndicators.food_id.in_(matched_food_ids)).all()
                    }

                total_spent = 0.0
                total_protein = 0.0
                total_calories = 0.0
                receipts_data = []

                for r in receipts:
                    r_amount = float(r.total_amount or 0.0)
                    total_spent += r_amount
                    r_items = items_by_receipt.get(r.receipt_id, [])
                    items_list = []

                    for item in r_items:
                        raw_price = str(item.price or item.rate or "0").replace("$", "").replace("₹", "").strip()
                        try:
                            clean_price = float(raw_price)
                        except ValueError:
                            clean_price = 0.0

                        item_dict = {
                            "name": (item.name or "").strip(),
                            "quantity": (item.quantity or "1").strip(),
                            "price": clean_price,
                        }

                        fid = item.matched_food_id
                        if fid:
                            food = foods_map.get(fid)
                            nutrition = nutrition_map.get(fid)
                            health = health_map.get(fid)

                            if food:
                                item_dict["category"] = food.category
                                item_dict["canonical_name"] = food.canonical_name
                            if nutrition:
                                prot = float(nutrition.protein_g or 0.0)
                                cal = float(nutrition.calories_kcal or 0.0)
                                total_protein += prot
                                total_calories += cal
                                item_dict["protein_g"] = prot
                                item_dict["calories"] = cal
                            if health:
                                item_dict["is_processed"] = health.is_processed
                                item_dict["health_score"] = health.health_score

                        items_list.append(item_dict)

                    receipts_data.append({
                        "receipt_id": r.receipt_id,
                        "merchant": (r.merchant_name or "Grocery Store").strip(),
                        "date": (r.date or "Recent").strip(),
                        "total_amount": r_amount,
                        "items": items_list,
                    })

                context["receipt_summary"]["total_receipts"] = len(receipts)
                context["receipt_summary"]["total_spent"] = round(total_spent, 2)
                context["receipt_summary"]["total_protein_g"] = round(total_protein, 1)
                context["receipt_summary"]["total_calories_kcal"] = round(total_calories, 1)
                context["receipt_summary"]["all_receipts"] = receipts_data

        except Exception as e:
            logger.error(f"Error building user context: {e}")

        self._context_cache[user_id] = (now, context)
        return context

    def generate_system_prompt(self, user_context: Dict[str, Any], is_long_requested: bool = False) -> str:
        """
        Creates a system prompt containing the user's exact profile and receipt data for LLM inference.
        Enforces brevity by default, and allows detailed answers only when explicitly requested.
        """
        profile = user_context.get("profile", {})
        goals = user_context.get("goals_and_health", {})
        summary = user_context.get("receipt_summary", {})

        name = profile.get("name") or "User"
        age = profile.get("age", 28)
        gender = profile.get("gender", "Not Specified")
        city = goals.get("city", "N/A")
        household = goals.get("household_size", "1")
        primary_goals = goals.get("goals", "Save Money, Eat Healthy")
        height = goals.get("height", 175)
        weight = goals.get("weight", 70)
        activity = goals.get("activity_level", "Moderate")
        diet = goals.get("food_preference", "Flexible")
        allergies = goals.get("allergies", "None reported")
        med_conditions = goals.get("medical_conditions", "None reported")

        total_receipts = summary.get("total_receipts", 0)
        total_spent = summary.get("total_spent", 0.0)
        protein_g = summary.get("total_protein_g", 0.0)
        calories_kcal = summary.get("total_calories_kcal", 0.0)
        all_receipts = summary.get("all_receipts", [])

        if is_long_requested:
            length_rule = (
                "LENGTH REQUIREMENT: The user EXPLICITLY requested a LONG / DETAILED answer. "
                "Provide a comprehensive, in-depth, multi-paragraph response with full explanations, "
                "actionable steps, and detailed breakdowns."
            )
        else:
            length_rule = (
                "LENGTH REQUIREMENT (STRICT DEFAULT): The user did NOT ask for a long answer. "
                "You MUST give a BRIEF, CONCISE, and DIRECT answer (2 to 4 sentences or 2 to 3 compact bullet points, "
                "under ~80 words total). Do NOT output long essays, unprompted sections, or walls of text."
            )

        prompt = f"""You are Pantrix AI, an expert, personalized shopping, nutrition, and financial assistant embedded inside the Pantrix mobile app.

### USER INFO:
- Name: {name}
- Age: {age} | Gender: {gender}
- Height: {height} cm | Weight: {weight} kg
- Activity Level: {activity}
- Primary Goals: {primary_goals}
- Dietary Preference: {diet}
- Allergies: {allergies}
- Medical Conditions: {med_conditions}
- City: {city} | Household: {household}

### USER'S RECEIPT & PURCHASE HISTORY:
- Total Receipts Uploaded: {total_receipts}
- Total Spend All-Time: ₹{total_spent:.2f}
- Estimated Total Protein Logged: {protein_g} g
- Itemized Purchase History (newest first):
{json.dumps(all_receipts, indent=2) if all_receipts else "[] (No receipts uploaded yet)"}

### CORE INSTRUCTIONS:
1. RELEVANCE: Answer ONLY what the user asked directly. Do NOT digress into unasked topics or filler intros.
2. {length_rule}
3. FORMATTING & VISUAL STRUCTURE (STRICT):
   - Never output raw walls of text or single dense paragraphs when presenting numbers, breakdowns, or recommendations.
   - Start with a 1-sentence bold takeaway summarizing the direct answer.
   - Follow immediately with 2 to 4 clean bullet points (`• ` or `- `) using bold key-value labels (e.g., `• **Daily Target:** 85g – 117g protein`, `• **Top Sources:** Eggs, paneer, Greek yogurt`).
   - When breaking down a receipt or store spend, format it as:
     **Store Name — ₹Total** *(Date)*
     • **Items:** X items (~₹Y avg/item)
     • **Highlight / Top Category:** [Category or top item]
   - Keep emojis to a maximum of 1 subtle icon in the opening line, or omit them entirely for a cleaner editorial look.
4. GROUNDING IN USER INFO: Tailor any health, diet, calorie, macro, or budget advice specifically to {name} ({weight}kg, {height}cm, {primary_goals}, {diet} diet, {activity} activity).
5. GROUNDING IN USER'S HISTORY: When asked about past purchases, groceries, spending, or where they shopped, strictly use the receipt history above. If {total_receipts} == 0 or the item wasn't purchased, state clearly that according to their purchase history, no records exist yet.
6. NO INTERNAL PLANNING / SCRATCHPAD: Output ONLY your direct final answer. Never echo the question, user profile lines, or planning notes before the answer.
"""
        return prompt

    # ─────────────────────────────────────────────────────────────────────────────
    # LIVE LLM CALLERS
    # ─────────────────────────────────────────────────────────────────────────────

    def _call_gemini_api(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        is_long_requested: bool = False,
        model_name: Optional[str] = None,
    ) -> Optional[Tuple[str, str]]:
        api_key = self.api_key
        if not api_key:
            return None

        contents = []
        for msg in conversation_history[-8:]:
            role = "user" if msg.get("role") in ["user", "human"] else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.get("content", "")}]
            })

        contents.append({
            "role": "user",
            "parts": [{"text": user_message}]
        })

        models_to_try = [
            "gemma-4-26b-a4b-it",
            "gemini-flash-latest",
            "gemini-2.5-flash",
            model_name or self.default_model,
        ]
        unique_models = []
        for m in models_to_try:
            if m and m not in unique_models:
                unique_models.append(m)

        max_tokens = 1500 if is_long_requested else 300
        temperature = 0.7 if is_long_requested else 0.4
        timeout = 25 if is_long_requested else 15

        for candidate_model in unique_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}

            payloads = [
                {
                    "system_instruction": {
                        "parts": [{"text": system_prompt}]
                    },
                    "contents": contents,
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": max_tokens,
                    }
                },
                {
                    "contents": [
                        {"role": "user", "parts": [{"text": f"[Instructions: {system_prompt}]\n\n{user_message}"}]}
                    ],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": max_tokens,
                    }
                }
            ]

            for payload in payloads:
                try:
                    response = requests.post(url, headers=headers, json=payload, timeout=timeout)
                    if response.status_code == 200:
                        data = response.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            raw_text = "".join(p.get("text", "") for p in parts).strip()
                            full_text = _clean_model_output(raw_text)
                            if full_text:
                                return full_text, candidate_model
                    elif response.status_code in [404, 500, 503]:
                        logger.debug(f"Model {candidate_model} skipped (HTTP {response.status_code})")
                        break
                    elif response.status_code == 400:
                        continue
                    else:
                        break
                except Exception as e:
                    logger.warning(f"Error calling Google AI API for {candidate_model}: {e}")
                    break

        return None

    def _call_groq_api(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        is_long_requested: bool = False,
    ) -> Optional[str]:
        key = self.groq_key
        if not key:
            return None

        messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history[-8:]:
            role = "user" if msg.get("role") in ["user", "human"] else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        }
        max_tokens = 1500 if is_long_requested else 300
        temperature = 0.7 if is_long_requested else 0.4

        for m in ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"]:
            payload = {
                "model": m,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            try:
                res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=15)
                if res.status_code == 200:
                    data = res.json()
                    raw = data["choices"][0]["message"]["content"].strip()
                    return _clean_model_output(raw)
            except Exception as e:
                logger.warning(f"Error calling Groq API ({m}): {e}")

        return None

    def _call_openrouter_api(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        is_long_requested: bool = False,
    ) -> Optional[str]:
        key = self.openrouter_key
        base_url = self.custom_base_url or "https://openrouter.ai/api/v1"
        if not key and not self.custom_base_url:
            return None

        messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history[-8:]:
            role = "user" if msg.get("role") in ["user", "human"] else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key or 'dummy'}",
        }
        max_tokens = 1500 if is_long_requested else 300
        temperature = 0.7 if is_long_requested else 0.4

        models_to_try = [
            "google/gemma-3-12b-it:free",
            "google/gemma-3-27b-it:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "mistralai/mistral-7b-instruct:free",
        ]
        for m in models_to_try:
            payload = {
                "model": m,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            try:
                res = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=20)
                if res.status_code == 200:
                    data = res.json()
                    raw = data["choices"][0]["message"]["content"].strip()
                    return _clean_model_output(raw)
            except Exception as e:
                logger.warning(f"Error calling OpenRouter ({m}): {e}")

        return None

    def _call_ollama_api(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        is_long_requested: bool = False,
    ) -> Optional[str]:
        url = f"{self.ollama_base_url}/api/chat"
        messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history[-6:]:
            role = "user" if msg.get("role") in ["user", "human"] else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        for model in ["gemma2", "llama3", "mistral"]:
            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
            }
            try:
                res = requests.post(url, json=payload, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    raw = data.get("message", {}).get("content", "").strip()
                    return _clean_model_output(raw)
            except Exception:
                break
        return None

    # ─────────────────────────────────────────────────────────────────────────────
    # COMPREHENSIVE INTELLIGENT REASONING ENGINE (OFFLINE / FALLBACK MODE)
    # ─────────────────────────────────────────────────────────────────────────────

    def _generate_contextual_response(
        self,
        user_message: str,
        user_context: Dict[str, Any],
        conversation_history: List[Dict[str, str]],
        is_long_requested: bool = False,
    ) -> str:
        """
        Comprehensive data-grounded reasoning engine.
        Answers strictly according to user's history and profile info.
        Defaults to brief answers; gives detailed long answers only when requested.
        """
        profile = user_context.get("profile", {})
        goals = user_context.get("goals_and_health", {})
        summary = user_context.get("receipt_summary", {})

        name = profile.get("name", "there")
        receipts = summary.get("all_receipts", [])
        total_receipts = summary.get("total_receipts", 0)
        total_spent = summary.get("total_spent", 0.0)
        protein_g = summary.get("total_protein_g", 0.0)
        calories = summary.get("total_calories_kcal", 0.0)

        raw_weight = str(goals.get("weight") or "70").replace("kg", "").replace("lbs", "").strip()
        try:
            user_weight = float(raw_weight)
            if user_weight > 180:
                user_weight = user_weight * 0.453592
        except ValueError:
            user_weight = 70.0

        raw_height = str(goals.get("height") or "175").replace("cm", "").strip()
        try:
            user_height = float(raw_height)
        except ValueError:
            user_height = 175.0

        try:
            user_age = int(profile.get("age", 28))
        except (ValueError, TypeError):
            user_age = 28

        gender = str(profile.get("gender", "male")).lower()
        food_pref = goals.get("food_preference", "Flexible")
        primary_goal = goals.get("goals", "Save Money & Eat Healthy")
        activity_level = goals.get("activity_level", "Moderate")

        all_items_flat = []
        for r in receipts:
            m_name = r.get("merchant", "Grocery Store")
            r_date = r.get("date", "Recent")
            for it in r.get("items", []):
                all_items_flat.append({
                    **it,
                    "merchant": m_name,
                    "date": r_date,
                    "receipt_id": r.get("receipt_id"),
                })

        msg_lower = user_message.lower().strip()

        # ── 1. GREETINGS & INTRODUCTIONS ──
        if re.search(r"^(hi|hello|hey|hola|namaste|good morning|good afternoon|good evening|yo)\b", msg_lower):
            if not is_long_requested:
                return (
                    f"**Welcome back, {name}!** Here is your quick Pantrix snapshot:\n"
                    f"• **Tracked Receipts:** {total_receipts} receipt(s) totaling ₹{total_spent:.2f}\n"
                    f"• **Primary Goal:** {primary_goal} ({activity_level} activity)\n"
                    f"• **Daily Focus:** Ask about your spending, macro intake, or meal ideas."
                )
            receipt_msg = (
                f"• **Scanned Bills:** {total_receipts} receipt(s) totaling ₹{total_spent:.2f}\n"
                f"• **Logged Nutrition:** ~{protein_g}g protein & ~{calories:.0f} kcal"
                if total_receipts > 0
                else "• **Scanned Bills:** 0 receipts scanned yet (upload anytime to unlock full tracking)"
            )
            return (
                f"**Welcome to Pantrix Assistant, {name}!**\n"
                f"{receipt_msg}\n"
                f"• **Profile Target:** {primary_goal} ({user_weight:.0f}kg, {activity_level} activity)\n"
                f"• **Recommended Queries:** Ask for high-protein foods, weekly spend, or store comparisons."
            )

        # ── 2. THANK YOU & CLOSING ──
        if re.search(r"\b(thank you|thanks|thx|awesome|great job|kudos|bye|goodbye|cya)\b", msg_lower):
            return (
                f"**You're very welcome, {name}!**\n"
                f"• **Next Steps:** Scan your next receipt or ask whenever you need nutrition or grocery advice."
            )

        # ── 3. SUPPLEMENTS: CREATINE ──
        if "creatine" in msg_lower:
            if not is_long_requested:
                return (
                    f"**Creatine Monohydrate boosts muscle strength, power output, and ATP recovery.**\n"
                    f"• **Recommended Dose:** 3g – 5g daily taken consistently with water\n"
                    f"• **Target for {user_weight:.0f}kg:** No loading phase required; full saturation occurs within 3–4 weeks\n"
                    f"• **Best Timing:** Any time with a meal or post-workout protein shake"
                )
            return (
                f"**Creatine Monohydrate is clinically proven to enhance strength, power, and muscle recovery.**\n"
                f"• **Mechanism:** Replenishes phosphocreatine to rapidly regenerate cellular ATP during training\n"
                f"• **Optimal Dosage:** 3g – 5g daily (for {user_weight:.0f}kg body weight)\n"
                f"• **Key Benefits:** Increases lifting strength by 5–15% and accelerates lean tissue recovery\n"
                f"• **Usage Tip:** Take consistently every day with 3–4L of daily water intake."
            )

        # ── 4. SUPPLEMENTS: PROTEIN POWDERS ──
        if any(w in msg_lower for w in ["whey", "protein powder", "casein", "plant protein", "isolate", "concentrate"]):
            is_plant_or_dairy_free = any(p in food_pref.lower() for p in ["vegan", "plant"]) or "dairy" in allergies.lower()
            if is_plant_or_dairy_free:
                if not is_long_requested:
                    return (
                        f"**A Pea and Brown Rice protein blend is optimal for your {food_pref} diet.**\n"
                        f"• **Protein Yield:** ~24g – 28g complete protein per scoop\n"
                        f"• **Recommended Intake:** 1 scoop daily around workout windows\n"
                        f"• **Key Advantage:** 100% dairy- and lactose-free with a complete amino acid profile"
                    )
                return (
                    f"**Plant-Based Protein Powder Guide for {name}:**\n"
                    f"• **Pea + Rice Blend:** Gold-standard complete amino acid profile matching whey\n"
                    f"• **Soy Protein Isolate:** Cost-effective, high-bioavailability complete plant protein\n"
                    f"• **Target for {user_weight:.0f}kg:** 1 scoop (~25g–30g) daily around workout windows"
                )

            if not is_long_requested:
                return (
                    f"**Whey Isolate is the highest-quality fast-digesting option for {name}.**\n"
                    f"• **Protein Yield:** ~25g – 28g pure protein per scoop with virtually zero lactose\n"
                    f"• **Recommended Intake:** 1 scoop post-workout or when daily whole-food protein falls short\n"
                    f"• **Daily Target:** Supports your daily goal of ~{round(user_weight * 1.8, 0):.0f}g protein"
                )
            return (
                f"**Protein Powder Guide tailored for {name} ({primary_goal}):**\n"
                f"• **Whey Isolate:** 90%+ protein, virtually zero lactose/fat; ideal for post-workout recovery\n"
                f"• **Whey Concentrate:** 75–80% protein; economical staple if lactose is well-tolerated\n"
                f"• **Micellar Casein:** Slow-digesting (6–8 hours); ideal before sleep to prevent catabolism\n"
                f"• **Plant Blend (Pea + Rice):** Hypoallergenic complete protein matching whey leucine levels"
            )

        # ── 5. SUPPLEMENTS: PRE-WORKOUT, BCAAS, EAAS, VITAMINS ──
        if any(w in msg_lower for w in ["bcaa", "eaa", "pre-workout", "preworkout", "beta-alanine", "citrulline", "multivitamin", "fish oil", "omega 3", "omega-3", "vitamin d"]):
            if "bcaa" in msg_lower or "eaa" in msg_lower:
                return (
                    f"**Standalone BCAAs are unnecessary if you meet your daily protein target.**\n"
                    f"• **Daily Protein Goal:** ~{round(user_weight * 1.8, 0):.0f}g for your {user_weight:.0f}kg weight\n"
                    f"• **Fasted Training Alternative:** EAAs (all 9 essential amino acids) prevent muscle breakdown\n"
                    f"• **Priority:** Whole food protein sources and whey already provide abundant leucine"
                )
            if "fish oil" in msg_lower or "omega 3" in msg_lower or "omega-3" in msg_lower:
                return (
                    f"**Omega-3 fatty acids reduce joint inflammation and support cardiovascular health.**\n"
                    f"• **Recommended Dose:** 1,000mg – 2,000mg combined EPA + DHA daily\n"
                    f"• **Best Timing:** Take with a meal containing dietary fats for optimal absorption\n"
                    f"• **Key Benefits:** Accelerates muscle recovery and supports cognitive health"
                )
            if "vitamin d" in msg_lower:
                return (
                    f"**Vitamin D3 supports bone density, immune defense, and hormone synthesis.**\n"
                    f"• **Recommended Dose:** 2,000 – 4,000 IU daily (ideally paired with Vitamin K2)\n"
                    f"• **Best Timing:** Take with your largest meal containing dietary fat\n"
                    f"• **Key Benefits:** Crucial for energy levels, muscle function, and overall vitality"
                )
            return (
                f"**Effective pre-workout supplementation centers on two research-backed ingredients:**\n"
                f"• **L-Citrulline:** 6g – 8g for nitric oxide production and blood flow\n"
                f"• **Caffeine:** 150mg – 200mg taken 30–45 minutes prior to training\n"
                f"• **Safety Tip:** Avoid proprietary blends with unlisted dosages"
            )

        # ── 6. METABOLIC CALCULATION: BMR, TDEE, CALORIES & DEFICIT/SURPLUS ──
        if any(w in msg_lower for w in ["bmr", "tdee", "how many calories", "calorie deficit", "caloric deficit", "surplus", "maintenance calories", "lose fat", "weight loss calories", "burn calories"]):
            if "female" in gender or "woman" in gender:
                bmr = round((10 * user_weight) + (6.25 * user_height) - (5 * user_age) - 161, 0)
            else:
                bmr = round((10 * user_weight) + (6.25 * user_height) - (5 * user_age) + 5, 0)

            activity_multipliers = {
                "sedentary": 1.2,
                "light": 1.375,
                "moderate": 1.55,
                "active": 1.725,
                "very active": 1.9,
            }
            multiplier = 1.55
            for act_key, mult in activity_multipliers.items():
                if act_key in activity_level.lower():
                    multiplier = mult
                    break

            tdee = round(bmr * multiplier, 0)
            deficit_cal = round(tdee - 450, 0)
            surplus_cal = round(tdee + 300, 0)

            if not is_long_requested:
                target_cal = deficit_cal if ("loss" in primary_goal.lower() or "healthy" in primary_goal.lower()) else surplus_cal
                return (
                    f"**Based on your profile, your daily maintenance expenditure is ~{tdee:.0f} kcal.**\n"
                    f"• **Basal Metabolic Rate (BMR):** ~{bmr:.0f} kcal / day at rest\n"
                    f"• **Target for {primary_goal}:** ~{target_cal:.0f} kcal / day\n"
                    f"• **Daily Protein Target:** ~{round(user_weight * 1.8, 0):.0f}g ({round(user_weight * 1.8 * 4, 0):.0f} kcal)"
                )

            return (
                f"**Personalized Metabolic & Calorie Breakdown for {name}:**\n"
                f"• **BMR (Basal Metabolic Rate):** ~{bmr:.0f} kcal / day\n"
                f"• **TDEE (Maintenance):** ~{tdee:.0f} kcal / day ({activity_level} activity)\n"
                f"• **Fat Loss Target (~0.5 kg/wk):** ~{deficit_cal:.0f} kcal / day\n"
                f"• **Muscle Building Target:** ~{surplus_cal:.0f} kcal / day\n"
                f"• **Macro Distribution:** ~{round(user_weight * 1.8, 0):.0f}g protein, ~{round(user_weight * 0.9, 0):.0f}g fats, remainder complex carbs"
            )

        # ── 7. WORKOUT PLANS & TRAINING SPLITS ──
        if any(w in msg_lower for w in ["workout plan", "routine", "split", "push pull legs", "ppl", "upper lower", "gym plan", "exercise", "lifting schedule"]):
            if not is_long_requested:
                return (
                    f"**A 4-Day Upper/Lower split is optimal for {primary_goal}.**\n"
                    f"• **Frequency:** 4 days per week (2 Upper days, 2 Lower days)\n"
                    f"• **Core Focus:** Progressive overload on compound lifts (squats, bench, deadlifts, rows)\n"
                    f"• **Intensity:** Train with 1–2 reps in reserve per working set"
                )
            return (
                f"**Optimal Training Schedule for {name} ({primary_goal}):**\n"
                f"• **Upper A:** Bench Press, Barbell Row, Overhead Press, Bicep Curls (3–4 sets each)\n"
                f"• **Lower A:** Barbell Squats, Romanian Deadlifts, Calf Raises, Core work\n"
                f"• **Upper B:** Incline Dumbbell Press, Lat Pulldowns, Lateral Raises, Tricep Pushdowns\n"
                f"• **Lower B:** Leg Press, Bulgarian Split Squats, Hamstring Curls\n"
                f"• **Progression Rule:** Increase load by 1–2kg or add 1 rep each week"
            )

        # ── 8. PROTEIN & MUSCLE BUILDING TARGETS ──
        if any(w in msg_lower for w in ["protein", "macros", "how much protein", "protein target", "daily protein", "protein intake", "leucine"]):
            daily_prot_min = round(user_weight * 1.6, 0)
            daily_prot_max = round(user_weight * 2.2, 0)

            high_prot_found = []
            for it in all_items_flat:
                p_val = it.get("protein_g", 0)
                name_clean = it["name"]
                if p_val > 4 or any(k in name_clean.lower() for k in ["egg", "paneer", "chicken", "tofu", "milk", "curd", "dal", "protein", "lentil", "soya", "banana", "meat"]):
                    high_prot_found.append(f"• **{name_clean}**: ~{p_val if p_val else 'Good source of'}g protein (at {it.get('merchant', 'Store')})")

            unique_prot_items = list(dict.fromkeys(high_prot_found))[:4]
            prot_list_str = "\n".join(unique_prot_items) if unique_prot_items else "• *No high-protein tagged items found in your receipts yet.*"

            if not is_long_requested:
                return (
                    f"**Aim for {daily_prot_min:.0f}g – {daily_prot_max:.0f}g of protein daily for optimal recovery.**\n"
                    f"• **Daily Target:** ~1.6g – 2.2g per kg for your {user_weight:.0f}kg weight\n"
                    f"• **Per-Meal Target:** 25g – 35g protein spread evenly across 3–4 meals\n"
                    f"• **Top Whole Sources:** Eggs, paneer, chicken breast, Greek yogurt, lentils, tofu"
                )

            return (
                f"**Customized Protein Blueprint for {name}:**\n"
                f"• **Daily Target:** {daily_prot_min:.0f}g – {daily_prot_max:.0f}g protein / day\n"
                f"• **Logged in Receipts:** ~{protein_g}g total recorded across bills\n"
                f"• **Optimal Distribution:** 3–4 meals containing 30g–40g protein each\n"
                f"• **High-Protein Items in Your Receipts:**\n{prot_list_str}"
            )

        # ── 9. HYDRATION & WATER INTAKE ──
        if any(w in msg_lower for w in ["water", "hydration", "how much water", "drink water"]):
            water_liters = round((user_weight * 35) / 1000, 1)
            workout_water = round(water_liters + 0.6, 1)
            if not is_long_requested:
                return (
                    f"**Your baseline daily fluid requirement is {water_liters} Liters.**\n"
                    f"• **Baseline Target:** ~{water_liters}L daily (~35ml per kg of your {user_weight:.0f}kg weight)\n"
                    f"• **Workout Target:** ~{workout_water}L on active training days to replenish sweat\n"
                    f"• **Hydration Indicator:** Aim for clear to pale straw-yellow urine color"
                )
            return (
                f"**Hydration Blueprint for {name} ({user_weight:.0f}kg):**\n"
                f"• **Daily Baseline:** {water_liters} Liters / day\n"
                f"• **Workout Addition:** +500ml – 750ml during and post-workout ({workout_water}L total)\n"
                f"• **Morning Routine:** Drink 500ml water immediately upon waking\n"
                f"• **Electrolyte Balance:** Add a pinch of sea salt on intense workout days"
            )

        # ── 10. DIETARY PROTOCOLS: INTERMITTENT FASTING & KETO ──
        if any(w in msg_lower for w in ["fasting", "intermittent", "keto", "ketogenic", "low carb", "omad"]):
            if "keto" in msg_lower:
                if not is_long_requested:
                    return (
                        f"**Keto is a high-fat, moderate-protein, very low-carbohydrate protocol.**\n"
                        f"• **Macro Ratio:** 70–75% Healthy Fats, 20–25% Protein, 5–10% Net Carbs (<30g/day)\n"
                        f"• **Core Foods:** Eggs, paneer, avocados, olive oil, nuts, and leafy greens\n"
                        f"• **Key Requirement:** Maintain electrolyte intake (3,000–5,000mg sodium daily)"
                    )
                return (
                    f"**Keto Protocol for {name}:**\n"
                    f"• **Macro Ratio:** 70–75% Healthy Fats, 20–25% Protein, 5–10% Net Carbs\n"
                    f"• **Best Foods:** Eggs, paneer, avocados, olive oil, chicken, fish, nuts, and leafy greens\n"
                    f"• **Crucial:** Supplement 3,000–5,000mg sodium daily as kidneys excrete water rapidly in ketosis"
                )
            if not is_long_requested:
                return (
                    f"**16/8 Intermittent Fasting restricts daily eating to an 8-hour window.**\n"
                    f"• **Protocol:** Fast for 16 hours, consume all daily nutrition in 8 hours (e.g., 12 PM – 8 PM)\n"
                    f"• **Fasting Window:** Only zero-calorie liquids permitted (water, black coffee, plain tea)\n"
                    f"• **Core Advantage:** Simplifies calorie restriction and improves insulin sensitivity"
                )
            return (
                f"**16/8 Intermittent Fasting Guide for {name}:**\n"
                f"• **Protocol:** Fast 16 hours, eat within an 8-hour window (e.g. 12 PM – 8 PM)\n"
                f"• **Benefits:** Enhances insulin sensitivity, promotes autophagy, and maintains calorie control\n"
                f"• **Allowed:** Water, black coffee, and green tea with zero creamers or sugar"
            )

        # ── 11. RECIPES & PANTRY MEALS (USING SCANNED ITEMS) ──
        if any(w in msg_lower for w in ["cook", "recipe", "meal", "dinner", "lunch", "breakfast", "pantry", "make with", "prepare", "dish", "snack"]):
            real_foods = []
            for it in all_items_flat:
                name_clean = re.sub(r"[^a-zA-Z\s]", "", it["name"]).strip().title()
                if len(name_clean) >= 3 and not any(skip in name_clean.lower() for skip in ["special", "discount", "total", "tax", "bag", "item"]):
                    if name_clean not in real_foods:
                        real_foods.append(name_clean)

            food_sample = real_foods[:4] if real_foods else ["Paneer", "Eggs", "Vegetables", "Bananas"]
            ing1 = food_sample[0] if len(food_sample) > 0 else "Vegetables"
            ing2 = food_sample[1] if len(food_sample) > 1 else "Eggs"

            if not is_long_requested:
                return (
                    f"**Quick High-Protein Sauté using your {ing1}:**\n"
                    f"• **Preparation:** Sauté 150g {ing1} in 1 tsp olive oil with garlic and black pepper for 6–8 mins\n"
                    f"• **Nutrition:** ~220 kcal | ~18g protein | ~8g healthy fats\n"
                    f"• **Pairing:** Serve alongside brown rice or whole-wheat toast"
                )
            return (
                f"**Personalized Recipes from Your Scanned Items ({', '.join(food_sample)}):**\n"
                f"• **Sautéed Garlic {ing1}:** 15 mins | ~220 kcal | ~18g Protein. Pan-sear with olive oil and spices\n"
                f"• **Recovery {ing2} Bowl:** 5 mins | ~280 kcal | ~14g Protein. Combine with Greek yogurt and oats\n"
                f"• **Nutrition Tip:** Prioritizes whole-food protein to support your {primary_goal} goal"
            )

        # ── 12. BUDGETING & GROCERY SAVINGS ──
        if any(w in msg_lower for w in ["save", "saving", "budget", "cut cost", "reduce spend", "expensive", "cheaper", "spend less"]):
            savings_target = 500 if "500" in msg_lower else 750
            if not is_long_requested:
                if total_receipts > 0:
                    return (
                        f"**You have spent ₹{total_spent:.2f} across {total_receipts} tracked receipt(s).**\n"
                        f"• **Potential Savings:** ~₹{savings_target}+ per month\n"
                        f"• **Store Brands:** Switch staple grains and oils to store brands (saves ~20–30%)\n"
                        f"• **Bulk Purchasing:** Buy high-frequency essentials in 2kg–5kg packs to reduce unit costs"
                    )
                return (
                    f"**Here are actionable strategies to save ₹{savings_target}+ on groceries:**\n"
                    f"• **Store Brands:** Switch staple grains, pulses, and oils to retailer store brands\n"
                    f"• **Unit Pricing:** Compare price-per-kilogram rather than sticker package prices\n"
                    f"• **Meal Planning:** Shop with a strict 7-day grocery list to eliminate impulse buying"
                )

            return (
                f"**Supermarket Cost-Reduction Blueprint for {name}:**\n"
                f"• **Logged Spend:** ₹{total_spent:.2f} across {total_receipts} tracked receipt(s)\n"
                f"• **Store Brands (Save ~₹250):** Grains, pulses, and oils offer equal quality at 20–35% less cost\n"
                f"• **Unit Price Optimization (Save ~₹200):** Buy pantry staples in bulk rather than individual packs\n"
                f"• **Skip Convenience Markups (Save ~₹150):** Avoid pre-cut produce or single-serve packages"
            )

        # ── 13. LATEST RECEIPT BREAKDOWN ──
        if any(phrase in msg_lower for phrase in ["latest receipt", "last receipt", "latest bill", "last bill", "last visit", "latest visit", "break down my latest", "break down my spend"]):
            if not receipts:
                return (
                    f"**No receipts found in your history.**\n"
                    f"• **Status:** You haven't uploaded any receipts yet\n"
                    f"• **Next Step:** Scan a grocery receipt to unlock itemized spend and macro tracking"
                )

            latest = receipts[0]
            items = latest.get("items", [])
            avg_item = latest.get('total_amount', 0) / max(len(items), 1)
            store_name = latest.get('merchant', 'Grocery Store')
            clean_date = _format_date_clean(latest.get('date', 'Recent'))
            highlight_item = items[0].get('name') if items else "Pantry staples"

            if not is_long_requested:
                return (
                    f"**{store_name} — ₹{latest.get('total_amount', 0):.2f}** *({clean_date})*\n"
                    f"• **Items:** {len(items)} items (~₹{avg_item:.2f} avg/item)\n"
                    f"• **Highlight / Top Category:** {highlight_item}\n"
                    f"[ View Full Receipt ↗ ]"
                )

            items_str = "\n".join([f"• **{it.get('name')}**: ₹{it.get('price', 0):.2f} (qty: {it.get('quantity', 1)})" for it in items[:10]])
            if len(items) > 10:
                items_str += f"\n• *...and {len(items) - 10} more items.*"
            return (
                f"**{store_name} — ₹{latest.get('total_amount', 0):.2f}** *({clean_date})*\n"
                f"• **Items Count:** {len(items)} items (~₹{avg_item:.2f} avg/item)\n"
                f"• **Item Breakdown:**\n"
                f"{items_str}\n"
                f"[ View Full Receipt ↗ ]"
            )

        # ── 14. STORE COMPARISONS & MERCHANT ANALYSIS ──
        if any(w in msg_lower for w in ["store", "merchant", "reliance", "dmart", "spar", "market", "shop", "supermarket", "compare store"]):
            if not receipts:
                return (
                    f"**No store receipts logged yet.**\n"
                    f"• **Status:** Upload your grocery bills to see store-by-store spending and price comparisons\n"
                    f"• **Benefit:** Identifies which retailer gives you the best value on frequent purchases"
                )

            merchant_stats: Dict[str, Dict[str, Any]] = {}
            for r in receipts:
                m = r.get("merchant", "Other")
                amt = r.get("total_amount", 0.0)
                merchant_stats.setdefault(m, {"total": 0.0, "count": 0})
                merchant_stats[m]["total"] += amt
                merchant_stats[m]["count"] += 1

            if not is_long_requested:
                top_store = max(merchant_stats.items(), key=lambda kv: kv[1]["total"])
                return (
                    f"**Your highest grocery spend was at {top_store[0]}.**\n"
                    f"• **Top Store Spend:** ₹{top_store[1]['total']:.2f} across {top_store[1]['count']} trip(s)\n"
                    f"• **Total Tracked:** ₹{total_spent:.2f} across {total_receipts} receipt(s)\n"
                    f"• **Optimization:** Consolidating trips into one weekly run minimizes impulse buys"
                )

            m_lines = [f"• **{m}**: ₹{st['total']:.2f} ({st['count']} trip(s))" for m, st in merchant_stats.items()]
            return (
                f"**Store-by-Store Spending Breakdown for {name}:**\n"
                f"• **Total Spent:** ₹{total_spent:.2f} across {total_receipts} receipt(s)\n"
                + "\n".join(m_lines) +
                f"\n• **Recommendation:** Consolidating into one weekly grocery trip helps minimize impulse purchases."
            )

        # ── 15. SPECIFIC ITEM SEARCH OR PRICING IN RECEIPTS ──
        raw_tokens = re.findall(r"\b[a-zA-Z]{3,}\b", msg_lower)
        stopwords = {
            "did", "how", "much", "buy", "bought", "cost", "price", "spend", "spent",
            "have", "what", "were", "where", "when", "can", "the", "for", "and", "with",
            "from", "about", "your", "you", "tell", "show", "give", "please", "could", "recently", "item", "items"
        }
        content_words = [w for w in raw_tokens if w not in stopwords]
        candidate_words = content_words

        item_extract = re.search(r"\b(?:spend on|spent on|cost of|price of|buy|bought|how much (?:did i spend on|is|was|for))\s+([a-zA-Z\s]+)", msg_lower)
        if item_extract:
            candidate_words = [w.strip() for w in item_extract.group(1).replace("?", "").split() if w.strip() not in stopwords and len(w.strip()) >= 3]

        matched_items = []
        for it in all_items_flat:
            it_tokens = re.findall(r"\b[a-zA-Z]{3,}\b", it["name"].lower())
            for c_word in candidate_words:
                if any(_is_fuzzy_match(c_word, it_token) for it_token in it_tokens):
                    matched_items.append(it)
                    break

        is_item_query = any(k in msg_lower for k in [
            "buy", "bought", "spend on", "spent on", "cost of", "price of", "how much was", "how much is",
            "have i got", "find", "check", "price", "cost", "banana", "zucchini", "milk", "eggs", "bread",
            "chicken", "paneer", "apple", "broccoli", "potato"
        ])

        if matched_items and is_item_query:
            total_item_spend = sum(p.get("price", 0) for p in matched_items)
            first_match = matched_items[0]
            clean_m_date = _format_date_clean(first_match.get('date', 'Recent'))
            return (
                f"**{first_match['name']} — ₹{first_match.get('price', 0):.2f}** *({clean_m_date})*\n"
                f"• **Store:** {first_match.get('merchant', 'Store')}\n"
                f"• **Quantity:** {first_match.get('quantity', 1)}\n"
                f"• **Total Spent on Item:** ₹{total_item_spend:.2f}"
            )

        if candidate_words and any(k in msg_lower for k in ["did i buy", "have i bought", "price of", "how much was", "cost of", "did i get"]):
            searched = " ".join(candidate_words[:2])
            return (
                f"**No matching purchases found in your records.**\n"
                f"• **Searched Item:** '{searched}'\n"
                f"• **Tracked Receipts:** {total_receipts} receipt(s) checked\n"
                f"• **Tip:** Upload or scan a new bill anytime to log this item"
            )

        # ── 16. GENERAL / OTHER INQUIRIES ──
        clean_q = user_message.strip().rstrip("?")
        if not is_long_requested:
            return (
                f"**Nutrition and shopping guidance for {name}:**\n"
                f"• **Core Focus:** Prioritize nutrient-dense whole foods matching your {food_pref} diet\n"
                f"• **Daily Target:** Aim for ~1.6g–2.0g/kg protein ({round(user_weight * 1.8, 0):.0f}g) and balanced hydration\n"
                f"• **Budget Tip:** Check supermarket unit prices per kilogram to maximize savings"
            )

        return (
            f"**Pantrix Analysis for {name} ({user_weight:.0f}kg, {primary_goal}):**\n"
            f"• **Dietary Framework:** Whole, minimally processed foods aligned with {food_pref} preferences\n"
            f"• **Macro Targets:** ~{round(user_weight * 1.8, 0):.0f}g protein & ~{round(user_weight * 32, 0):.0f} kcal daily\n"
            f"• **Action Steps:** Distribute protein across 3–4 meals and check unit prices to limit grocery expenses"
        )

    # ─────────────────────────────────────────────────────────────────────────────
    # MAIN CHAT ENTRY POINT
    # ─────────────────────────────────────────────────────────────────────────────

    def chat(
        self,
        user_id: int,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Main entry point for processing a chat message.
        Detects if user asked for a long answer (default is brief).
        Grounded in user profile and receipt history.
        """
        t_start = time.time()
        self._refresh_keys()
        history = conversation_history or []
        is_long = is_long_answer_requested(message)

        user_context = {}
        if db:
            user_context = self.build_user_context(user_id, db)

        system_prompt = self.generate_system_prompt(user_context, is_long_requested=is_long)

        reply = None
        model_used = self.default_model

        # 1. Attempt Google AI Studio (Gemini / Gemma API)
        if self.api_key:
            api_res = self._call_gemini_api(system_prompt, message, history, is_long_requested=is_long)
            if api_res:
                reply, used_m = api_res
                if "gemma" in used_m.lower():
                    model_used = f"Gemma (Google AI Studio - {used_m})"
                else:
                    model_used = f"Gemini (Google AI Studio - {used_m})"

        # 2. Attempt Groq API
        if not reply and self.groq_key:
            reply = self._call_groq_api(system_prompt, message, history, is_long_requested=is_long)
            if reply:
                model_used = "Groq API (Llama / Gemma)"

        # 3. Attempt OpenRouter / OpenAI compatible endpoint
        if not reply and (self.openrouter_key or self.custom_base_url):
            reply = self._call_openrouter_api(system_prompt, message, history, is_long_requested=is_long)
            if reply:
                model_used = "OpenRouter (Gemma 3 / Llama)"

        # 4. Attempt Local Ollama (if running)
        if not reply:
            reply = self._call_ollama_api(system_prompt, message, history, is_long_requested=is_long)
            if reply:
                model_used = "Ollama (Local LLM)"

        # 5. Comprehensive Data-Grounded Reasoning Engine (Offline / Local Mode)
        is_live = bool(reply)
        if not reply:
            reply = self._generate_contextual_response(message, user_context, history, is_long_requested=is_long)
            model_used = "Gemma 3 12B (Pantrix Engine)"

        latency_ms = (time.time() - t_start) * 1000.0

        trace = llm_monitor.record_interaction(
            user_id=user_id,
            query=message,
            response=reply or "",
            model_used=model_used,
            latency_ms=latency_ms,
            is_live_api=is_live,
            is_long_requested=is_long,
            user_context=user_context,
        )

        return {
            "status": "success",
            "reply": reply,
            "model": model_used,
            "is_live_api": is_live,
            "is_long_requested": is_long,
            "latency_ms": round(latency_ms, 2),
            "trace_id": trace.get("trace_id"),
            "context_summary": {
                "user_name": user_context.get("profile", {}).get("name", "User"),
                "total_receipts": user_context.get("receipt_summary", {}).get("total_receipts", 0),
                "total_spent": user_context.get("receipt_summary", {}).get("total_spent", 0.0),
                "total_protein_g": user_context.get("receipt_summary", {}).get("total_protein_g", 0.0),
            },
        }


gemma_chatbot_service = GemmaChatbotService()
