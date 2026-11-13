"""
Pytest LLM Unit Tests for Pantrix AI Chatbot (DeepEval / Ragas test suite).
Execute with:
    pytest backend/app/evaluation/test_llm_eval.py -v
"""

import os
import sys
import json
import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.gemma_chatbot_service import gemma_chatbot_service
from app.evaluation.evaluator import LLMEvaluator

evaluator = LLMEvaluator()

test_cases_path = os.path.join(os.path.dirname(__file__), "test_cases.json")
with open(test_cases_path, "r", encoding="utf-8") as f:
    TEST_CASES = json.load(f)


@pytest.mark.parametrize("tc", TEST_CASES, ids=[tc["id"] for tc in TEST_CASES])
def test_chatbot_scenario(tc):
    """
    Evaluates individual benchmark test cases against DeepEval and Ragas criteria.
    """
    query = tc["query"]
    user_context = tc["user_context"]
    is_long = tc.get("is_long_requested", False)

    # 1. Run inference through Chatbot reasoning engine
    reply = gemma_chatbot_service._generate_contextual_response(
        user_message=query,
        user_context=user_context,
        conversation_history=[],
        is_long_requested=is_long,
    )
    assert reply, "Chatbot reply must not be empty"

    # 2. Evaluate Faithfulness & Hallucination (Ragas)
    faithfulness = evaluator.evaluate_faithfulness(reply, user_context, query)
    assert faithfulness["passed"], f"Faithfulness check failed: {faithfulness['hallucinations']}"

    # 3. Evaluate Relevancy (DeepEval)
    relevancy = evaluator.evaluate_relevancy(reply, query)
    assert relevancy["passed"], f"Relevancy check failed: overlap ratio is {relevancy['overlap_ratio']}"

    # 4. Evaluate Goal & Profile Alignment
    goal_align = evaluator.evaluate_goal_alignment(reply, user_context)
    assert goal_align["passed"], f"Goal alignment failed: {goal_align['violations']}"

    # 5. Evaluate Length & Constraint Adherence
    length_adh = evaluator.evaluate_length_constraint(reply, is_long)
    assert length_adh["passed"], f"Length constraint violated: {length_adh['reason']}"
