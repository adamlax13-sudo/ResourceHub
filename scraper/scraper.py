"""
Web scraper for Alberta mental health and social services.
Runs monthly to keep service information up-to-date.
Uses OpenAI web search to find missing service websites and
AI-powered extraction to populate database fields.
"""
import os
import re
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

# Try to import OpenAI for AI-powered enrichment
try:
    from openai import OpenAI as OpenAIClient
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

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
    """Scraper for service information with AI-powered enrichment."""

    def __init__(self, session):
        self.session = session
        self.run_id = str(uuid.uuid4())[:8]
        self.log = ScraperLog(run_id=self.run_id, status='running')
        session.add(self.log)
        session.commit()
        self.openai_client = None
        self._init_openai()

    def _init_openai(self):
        """Initialize OpenAI client for web search and AI enrichment."""
        if not HAS_OPENAI:
            logger.warning("openai package not installed - AI enrichment disabled")
            return

        api_key = os.getenv('AI_INTEGRATIONS_OPENAI_API_KEY')
        if not api_key:
            logger.warning("AI_INTEGRATIONS_OPENAI_API_KEY not set - AI enrichment disabled")
            return

        try:
            kwargs = {'api_key': api_key}
            base_url = os.getenv('AI_INTEGRATIONS_OPENAI_BASE_URL')
            if base_url:
                kwargs['base_url'] = base_url
            self.openai_client = OpenAIClient(**kwargs)
            logger.info("OpenAI client initialized for AI enrichment")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")

    def scrape_service(self, service_data: Dict, existing_url: Optional[str] = None) -> Optional[Dict]:
        """
        Scrape a single service for updated information.

        Args:
            service_data: Dictionary with service info from reference database
            existing_url: URL already stored in database for this service

        Returns:
            Dictionary with scraped data or None if scraping failed
        """
        try:
            # Extract contact info to find scrapable URLs
            contact = service_data.get('contact', '')
            urls = self._extract_urls(contact)

            # Use existing URL from database if no URL in contact field
            if not urls and existing_url:
                urls = [existing_url]
                logger.info(f"Using existing DB URL for {service_data['name']}: {existing_url}")

            # Use OpenAI web search to find website if still no URL
            if not urls and self.openai_client:
                found_url = self._find_website_with_ai(service_data)
                if found_url:
                    urls = [found_url]
                    logger.info(f"AI found URL for {service_data['name']}: {found_url}")

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

            return {**service_data, 'website_url': primary_url}

        except Exception as e:
            logger.error(f"Error scraping {service_data.get('name', 'Unknown')}: {e}")
            self.log.errors_count += 1
            return service_data

    def _extract_urls(self, text: str) -> List[str]:
        """Extract URLs from text."""
        url_pattern = r'https?://[^\s,]+'
        domain_pattern = r'[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:/[^\s,]*)?'

        urls = re.findall(url_pattern, text)
        domains = re.findall(domain_pattern, text)

        # Add http:// to bare domains
        for domain in domains:
            if not domain.startswith('http'):
                urls.append(f'https://{domain}')

        return list(set(urls))  # Remove duplicates

    def _find_website_with_ai(self, service_data: Dict) -> Optional[str]:
        """
        Use OpenAI web search to find a service's official website.

        Args:
            service_data: Dictionary with service info

        Returns:
            URL string if found, None otherwise
        """
        if not self.openai_client:
            return None

        name = service_data.get('name', '')
        location = service_data.get('location', 'Alberta, Canada')
        category = service_data.get('category', 'social service')

        try:
            response = self.openai_client.responses.create(
                model="gpt-4o-mini",
                tools=[{"type": "web_search"}],
                input=(
                    f'Find the official website URL for "{name}" located in {location}. '
                    f'This is a {category} organization in Alberta, Canada. '
                    f'Return ONLY the main website URL, nothing else. '
                    f'If you cannot find it, respond with "NOT_FOUND".'
                ),
            )

            result_text = response.output_text.strip()

            if 'NOT_FOUND' in result_text:
                logger.info(f"AI could not find website for {name}")
                return None

            # Extract URL from the response text
            found_urls = re.findall(r'https?://[^\s\)\]"\'<>,]+', result_text)
            if found_urls:
                url = found_urls[0].rstrip('.')
                logger.info(f"AI web search found: {url} for {name}")
                return url

            logger.info(f"AI response did not contain a URL for {name}")
            return None

        except Exception as e:
            logger.error(f"AI web search failed for {name}: {e}")
            return None

    def _scrape_website(self, url: str, original_data: Dict) -> Dict:
        """
        Scrape website for service information with optional AI enrichment.

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

            # Base scraped data
            scraped = {
                'data_source': url,
                'last_scraped': datetime.now().isoformat(),
            }

            # Try AI-powered extraction first (much better results)
            if self.openai_client:
                page_text = self._extract_page_text(soup)
                if page_text:
                    ai_data = self._enrich_with_ai(page_text, original_data)
                    if ai_data:
                        scraped.update(ai_data)
                        return scraped

            # Fallback to basic regex extraction if AI is unavailable
            contact_info = self._extract_contact_info(soup, url)
            if contact_info:
                scraped['contact'] = contact_info

            hours = self._extract_hours(soup)
            if hours:
                scraped['hours_of_operation'] = hours

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

    def _extract_page_text(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract clean text content from a page for AI processing."""
        # Remove script and style elements
        for element in soup(['script', 'style', 'nav', 'footer', 'header']):
            element.decompose()

        text = soup.get_text(separator=' ', strip=True)

        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)

        # Limit to ~4000 chars to stay within token limits
        if len(text) > 4000:
            text = text[:4000]

        return text if len(text) > 100 else None

    def _enrich_with_ai(self, page_text: str, service_data: Dict) -> Optional[Dict]:
        """
        Use OpenAI to extract structured service data from webpage text.

        Only extracts supplemental fields that aren't already well-populated
        in the reference data (service_format, languages, booking_url, tags).
        Also extracts an updated description and hours if the website has
        better information.

        Args:
            page_text: Clean text from the scraped webpage
            service_data: Original service data for context

        Returns:
            Dictionary with extracted fields, or None if extraction failed
        """
        if not self.openai_client:
            return None

        name = service_data.get('name', '')
        category = service_data.get('category', '')

        try:
            completion = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a data extraction assistant. Given webpage content from an Alberta "
                            "service organization, extract structured information. Return a JSON object with "
                            "ONLY the fields where you found clear, reliable information on the page. "
                            "Use null for any field where the information is not clearly available.\n\n"
                            "Fields to extract:\n"
                            '- "description": A clear 2-3 sentence description of what this service provides (only if the page has good info)\n'
                            '- "hours_of_operation": Current hours (e.g., "Mon-Fri 9am-5pm", "24/7"). Only if clearly stated.\n'
                            '- "service_format": One of "in-person", "virtual", "hybrid", or null\n'
                            '- "languages_supported": Array of languages offered (e.g., ["English", "French"]). Only if mentioned.\n'
                            '- "booking_url": Direct URL for booking/referral/intake if different from main page, or null\n'
                            '- "tags": Array of 5-10 relevant search keywords for this service\n\n'
                            "Rules:\n"
                            "- Only include data you are confident about from the webpage\n"
                            "- Do NOT guess or fabricate information\n"
                            "- For tags, generate keywords based on the service type, target population, and treatments offered"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Service: {name}\n"
                            f"Category: {category}\n\n"
                            f"Webpage content:\n{page_text}"
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            result = json.loads(completion.choices[0].message.content)

            # Build enrichment dict with only non-null values
            enriched = {}

            if result.get('description'):
                enriched['description'] = result['description']
            if result.get('hours_of_operation'):
                enriched['hours_of_operation'] = result['hours_of_operation']
            if result.get('service_format'):
                enriched['service_format'] = result['service_format']
            if result.get('languages_supported'):
                enriched['languages_supported'] = result['languages_supported']
            if result.get('booking_url'):
                enriched['booking_url'] = result['booking_url']
            if result.get('tags'):
                enriched['tags'] = result['tags']

            if enriched:
                logger.info(f"AI enriched {name} with fields: {list(enriched.keys())}")

            return enriched if enriched else None

        except Exception as e:
            logger.error(f"AI enrichment failed for {name}: {e}")
            return None

    def _extract_contact_info(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        """Extract contact information from page."""
        contact_parts = []

        # Look for phone numbers
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
        text = soup.get_text()

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
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            return meta_desc['content']

        paragraphs = soup.find_all('p')
        for p in paragraphs[:5]:
            text = p.get_text().strip()
            if len(text) > 50 and service_name.lower() in text.lower():
                return text

        return None


def generate_service_id(name: str, location: str = '') -> str:
    """Generate a unique service ID from name and location."""
    text = f"{name.lower()}-{location.lower()}".strip()
    text = re.sub(r'[^a-z0-9-]', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:255]


def calculate_data_hash(service_data: Dict) -> str:
    """Calculate hash of service data for change detection."""
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
    and updates last_checked timestamp. Also fills in supplemental fields
    (service_format, languages_supported, booking_url, tags) when available.

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
                booking_url=service_data.get('booking_url'),
                service_format=service_data.get('service_format'),
                languages_supported=service_data.get('languages_supported'),
                tags=service_data.get('tags'),
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

        # Always fill in supplemental fields if they're empty in the DB
        supplemental_updated = False
        if service_data.get('website_url') and not existing.website_url:
            existing.website_url = service_data['website_url']
            supplemental_updated = True
        if service_data.get('booking_url') and not existing.booking_url:
            existing.booking_url = service_data['booking_url']
            supplemental_updated = True
        if service_data.get('service_format') and not existing.service_format:
            existing.service_format = service_data['service_format']
            supplemental_updated = True
        if service_data.get('languages_supported') and not existing.languages_supported:
            existing.languages_supported = service_data['languages_supported']
            supplemental_updated = True
        if service_data.get('tags') and not existing.tags:
            existing.tags = service_data['tags']
            supplemental_updated = True
        if service_data.get('data_source') and not existing.data_source:
            existing.data_source = service_data['data_source']
            supplemental_updated = True

        if supplemental_updated:
            existing.last_updated = datetime.now()

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

        if supplemental_updated:
            if scraper:
                scraper.log.services_updated += 1
            logger.info(f"Supplemental update for: {service_data['name']}")
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

        # Load reference data
        from reference_data import load_alberta_services
        services_data = load_alberta_services()

        scraper.log.services_checked = len(services_data)

        for service_data in services_data:
            try:
                # Check if service already has a website_url in the database
                service_id = generate_service_id(
                    service_data['name'],
                    service_data.get('location', '')
                )
                existing = session.query(Service).filter_by(service_id=service_id).first()
                existing_url = existing.website_url if existing else None

                # Scrape for updates (passes existing URL to avoid redundant AI search)
                updated_data = scraper.scrape_service(service_data, existing_url=existing_url)

                # Sync to database
                sync_service_data(updated_data, session, scraper)

                session.commit()

                # Delay between requests (2s when using AI, 1s otherwise)
                delay = 2 if scraper.openai_client else 1
                time.sleep(delay)

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
