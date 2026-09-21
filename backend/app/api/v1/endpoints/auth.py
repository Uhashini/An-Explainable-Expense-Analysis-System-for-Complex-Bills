from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import hashlib
import secrets
from typing import Optional, Dict, Any
import bcrypt

from app.database.postgres_client import get_db, UserProfile, UserOnboarding
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_optional_current_user
)

router = APIRouter()

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OAuthLoginRequest(BaseModel):
    provider: str  # e.g., "google", "apple"
    email: EmailStr
    name: Optional[str] = None
    id_token: Optional[str] = None
    access_token: Optional[str] = None
    provider_id: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class OnboardingData(BaseModel):
    user_id: int
    height: Optional[str] = None
    weight: Optional[str] = None
    activity_level: Optional[str] = None
    food_preference: Optional[str] = None
    allergies: Optional[str] = None
    medical_conditions: Optional[str] = None
    goals: Optional[str] = None
    household_size: Optional[str] = None
    shopping_frequency: Optional[str] = None
    city: Optional[str] = None

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
    if not db_user or not db_user.password_hash:
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
                # Automatically upgrade hash to sha256 pre-hashed format
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

@router.post("/oauth/login")
def oauth_login(request: OAuthLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate or auto-register a user via OAuth (Google / Apple).
    Issues JWT access and refresh tokens.
    """
    clean_email = request.email.strip().lower()
    from sqlalchemy import func
    db_user = db.query(UserProfile).filter(func.lower(UserProfile.email) == clean_email).first()
    is_new_user = False

    if not db_user:
        # Create a new user account for the OAuth profile
        is_new_user = True
        display_name = request.name.strip() if request.name else clean_email.split('@')[0].capitalize()
        # Generate secure random dummy hash for OAuth-only users
        random_secret = secrets.token_urlsafe(32)
        random_prehash = hashlib.sha256(random_secret.encode('utf-8')).hexdigest().encode('utf-8')
        dummy_hash = bcrypt.hashpw(random_prehash, bcrypt.gensalt()).decode('utf-8')

        db_user = UserProfile(
            name=display_name,
            email=clean_email,
            password_hash=dummy_hash
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    elif request.name and (not db_user.name or db_user.name.strip() == ""):
        db_user.name = request.name.strip()
        db.commit()

    token_payload = {
        "sub": str(db_user.user_id),
        "user_id": db_user.user_id,
        "email": db_user.email,
        "name": db_user.name,
        "provider": request.provider.lower()
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
            "email": db_user.email
        }
    }

@router.post("/token")
def oauth2_password_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Standard OAuth2 Password Grant endpoint for Swagger UI & RFC 6749 compliance."""
    clean_email = form_data.username.strip().lower()
    from sqlalchemy import func
    db_user = db.query(UserProfile).filter(func.lower(UserProfile.email) == clean_email).first()
    if not db_user or not db_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password"
        )
        
    raw_pwd_bytes = form_data.password.encode('utf-8')
    pre_hashed = hashlib.sha256(raw_pwd_bytes).hexdigest().encode('utf-8')
    stored_hash_bytes = db_user.password_hash.strip().encode('utf-8')
    
    authenticated = False
    try:
        if bcrypt.checkpw(pre_hashed, stored_hash_bytes) or bcrypt.checkpw(raw_pwd_bytes, stored_hash_bytes):
            authenticated = True
    except Exception:
        pass
        
    if not authenticated and db_user.password_hash.strip() == form_data.password:
        authenticated = True
        
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password"
        )
        
    token_payload = {
        "sub": str(db_user.user_id),
        "user_id": db_user.user_id,
        "email": db_user.email,
        "name": db_user.name
    }
    access_token = create_access_token(token_payload)
    return {
        "access_token": access_token,
        "token_type": "bearer"
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
            "household_size": onboarding.household_size if onboarding else None,
            "shopping_frequency": onboarding.shopping_frequency if onboarding else None,
            "city": onboarding.city if onboarding else None,
        } if onboarding else None
    }

@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
def onboarding(data: OnboardingData, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(UserProfile).filter(UserProfile.user_id == data.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if onboarding data already exists
    existing_onboarding = db.query(UserOnboarding).filter(UserOnboarding.user_id == data.user_id).first()
    if existing_onboarding:
        # Update existing
        for key, value in data.dict(exclude={"user_id"}).items():
            setattr(existing_onboarding, key, value)
        db.commit()
        return {"message": "Onboarding data updated successfully"}
    else:
        # Create new
        new_onboarding = UserOnboarding(**data.dict())
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
            "household_size": onboarding.household_size if onboarding else None,
            "shopping_frequency": onboarding.shopping_frequency if onboarding else None,
            "city": onboarding.city if onboarding else None,
        } if onboarding else None
    }

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[str] = None # Using str since some inputs might be sent as string
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
