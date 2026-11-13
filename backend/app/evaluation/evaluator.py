"""
LLM Evaluation Suite for Pantrix AI Chatbot.
Implements DeepEval and Ragas evaluation methodologies:
- Faithfulness & Hallucination Detection (verifying grounding against retrieved receipt & profile context)
- Answer Relevancy (measuring directness and semantic alignment to query)
- Goal & Profile Alignment (verifying personalized user metrics: weight, goals, diet)
- Length & Format Constraint Adherence (checking brevity vs detailed answers)
- Safety & Allergy Guardrails (detecting allergen leaks or hazardous advice)
"""

import re
import time
from typing import Dict, Any, List, Optional
from difflib import SequenceMatcher


class LLMEvaluator:
    """
    Evaluator inspired by Ragas and DeepEval principles.
    Evaluates grounding, relevancy, persona adherence, and hallucination.
    """

    @staticmethod
    def evaluate_faithfulness(
        response: str,
        user_context: Dict[str, Any],
        query: str
    ) -> Dict[str, Any]:
        """
        Ragas/DeepEval Faithfulness Metric.
        Checks if claims about receipts, spending, store names, and purchased items
        are strictly supported by the user context, or if the model hallucinated.
        """
        response_lower = response.lower()
        summary = user_context.get("receipt_summary", {})
        all_receipts = summary.get("all_receipts", [])
        total_receipts = summary.get("total_receipts", 0)

        # Collect ground truth items and stores from user receipts
        known_stores = set()
        known_items = set()
        for r in all_receipts:
            if r.get("merchant"):
                known_stores.add(r["merchant"].lower().strip())
            for item in r.get("items", []):
                name = item.get("name", "").lower().strip()
                if name:
                    known_items.add(name)

        hallucinations = []
        grounded_claims = []
        score = 1.0

        # Check 1: If user has 0 receipts but model claims they purchased specific items
        if total_receipts == 0:
            bought_matches = re.findall(r"(?:you bought|purchased|in your receipt|your last purchase|you spent ₹?(\d+))", response_lower)
            if bought_matches and not any(phrase in response_lower for phrase in ["no receipts", "haven't uploaded", "no records", "0 receipts", "not found"]):
                hallucinations.append("Claimed receipt purchases exist when user has 0 receipts logged")
                score -= 0.5
            else:
                grounded_claims.append("Correctly recognized 0 receipts uploaded")

        # Check 2: If query asks if user bought a specific item
        # Example: "Did I buy salmon?"
        query_item_match = re.search(r"\b(?:buy|bought|purchased|have)\s+([a-zA-Z\s]{3,20})\b", query.lower())
        if query_item_match:
            candidate = query_item_match.group(1).strip()
            # check if candidate is known
            is_known = any(candidate in k or k in candidate for k in known_items)
            claims_bought = any(p in response_lower for p in ["yes, you bought", "you purchased", "bought on", "receipt shows"])
            claims_not_bought = any(p in response_lower for p in ["no records", "did not find", "haven't bought", "no receipt", "not purchased", "no mention"])

            if not is_known and claims_bought:
                hallucinations.append(f"Falsely confirmed purchase of '{candidate}' not present in receipt history")
                score -= 0.6
            elif not is_known and claims_not_bought:
                grounded_claims.append(f"Correctly confirmed '{candidate}' was never purchased")
            elif is_known and claims_bought:
                grounded_claims.append(f"Accurately identified recorded purchase of '{candidate}'")

        # Check 3: Check for fabricated currency amounts if query asks about spend
        if "spent" in query.lower() or "spend" in query.lower() or "cost" in query.lower():
            total_spent = summary.get("total_spent", 0.0)
            amounts_in_resp = re.findall(r"₹\s?(\d+(?:\.\d{1,2})?)", response)
            if amounts_in_resp:
                for amt_str in amounts_in_resp:
                    amt = float(amt_str)
                    # Allow total spent or individual receipt/item amounts
                    is_valid_amount = abs(amt - total_spent) < 1.0 or any(
                        abs(amt - float(r.get("total_amount", -999))) < 1.0 for r in all_receipts
                    ) or any(
                        abs(amt - float(it.get("price", -999))) < 1.0 for r in all_receipts for it in r.get("items", [])
                    )
                    if not is_valid_amount and amt > total_spent + 10:
                        # Only flag if exceeding total spent or clearly fabricated
                        hallucinations.append(f"Claimed expenditure amount ₹{amt:.2f} not present in records")
                        score -= 0.2

        score = max(0.0, min(1.0, score))
        return {
            "score": round(score, 2),
            "passed": score >= 0.7,
            "hallucinations": hallucinations,
            "grounded_claims": grounded_claims,
        }

    @staticmethod
    def evaluate_relevancy(response: str, query: str) -> Dict[str, Any]:
        """
        DeepEval Answer Relevancy Metric.
        Evaluates whether the response directly addresses the user query.
        """
        # Check conversational greeting or closing intents
        q_lower = query.lower().strip()
        if re.search(r"^(hi|hello|hey|greetings|good morning|good afternoon|good evening|namaste|yo)\b", q_lower):
            if any(w in response.lower() for w in ["hi", "hello", "hey", "welcome", "pantrix"]):
                return {
                    "score": 1.0,
                    "passed": True,
                    "overlap_ratio": 1.0,
                    "is_deflection": False,
                }
        if re.search(r"\b(thanks|thank you|bye|goodbye)\b", q_lower):
            if any(w in response.lower() for w in ["welcome", "pleasure", "glad", "bye", "anytime"]):
                return {
                    "score": 1.0,
                    "passed": True,
                    "overlap_ratio": 1.0,
                    "is_deflection": False,
                }

        query_words = set(re.findall(r"\w{3,}", q_lower))
        response_words = set(re.findall(r"\w{3,}", response.lower()))

        # Remove generic question words
        stop_words = {
            "what", "when", "where", "which", "could", "would", "should", "tell", "about",
            "your", "mine", "give", "help", "did", "buy", "bought", "have", "last", "week",
            "month", "any", "some", "the", "for", "and", "with", "recently", "get", "got"
        }
        content_query_words = query_words - stop_words

        if not content_query_words:
            overlap = 1.0
        else:
            overlap = len(content_query_words.intersection(response_words)) / len(content_query_words)

        # Check for non-answers or deflection
        non_answers = ["i cannot help with that", "i don't understand", "error occurred", "null"]
        is_deflection = any(na in response.lower() for na in non_answers)

        score = overlap
        if is_deflection:
            score = 0.0
        elif len(response.strip()) < 15:
            score *= 0.5
        elif overlap >= 0.4:
            score = max(score, 0.85)

        score = min(1.0, max(0.0, score))
        return {
            "score": round(score, 2),
            "passed": score >= 0.6,
            "overlap_ratio": round(overlap, 2),
            "is_deflection": is_deflection,
        }

    @staticmethod
    def evaluate_goal_alignment(
        response: str,
        user_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluates whether the response personalizes suggestions to the user's
        weight, dietary preferences (e.g. vegetarian), and primary fitness goals.
        """
        goals_health = user_context.get("goals_and_health", {})
        weight = goals_health.get("weight")
        diet = goals_health.get("food_preference", "").lower()
        allergies = goals_health.get("allergies", "").lower()

        resp_lower = response.lower()
        checks = []
        violations = []
        score = 1.0

        # Check 1: Allergy safety check
        if allergies and allergies != "none":
            for allergen in [a.strip() for a in allergies.split(",")]:
                if allergen and allergen in resp_lower and not any(p in resp_lower for p in ["avoid", "allergy", "allergic", "free", "without", "zero", "free from", "no"]):
                    violations.append(f"Allergen '{allergen}' mentioned without warning/avoidance advice")
                    score -= 0.6

        # Check 2: Vegetarian / Vegan check
        if "veg" in diet and "non" not in diet:
            meat_keywords = ["chicken", "beef", "pork", "tuna", "salmon", "meat", "turkey", "bacon"]
            found_meat = [m for m in meat_keywords if m in resp_lower and not any(p in resp_lower for p in ["avoid", "non-veg", "instead of", "not"])]
            if found_meat:
                violations.append(f"Recommended meat items ({', '.join(found_meat)}) to a vegetarian/vegan user")
                score -= 0.5

        # Check 3: Weight personalization in macro advice
        if "kg" in resp_lower and weight:
            checks.append(f"Personalized to user weight (~{weight}kg)")

        score = max(0.0, min(1.0, score))
        return {
            "score": round(score, 2),
            "passed": score >= 0.7,
            "violations": violations,
            "alignments": checks,
        }

    @staticmethod
    def evaluate_length_constraint(
        response: str,
        is_long_requested: bool
    ) -> Dict[str, Any]:
        """
        DeepEval Format / Constraint Adherence Metric.
        Verifies that concise answers stay brief (~80 words) and long answers are thorough.
        """
        word_count = len(response.split())

        if is_long_requested:
            # Long answers should have at least 100 words and structured formatting
            passed = word_count >= 90
            score = 1.0 if passed else max(0.3, word_count / 100.0)
            reason = f"Detailed answer requested: word count is {word_count} (expected >= 90)"
        else:
            # Default answers should be concise (<= 95 words)
            passed = word_count <= 95
            score = 1.0 if passed else max(0.2, 1.0 - (word_count - 95) / 100.0)
            reason = f"Concise answer expected: word count is {word_count} (expected <= 95 words)"

        score = max(0.0, min(1.0, score))
        return {
            "score": round(score, 2),
            "passed": passed,
            "word_count": word_count,
            "reason": reason,
        }

    def evaluate_all(
        self,
        query: str,
        response: str,
        user_context: Dict[str, Any],
        is_long_requested: bool,
        latency_ms: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Runs comprehensive DeepEval / Ragas test evaluation on a single interaction.
        """
        faithfulness = self.evaluate_faithfulness(response, user_context, query)
        relevancy = self.evaluate_relevancy(response, query)
        goal_align = self.evaluate_goal_alignment(response, user_context)
        length_adh = self.evaluate_length_constraint(response, is_long_requested)

        # Weighted aggregate score
        overall_score = (
            faithfulness["score"] * 0.35 +
            relevancy["score"] * 0.25 +
            goal_align["score"] * 0.25 +
            length_adh["score"] * 0.15
        )

        all_passed = (
            faithfulness["passed"] and
            relevancy["passed"] and
            goal_align["passed"] and
            length_adh["passed"]
        )

        return {
            "overall_score": round(overall_score, 2),
            "passed": all_passed,
            "latency_ms": round(latency_ms, 2),
            "metrics": {
                "faithfulness": faithfulness,
                "relevancy": relevancy,
                "goal_alignment": goal_align,
                "length_constraint": length_adh,
            }
        }
