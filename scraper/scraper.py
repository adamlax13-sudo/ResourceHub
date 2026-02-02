"""
Web scraper for Alberta mental health and social services.
Runs monthly to keep service information up-to-date.
"""
import os
import json
import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
import time
import uuid

import requests
from bs4 import BeautifulSoup
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from dotenv import load_dotenv

load_dotenv()  # Load .env file

from models import Base, Service, ServiceHistory, ScraperLog

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://user:password@localhost:5432/recovery_hub'
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


class ServiceScraper:
    """Scraper for service information."""

    def __init__(self, session):
        self.session = session
        self.run_id = str(uuid.uuid4())[:8]
        self.log = ScraperLog(run_id=self.run_id, status='running')
        session.add(self.log)
        session.commit()

    def scrape_service(self, service_data: Dict) -> Optional[Dict]:
        """
        Scrape a single service for updated information.

        Args:
            service_data: Dictionary with service info from reference database

        Returns:
            Dictionary with scraped data or None if scraping failed
        """
        try:
            # Extract contact info to find scrapable URLs
            contact = service_data.get('contact', '')
            urls = self._extract_urls(contact)

            if not urls:
                # No URL to scrape, return original data
                logger.info(f"No URL found for {service_data['name']}")
                return service_data

            # Try to scrape the first valid URL
            primary_url = urls[0]
            logger.info(f"Scraping {service_data['name']} from {primary_url}")

            scraped_data = self._scrape_website(primary_url, service_data)

            # Merge scraped data with original data
            if scraped_data:
                return {**service_data, **scraped_data, 'website_url': primary_url}

            return service_data

        except Exception as e:
            logger.error(f"Error scraping {service_data.get('name', 'Unknown')}: {e}")
            self.log.errors_count += 1
            return service_data

    def _extract_urls(self, text: str) -> List[str]:
        """Extract URLs from text."""
        import re
        url_pattern = r'https?://[^\s,]+'
        domain_pattern = r'[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:/[^\s,]*)?'

        urls = re.findall(url_pattern, text)
        domains = re.findall(domain_pattern, text)

        # Add http:// to bare domains
        for domain in domains:
            if not domain.startswith('http'):
                urls.append(f'https://{domain}')

        return list(set(urls))  # Remove duplicates

    def _scrape_website(self, url: str, original_data: Dict) -> Dict:
        """
        Scrape website for service information.

        Args:
            url: Website URL
            original_data: Original service data for context

        Returns:
            Dictionary with scraped data
        """
        try:
            # Set headers to avoid being blocked
            headers = {
                'User-Agent': 'Mozilla/5.0 (compatible; ServiceBot/1.0; +http://recoveryoncampusalberta.ca)',
            }

            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Extract data using heuristics
            scraped = {
                'data_source': url,
                'last_scraped': datetime.now().isoformat(),
            }

            # Try to find contact information
            contact_info = self._extract_contact_info(soup, url)
            if contact_info:
                scraped['contact'] = contact_info

            # Try to find hours
            hours = self._extract_hours(soup)
            if hours:
                scraped['hours_of_operation'] = hours

            # Try to find description
            description = self._extract_description(soup, original_data.get('name', ''))
            if description:
                scraped['description'] = description

            return scraped

        except requests.RequestException as e:
            logger.warning(f"Failed to scrape {url}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error scraping {url}: {e}")
            return {}

    def _extract_contact_info(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        """Extract contact information from page."""
        contact_parts = []

        # Look for phone numbers
        import re
        text = soup.get_text()
        phone_pattern = r'\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        phones = re.findall(phone_pattern, text)
        if phones:
            contact_parts.append(f"Phone: {phones[0]}")

        # Look for email addresses
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, text)
        if emails:
            contact_parts.append(f"Email: {emails[0]}")

        # Add website
        contact_parts.append(f"Website: {base_url}")

        return ' | '.join(contact_parts) if contact_parts else None

    def _extract_hours(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract hours of operation."""
        # Look for common hours patterns
        import re
        text = soup.get_text()

        # Pattern for hours like "Mon-Fri 9am-5pm"
        hours_patterns = [
            r'(?:Mon|Monday).*?(?:Fri|Friday).*?\d{1,2}(?:am|pm).*?\d{1,2}(?:am|pm)',
            r'\d{1,2}(?:am|pm).*?(?:to|-)\s*\d{1,2}(?:am|pm)',
        ]

        for pattern in hours_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)

        return None

    def _extract_description(self, soup: BeautifulSoup, service_name: str) -> Optional[str]:
        """Extract service description."""
        # Look for meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            return meta_desc['content']

        # Look for first paragraph
        paragraphs = soup.find_all('p')
        for p in paragraphs[:5]:  # Check first 5 paragraphs
            text = p.get_text().strip()
            if len(text) > 50 and service_name.lower() in text.lower():
                return text

        return None


def generate_service_id(name: str, location: str = '') -> str:
    """Generate a unique service ID from name and location."""
    text = f"{name.lower()}-{location.lower()}".strip()
    # Remove special characters
    import re
    text = re.sub(r'[^a-z0-9-]', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:255]


def calculate_data_hash(service_data: Dict) -> str:
    """Calculate hash of service data for change detection."""
    # Only include fields that matter for change detection
    relevant_fields = [
        'name', 'description', 'location', 'contact',
        'eligibility', 'process_steps', 'wait_times',
        'required_docs', 'hours_of_operation'
    ]

    data_to_hash = {k: v for k, v in service_data.items() if k in relevant_fields}
    data_str = json.dumps(data_to_hash, sort_keys=True)
    return hashlib.md5(data_str.encode()).hexdigest()


def detect_changes(old_data: Dict, new_data: Dict) -> Tuple[bool, List[str]]:
    """
    Detect what fields changed between old and new data.

    Returns:
        Tuple of (has_changes, list_of_changed_fields)
    """
    tracked_fields = [
        'name', 'description', 'location', 'contact',
        'eligibility', 'process_steps', 'wait_times',
        'required_docs', 'hours_of_operation'
    ]

    changed_fields = []
    for field in tracked_fields:
        old_val = old_data.get(field)
        new_val = new_data.get(field)

        # Normalize for comparison
        if isinstance(old_val, list):
            old_val = sorted(old_val) if old_val else []
        if isinstance(new_val, list):
            new_val = sorted(new_val) if new_val else []

        if old_val != new_val:
            changed_fields.append(field)

    return len(changed_fields) > 0, changed_fields


def sync_service_data(
    service_data: Dict,
    session,
    scraper: Optional[ServiceScraper] = None
) -> str:
    """
    Sync service data to database.

    Compares with existing data, creates history entries for changes,
    and updates last_checked timestamp.

    Args:
        service_data: Dictionary with service information
        session: SQLAlchemy session
        scraper: ServiceScraper instance for tracking

    Returns:
        Action taken: 'created', 'updated', 'unchanged'
    """
    try:
        # Generate service ID
        service_id = generate_service_id(
            service_data['name'],
            service_data.get('location', '')
        )

        # Check if service exists
        existing = session.query(Service).filter_by(service_id=service_id).first()

        if not existing:
            # Create new service
            new_service = Service(
                service_id=service_id,
                name=service_data['name'],
                category=service_data.get('category', 'Unknown'),
                description=service_data.get('description'),
                location=service_data.get('location'),
                contact=service_data.get('contact'),
                eligibility=service_data.get('eligibility'),
                process_steps=service_data.get('process', []),
                wait_times=service_data.get('waitTimes'),
                required_docs=service_data.get('requiredDocs', []),
                hours_of_operation=service_data.get('hours_of_operation'),
                website_url=service_data.get('website_url'),
                data_source=service_data.get('data_source', 'manual'),
            )

            session.add(new_service)

            # Create history entry
            history = ServiceHistory(
                service_id=service_id,
                name=new_service.name,
                category=new_service.category,
                description=new_service.description,
                location=new_service.location,
                contact=new_service.contact,
                eligibility=new_service.eligibility,
                process_steps=new_service.process_steps,
                wait_times=new_service.wait_times,
                required_docs=new_service.required_docs,
                hours_of_operation=new_service.hours_of_operation,
                website_url=new_service.website_url,
                change_type='created',
                changed_fields=['all'],
                data_source=new_service.data_source,
            )
            session.add(history)

            if scraper:
                scraper.log.services_created += 1

            logger.info(f"Created new service: {service_data['name']}")
            return 'created'

        # Compare with existing data
        old_data = {
            'name': existing.name,
            'description': existing.description,
            'location': existing.location,
            'contact': existing.contact,
            'eligibility': existing.eligibility,
            'process_steps': existing.process_steps,
            'wait_times': existing.wait_times,
            'required_docs': existing.required_docs,
            'hours_of_operation': existing.hours_of_operation,
        }

        new_data = {
            'name': service_data['name'],
            'description': service_data.get('description'),
            'location': service_data.get('location'),
            'contact': service_data.get('contact'),
            'eligibility': service_data.get('eligibility'),
            'process_steps': service_data.get('process', []),
            'wait_times': service_data.get('waitTimes'),
            'required_docs': service_data.get('requiredDocs', []),
            'hours_of_operation': service_data.get('hours_of_operation'),
        }

        has_changes, changed_fields = detect_changes(old_data, new_data)

        # Update last_checked timestamp always
        existing.last_checked = datetime.now()

        if has_changes:
            # Update service with new data
            existing.name = new_data['name']
            existing.description = new_data['description']
            existing.location = new_data['location']
            existing.contact = new_data['contact']
            existing.eligibility = new_data['eligibility']
            existing.process_steps = new_data['process_steps']
            existing.wait_times = new_data['wait_times']
            existing.required_docs = new_data['required_docs']
            existing.hours_of_operation = new_data['hours_of_operation']
            existing.last_updated = datetime.now()

            if service_data.get('website_url'):
                existing.website_url = service_data['website_url']
            if service_data.get('data_source'):
                existing.data_source = service_data['data_source']

            # Create history entry
            history = ServiceHistory(
                service_id=service_id,
                name=existing.name,
                category=existing.category,
                description=existing.description,
                location=existing.location,
                contact=existing.contact,
                eligibility=existing.eligibility,
                process_steps=existing.process_steps,
                wait_times=existing.wait_times,
                required_docs=existing.required_docs,
                hours_of_operation=existing.hours_of_operation,
                website_url=existing.website_url,
                change_type='updated',
                changed_fields=changed_fields,
                data_source=existing.data_source,
            )
            session.add(history)

            if scraper:
                scraper.log.services_updated += 1

            logger.info(f"Updated service: {service_data['name']} (changed: {', '.join(changed_fields)})")
            return 'updated'

        logger.debug(f"No changes for service: {service_data['name']}")
        return 'unchanged'

    except Exception as e:
        logger.error(f"Error syncing service {service_data.get('name', 'Unknown')}: {e}")
        if scraper:
            scraper.log.errors_count += 1
        raise


def run_scraper():
    """Main scraper function - run this on cron schedule."""
    start_time = time.time()
    session = SessionLocal()

    try:
        logger.info("Starting scraper run")

        scraper = ServiceScraper(session)

        # Load reference data from your routes.ts file
        # For now, we'll create a sample - you should import from your actual data
        from reference_data import load_alberta_services
        services_data = load_alberta_services()

        scraper.log.services_checked = len(services_data)

        for service_data in services_data:
            try:
                # Scrape for updates
                updated_data = scraper.scrape_service(service_data)

                # Sync to database
                sync_service_data(updated_data, session, scraper)

                session.commit()

                # Be polite - delay between requests
                time.sleep(1)

            except Exception as e:
                logger.error(f"Error processing service: {e}")
                session.rollback()
                continue

        # Update log
        scraper.log.status = 'completed'
        scraper.log.completed_at = datetime.now()
        scraper.log.duration_seconds = int(time.time() - start_time)
        session.commit()

        logger.info(
            f"Scraper completed: {scraper.log.services_checked} checked, "
            f"{scraper.log.services_created} created, "
            f"{scraper.log.services_updated} updated, "
            f"{scraper.log.errors_count} errors"
        )

    except Exception as e:
        logger.error(f"Scraper run failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


def init_database():
    """Initialize database tables."""
    logger.info("Initializing database...")
    Base.metadata.create_all(engine)
    logger.info("Database initialized successfully")


if __name__ == '__main__':
    # Initialize database if needed
    init_database()

    # Run scraper
    run_scraper()
