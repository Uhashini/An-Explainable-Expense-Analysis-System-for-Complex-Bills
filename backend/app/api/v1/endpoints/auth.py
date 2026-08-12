from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import hashlib
from typing import Optional
import bcrypt

from app.database.postgres_client import get_db, UserProfile, UserOnboarding

router = APIRouter()

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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
    db_user = db.query(UserProfile).filter(UserProfile.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Pre-hash to avoid bcrypt 72-byte limit
    pre_hashed_password = hashlib.sha256(user.password.encode('utf-8')).hexdigest().encode('utf-8')
    hashed_password = bcrypt.hashpw(pre_hashed_password, bcrypt.gensalt()).decode('utf-8')
    new_user = UserProfile(
        name=user.name, 
        email=user.email, 
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.user_id}

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(UserProfile).filter(UserProfile.email == user.email).first()
    if not db_user or not db_user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    pre_hashed_password = hashlib.sha256(user.password.encode('utf-8')).hexdigest().encode('utf-8')
    if not bcrypt.checkpw(pre_hashed_password, db_user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    return {
        "message": "Login successful", 
        "user": {
            "id": db_user.user_id,
            "name": db_user.name,
            "email": db_user.email
        }
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
