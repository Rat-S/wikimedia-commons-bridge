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
from app.session import update_wikimedia_session_tokens, get_user_session

logger = logging.getLogger("wikimedia_commons_bridge.auth_wikimedia")
router = APIRouter(prefix="/auth/wikimedia", tags=["Wikimedia OAuth"])

USER_AGENT = "WikimediaCommonsBridge/1.0 (https://github.com/anu/wikimedia-commons-bridge; mailto:info@covai.org)"

@router.get("/login")
async def wikimedia_login(
    session_id: str = Depends(get_session_id)
):
    """Initiate Wikimedia OAuth 2.0 flow by redirecting the user to Meta-Wiki."""
    wikimedia_auth_url = "https://meta.wikimedia.org/w/rest.php/oauth2/authorize"
    
    params = {
        "client_id": settings.wikimedia_client_id,
        "redirect_uri": f"{settings.base_url}/api/auth/wikimedia/callback",
        "response_type": "code",
        "state": session_id
    }
    
    auth_uri = f"{wikimedia_auth_url}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_uri)

@router.get("/callback")
async def wikimedia_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    db: AsyncSession = Depends(get_db),
    session_id: str = Depends(get_session_id)
):
    """Handle the callback redirect from Wikimedia OAuth."""
    if error:
        logger.error(f"Wikimedia OAuth error: {error}")
        return RedirectResponse(url=f"{settings.frontend_url}/?error=wikimedia_auth_failed&details={error}")
        
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing authorization code or state")

    # Verify state against session_id
    if state != session_id:
        logger.error(f"Wikimedia OAuth state mismatch. State: {state}, Expected: {session_id}")
        return RedirectResponse(url=f"{settings.frontend_url}/?error=session_mismatch")

    # Exchange code for access token
    token_url = "https://meta.wikimedia.org/w/rest.php/oauth2/access_token"
    token_data = {
        "client_id": settings.wikimedia_client_id,
        "client_secret": settings.wikimedia_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": f"{settings.base_url}/api/auth/wikimedia/callback"
    }
    
    headers = {
        "User-Agent": USER_AGENT
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(token_url, data=token_data, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Failed to exchange Wikimedia OAuth code: {resp.text}")
                return RedirectResponse(url=f"{settings.frontend_url}/?error=wikimedia_token_exchange_failed")
                
            tokens = resp.json()
            access_token = tokens.get("access_token")
            expires_in = tokens.get("expires_in", 3600)
            refresh_token = tokens.get("refresh_token")
            
            # Fetch user profile to retrieve the Wikimedia username
            profile_url = "https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile"
            profile_headers = {
                "Authorization": f"Bearer {access_token}",
                "User-Agent": USER_AGENT
            }
            
            profile_resp = await client.get(profile_url, headers=profile_headers)
            if profile_resp.status_code != 200:
                logger.error(f"Failed to retrieve Wikimedia profile: {profile_resp.text}")
                return RedirectResponse(url=f"{settings.frontend_url}/?error=wikimedia_profile_failed")
                
            profile = profile_resp.json()
            username = profile.get("username")
            
            if not username:
                logger.error("Wikimedia profile response did not contain username")
                return RedirectResponse(url=f"{settings.frontend_url}/?error=wikimedia_username_missing")

            # Ensure user session exists in database
            session = await get_user_session(db, session_id)
            if not session:
                from app.session import create_user_session
                await create_user_session(db, session_id)
                
            # Update Wikimedia tokens and username in database
            await update_wikimedia_session_tokens(
                db=db,
                session_id=session_id,
                access_token=access_token,
                expires_in=expires_in,
                username=username,
                refresh_token=refresh_token
            )
            
            logger.info(f"Wikimedia OAuth tokens successfully saved for user {username} in session: {session_id}")
            return RedirectResponse(url=f"{settings.frontend_url}/?wikimedia=connected&username={urllib.parse.quote(username)}")
            
        except httpx.RequestError as exc:
            logger.error(f"HTTP request failed during Wikimedia token exchange: {exc}")
            return RedirectResponse(url=f"{settings.frontend_url}/?error=wikimedia_connection_error")

@router.get("/status")
async def wikimedia_status(
    session: UserSession = Depends(get_current_session)
):
    """Check if the user is connected to Wikimedia and return their username."""
    is_connected = session.wikimedia_access_token is not None
    return {
        "connected": is_connected,
        "username": session.wikimedia_username if is_connected else None
    }

@router.post("/disconnect")
async def wikimedia_disconnect(
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session)
):
    """Disconnect Wikimedia account by clearing tokens and username."""
    session.wikimedia_access_token = None
    session.wikimedia_refresh_token = None
    session.wikimedia_token_expiry = None
    session.wikimedia_username = None
    await db.commit()
    return {"status": "success", "message": "Wikimedia account disconnected"}
