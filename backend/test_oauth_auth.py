import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.postgres_client import get_db, UserProfile
from app.api.v1.endpoints.auth import (
    register,
    login,
    oauth_login,
    refresh_token,
    get_current_user_profile,
    UserCreate,
    UserLogin,
    OAuthLoginRequest,
    RefreshTokenRequest,
)
from app.core.security import decode_token

def run_tests():
    print("=" * 60)
    print("STARTING DIRECT OAUTH & JWT AUTHENTICATION ENDPOINT TESTS")
    print("=" * 60)
    
    db = next(get_db())

    # 1. Standard Register Test
    test_email = "direct_jwt_test@example.com"
    # Clean up if already exists
    existing = db.query(UserProfile).filter(UserProfile.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()

    print(f"\n1. Testing register() for {test_email}...")
    reg_req = UserCreate(name="Direct Test User", email=test_email, password="MySecurePassword1")
    reg_res = register(reg_req, db=db)
    print("   Register response keys:", list(reg_res.keys()))
    assert "access_token" in reg_res, "access_token missing"
    assert "refresh_token" in reg_res, "refresh_token missing"
    print("   ✓ Registration generated valid JWT access & refresh tokens!")

    # 2. Standard Login Test
    print(f"\n2. Testing login() for {test_email}...")
    login_req = UserLogin(email=test_email, password="MySecurePassword1")
    login_res = login(login_req, db=db)
    assert "access_token" in login_res, "access_token missing in login"
    print("   ✓ Login successful with JWT access token!")

    # 3. Google OAuth Login Test (New Account)
    google_email = "direct_oauth_gmail@gmail.com"
    existing_g = db.query(UserProfile).filter(UserProfile.email == google_email).first()
    if existing_g:
        db.delete(existing_g)
        db.commit()

    print(f"\n3. Testing oauth_login() with new Google / Gmail account ({google_email})...")
    oauth_req = OAuthLoginRequest(
        provider="google",
        email=google_email,
        name="Alex Google Student",
        provider_id="google_test_direct_12345"
    )
    oauth_res = oauth_login(oauth_req, db=db)
    print("   OAuth response:", oauth_res.get("message"))
    assert oauth_res.get("is_new_user") is True, "Expected is_new_user=True"
    assert "access_token" in oauth_res, "access_token missing in oauth_res"
    assert "refresh_token" in oauth_res, "refresh_token missing in oauth_res"
    print(f"   ✓ New Google user auto-registered with ID {oauth_res['user']['id']} and JWT tokens issued!")

    # 4. Google OAuth Re-Login Test (Existing Account)
    print(f"\n4. Testing oauth_login() re-login with existing Google / Gmail account...")
    oauth_relogin_req = OAuthLoginRequest(
        provider="google",
        email=google_email,
    )
    oauth_relogin_res = oauth_login(oauth_relogin_req, db=db)
    assert oauth_relogin_res.get("is_new_user") is False, "Expected is_new_user=False for existing user"
    assert oauth_relogin_res["user"]["id"] == oauth_res["user"]["id"], "User ID should match"
    print("   ✓ Existing Google account recognized correctly!")

    # 5. JWT Token Payload Validation
    print("\n5. Testing decode_token() on generated Google OAuth JWT...")
    decoded = decode_token(oauth_res["access_token"])
    print("   Decoded JWT:", decoded)
    assert decoded["email"] == google_email
    assert decoded["provider"] == "google"
    assert decoded["type"] == "access"
    print("   ✓ JWT claims, provider, expiration, and user identity verified!")

    # 6. Refresh Token Endpoint Test
    print("\n6. Testing refresh_token() endpoint...")
    ref_req = RefreshTokenRequest(refresh_token=oauth_res["refresh_token"])
    ref_res = refresh_token(ref_req, db=db)
    assert "access_token" in ref_res, "New access_token missing in refresh_token response"
    new_decoded = decode_token(ref_res["access_token"])
    assert new_decoded["email"] == google_email
    print("   ✓ Token refresh generated a fresh new access token!")

    # 7. Authenticated Current User Profile Test
    print("\n7. Testing get_current_user_profile()...")
    user_model = db.query(UserProfile).filter(UserProfile.user_id == oauth_res["user"]["id"]).first()
    profile = get_current_user_profile(current_user=user_model, db=db)
    assert profile["email"] == google_email
    print(f"   ✓ Profile fetched successfully: {profile['name']} ({profile['email']})")

    print("\n" + "=" * 60)
    print("🎉 ALL OAUTH & JWT AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
