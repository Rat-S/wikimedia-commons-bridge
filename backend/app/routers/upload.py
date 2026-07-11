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

# In-memory database of active background upload jobs
class UploadJobTracker:
    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}

    def create_job(self, filename: str) -> str:
        job_id = str(uuid.uuid4())
        self._jobs[job_id] = {
            "job_id": job_id,
            "filename": filename,
            "status": "queued",
            "progress_bytes": 0,
            "total_bytes": 0,
            "error": None,
            "description_url": None,
            "url": None
        }
        return job_id

    def update_progress(self, job_id: str, progress_bytes: int, total_bytes: int):
        if job_id in self._jobs:
            self._jobs[job_id]["status"] = "uploading"
            self._jobs[job_id]["progress_bytes"] = progress_bytes
            self._jobs[job_id]["total_bytes"] = total_bytes

    def mark_success(self, job_id: str, filename: str, description_url: str, url: str):
        if job_id in self._jobs:
            self._jobs[job_id]["status"] = "success"
            self._jobs[job_id]["filename"] = filename
            self._jobs[job_id]["description_url"] = description_url
            self._jobs[job_id]["url"] = url

    def mark_failed(self, job_id: str, error_msg: str):
        if job_id in self._jobs:
            self._jobs[job_id]["status"] = "failed"
            self._jobs[job_id]["error"] = error_msg

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self._jobs.get(job_id)

tracker = UploadJobTracker()

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
    google_token: str
):
    tracker.update_progress(job_id, 0, 100)
    
    # Define nested callback function for progress updates
    async def on_progress(bytes_sent: int, total_bytes: int):
        tracker.update_progress(job_id, bytes_sent, total_bytes)
        
    try:
        result = await upload_file_in_chunks(
            wikimedia_token=wikimedia_token,
            google_token=google_token,
            media_url=google_media_url,
            commons_filename=commons_filename,
            wikitext=wikitext,
            on_progress=on_progress
        )
        tracker.mark_success(
            job_id=job_id,
            filename=result["filename"],
            description_url=result["description_url"],
            url=result["url"]
        )
    except Exception as exc:
        logger.error(f"Background upload task failed for job {job_id}: {exc}")
        tracker.mark_failed(job_id, str(exc))

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
    
    # 3. Register the job inside tracker
    job_id = tracker.create_job(request.commons_filename)
    
    # 4. Schedule background worker
    background_tasks.add_task(
        run_background_upload,
        job_id=job_id,
        google_media_url=request.media_url,
        commons_filename=request.commons_filename,
        wikitext=wikitext,
        wikimedia_token=wikimedia_token,
        google_token=google_token
    )
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Upload job has been queued in the background."
    }

@router.get("/status/{job_id}")
async def get_upload_job_status(job_id: str):
    """Retrieve the current progress and status of a background upload job."""
    job = tracker.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload job not found")
    return job

@router.get("/limits")
async def check_user_limits(
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """Query Wikimedia Commons for the current user's active rate limits."""
    wikimedia_token = await ensure_wikimedia_token(db, session)
    limits = await get_user_rate_limits(wikimedia_token)
    return {"ratelimits": limits}

