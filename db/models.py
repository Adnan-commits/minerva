from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "jobs"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    request_id       = Column(String, unique=True, nullable=False, index=True)
    job_type         = Column(String, nullable=False)          # "scrape" or "pdf"
    input            = Column(String, nullable=False)          # url or file path
    status           = Column(String, nullable=False)          # "success" or "failed"
    failure_reason   = Column(String, nullable=True)
    strategy_used    = Column(String, nullable=True)           # density_scoring, listing_fallback
    word_count       = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)