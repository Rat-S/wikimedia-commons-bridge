import logging
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.deps import get_current_session
from app.models.session import UserSession
from app.session import ensure_google_token, ensure_wikimedia_token
from app.services.metadata import generate_commons_wikitext
from app.services.mediawiki import upload_file_in_chunks, get_user_rate_limits

logger = logging.getLogger("wikimedia_commons_bridge.upload")
router = APIRouter(prefix="/upload", tags=["Wikimedia Upload Pipeline"])

from sqlalchemy import select
from app.database import get_db, AsyncSessionLocal
from app.models.session import UserSession, UploadJob

# DB-backed helpers for job tracking across uWSGI processes
async def create_upload_job(db: AsyncSession, filename: str) -> str:
    job_id = str(uuid.uuid4())
    job = UploadJob(
        job_id=job_id,
        filename=filename,
        status="queued",
        progress_bytes=0,
        total_bytes=0
    )
    db.add(job)
    await db.commit()
    return job_id

async def update_job_progress(job_id: str, progress_bytes: int, total_bytes: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UploadJob).where(UploadJob.job_id == job_id))
        job = result.scalar_one_or_none()
        if job:
            job.status = "uploading"
            job.progress_bytes = progress_bytes
            job.total_bytes = total_bytes
            await db.commit()

async def mark_job_success(job_id: str, filename: str, description_url: str, url: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UploadJob).where(UploadJob.job_id == job_id))
        job = result.scalar_one_or_none()
        if job:
            job.status = "success"
            job.filename = filename
            job.description_url = description_url
            job.url = url
            await db.commit()

async def mark_job_failed(job_id: str, error_msg: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UploadJob).where(UploadJob.job_id == job_id))
        job = result.scalar_one_or_none()
        if job:
            job.status = "failed"
            job.error = error_msg
            await db.commit()

# Pydantic Schemas for requests
class UploadRequest(BaseModel):
    media_url: str = Field(..., description="The temporary Google Photos media item baseUrl")
    commons_filename: str = Field(..., description="The target filename for Wikimedia Commons")
    description: str = Field(..., description="English file description")
    date: Optional[str] = Field(None, description="Creation date in YYYY-MM-DD")
    license_code: str = Field(..., description="CC-BY-SA-4.0, CC-BY-4.0, or CC0-1.0")
    categories: List[str] = Field(default_factory=list, description="Target Commons category names")
    lat: Optional[float] = Field(None, description="Optional GPS latitude decimal")
    lon: Optional[float] = Field(None, description="Optional GPS longitude decimal")

# Background task wrapper
async def run_background_upload(
    job_id: str,
    google_media_url: str,
    commons_filename: str,
    wikitext: str,
    wikimedia_token: str,
    google_token: str,
    license_code: str
):
    await update_job_progress(job_id, 0, 100)
    
    # Define nested callback function for progress updates
    async def on_progress(bytes_sent: int, total_bytes: int):
        await update_job_progress(job_id, bytes_sent, total_bytes)
        
    try:
        result = await upload_file_in_chunks(
            wikimedia_token=wikimedia_token,
            google_token=google_token,
            media_url=google_media_url,
            commons_filename=commons_filename,
            wikitext=wikitext,
            license_code=license_code,
            on_progress=on_progress
        )
        await mark_job_success(
            job_id=job_id,
            filename=result["filename"],
            description_url=result["description_url"],
            url=result["url"]
        )
    except Exception as exc:
        logger.error(f"Background upload task failed for job {job_id}: {exc}")
        await mark_job_failed(job_id, str(exc))

@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def start_upload_job(
    request: UploadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """
    Start a background upload job.
    Streams high-resolution file bytes and pushes them to MediaWiki chunked upload API.
    """
    # 1. Ensure valid credentials on both sides
    google_token = await ensure_google_token(db, session)
    wikimedia_token = await ensure_wikimedia_token(db, session)
    
    # 2. Generate wikitext page content
    wikitext = generate_commons_wikitext(
        description=request.description,
        date_str=request.date,
        author_username=session.wikimedia_username,
        license_code=request.license_code,
        categories=request.categories,
        lat=request.lat,
        lon=request.lon
    )
    
    # 3. Register the job inside database
    job_id = await create_upload_job(db, request.commons_filename)
    
    # 4. Schedule background worker
    background_tasks.add_task(
        run_background_upload,
        job_id=job_id,
        google_media_url=request.media_url,
        commons_filename=request.commons_filename,
        wikitext=wikitext,
        wikimedia_token=wikimedia_token,
        google_token=google_token,
        license_code=request.license_code
    )
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Upload job has been queued in the background."
    }

@router.get("/status/{job_id}")
async def get_upload_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve the current progress and status of a background upload job."""
    result = await db.execute(select(UploadJob).where(UploadJob.job_id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Upload job not found")
    return {
        "job_id": job.job_id,
        "filename": job.filename,
        "status": job.status,
        "progress_bytes": job.progress_bytes,
        "total_bytes": job.total_bytes,
        "error": job.error,
        "description_url": job.description_url,
        "url": job.url
    }

@router.get("/limits")
async def check_user_limits(
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """Query Wikimedia Commons for the current user's active rate limits."""
    wikimedia_token = await ensure_wikimedia_token(db, session)
    limits = await get_user_rate_limits(wikimedia_token)
    return {"ratelimits": limits}

