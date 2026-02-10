"""
Database models for service tracking and history.
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, JSON, Boolean, ForeignKey, Index
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()


class Service(Base):
    """Main service record with current information."""
    __tablename__ = 'services'

    id = Column(Integer, primary_key=True)

    # Service identification
    service_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False)
    category = Column(String(255), nullable=False, index=True)

    # Core information
    description = Column(Text)
    location = Column(String(500), default='Alberta')
    contact = Column(Text)  # Phone, email, website (combined for display)
    eligibility = Column(Text)

    # Normalized contact fields (extracted from contact for search)
    phone = Column(String(100))  # Primary phone number
    email = Column(String(255))  # Primary email address
    address = Column(Text)  # Physical address

    # Process and requirements
    process_steps = Column(JSON)  # Array of process steps
    wait_times = Column(String(255))
    required_docs = Column(JSON)  # Array of required documents

    # Operational details
    hours_of_operation = Column(String(500))
    languages_supported = Column(JSON)  # Array of languages
    service_format = Column(String(100))  # virtual, in-person, hybrid

    # URLs and external links
    website_url = Column(Text)

    # Data quality
    confidence_score = Column(Integer, default=100)  # 0-100, data reliability

    # Tracking
    is_active = Column(Boolean, default=True)
    last_checked = Column(DateTime, default=func.now(), onupdate=func.now())
    last_updated = Column(DateTime, default=func.now())

    # Metadata
    tags = Column(JSON)  # Array of tags for search

    # Category columns still in use
    gender_restriction = Column(String(50))  # women_only, men_only, all
    is_24_7 = Column(Boolean, default=False)

    # Indexes for common queries
    __table_args__ = (
        Index('idx_service_category', 'category'),
        Index('idx_service_active', 'is_active'),
        Index('idx_service_last_checked', 'last_checked'),
        Index('idx_gender_restriction', 'gender_restriction'),
        Index('idx_is_24_7', 'is_24_7'),
    )


class ServiceHistory(Base):
    """Historical record of service changes."""
    __tablename__ = 'service_history'

    id = Column(Integer, primary_key=True)
    service_id = Column(String(255), ForeignKey('services.service_id'), nullable=False, index=True)

    # Snapshot of data at this point in time
    name = Column(String(500), nullable=False)
    category = Column(String(255), nullable=False)
    description = Column(Text)
    location = Column(String(500))
    contact = Column(Text)
    eligibility = Column(Text)
    process_steps = Column(JSON)
    wait_times = Column(String(255))
    required_docs = Column(JSON)
    hours_of_operation = Column(String(500))
    languages_supported = Column(JSON)
    service_format = Column(String(100))
    website_url = Column(Text)

    # Change tracking
    changed_fields = Column(JSON)  # Array of field names that changed
    change_type = Column(String(50))  # 'created', 'updated', 'deactivated'

    # Metadata
    recorded_at = Column(DateTime, default=func.now(), index=True)
    confidence_score = Column(Integer, default=100)

    __table_args__ = (
        Index('idx_history_service_recorded', 'service_id', 'recorded_at'),
    )


class ScraperLog(Base):
    """Log of scraper runs."""
    __tablename__ = 'scraper_logs'

    id = Column(Integer, primary_key=True)
    run_id = Column(String(100), unique=True, nullable=False, index=True)

    # Run details
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)
    status = Column(String(50))  # 'running', 'completed', 'failed', 'partial'

    # Statistics
    services_checked = Column(Integer, default=0)
    services_updated = Column(Integer, default=0)
    services_created = Column(Integer, default=0)
    services_deactivated = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)

    # Error tracking
    errors = Column(JSON)  # Array of error messages

    # Performance
    duration_seconds = Column(Integer)

    __table_args__ = (
        Index('idx_scraper_log_started', 'started_at'),
    )
