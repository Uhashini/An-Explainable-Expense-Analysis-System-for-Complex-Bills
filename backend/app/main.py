from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.v1.endpoints import receipts, demo, auth, products, analytics, gain_muscle, chatbot, forecast, nutrition_forecast
from app.database.postgres_client import init_db
import os

try:
    init_db()
except Exception as e:
    print(f"[DB Warning] Could not initialize DB tables: {e}")

app = FastAPI(
    title="Receipt API",
    description="Backend API for Receipt Management System",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(receipts.router, prefix="/api/v1/receipts", tags=["Receipts"])
app.include_router(demo.router, prefix="/api/v1/demo", tags=["Demo"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(forecast.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(nutrition_forecast.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(gain_muscle.router, prefix="/api/v1/gain-muscle", tags=["Gain Muscle"])
app.include_router(chatbot.router, prefix="/api/v1/chatbot", tags=["Chatbot"])

# Serve Static Files
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_path = os.path.join(backend_dir, "static")
if not os.path.exists(static_path):
    os.makedirs(static_path, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_path), name="static")

@app.get("/", tags=["UI"])
async def read_index():
    return FileResponse(os.path.join(static_path, "index.html"))

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}
