"""211 Alberta direct directory scraper.

Uses Playwright to browse ab.211.ca directly, bypassing Cloudflare Turnstile
CAPTCHA that blocks standard HTTP requests.

Source: https://ab.211.ca/
"""
import json
import logging
import re
import time
from typing import Dict, List, Optional

from sources.base import BaseDirectoryScraper

logger = logging.getLogger(__name__)

AB211_URL = "https://ab.211.ca/"
AB211_TOPICS_URL = "https://ab.211.ca/how-we-help/"


class AB211DirectScraper(BaseDirectoryScraper):
    SOURCE_NAME = "211_direct"
    CATEGORY = "Social Services"
    RATE_LIMIT_SECONDS = 3

    TOPIC_IDS = {
        "mental_health": "Mental Health & Addiction",
        "crisis": "Crisis Services",
        "housing": "Housing & Shelter",
        "food": "Food & Basic Needs",
        "employment": "Employment & Financial",
        "health": "Health Care",
        "family": "Family & Children",
        "seniors": "Seniors Services",
        "disability": "Disability Services",
        "legal": "Legal & Advocacy",
    }

    def scrape(self) -> List[Dict]:
        """Scrape 211 Alberta using Playwright browser."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.error(
                "[211Direct] Playwright not installed. Run: pip install playwright && playwright install chromium"
            )
            return []

        results = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()

            try:
                logger.info("[211Direct] Navigating to ab.211.ca...")
                page.goto(AB211_URL, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(5000)

                page.goto(AB211_TOPICS_URL, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(3000)

                topic_links = page.query_selector_all("a[onclick*='getSubTopics']")
                topic_urls = []

                for link in topic_links:
                    href = link.get_attribute("href")
                    text = link.inner_text().strip()
                    if href:
                        topic_urls.append((href, text))

                logger.info(f"[211Direct] Found {len(topic_urls)} topic categories")

                for topic_url, topic_name in topic_urls:
                    try:
                        logger.info(f"[211Direct] Browsing topic: {topic_name}")
                        full_url = topic_url if topic_url.startswith("http") else AB211_URL.rstrip("/") + topic_url
                        page.goto(full_url, wait_until="networkidle", timeout=20000)
                        page.wait_for_timeout(2000)

                        listings = self._extract_page_listings(page)
                        for listing in listings:
                            listing["category"] = topic_name
                            normalized = self.normalize_listing(listing)
                            if not self.is_already_known(normalized["name"]):
                                results.append(normalized)

                        time.sleep(self.RATE_LIMIT_SECONDS)

                    except Exception as e:
                        logger.error(f"[211Direct] Error browsing {topic_name}: {e}")

            except Exception as e:
                logger.error(f"[211Direct] Browser error: {e}")
            finally:
                browser.close()

        logger.info(f"[211Direct] Total new services found: {len(results)}")
        return results

    def _extract_page_listings(self, page) -> List[Dict]:
        """Extract service listings from the current page."""
        listings = []

        try:
            results_elements = page.query_selector_all(".result-item, .listing-item, .service-result")

            if not results_elements:
                return listings

            for elem in results_elements:
                try:
                    name_el = elem.query_selector("h3, h4, .title, .name")
                    name = name_el.inner_text().strip() if name_el else ""

                    desc_el = elem.query_selector(".description, .summary, p")
                    description = desc_el.inner_text().strip() if desc_el else ""

                    phone_el = elem.query_selector("a[href^='tel:'], .phone")
                    phone = phone_el.inner_text().strip() if phone_el else ""

                    addr_el = elem.query_selector(".address, .location")
                    address = addr_el.inner_text().strip() if addr_el else ""

                    link_el = elem.query_selector("a[href]")
                    website = link_el.get_attribute("href") if link_el else ""

                    if name:
                        listings.append({
                            "name": name,
                            "description": description,
                            "phone": phone,
                            "address": address,
                            "website": website,
                            "category": "",
                        })
                except Exception:
                    continue

        except Exception as e:
            logger.error(f"[211Direct] Error extracting listings: {e}")

        return listings

    def normalize_listing(self, listing: Dict) -> Dict:
        """Normalize a raw listing into a service data dict."""
        address = listing.get("address", "")
        city = "Alberta"
        for test_city in ["Calgary", "Edmonton", "Lethbridge", "Red Deer", "Medicine Hat", "Grande Prairie", "Fort McMurray"]:
            if test_city.lower() in address.lower():
                city = test_city
                break

        return self.build_service_data(
            name=listing.get("name", "").strip(),
            category=listing.get("category", self.CATEGORY),
            location=city,
            phone=listing.get("phone", ""),
            address=address,
            website_url=listing.get("website", ""),
            description=listing.get("description", ""),
            tags=["211", city.lower()],
        )

    def is_already_known(self, name: str) -> bool:
        """Check if a service name already exists in the database."""
        if not name:
            return True
        normalized = name.lower().strip()
        if normalized in self.existing_lookup:
            return True
        short = re.sub(r"\s*\(.*?\)\s*", "", normalized).strip()
        if short in self.existing_lookup:
            return True
        for existing_name in self.existing_lookup:
            if len(normalized) > 5 and len(existing_name) > 5:
                if normalized in existing_name or existing_name in normalized:
                    return True
        return False
