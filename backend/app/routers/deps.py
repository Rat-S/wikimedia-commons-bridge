import uuid
from fastapi import Request, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.session import get_user_session, create_user_session
from app.models.session import UserSession

async def get_session_id(request: Request, response: Response) -> str:
    """Retrieve session_id from cookie or generate a new one if not present."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        is_secure = request.url.scheme == "https"
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            secure=is_secure,
            samesite="lax",
            max_age=3600 * 24 * 7  # 7 days
        )
    return session_id

async def get_current_session(
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_db)
) -> UserSession:
    """Retrieve the UserSession object from the database, creating it if it doesn't exist."""
    session = await get_user_session(db, session_id)
    if not session:
        # Create empty database entry for this session_id
        session = await create_user_session(db, session_id)
    return session
