import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.session import UserSession

async def create_user_session(
    db: AsyncSession,
    session_id: str,
    google_tokens: Optional[Dict[str, Any]] = None,
    wikimedia_tokens: Optional[Dict[str, Any]] = None,
    wikimedia_username: Optional[str] = None
) -> UserSession:
    """Create a new database user session."""
    db_session = UserSession(
        session_id=session_id,
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow()
    )

    if google_tokens:
        db_session.google_access_token = google_tokens.get("access_token")
        db_session.google_refresh_token = google_tokens.get("refresh_token")
        expires_in = google_tokens.get("expires_in")
        if expires_in:
            db_session.google_token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(expires_in))

    if wikimedia_tokens:
        db_session.wikimedia_access_token = wikimedia_tokens.get("access_token")
        db_session.wikimedia_refresh_token = wikimedia_tokens.get("refresh_token")
        expires_in = wikimedia_tokens.get("expires_in")
        if expires_in:
            db_session.wikimedia_token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(expires_in))
        db_session.wikimedia_username = wikimedia_username

    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    return db_session

async def get_user_session(db: AsyncSession, session_id: str) -> Optional[UserSession]:
    """Retrieve a user session by its ID."""
    result = await db.execute(select(UserSession).where(UserSession.session_id == session_id))
    return result.scalars().first()

async def update_google_session_tokens(
    db: AsyncSession,
    session_id: str,
    access_token: str,
    expires_in: int,
    refresh_token: Optional[str] = None
) -> Optional[UserSession]:
    """Update Google tokens for an existing session."""
    db_session = await get_user_session(db, session_id)
    if not db_session:
        return None

    db_session.google_access_token = access_token
    db_session.google_token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(expires_in))
    if refresh_token:
        db_session.google_refresh_token = refresh_token
    
    db_session.updated_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(db_session)
    return db_session

async def update_wikimedia_session_tokens(
    db: AsyncSession,
    session_id: str,
    access_token: str,
    expires_in: int,
    username: str,
    refresh_token: Optional[str] = None
) -> Optional[UserSession]:
    """Update Wikimedia tokens for an existing session."""
    db_session = await get_user_session(db, session_id)
    if not db_session:
        return None

    db_session.wikimedia_access_token = access_token
    db_session.wikimedia_token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(expires_in))
    db_session.wikimedia_username = username
    if refresh_token:
        db_session.wikimedia_refresh_token = refresh_token
        
    db_session.updated_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(db_session)
    return db_session

async def delete_user_session(db: AsyncSession, session_id: str) -> bool:
    """Delete a user session by its ID."""
    db_session = await get_user_session(db, session_id)
    if not db_session:
        return False
        
    await db.delete(db_session)
    await db.commit()
    return True

async def ensure_google_token(db: AsyncSession, session: UserSession) -> str:
    """
    Ensure the session's Google access token is valid.
    If it is close to expiration (within 5 minutes) and a refresh token exists, refresh it.
    """
    if not session.google_access_token:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Google Photos account not connected")

    now = datetime.datetime.utcnow()
    # Check if expired or expiring within 5 minutes (300 seconds)
    is_expired = (
        not session.google_token_expiry or 
        session.google_token_expiry <= now + datetime.timedelta(minutes=5)
    )

    if is_expired:
        if not session.google_refresh_token:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=401, 
                detail="Google Photos session expired. Please reconnect your account."
            )

        # Refresh the token
        import httpx
        from app.config import settings
        
        token_url = "https://oauth2.googleapis.com/token"
        refresh_data = {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": session.google_refresh_token,
            "grant_type": "refresh_token"
        }

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(token_url, data=refresh_data)
                if resp.status_code != 200:
                    from fastapi import HTTPException
                    raise HTTPException(
                        status_code=401, 
                        detail="Failed to refresh Google token. Please reconnect your account."
                    )

                tokens = resp.json()
                new_access_token = tokens.get("access_token")
                expires_in = tokens.get("expires_in", 3600)
                
                # Update tokens in database
                await update_google_session_tokens(
                    db=db,
                    session_id=session.session_id,
                    access_token=new_access_token,
                    expires_in=expires_in
                )
                return new_access_token
            except httpx.RequestError as exc:
                from fastapi import HTTPException
                raise HTTPException(status_code=500, detail=f"Failed to connect to Google API: {exc}")
    
    return session.google_access_token

async def ensure_wikimedia_token(db: AsyncSession, session: UserSession) -> str:
    """
    Ensure the session's Wikimedia access token is valid.
    If it is close to expiration and a refresh token exists, refresh it.
    """
    if not session.wikimedia_access_token:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Wikimedia account not connected")

    now = datetime.datetime.utcnow()
    is_expired = (
        not session.wikimedia_token_expiry or 
        session.wikimedia_token_expiry <= now + datetime.timedelta(minutes=5)
    )

    if is_expired:
        if not session.wikimedia_refresh_token:
            # If no refresh token exists, just return the current token and let it fail downstream
            return session.wikimedia_access_token

        # Refresh the token
        import httpx
        from app.config import settings
        
        token_url = "https://commons.wikimedia.org/w/rest.php/oauth2/access_token"
        refresh_data = {
            "client_id": settings.wikimedia_client_id,
            "client_secret": settings.wikimedia_client_secret,
            "refresh_token": session.wikimedia_refresh_token,
            "grant_type": "refresh_token"
        }
        
        headers = {
            "User-Agent": "WikimediaCommonsBridge/1.0 (https://github.com/anu/wikimedia-commons-bridge; mailto:info@covai.org)"
        }

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(token_url, data=refresh_data, headers=headers)
                if resp.status_code != 200:
                    # Do not raise 401 directly here as Wikimedia's refresh token might be optional
                    return session.wikimedia_access_token

                tokens = resp.json()
                new_access_token = tokens.get("access_token")
                expires_in = tokens.get("expires_in", 3600)
                
                # Update tokens in database
                await update_wikimedia_session_tokens(
                    db=db,
                    session_id=session.session_id,
                    access_token=new_access_token,
                    expires_in=expires_in,
                    username=session.wikimedia_username
                )
                return new_access_token
            except httpx.RequestError:
                return session.wikimedia_access_token
                
    return session.wikimedia_access_token

