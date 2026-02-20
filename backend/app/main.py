from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.v1.endpoints import receipts
import os

app = FastAPI(
    title="Receipt API",
    description="Backend API for Receipt Management System",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(receipts.router, prefix="/api/v1/receipts", tags=["Receipts"])

# Serve Static Files
static_path = os.path.join(os.getcwd(), "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

@app.get("/", tags=["UI"])
async def read_index():
    return FileResponse(os.path.join(static_path, "index.html"))

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}
