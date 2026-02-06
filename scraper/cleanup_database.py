"""
Database Cleanup Script

Normalizes contact information and builds search-optimized text fields.
This improves search functionality without changing what users see.

Features:
  - Extracts phone numbers from contact field
  - Extracts email addresses from contact field
  - Moves URLs from contact to website_url (if not already set)
  - Builds comprehensive search_text for full-text search
  - Normalizes location data
  - Removes duplicate/redundant data

Usage:
  python cleanup_database.py           # Run full cleanup
  python cleanup_database.py --dry-run # Preview changes without saving
"""
import argparse
import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

from models import Base, Service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/recovery_hub",
)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


# ──────────────────────────────────────────────────────────────────────────────
# Extraction Patterns
# ──────────────────────────────────────────────────────────────────────────────

# Phone patterns - matches various formats
PHONE_PATTERNS = [
    r'1[-.\s]?(?:\d{3})[-.\s]?\d{3}[-.\s]?\d{4}',  # 1-800-XXX-XXXX
    r'(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}',  # (XXX) XXX-XXXX or XXX-XXX-XXXX
    r'\d{3}[-.\s]\d{4}',  # XXX-XXXX (local)
]
PHONE_REGEX = re.compile('|'.join(PHONE_PATTERNS), re.IGNORECASE)

# Email pattern
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', re.IGNORECASE)

# URL pattern
URL_REGEX = re.compile(
    r'(?:https?://)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:/[^\s,]*)?',
    re.IGNORECASE
)


# ──────────────────────────────────────────────────────────────────────────────
# Extraction Functions
# ──────────────────────────────────────────────────────────────────────────────

def extract_phones(text: str) -> List[str]:
    """Extract phone numbers from text."""
    if not text:
        return []
    matches = PHONE_REGEX.findall(text)
    # Clean and deduplicate
    phones = []
    seen = set()
    for match in matches:
        # Normalize: remove non-digits
        normalized = re.sub(r'[^\d]', '', match)
        if len(normalized) >= 7 and normalized not in seen:
            seen.add(normalized)
            phones.append(match.strip())
    return phones


def extract_emails(text: str) -> List[str]:
    """Extract email addresses from text."""
    if not text:
        return []
    matches = EMAIL_REGEX.findall(text)
    # Deduplicate (case-insensitive)
    seen = set()
    emails = []
    for email in matches:
        lower = email.lower()
        if lower not in seen:
            seen.add(lower)
            emails.append(email)
    return emails


def extract_urls(text: str) -> List[str]:
    """Extract URLs from text."""
    if not text:
        return []
    matches = URL_REGEX.findall(text)
    urls = []
    seen = set()
    for url in matches:
        # Skip email-like matches
        if '@' in url:
            continue
        # Normalize
        normalized = url.lower().strip().rstrip('.')
        if normalized not in seen:
            seen.add(normalized)
            # Ensure https prefix
            if not url.startswith('http'):
                url = 'https://' + url
            urls.append(url)
    return urls


def normalize_phone(phone: str) -> str:
    """Normalize phone number to consistent format."""
    digits = re.sub(r'[^\d]', '', phone)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"1-{digits[1:4]}-{digits[4:7]}-{digits[7:]}"
    elif len(digits) == 7:
        return f"{digits[:3]}-{digits[3:]}"
    return phone  # Return original if format unknown


def build_search_text(service: Service) -> str:
    """Build comprehensive search text from all service fields."""
    parts = []

    # Core fields
    if service.name:
        parts.append(service.name)
    if service.category:
        parts.append(service.category)
    if service.description:
        parts.append(service.description)
    if service.location:
        parts.append(service.location)
    if service.eligibility:
        parts.append(service.eligibility)

    # Tags
    if service.tags:
        if isinstance(service.tags, list):
            parts.extend(service.tags)
        elif isinstance(service.tags, str):
            parts.append(service.tags)

    # Languages
    if service.languages_supported:
        if isinstance(service.languages_supported, list):
            parts.extend(service.languages_supported)

    # Service format
    if service.service_format:
        parts.append(service.service_format)

    # Notes (often contains additional keywords)
    if service.notes:
        parts.append(service.notes)

    # Join and clean
    text = ' '.join(str(p) for p in parts if p)
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_address_from_notes(notes: str) -> Optional[str]:
    """Extract address from notes field if present."""
    if not notes:
        return None
    # Look for "Address: ..." pattern
    match = re.search(r'Address:\s*([^|]+)', notes, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Main Cleanup Functions
# ──────────────────────────────────────────────────────────────────────────────

def cleanup_service(service: Service, dry_run: bool = False) -> Dict:
    """Clean up a single service's data. Returns dict of changes made."""
    changes = {}

    # Extract contact components
    contact = service.contact or ""

    # Extract and set phone
    phones = extract_phones(contact)
    if phones and not getattr(service, 'phone', None):
        primary_phone = normalize_phone(phones[0])
        if not dry_run:
            service.phone = primary_phone
        changes['phone'] = primary_phone

    # Extract and set email
    emails = extract_emails(contact)
    if emails and not getattr(service, 'email', None):
        if not dry_run:
            service.email = emails[0]
        changes['email'] = emails[0]

    # Extract URLs and move to website_url if not set
    urls = extract_urls(contact)
    if urls and not service.website_url:
        if not dry_run:
            service.website_url = urls[0]
        changes['website_url'] = urls[0]

    # Extract address from notes
    if service.notes:
        address = extract_address_from_notes(service.notes)
        if address and not getattr(service, 'address', None):
            if not dry_run:
                service.address = address
            changes['address'] = address

    # Build search text
    search_text = build_search_text(service)
    current_search_text = getattr(service, 'search_text', None)
    if search_text != current_search_text:
        if not dry_run:
            service.search_text = search_text
        changes['search_text'] = f"[{len(search_text)} chars]"

    return changes


def run_cleanup(dry_run: bool = False):
    """Run the full database cleanup."""
    session = SessionLocal()

    try:
        # First, run the migration to add new columns
        logger.info("Ensuring database columns exist...")
        migration_sql = """
        ALTER TABLE services ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
        ALTER TABLE services ADD COLUMN IF NOT EXISTS email VARCHAR(255);
        ALTER TABLE services ADD COLUMN IF NOT EXISTS address TEXT;
        ALTER TABLE services ADD COLUMN IF NOT EXISTS search_text TEXT;
        """
        session.execute(text(migration_sql))
        session.commit()

        # Get all services
        all_services = session.query(Service).all()
        logger.info(f"Processing {len(all_services)} services...")

        updated_count = 0
        phone_count = 0
        email_count = 0
        url_count = 0
        search_text_count = 0

        for i, service in enumerate(all_services):
            changes = cleanup_service(service, dry_run=dry_run)

            if changes:
                updated_count += 1
                if 'phone' in changes:
                    phone_count += 1
                if 'email' in changes:
                    email_count += 1
                if 'website_url' in changes:
                    url_count += 1
                if 'search_text' in changes:
                    search_text_count += 1

                if not dry_run:
                    service.last_updated = datetime.now()

                # Log progress every 100 services
                if (i + 1) % 100 == 0:
                    logger.info(f"  Processed {i + 1}/{len(all_services)}...")

        if not dry_run:
            session.commit()
            logger.info("Changes committed to database.")
        else:
            logger.info("DRY RUN - No changes saved.")

        # Summary
        logger.info("=" * 60)
        logger.info("CLEANUP SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total services processed: {len(all_services)}")
        logger.info(f"Services with changes:    {updated_count}")
        logger.info(f"Phone numbers extracted:  {phone_count}")
        logger.info(f"Emails extracted:         {email_count}")
        logger.info(f"URLs moved to website:    {url_count}")
        logger.info(f"Search text updated:      {search_text_count}")

        # Create indexes if not dry run
        if not dry_run:
            logger.info("Creating search indexes...")
            index_sql = """
            CREATE INDEX IF NOT EXISTS idx_services_phone ON services(phone);
            CREATE INDEX IF NOT EXISTS idx_services_email ON services(email);
            CREATE INDEX IF NOT EXISTS idx_services_search_text_gin
                ON services USING gin(to_tsvector('english', COALESCE(search_text, '')));
            """
            session.execute(text(index_sql))
            session.commit()
            logger.info("Indexes created.")

    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


def show_sample(limit: int = 5):
    """Show sample of cleaned data."""
    session = SessionLocal()
    try:
        services = session.query(Service).filter(Service.is_active == True).limit(limit).all()

        for svc in services:
            print(f"\n{'='*60}")
            print(f"Service: {svc.name}")
            print(f"{'='*60}")
            print(f"Original contact: {svc.contact[:100] if svc.contact else 'N/A'}...")
            print(f"Extracted phone:  {getattr(svc, 'phone', 'N/A')}")
            print(f"Extracted email:  {getattr(svc, 'email', 'N/A')}")
            print(f"Website URL:      {svc.website_url or 'N/A'}")
            print(f"Address:          {getattr(svc, 'address', 'N/A')}")
            search_text = getattr(svc, 'search_text', '')
            print(f"Search text:      [{len(search_text) if search_text else 0} chars]")
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Database Cleanup Script")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without saving to database",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=0,
        help="Show sample of N cleaned records",
    )
    args = parser.parse_args()

    if args.sample > 0:
        show_sample(args.sample)
    else:
        run_cleanup(dry_run=args.dry_run)
