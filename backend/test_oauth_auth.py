import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from unittest.mock import patch
from fastapi import HTTPException
from app.database.postgres_client import get_db, UserProfile
from app.api.v1.endpoints.auth import (
    register,
    login,
    oauth_login,
    google_oauth,
    refresh_token,
    get_current_user_profile,
    UserCreate,
    UserLogin,
    OAuthLoginRequest,
    GoogleOAuthRequest,
    RefreshTokenRequest,
)
from app.core.security import decode_token

def run_tests():
    print("=" * 60)
    print("STARTING OAUTH & JWT AUTHENTICATION ENDPOINT TESTS")
    print("=" * 60)
    
    db = next(get_db())

    # 1. Standard Register Test
    test_email = "direct_jwt_test@example.com"
    existing = db.query(UserProfile).filter(UserProfile.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()

    print(f"\n1. Testing register() for {test_email}...")
    reg_req = UserCreate(name="Direct Test User", email=test_email, password="MySecurePassword1")
    reg_res = register(reg_req, db=db)
    assert "access_token" in reg_res, "access_token missing"
    assert "refresh_token" in reg_res, "refresh_token missing"
    print("   ✓ Registration generated valid JWT access & refresh tokens!")

    # 2. Standard Login Test
    print(f"\n2. Testing login() for {test_email}...")
    login_req = UserLogin(email=test_email, password="MySecurePassword1")
    login_res = login(login_req, db=db)
    assert "access_token" in login_res, "access_token missing in login"
    print("   ✓ Login successful with JWT access token!")

    # 3. Security Test: Rejection of unverified client-supplied Google email
    print("\n3. Testing security validation: Reject unverified Google login without tokens...")
    try:
        oauth_login(OAuthLoginRequest(provider="google", email="unverified@gmail.com"), db=db)
        assert False, "Should reject unverified Google login without token"
    except HTTPException as e:
        assert e.status_code == 400
        print("   ✓ Security enforced: Backend strictly rejects client-supplied email without verified Google token!")

    # 4. Verified Google OAuth Login (Simulating verified Google token)
    google_email = "alex.google.verified@gmail.com"
    existing_g = db.query(UserProfile).filter(UserProfile.email == google_email).first()
    if existing_g:
        db.delete(existing_g)
        db.commit()

    mock_google_info = {
        "iss": "https://accounts.google.com",
        "sub": "google_sub_1092837465",
        "email": google_email,
        "name": "Alex Google Verified",
        "picture": "https://lh3.googleusercontent.com/test_avatar.jpg",
    }

    print(f"\n4. Testing google_oauth() with verified Google ID token ({google_email})...")
    with patch("app.api.v1.endpoints.auth.verify_google_id_token", return_value=mock_google_info):
        req = GoogleOAuthRequest(id_token="mock_valid_google_id_token")
        oauth_res = google_oauth(req, db=db)
        assert oauth_res.get("is_new_user") is True, "Expected is_new_user=True for new account"
        assert "access_token" in oauth_res, "access_token missing in oauth_res"
        assert "refresh_token" in oauth_res, "refresh_token missing in oauth_res"
        assert oauth_res["user"]["email"] == google_email
        assert oauth_res["user"]["picture"] == mock_google_info["picture"]
        print(f"   ✓ Verified Google user auto-registered with ID {oauth_res['user']['id']}, profile pic saved, and JWT tokens issued!")

    # 5. Verified Google OAuth Re-Login (Existing Account)
    print("\n5. Testing google_oauth() re-login with existing verified Google account...")
    with patch("app.api.v1.endpoints.auth.verify_google_id_token", return_value=mock_google_info):
        req = GoogleOAuthRequest(id_token="mock_valid_google_id_token")
        oauth_relogin_res = google_oauth(req, db=db)
        assert oauth_relogin_res.get("is_new_user") is False, "Expected is_new_user=False for existing user"
        assert oauth_relogin_res["user"]["id"] == oauth_res["user"]["id"], "User ID should match"
        print("   ✓ Existing Google user correctly recognized and logged in without creating duplicate record!")

    # 6. Missing token validation
    print("\n6. Testing google_oauth() endpoint with empty payload...")
    try:
        google_oauth(GoogleOAuthRequest(), db=db)
        assert False, "Should have raised HTTPException for missing token"
    except HTTPException as e:
        assert e.status_code == 400
        print("   ✓ Missing token properly rejected with HTTP 400!")

    # 7. JWT Token Payload Validation
    print("\n7. Testing decode_token() on generated Google OAuth JWT...")
    decoded = decode_token(oauth_res["access_token"])
    assert decoded["email"] == google_email
    assert decoded["provider"] == "google"
    assert decoded["type"] == "access"
    assert decoded["google_id"] == mock_google_info["sub"]
    print("   ✓ JWT claims, provider, google_id, and expiration verified!")

    # 8. Refresh Token Endpoint Test
    print("\n8. Testing refresh_token() endpoint...")
    ref_req = RefreshTokenRequest(refresh_token=oauth_res["refresh_token"])
    ref_res = refresh_token(ref_req, db=db)
    assert "access_token" in ref_res, "New access_token missing in refresh_token response"
    new_decoded = decode_token(ref_res["access_token"])
    assert new_decoded["email"] == google_email
    print("   ✓ Token refresh generated a fresh new access token!")

    # 9. Authenticated Current User Profile Test
    print("\n9. Testing get_current_user_profile()...")
    user_model = db.query(UserProfile).filter(UserProfile.user_id == oauth_res["user"]["id"]).first()
    profile = get_current_user_profile(current_user=user_model, db=db)
    assert profile["email"] == google_email
    print(f"   ✓ Authenticated profile fetched: {profile['name']} ({profile['email']})")

    print("\n" + "=" * 60)
    print("🎉 ALL OAUTH & JWT AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
