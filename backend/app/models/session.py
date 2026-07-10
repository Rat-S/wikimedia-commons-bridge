import datetime
from sqlalchemy import Column, String, Text, DateTime
from app.database import Base

class UserSession(Base):
    __tablename__ = "user_sessions"

    session_id = Column(String(36), primary_key=True, index=True)
    
    # Google OAuth
    google_access_token = Column(Text, nullable=True)
    google_refresh_token = Column(Text, nullable=True)
    google_token_expiry = Column(DateTime, nullable=True)

    # Wikimedia OAuth
    wikimedia_access_token = Column(Text, nullable=True)
    wikimedia_refresh_token = Column(Text, nullable=True)
    wikimedia_token_expiry = Column(DateTime, nullable=True)
    wikimedia_username = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
