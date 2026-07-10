from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional

class Settings(BaseSettings):
    # Google OAuth credentials
    google_client_id: str = Field(default="", validation_alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", validation_alias="GOOGLE_CLIENT_SECRET")
    
    # Optional domain verification
    google_site_verification_filename: Optional[str] = Field(default=None, validation_alias="GOOGLE_SITE_VERIFICATION_FILENAME")
    google_site_verification_code: Optional[str] = Field(default=None, validation_alias="GOOGLE_SITE_VERIFICATION_CODE")

    # Wikimedia OAuth credentials
    wikimedia_client_id: str = Field(default="", validation_alias="WIKIMEDIA_CLIENT_ID")
    wikimedia_client_secret: str = Field(default="", validation_alias="WIKIMEDIA_CLIENT_SECRET")
    mock_wikimedia: bool = Field(default=False, validation_alias="MOCK_WIKIMEDIA")

    # App Settings
    base_url: str = Field(default="http://localhost:8000", validation_alias="BASE_URL")
    frontend_url: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_URL")
    session_secret_key: str = Field(default="development-only-secret-key-change-in-production", validation_alias="SESSION_SECRET_KEY")

    # Database URL
    database_url: str = Field(default="sqlite+aiosqlite:///./sessions.db", validation_alias="DATABASE_URL")

    # Pydantic Configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
