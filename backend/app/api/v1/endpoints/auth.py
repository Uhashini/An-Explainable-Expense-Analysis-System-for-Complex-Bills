from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import hashlib
import secrets
from typing import Optional, Dict, Any
import bcrypt
import requests as http_requests

try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    HAS_GOOGLE_AUTH = True
except ImportError:
    HAS_GOOGLE_AUTH = False
    google_id_token = None
    google_requests = None

from app.core.config import settings
from app.database.postgres_client import get_db, UserProfile, UserOnboarding
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_optional_current_user
)

router = APIRouter()

# ─── Helper Functions for Google Verification ───────────────────────────────

def verify_google_id_token(token: str) -> Dict[str, Any]:
    """
    Cryptographically verify Google ID token using Google public certificates.
    Validates signature, issuer, expiration, and audience (client_id).
    Falls back to Google tokeninfo API if google-auth is not installed or fails.
    """
    google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
    last_err = "Verification failed"

    # 1. Primary: Google official cryptographic verification (if google-auth library available)
    if HAS_GOOGLE_AUTH and google_requests and google_id_token:
        try:
            transport_req = google_requests.Request()
            payload = google_id_token.verify_oauth2_token(
                token,
                transport_req,
                audience=google_client_id if google_client_id else None
            )
            if payload.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
                raise ValueError(f"Invalid Google token issuer: {payload.get('iss')}")
            return payload
        except Exception as err:
            last_err = err
    else:
        last_err = "google-auth library not available"

    # 2. Fallback: Google tokeninfo verification API
    try:
        resp = http_requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}", timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("iss") in ["accounts.google.com", "https://accounts.google.com"]:
                return data
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Google ID token verification failed: {str(last_err)}"
    )

def verify_google_access_token(access_token: str) -> Dict[str, Any]:
    """
    Verify Google OAuth2 access token by querying Google's official userinfo endpoint.
    """
    try:
        resp = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=6
        )
        if resp.status_code == 200:
            return resp.json()
        raise ValueError(f"Google userinfo returned status {resp.status_code}")
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google access token verification failed: {str(err)}"
        )

# ─── Request Schemas ────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleOAuthRequest(BaseModel):
    id_token: Optional[str] = None
    access_token: Optional[str] = None

class OAuthLoginRequest(BaseModel):
    provider: str  # e.g., "google", "apple"
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    id_token: Optional[str] = None
    access_token: Optional[str] = None
    provider_id: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class OnboardingData(BaseModel):
    user_id: int
    # Personal info (also updates UserProfile)
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    # Onboarding fields
    height: Optional[str] = None
    weight: Optional[str] = None
    activity_level: Optional[str] = None
    food_preference: Optional[str] = None
    allergies: Optional[str] = None
    medical_conditions: Optional[str] = None
    goals: Optional[str] = None
    monthly_budget: Optional[float] = None
    preferred_stores: Optional[str] = None
    household_size: Optional[str] = None
    shopping_frequency: Optional[str] = None
    city: Optional[str] = None

# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    clean_email = user.email.strip().lower()
    from sqlalchemy import func
    db_user = db.query(UserProfile).filter(func.lower(UserProfile.email) == clean_email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Pre-hash to avoid bcrypt 72-byte limit
    pre_hashed_password = hashlib.sha256(user.password.encode('utf-8')).hexdigest().encode('utf-8')
    hashed_password = bcrypt.hashpw(pre_hashed_password, bcrypt.gensalt()).decode('utf-8')
    new_user = UserProfile(
        name=user.name.strip(), 
        email=clean_email, 
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token_payload = {
        "sub": str(new_user.user_id),
        "user_id": new_user.user_id,
        "email": new_user.email,
        "name": new_user.name
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    
    return {
        "message": "User registered successfully",
        "user_id": new_user.user_id,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.user_id,
            "name": new_user.name,
            "email": new_user.email
        }
    }

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    clean_email = user.email.strip().lower()
    from sqlalchemy import func
    db_user = db.query(UserProfile).filter(func.lower(UserProfile.email) == clean_email).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="No account found with this email. If you used Google to sign up, please click 'Continue with Google', or click 'Sign Up' to create a password account.")
    if not db_user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    raw_pwd_bytes = user.password.encode('utf-8')
    pre_hashed_password = hashlib.sha256(raw_pwd_bytes).hexdigest().encode('utf-8')
    stored_hash = db_user.password_hash.strip()
    stored_hash_bytes = stored_hash.encode('utf-8')
    
    authenticated = False
    
    # 1. Try SHA-256 pre-hashed bcrypt check (standard)
    try:
        if bcrypt.checkpw(pre_hashed_password, stored_hash_bytes):
            authenticated = True
    except Exception:
        pass
        
    # 2. Try raw direct bcrypt check (for accounts created prior to pre-hash update)
    if not authenticated:
        try:
            if bcrypt.checkpw(raw_pwd_bytes, stored_hash_bytes):
                authenticated = True
                new_hash = bcrypt.hashpw(pre_hashed_password, bcrypt.gensalt()).decode('utf-8')
                db_user.password_hash = new_hash
                db.commit()
        except Exception:
            pass
            
    # 3. Fallback: plaintext match for seeded/test accounts
    if not authenticated and stored_hash == user.password:
        authenticated = True
        new_hash = bcrypt.hashpw(pre_hashed_password, bcrypt.gensalt()).decode('utf-8')
        db_user.password_hash = new_hash
        db.commit()
        
    if not authenticated:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    token_payload = {
        "sub": str(db_user.user_id),
        "user_id": db_user.user_id,
        "email": db_user.email,
        "name": db_user.name
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.user_id,
            "name": db_user.name,
            "email": db_user.email
        }
    }

@router.post("/oauth/google")
def google_oauth(request: GoogleOAuthRequest, db: Session = Depends(get_db)):
    """
    Dedicated endpoint for Official Google OAuth2 verification and login/registration.
    Accepts Google id_token or access_token, verifies it cryptographically with Google,
    retrieves user profile, and returns Pantrix JWT session tokens.
    """
    if not request.id_token and not request.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either id_token or access_token from Google must be provided."
        )

    google_info = None
    last_error = None
    if request.id_token:
        try:
            google_info = verify_google_id_token(request.id_token)
        except Exception as e:
            last_error = e

    if not google_info and request.access_token:
        try:
            google_info = verify_google_access_token(request.access_token)
        except Exception as e:
            last_error = last_error or e

    if not google_info or not google_info.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to retrieve verified email from Google: {last_error or 'No email'}"
        )

    email = google_info["email"].strip().lower()
    name = google_info.get("name") or email.split("@")[0].capitalize()
    google_id = google_info.get("sub")
    picture = google_info.get("picture")

    from sqlalchemy import func
    db_user = db.query(UserProfile).filter(func.lower(UserProfile.email) == email).first()
    is_new_user = False

    if not db_user:
        is_new_user = True
        random_secret = secrets.token_urlsafe(32)
        random_prehash = hashlib.sha256(random_secret.encode('utf-8')).hexdigest().encode('utf-8')
        dummy_hash = bcrypt.hashpw(random_prehash, bcrypt.gensalt()).decode('utf-8')

        db_user = UserProfile(
            name=name,
            email=email,
            password_hash=dummy_hash
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    elif name and (not db_user.name or db_user.name.strip() == ""):
        db_user.name = name
        db.commit()

    token_payload = {
        "sub": str(db_user.user_id),
        "user_id": db_user.user_id,
        "email": db_user.email,
        "name": db_user.name,
        "provider": "google",
        "google_id": google_id,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    return {
        "message": "Google authentication successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
        "user": {
            "id": db_user.user_id,
            "name": db_user.name,
            "email": db_user.email,
            "picture": picture,
            "google_id": google_id,
            "auth_provider": "google"
        }
    }

@router.post("/oauth/login")
def oauth_login(request: OAuthLoginRequest, db: Session = Depends(get_db)):
    """
    Unified OAuth endpoint for Google / Apple authentication.
    If a Google id_token or access_token is supplied, verifies it with Google first.
    """
    email = request.email.strip().lower() if request.email else None
    name = request.name
    google_id = request.provider_id
    picture = None

    # Google provider strictly requires official token verification
    if request.provider.lower() == "google":
        if not request.id_token and not request.access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google authentication requires a valid id_token or access_token from Google."
            )
        if request.id_token:
            info = verify_google_id_token(request.id_token)
        else:
            info = verify_google_access_token(request.access_token)
        
        if not info.get("email"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to retrieve verified email from Google."
            )
        email = info["email"].strip().lower()
        if info.get("name") and not name:
            name = info["name"]
        google_id = info.get("sub") or google_id
        picture = info.get("picture")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required for authentication."
        )

    from sqlalchemy import func
    db_user = db.query(UserProfile).filter(func.lower(UserProfile.email) == email).first()
    is_new_user = False

    if not db_user:
        is_new_user = True
        display_name = name.strip() if name else email.split('@')[0].capitalize()
        random_secret = secrets.token_urlsafe(32)
        random_prehash = hashlib.sha256(random_secret.encode('utf-8')).hexdigest().encode('utf-8')
        dummy_hash = bcrypt.hashpw(random_prehash, bcrypt.gensalt()).decode('utf-8')

        db_user = UserProfile(
            name=display_name,
            email=email,
            password_hash=dummy_hash
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    elif name and (not db_user.name or db_user.name.strip() == ""):
        db_user.name = name.strip()
        db.commit()

    token_payload = {
        "sub": str(db_user.user_id),
        "user_id": db_user.user_id,
        "email": db_user.email,
        "name": db_user.name,
        "provider": request.provider.lower(),
        "google_id": google_id,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    return {
        "message": f"OAuth login successful with {request.provider.capitalize()}",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
        "user": {
            "id": db_user.user_id,
            "name": db_user.name,
            "email": db_user.email,
            "picture": picture,
            "auth_provider": request.provider.lower()
        }
    }

@router.post("/refresh")
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Generate a new access token using a valid refresh token."""
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Refresh token required."
        )
    
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload"
        )
        
    db_user = db.query(UserProfile).filter(UserProfile.user_id == int(user_id)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User no longer exists")
        
    new_payload = {
        "sub": str(db_user.user_id),
        "user_id": db_user.user_id,
        "email": db_user.email,
        "name": db_user.name
    }
    new_access_token = create_access_token(new_payload)
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout():
    """Client-side token invalidation endpoint."""
    return {"message": "Logout successful"}

@router.get("/me")
def get_current_user_profile(
    current_user: UserProfile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve profile and onboarding info for the currently authenticated JWT user."""
    onboarding = db.query(UserOnboarding).filter(UserOnboarding.user_id == current_user.user_id).first()
    return {
        "user_id": current_user.user_id,
        "name": current_user.name,
        "email": current_user.email,
        "age": current_user.age,
        "gender": current_user.gender,
        "onboarding": {
            "height": onboarding.height if onboarding else None,
            "weight": onboarding.weight if onboarding else None,
            "activity_level": onboarding.activity_level if onboarding else None,
            "food_preference": onboarding.food_preference if onboarding else None,
            "allergies": onboarding.allergies if onboarding else None,
            "medical_conditions": onboarding.medical_conditions if onboarding else None,
            "goals": onboarding.goals if onboarding else None,
            "monthly_budget": float(onboarding.monthly_budget) if onboarding and onboarding.monthly_budget else None,
            "preferred_stores": onboarding.preferred_stores if onboarding else None,
            "household_size": onboarding.household_size if onboarding else None,
            "shopping_frequency": onboarding.shopping_frequency if onboarding else None,
            "city": onboarding.city if onboarding else None,
        } if onboarding else None
    }

@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
def onboarding(data: OnboardingData, db: Session = Depends(get_db)):
    db_user = db.query(UserProfile).filter(UserProfile.user_id == data.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update UserProfile with personal info if provided
    if data.full_name:
        db_user.name = data.full_name.strip()
    if data.age is not None:
        db_user.age = data.age
    if data.gender:
        db_user.gender = data.gender
    db.commit()

    # Fields that belong in UserOnboarding (exclude personal info + user_id)
    onboarding_fields = {
        "height": data.height,
        "weight": data.weight,
        "activity_level": data.activity_level,
        "food_preference": data.food_preference,
        "allergies": data.allergies,
        "medical_conditions": data.medical_conditions,
        "goals": data.goals,
        "monthly_budget": data.monthly_budget,
        "preferred_stores": data.preferred_stores,
        "household_size": data.household_size,
        "shopping_frequency": data.shopping_frequency,
        "city": data.city,
    }

    existing_onboarding = db.query(UserOnboarding).filter(UserOnboarding.user_id == data.user_id).first()
    if existing_onboarding:
        for key, value in onboarding_fields.items():
            if value is not None:
                setattr(existing_onboarding, key, value)
        db.commit()
        return {"message": "Onboarding data updated successfully"}
    else:
        new_onboarding = UserOnboarding(user_id=data.user_id, **{k: v for k, v in onboarding_fields.items() if v is not None})
        db.add(new_onboarding)
        db.commit()
        return {"message": "Onboarding data saved successfully"}

@router.get("/me/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    onboarding = db.query(UserOnboarding).filter(UserOnboarding.user_id == user_id).first()
    
    return {
        "user_id": db_user.user_id,
        "name": db_user.name,
        "email": db_user.email,
        "age": db_user.age,
        "gender": db_user.gender,
        "onboarding": {
            "height": onboarding.height if onboarding else None,
            "weight": onboarding.weight if onboarding else None,
            "activity_level": onboarding.activity_level if onboarding else None,
            "food_preference": onboarding.food_preference if onboarding else None,
            "allergies": onboarding.allergies if onboarding else None,
            "medical_conditions": onboarding.medical_conditions if onboarding else None,
            "goals": onboarding.goals if onboarding else None,
            "monthly_budget": float(onboarding.monthly_budget) if onboarding and onboarding.monthly_budget else None,
            "preferred_stores": onboarding.preferred_stores if onboarding else None,
            "household_size": onboarding.household_size if onboarding else None,
            "shopping_frequency": onboarding.shopping_frequency if onboarding else None,
            "city": onboarding.city if onboarding else None,
        } if onboarding else None
    }

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None

@router.put("/me/{user_id}")
def update_user_profile(user_id: int, data: UserProfileUpdate, db: Session = Depends(get_db)):
    db_user = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if data.name is not None:
        db_user.name = data.name
    if data.age is not None:
        try:
            db_user.age = int(data.age)
        except ValueError:
            pass
    if data.gender is not None:
        db_user.gender = data.gender
        
    onboarding = db.query(UserOnboarding).filter(UserOnboarding.user_id == user_id).first()
    if onboarding:
        if data.height is not None:
            onboarding.height = data.height
        if data.weight is not None:
            onboarding.weight = data.weight
    else:
        if data.height is not None or data.weight is not None:
            new_onboarding = UserOnboarding(user_id=user_id, height=data.height, weight=data.weight)
            db.add(new_onboarding)
            
    db.commit()
    return {"message": "Profile updated successfully"}
