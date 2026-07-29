from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings

# Determine if we are using SQLite or MySQL/MariaDB
# sqlite+aiosqlite doesn't support pool_recycle or pool_pre_ping in the same way as MySQL,
# so we configure base engine options accordingly.
connect_args = {}
if settings.database_url.startswith("sqlite"):
    # SQLite requires setting check_same_thread to False for multithreaded environments
    connect_args["check_same_thread"] = False
elif "mysql" in settings.database_url or "mariadb" in settings.database_url:
    connect_args["ssl"] = False

engine = create_async_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

_db_initialized = False

async def get_db() -> AsyncSession:
    """Dependency to retrieve the database session."""
    global _db_initialized
    if not _db_initialized:
        from app.models.session import UserSession  # Ensure models are registered
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        _db_initialized = True

    async with AsyncSessionLocal() as session:
        yield session
