import re
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.postgres_client import Receipt, ReceiptItem, FoodItem
from datetime import datetime
import numpy as np
import pandas as pd
try:
    from statsmodels.tsa.seasonal import STL
    from sklearn.ensemble import IsolationForest
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

def extract_float(price_str: str) -> float:
    if not price_str:
        return 0.0
    # Remove non-numeric characters except dot
    clean_str = re.sub(r'[^\d.]', '', price_str)
    try:
        return float(clean_str)
    except ValueError:
        return 0.0



