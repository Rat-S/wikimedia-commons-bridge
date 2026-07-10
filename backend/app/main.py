from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.config import settings
from app.database import engine, Base
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wikimedia_commons_bridge")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized successfully.")
    yield

app = FastAPI(
    title="Wikimedia Commons Bridge API",
    description="Backend API supporting authentication, Google Photos Picker, and Wikimedia uploads.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
from app.routers import auth_google, auth_wikimedia, picker, upload
app.include_router(auth_google.router, prefix="/api")
app.include_router(auth_wikimedia.router, prefix="/api")
app.include_router(picker.router, prefix="/api")
app.include_router(upload.router, prefix="/api")

# Health Check Route
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Service is healthy"}

# Google Site Verification Dynamic Endpoint
@app.get("/{verification_file}", response_class=HTMLResponse)
def google_site_verification(verification_file: str):
    # Check if the requested file matches the registered Google verification filename
    if (settings.google_site_verification_filename and 
        verification_file == settings.google_site_verification_filename):
        return HTMLResponse(content=settings.google_site_verification_code or "", status_code=200)
    
    # Otherwise, raise a 404 error
    raise HTTPException(status_code=404, detail="File not found")
