import logging
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.config import settings
from app.database import get_db
from app.routers.deps import get_session_id, get_current_session
from app.models.session import UserSession
from app.session import update_google_session_tokens, get_user_session

logger = logging.getLogger("wikimedia_commons_bridge.auth_google")
router = APIRouter(prefix="/auth/google", tags=["Google OAuth"])

@router.get("/login")
async def google_login(
    session_id: str = Depends(get_session_id)
):
    """Initiate Google OAuth 2.0 flow by redirecting the user to Google."""
    google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    scopes = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
    
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": f"{settings.base_url}/api/auth/google/callback",
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",  # Request refresh token
        "prompt": "consent",       # Force consent screen to ensure refresh token is returned
        "state": session_id        # Use session_id as state for verification
    }
    
    auth_uri = f"{google_auth_url}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_uri)

@router.get("/callback")
async def google_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    db: AsyncSession = Depends(get_db),
    session_id: str = Depends(get_session_id)
):
    """Handle the callback redirect from Google OAuth."""
    if error:
        logger.error(f"Google OAuth error returned: {error}")
        return RedirectResponse(url=f"{settings.frontend_url}/?error=google_auth_failed&details={error}")
        
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing authorization code or state")

    # Verify state matches our session_id to prevent CSRF
    if state != session_id:
        logger.error(f"Google OAuth state mismatch. State: {state}, Expected: {session_id}")
        return RedirectResponse(url=f"{settings.frontend_url}/?error=session_mismatch")

    # Exchange authorization code for access and refresh tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": f"{settings.base_url}/api/auth/google/callback"
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(token_url, data=token_data)
            if resp.status_code != 200:
                logger.error(f"Failed to exchange Google OAuth code: {resp.text}")
                return RedirectResponse(url=f"{settings.frontend_url}/?error=google_token_exchange_failed")
                
            tokens = resp.json()
            access_token = tokens.get("access_token")
            expires_in = tokens.get("expires_in", 3600)
            refresh_token = tokens.get("refresh_token")
            
            # Save tokens to database
            # Ensure the session row exists first
            session = await get_user_session(db, session_id)
            if not session:
                from app.session import create_user_session
                await create_user_session(db, session_id)
                
            await update_google_session_tokens(
                db=db,
                session_id=session_id,
                access_token=access_token,
                expires_in=expires_in,
                refresh_token=refresh_token
            )
            
            logger.info(f"Google OAuth tokens successfully saved for session: {session_id}")
            return RedirectResponse(url=f"{settings.frontend_url}/?google=connected")
            
        except httpx.RequestError as exc:
            logger.error(f"HTTP request failed during Google token exchange: {exc}")
            return RedirectResponse(url=f"{settings.frontend_url}/?error=google_connection_error")

@router.get("/status")
async def google_status(
    session: UserSession = Depends(get_current_session)
):
    """Check if the user is connected to Google Photos."""
    is_connected = session.google_access_token is not None
    return {"connected": is_connected}

@router.post("/disconnect")
async def google_disconnect(
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """Disconnect Google account by clearing saved Google tokens."""
    session.google_access_token = None
    session.google_refresh_token = None
    session.google_token_expiry = None
    await db.commit()
    return {"status": "success", "message": "Google account disconnected"}
