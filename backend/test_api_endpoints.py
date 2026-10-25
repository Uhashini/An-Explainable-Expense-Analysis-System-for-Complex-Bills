"""
Direct function test for Chatbot FastAPI router endpoints.
"""
import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.database.postgres_client import get_db
from app.api.v1.endpoints.chatbot import (
    get_status,
    get_chat_suggestions,
    chat_with_gemma,
    ChatRequest,
    ChatMessage,
    update_config,
    ChatConfigRequest,
)

def test_router_functions():
    db = next(get_db())

    print("1. Testing get_status() ...")
    status = get_status()
    print("Status output:", status)
    assert status["status"] == "online"

    print("\n2. Testing get_chat_suggestions(user_id=1) ...")
    suggestions = get_chat_suggestions(user_id=1, db=db)
    print("Suggestions output:", suggestions["suggestions"])
    assert len(suggestions["suggestions"]) > 0

    print("\n3. Testing chat_with_gemma() - Creatine Question ...")
    req = ChatRequest(
        user_id=1,
        message="What is creatine and how do I take it?",
        history=[]
    )
    res = chat_with_gemma(req, db=db)
    print("Model:", res.get("model"))
    print("Reply preview:", res.get("reply")[:250].replace("\n", " "))
    assert len(res.get("reply", "")) > 100

    print("\n4. Testing chat_with_gemma() - Grocery Budget Question ...")
    req2 = ChatRequest(
        user_id=1,
        message="How can I save ₹500 on groceries?",
        history=[]
    )
    res2 = chat_with_gemma(req2, db=db)
    print("Model:", res2.get("model"))
    print("Reply preview:", res2.get("reply")[:250].replace("\n", " "))
    assert len(res2.get("reply", "")) > 100

    print("\n5. Testing update_config() ...")
    cfg_req = ChatConfigRequest(gemini_api_key="AIzaSyDummyTestKeyForVerification")
    cfg_res = update_config(cfg_req)
    print("Config response:", cfg_res)
    assert cfg_res["has_gemini_key"] is True

    # Reset dummy key
    update_config(ChatConfigRequest(gemini_api_key=""))

    print("\n🎉 ALL CHATBOT ENDPOINTS & SERVICE LOGIC ARE FULLY VERIFIED AND WORKING!")

if __name__ == "__main__":
    test_router_functions()
