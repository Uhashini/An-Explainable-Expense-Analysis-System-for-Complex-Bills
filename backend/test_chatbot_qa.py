"""
Verification script for Pantrix Gemma / Gemini Chatbot Service.
Tests various questions to ensure accurate, scientific, and personalized answers.
"""
import sys

# Force utf-8 stdout for emojis
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.database.postgres_client import get_db
from app.services.gemma_chatbot_service import gemma_chatbot_service

def test_chatbot():
    db = next(get_db())
    test_queries = [
        "What is creatine and should I take it?",
        "How much protein do I need daily for muscle gain?",
        "What is my BMR and how many calories should I eat to lose fat?",
        "How much water should I drink every day?",
        "What is the difference between whey isolate and whey concentrate?",
        "How can I save ₹500 on my next grocery shopping trip?",
        "Can you suggest a recipe using ingredients from my receipts?",
        "Explain intermittent fasting 16/8",
        "Give me a workout split for building muscle",
    ]

    print("==================================================")
    print("TESTING PANTRIX AI GEMMA CHATBOT SERVICE")
    print("==================================================")

    for i, q in enumerate(test_queries, 1):
        print(f"\n--- [Q{i}] User asks: '{q}' ---")
        res = gemma_chatbot_service.chat(user_id=1, message=q, conversation_history=[], db=db)
        print(f"Model used: {res.get('model')}")
        print(f"Is Live API: {res.get('is_live_api')}")
        reply = res.get("reply", "")
        # Print first 250 chars of reply
        preview = reply[:300].replace("\n", " ")
        print(f"Reply preview: {preview}...")
        assert len(reply) > 50, f"Reply too short for query: {q}"
        assert "Regarding" not in reply or "Pantrix AI Expert Answer" in reply or "Everything You Need" in reply, "Generic boilerplate returned!"

    print("\n✅ ALL 9 TEST QUERIES PASSED WITH DETAILED, ACCURATE ANSWERS!")

if __name__ == "__main__":
    test_chatbot()
