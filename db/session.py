from typing import Generator                    # <‑‑ import the right typing helper
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session  # <‑‑ Session type for the annotation
from db.models import Base

DATABASE_URL = "sqlite:///./mcp_gateway.db"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

def init_db():
    """Create all tables if they don't exist. Called once on app startup."""
    Base.metadata.create_all(bind=engine)

def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session and ensures it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()