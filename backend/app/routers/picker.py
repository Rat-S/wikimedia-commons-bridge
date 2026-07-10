import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.deps import get_current_session
from app.models.session import UserSession
from app.session import ensure_google_token
from app.services.google_picker import GooglePhotosPickerProvider

logger = logging.getLogger("wikimedia_commons_bridge.picker")
router = APIRouter(prefix="/picker", tags=["Google Picker API"])

# Initialize Google Picker Client Provider
provider = GooglePhotosPickerProvider()

@router.post("/session", status_code=status.HTTP_201_CREATED)
async def create_picker_session(
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """
    Initialize a Google Photos Picker session.
    Retrieves the secure URL where the user can select their photos.
    """
    # Ensure a valid, refreshed access token is used
    access_token = await ensure_google_token(db, session)
    
    try:
        picker_data = await provider.create_picker_session(access_token)
        return {
            "picker_session_id": picker_data.get("session_id"),
            "picker_uri": picker_data.get("picker_uri")
        }
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        logger.error(f"Unexpected error creating picker session: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error creating Google Photos picker session: {exc}"
        )

@router.get("/session/{picker_session_id}/poll")
async def poll_picker_session(
    picker_session_id: str,
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """
    Poll the status of the Picker Session.
    Returns whether the user is finished selecting photos (mediaItemsSet == true).
    """
    access_token = await ensure_google_token(db, session)
    
    try:
        is_ready = await provider.poll_picker_session(access_token, picker_session_id)
        return {"ready": is_ready}
    except Exception as exc:
        logger.error(f"Error polling session {picker_session_id}: {exc}")
        return {"ready": False}

@router.get("/media/{picker_session_id}")
async def get_picked_media_items(
    picker_session_id: str,
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """
    Retrieve details of selected photos once the user completes the flow.
    Deletes the picker session on the Google side upon completion.
    """
    access_token = await ensure_google_token(db, session)
    
    try:
        # 1. Fetch picked items
        media_items = await provider.get_picked_media_items(access_token, picker_session_id)
        
        # 2. Cleanup session on Google side (best practice)
        await provider.delete_picker_session(access_token, picker_session_id)
        
        return {
            "media_items": media_items,
            "count": len(media_items)
        }
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        logger.error(f"Error retrieving picked media from session {picker_session_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch selected photos: {exc}"
        )
