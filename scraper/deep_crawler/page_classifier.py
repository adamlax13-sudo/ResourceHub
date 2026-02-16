"""
Page type classification for crawled web pages.

Identifies what type of content a page contains using URL patterns,
heading analysis, and AI fallback for ambiguous cases.
"""

import re
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class PageType(Enum):
    """Types of pages commonly found on service provider websites."""
    HOME = "home"
    INTAKE = "intake"           # How to apply, intake process, getting started
    SERVICES = "services"       # Service listings, programs offered
    ELIGIBILITY = "eligibility" # Who can access, criteria, requirements
    CONTACT = "contact"         # Contact info, hours, locations
    PROGRAM = "program"         # Specific program details
    FORMS = "forms"             # Application forms, PDFs
    FAQ = "faq"                 # Frequently asked questions
    ABOUT = "about"             # About the organization
    UNKNOWN = "unknown"


@dataclass
class PageClassification:
    """Result of page classification."""
    page_type: PageType
    confidence: float  # 0.0 to 1.0
    signals: List[str] = field(default_factory=list)  # What led to this classification


class PageClassifier:
    """
    Classifies web pages by content type using heuristics and AI.

    Classification methods (in order):
    1. URL patterns (e.g., /apply, /services, /contact)
    2. Page titles and headings
    3. Content keywords
    4. AI fallback for ambiguous pages
    """

    # URL patterns that strongly indicate page type
    URL_PATTERNS: Dict[PageType, List[str]] = {
        PageType.INTAKE: [
            r'/apply', r'/intake', r'/get-help', r'/access', r'/how-to',
            r'/referral', r'/register', r'/enroll', r'/admission', r'/getting-started',
            r'/start', r'/begin', r'/join', r'/request', r'/book'
        ],
        PageType.SERVICES: [
            r'/services', r'/programs', r'/what-we-offer', r'/what-we-do',
            r'/our-services', r'/support', r'/treatment', r'/offerings',
            r'/help-services', r'/care'
        ],
        PageType.ELIGIBILITY: [
            r'/eligibility', r'/who-can', r'/criteria', r'/qualify',
            r'/requirements', r'/who-we-serve', r'/who-we-help',
            r'/who-qualifies', r'/am-i-eligible'
        ],
        PageType.CONTACT: [
            r'/contact', r'/location', r'/hours', r'/find-us',
            r'/reach-us', r'/visit', r'/connect', r'/directions'
        ],
        PageType.FORMS: [
            r'/forms', r'/documents', r'/downloads', r'/application',
            r'/pdf', r'/paperwork', r'/files'
        ],
        PageType.FAQ: [
            r'/faq', r'/questions', r'/help', r'/faqs',
            r'/frequently-asked'
        ],
        PageType.ABOUT: [
            r'/about', r'/who-we-are', r'/our-story', r'/mission',
            r'/history', r'/team', r'/staff'
        ],
        PageType.PROGRAM: [
            r'/program/', r'/programme/', r'/course/'
        ]
    }

    # Heading patterns that indicate page type
    HEADING_PATTERNS: Dict[PageType, List[str]] = {
        PageType.INTAKE: [
            r'how to (apply|access|get help|start)',
            r'intake process', r'getting started', r'get help',
            r'referral process', r'admission', r'access (our )?services',
            r'step.*(1|one|first)', r'application', r'register',
            r'request (a |an )?(appointment|service|help)',
            r'book (a |an )?(appointment|session)', r'make (a )?referral'
        ],
        PageType.ELIGIBILITY: [
            r'who (can|is eligible|qualifies)', r'am i eligible',
            r'eligibility', r'criteria', r'requirements',
            r'who we (serve|help)', r'admission criteria',
            r'do (i|you) qualify', r'who (is|are) (this|we) for'
        ],
        PageType.SERVICES: [
            r'our (services|programs)', r'what we (do|offer)',
            r'treatment options', r'support services',
            r'programs we offer', r'types of (support|help|services)',
            r'how we (help|can help)'
        ],
        PageType.CONTACT: [
            r'contact (us|information)', r'get in touch',
            r'reach (us|out)', r'find us', r'our location',
            r'hours of operation', r'office hours'
        ],
        PageType.FAQ: [
            r'frequently asked', r'common questions',
            r'faq', r'questions and answers'
        ]
    }

    # Content keywords that suggest page type
    CONTENT_KEYWORDS: Dict[PageType, List[str]] = {
        PageType.INTAKE: [
            'call to apply', 'intake coordinator', 'referral form',
            'application process', 'to access our services', 'getting started',
            'first step', 'initial assessment', 'intake assessment',
            'to begin', 'walk-in', 'appointment required', 'self-referral'
        ],
        PageType.ELIGIBILITY: [
            'must be', 'eligible if', 'criteria include', 'requirements:',
            'qualify if', 'open to', 'who can access', 'age requirement',
            'residency requirement', 'income requirement', 'cannot serve'
        ],
        PageType.SERVICES: [
            'we offer', 'our programs include', 'services include',
            'treatment options', 'types of support', 'we provide'
        ]
    }

    def __init__(self, openai_client=None):
        """
        Initialize classifier.

        Args:
            openai_client: Optional OpenAI client for AI-based classification
        """
        self.client = openai_client
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile regex patterns for efficiency."""
        self._url_patterns = {
            ptype: [re.compile(p, re.IGNORECASE) for p in patterns]
            for ptype, patterns in self.URL_PATTERNS.items()
        }
        self._heading_patterns = {
            ptype: [re.compile(p, re.IGNORECASE) for p in patterns]
            for ptype, patterns in self.HEADING_PATTERNS.items()
        }

    def classify(
        self,
        url: str,
        html: str,
        text: str,
        is_homepage: bool = False
    ) -> PageClassification:
        """
        Classify a page using heuristics, with AI fallback.

        Args:
            url: The page URL
            html: Raw HTML content
            text: Extracted text content
            is_homepage: Whether this is the site's homepage

        Returns:
            PageClassification with type, confidence, and signals
        """
        signals = []
        scores: Dict[PageType, float] = {ptype: 0.0 for ptype in PageType}

        # Homepage detection
        if is_homepage:
            scores[PageType.HOME] += 0.5
            signals.append("Is homepage")

        # URL pattern matching (strong signal)
        url_matches = self._check_url_patterns(url)
        for ptype, match_count in url_matches.items():
            if match_count > 0:
                scores[ptype] += 0.4 * match_count
                signals.append(f"URL matches {ptype.value} pattern")

        # Heading analysis
        heading_matches = self._check_headings(html)
        for ptype, match_count in heading_matches.items():
            if match_count > 0:
                scores[ptype] += 0.3 * match_count
                signals.append(f"Heading matches {ptype.value} pattern")

        # Content keyword analysis
        keyword_matches = self._check_keywords(text)
        for ptype, match_count in keyword_matches.items():
            if match_count > 0:
                scores[ptype] += 0.15 * min(match_count, 3)  # Cap at 3
                signals.append(f"Content has {match_count} {ptype.value} keywords")

        # Find best match
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]

        # If confidence is low, try AI classification
        if best_score < 0.3 and self.client:
            ai_result = self._classify_with_ai(text[:3000], url)
            if ai_result and ai_result.confidence > best_score:
                return ai_result

        # Default to UNKNOWN if no strong signals
        if best_score < 0.2:
            return PageClassification(
                page_type=PageType.UNKNOWN,
                confidence=0.1,
                signals=signals or ["No strong classification signals"]
            )

        return PageClassification(
            page_type=best_type,
            confidence=min(best_score, 1.0),
            signals=signals
        )

    def _check_url_patterns(self, url: str) -> Dict[PageType, int]:
        """Check URL against pattern matches."""
        matches = {ptype: 0 for ptype in PageType}
        url_lower = url.lower()

        for ptype, patterns in self._url_patterns.items():
            for pattern in patterns:
                if pattern.search(url_lower):
                    matches[ptype] += 1

        return matches

    def _check_headings(self, html: str) -> Dict[PageType, int]:
        """Check page headings for classification signals."""
        matches = {ptype: 0 for ptype in PageType}

        try:
            soup = BeautifulSoup(html, 'lxml')
        except Exception:
            soup = BeautifulSoup(html, 'html.parser')

        # Check h1, h2, h3 tags
        for tag in ['h1', 'h2', 'h3', 'title']:
            for element in soup.find_all(tag):
                text = element.get_text(strip=True).lower()
                for ptype, patterns in self._heading_patterns.items():
                    for pattern in patterns:
                        if pattern.search(text):
                            # h1 and title are stronger signals
                            weight = 2 if tag in ['h1', 'title'] else 1
                            matches[ptype] += weight

        return matches

    def _check_keywords(self, text: str) -> Dict[PageType, int]:
        """Check content for keyword matches."""
        matches = {ptype: 0 for ptype in PageType}
        text_lower = text.lower()

        for ptype, keywords in self.CONTENT_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_lower:
                    matches[ptype] += 1

        return matches

    def _classify_with_ai(self, text: str, url: str) -> Optional[PageClassification]:
        """Use AI to classify ambiguous pages."""
        if not self.client:
            return None

        try:
            prompt = """Classify this webpage into ONE of these categories:
- INTAKE: How to apply, intake process, getting started, referrals
- ELIGIBILITY: Who can access, criteria, requirements
- SERVICES: List of programs/services offered
- CONTACT: Contact information, hours, locations
- PROGRAM: Specific program details
- FAQ: Frequently asked questions
- ABOUT: About the organization
- UNKNOWN: Cannot determine

URL: {url}

Page content (excerpt):
{text}

Respond with just the category name (e.g., INTAKE)."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You classify web pages by content type. Respond with only the category name."},
                    {"role": "user", "content": prompt.format(url=url, text=text[:2000])}
                ],
                temperature=0.1,
                max_tokens=20
            )

            result = response.choices[0].message.content.strip().upper()

            # Map response to PageType
            type_map = {
                "INTAKE": PageType.INTAKE,
                "ELIGIBILITY": PageType.ELIGIBILITY,
                "SERVICES": PageType.SERVICES,
                "CONTACT": PageType.CONTACT,
                "PROGRAM": PageType.PROGRAM,
                "FAQ": PageType.FAQ,
                "ABOUT": PageType.ABOUT,
                "UNKNOWN": PageType.UNKNOWN
            }

            page_type = type_map.get(result, PageType.UNKNOWN)
            return PageClassification(
                page_type=page_type,
                confidence=0.6 if page_type != PageType.UNKNOWN else 0.2,
                signals=["AI classification"]
            )

        except Exception as e:
            logger.warning(f"AI classification failed: {e}")
            return None

    def is_valuable_page(self, classification: PageClassification) -> bool:
        """Check if a page is worth extracting data from."""
        valuable_types = {
            PageType.INTAKE,
            PageType.ELIGIBILITY,
            PageType.SERVICES,
            PageType.PROGRAM,
            PageType.CONTACT
        }
        return (
            classification.page_type in valuable_types and
            classification.confidence >= 0.25
        )
