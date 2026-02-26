"""
Extracts detailed eligibility criteria from service websites.

Looks for age requirements, geographic restrictions, income requirements,
referral requirements, and specific populations served.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class EligibilityCriteria:
    """Detailed eligibility criteria for a service."""
    summary: Optional[str] = None
    age_requirements: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    gender_requirements: Optional[str] = None  # "women_only", "men_only", "all"
    geographic_requirements: List[str] = field(default_factory=list)
    residency_requirements: Optional[str] = None
    income_requirements: Optional[str] = None
    referral_requirements: Optional[str] = None
    diagnosis_requirements: List[str] = field(default_factory=list)
    exclusion_criteria: List[str] = field(default_factory=list)
    priority_populations: List[str] = field(default_factory=list)
    required_documents: List[str] = field(default_factory=list)
    fees_or_costs: Optional[str] = None
    insurance_accepted: List[str] = field(default_factory=list)
    languages_available: List[str] = field(default_factory=list)
    source_url: Optional[str] = None
    age_group: Optional[str] = None  # 'youth', 'youth_and_adult', 'adult', 'senior', 'all_ages'

    def to_text(self) -> str:
        """Convert to readable text for database storage."""
        parts = []

        if self.summary:
            parts.append(self.summary)

        if self.age_requirements:
            parts.append(f"Age: {self.age_requirements}")

        if self.gender_requirements and self.gender_requirements != "all":
            parts.append(f"Gender: {self.gender_requirements.replace('_', ' ')}")

        if self.geographic_requirements:
            parts.append(f"Location: {', '.join(self.geographic_requirements)}")

        if self.income_requirements:
            parts.append(f"Income: {self.income_requirements}")

        if self.referral_requirements:
            parts.append(f"Referral: {self.referral_requirements}")

        if self.priority_populations:
            parts.append(f"Priority populations: {', '.join(self.priority_populations)}")

        if self.exclusion_criteria:
            parts.append(f"Exclusions: {', '.join(self.exclusion_criteria)}")

        return ". ".join(parts) if parts else ""

    def is_complete(self) -> bool:
        """Check if we have meaningful eligibility information."""
        return bool(self.summary or self.age_requirements or
                   self.geographic_requirements or self.priority_populations)

    def compute_age_group(self) -> str:
        """Compute age_group from age_min/age_max."""
        if self.age_group:
            return self.age_group
        return map_age_range_to_group(self.age_min, self.age_max)


def map_age_range_to_group(age_min: Optional[int], age_max: Optional[int]) -> str:
    """Map age_min/age_max to age_group enum value."""
    # Check youth_and_adult first — meaningfully spans into adulthood
    if age_min is not None and age_max is not None:
        if age_min < 22 and age_max > 25 and age_max <= 40:
            return 'youth_and_adult'

    # Youth — clearly youth-only, max is 25 or under
    if age_max is not None and age_max <= 25:
        if age_min is None or age_min < 18:
            return 'youth'

    # Senior — 55+ or 65+
    if age_min is not None and age_min >= 55:
        return 'senior'

    # Adult — explicitly 18+ with no upper bound or high upper bound
    if age_min is not None and age_min >= 18:
        if age_max is None or age_max > 40:
            return 'adult'

    return 'all_ages'


class EligibilityExtractor:
    """
    Extracts detailed eligibility criteria from page content.

    Looks for:
    - Age requirements (youth 12-24, adults 18+, seniors 65+)
    - Gender restrictions (women only, men only)
    - Geographic restrictions (Calgary residents, Alberta residents)
    - Income requirements (low income, sliding scale)
    - Referral requirements
    - Specific populations served (Indigenous, newcomers, LGBTQ+)
    - Exclusion criteria (not active psychosis, not violent history)
    - Required ID/documents
    """

    # Age patterns
    AGE_PATTERNS = [
        (r'(?:ages?|aged?)\s*(\d+)\s*(?:to|-|–|and\s+(?:older|above|under))\s*(\d+)?', 'range'),
        (r'(\d+)\s*(?:years?\s*old|\+|and\s+(?:older|above))', 'min'),
        (r'under\s*(\d+)', 'max'),
        (r'(?:youth|teen|adolescent)s?\s*(?:\()?(\d+)?\s*(?:to|-|–)?\s*(\d+)?', 'youth'),
        (r'(?:adult)s?\s*(?:\()?(\d+)?\s*\+?', 'adult'),
        (r'(?:senior|elder)s?\s*(?:\()?(\d+)?\s*\+?', 'senior'),
    ]

    # Gender patterns
    GENDER_PATTERNS = [
        (r'(?:women|female)s?\s*only', 'women_only'),
        (r'(?:men|male)s?\s*only', 'men_only'),
        (r'for\s+(?:women|females?)\b', 'women_only'),
        (r'for\s+(?:men|males?)\b', 'men_only'),
        (r'open\s*to\s*all\s*genders?', 'all'),
        (r'all\s*genders?\s*welcome', 'all'),
    ]

    # Geographic patterns
    GEOGRAPHIC_PATTERNS = [
        r'(calgary)\s+residents?',
        r'(edmonton)\s+residents?',
        r'(alberta)\s+residents?',
        r'must\s+(?:live|reside)\s+in\s+([\w\s]+)',
        r'(province[- ]?wide)',
    ]

    # Income patterns
    INCOME_PATTERNS = [
        (r'low[- ]?income', 'low income'),
        (r'sliding\s+(?:scale|fee)', 'sliding scale based on income'),
        (r'free\s+(?:of\s+charge|service)', 'free'),
        (r'no\s+(?:cost|charge|fee)', 'free'),
        (r'(?:income|means)\s+test', 'income-tested'),
    ]

    # Population patterns
    POPULATION_PATTERNS = [
        (r'(?:indigenous|first\s*nations?|m[eé]tis|inuit)', 'Indigenous'),
        (r'(?:lgbtq\+?|lgbt|queer|2slgbtq)', 'LGBTQ+'),
        (r'(?:newcomer|immigrant|refugee)', 'Newcomers/Immigrants'),
        (r'(?:homeless|unhoused|houseless)', 'Experiencing homelessness'),
        (r'(?:veteran|military)', 'Veterans'),
        (r'(?:pregnant|expecting|prenatal)', 'Pregnant individuals'),
        (r'(?:domestic\s+violence|dv|intimate\s+partner)', 'Domestic violence survivors'),
        (r'(?:family|famili)', 'Families'),
        (r'(?:parent|caregiver)', 'Parents/Caregivers'),
    ]

    # Exclusion patterns
    EXCLUSION_PATTERNS = [
        r'(?:cannot|can\s*not|do\s*not)\s+(?:serve|accept|help)\s+(.+?)(?:\.|$)',
        r'not\s+(?:available|eligible)\s+(?:for|to)\s+(.+?)(?:\.|$)',
        r'(?:exclude|excluding|exclusion)s?\s*[:.]?\s*(.+?)(?:\.|$)',
    ]

    def __init__(self, openai_client=None):
        """
        Initialize extractor.

        Args:
            openai_client: OpenAI client for AI-based extraction
        """
        self.client = openai_client
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile regex patterns."""
        self._age_patterns = [
            (re.compile(p, re.IGNORECASE), t) for p, t in self.AGE_PATTERNS
        ]
        self._gender_patterns = [
            (re.compile(p, re.IGNORECASE), t) for p, t in self.GENDER_PATTERNS
        ]
        self._geographic_patterns = [
            re.compile(p, re.IGNORECASE) for p in self.GEOGRAPHIC_PATTERNS
        ]
        self._income_patterns = [
            (re.compile(p, re.IGNORECASE), t) for p, t in self.INCOME_PATTERNS
        ]
        self._population_patterns = [
            (re.compile(p, re.IGNORECASE), t) for p, t in self.POPULATION_PATTERNS
        ]
        self._exclusion_patterns = [
            re.compile(p, re.IGNORECASE) for p in self.EXCLUSION_PATTERNS
        ]

    def extract(self, text: str, html: str, service_name: str, source_url: str = None) -> EligibilityCriteria:
        """
        Extract eligibility criteria from page content.

        Args:
            text: Plain text content
            html: Raw HTML
            service_name: Name of the service
            source_url: URL the content came from

        Returns:
            EligibilityCriteria with extracted information
        """
        # Heuristic extraction
        heuristic_result = self._extract_heuristic(text)

        # AI extraction if available
        if self.client:
            ai_result = self._extract_with_ai(text, service_name)
            return self._merge_results(heuristic_result, ai_result, source_url)

        heuristic_result.source_url = source_url
        return heuristic_result

    def _extract_heuristic(self, text: str) -> EligibilityCriteria:
        """Heuristic extraction using regex patterns."""
        result = EligibilityCriteria()
        text_lower = text.lower()

        # Extract age requirements
        age_info = self._extract_age(text)
        if age_info:
            result.age_requirements = age_info.get('text')
            result.age_min = age_info.get('min')
            result.age_max = age_info.get('max')

        # Extract gender requirements
        for pattern, gender in self._gender_patterns:
            if pattern.search(text_lower):
                result.gender_requirements = gender
                break

        # Extract geographic requirements
        for pattern in self._geographic_patterns:
            match = pattern.search(text)
            if match:
                location = match.group(1).strip().title()
                if location not in result.geographic_requirements:
                    result.geographic_requirements.append(location)

        # Extract income requirements
        for pattern, income_type in self._income_patterns:
            if pattern.search(text_lower):
                result.income_requirements = income_type
                break

        # Extract priority populations
        for pattern, population in self._population_patterns:
            if pattern.search(text_lower):
                if population not in result.priority_populations:
                    result.priority_populations.append(population)

        # Extract exclusion criteria
        for pattern in self._exclusion_patterns:
            match = pattern.search(text)
            if match:
                exclusion = match.group(1).strip()
                if len(exclusion) < 100 and exclusion not in result.exclusion_criteria:
                    result.exclusion_criteria.append(exclusion)

        # Extract languages
        result.languages_available = self._extract_languages(text)

        return result

    def _extract_age(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract age requirements from text."""
        text_lower = text.lower()

        for pattern, age_type in self._age_patterns:
            match = pattern.search(text_lower)
            if match:
                groups = match.groups()

                if age_type == 'range':
                    min_age = int(groups[0]) if groups[0] else None
                    max_age = int(groups[1]) if groups[1] else None
                    return {
                        'min': min_age,
                        'max': max_age,
                        'text': f"Ages {min_age}" + (f"-{max_age}" if max_age else "+")
                    }

                elif age_type == 'min':
                    min_age = int(groups[0])
                    return {
                        'min': min_age,
                        'max': None,
                        'text': f"{min_age} years and older"
                    }

                elif age_type == 'max':
                    max_age = int(groups[0])
                    return {
                        'min': None,
                        'max': max_age,
                        'text': f"Under {max_age} years"
                    }

                elif age_type == 'youth':
                    min_age = int(groups[0]) if groups[0] else 12
                    max_age = int(groups[1]) if groups[1] else 24
                    return {
                        'min': min_age,
                        'max': max_age,
                        'text': f"Youth ages {min_age}-{max_age}"
                    }

                elif age_type == 'adult':
                    min_age = int(groups[0]) if groups[0] else 18
                    return {
                        'min': min_age,
                        'max': None,
                        'text': f"Adults {min_age}+"
                    }

                elif age_type == 'senior':
                    min_age = int(groups[0]) if groups[0] else 55
                    return {
                        'min': min_age,
                        'max': None,
                        'text': f"Seniors {min_age}+"
                    }

        return None

    def _extract_languages(self, text: str) -> List[str]:
        """Extract supported languages from text."""
        languages = []
        text_lower = text.lower()

        language_patterns = [
            (r'\b(french|fran[çc]ais)\b', 'French'),
            (r'\b(spanish|espa[ñn]ol)\b', 'Spanish'),
            (r'\b(mandarin|chinese)\b', 'Mandarin'),
            (r'\b(cantonese)\b', 'Cantonese'),
            (r'\b(punjabi)\b', 'Punjabi'),
            (r'\b(arabic)\b', 'Arabic'),
            (r'\b(tagalog|filipino)\b', 'Tagalog'),
            (r'\b(vietnamese)\b', 'Vietnamese'),
            (r'\b(korean)\b', 'Korean'),
            (r'\b(hindi)\b', 'Hindi'),
            (r'\b(urdu)\b', 'Urdu'),
        ]

        for pattern, language in language_patterns:
            if re.search(pattern, text_lower):
                if language not in languages:
                    languages.append(language)

        # Always include English if we found any languages
        if languages and 'English' not in languages:
            languages.insert(0, 'English')

        return languages

    def _extract_with_ai(self, text: str, service_name: str) -> EligibilityCriteria:
        """AI-based extraction with detailed prompt."""
        if not self.client:
            return EligibilityCriteria()

        prompt = """Extract eligibility criteria from this webpage for a social service.

Look for:
1. AGE REQUIREMENTS: Specific age ranges, youth/adult/senior definitions
2. GENDER REQUIREMENTS: Women only, men only, or all genders
3. GEOGRAPHIC REQUIREMENTS: Must live in specific city/province
4. RESIDENCY REQUIREMENTS: Alberta resident, Canadian citizen, etc.
5. INCOME REQUIREMENTS: Low income, sliding scale, free, income tested
6. REFERRAL REQUIREMENTS: Self-referral allowed? Doctor referral needed?
7. DIAGNOSIS REQUIREMENTS: Must have specific diagnosis
8. EXCLUSION CRITERIA: Who CANNOT access the service
9. PRIORITY POPULATIONS: Indigenous, LGBTQ+, newcomers, veterans, etc.
10. REQUIRED DOCUMENTS: ID, health card, proof of income
11. FEES/COSTS: Free, sliding scale, insurance, specific fees
12. LANGUAGES: What languages are services available in

Return JSON:
{
    "summary": "Brief overall eligibility statement",
    "age_requirements": "Ages 18-65" or null,
    "age_min": 18 or null,
    "age_max": 65 or null,
    "gender_requirements": "women_only" | "men_only" | "all" | null,
    "geographic_requirements": ["Calgary", "Alberta"],
    "residency_requirements": "Alberta resident" or null,
    "income_requirements": "Low income, sliding scale available" or null,
    "referral_requirements": "Self-referral accepted" or null,
    "diagnosis_requirements": ["substance use disorder"],
    "exclusion_criteria": ["active psychosis", "violent history"],
    "priority_populations": ["Indigenous", "LGBTQ+"],
    "required_documents": ["Alberta Health Care card", "ID"],
    "fees_or_costs": "Free" or null,
    "insurance_accepted": ["Alberta Health Care"],
    "languages_available": ["English", "French"]
}

Be specific. Use null if information not found."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Service: {service_name}\n\nWebpage content:\n{text[:8000]}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=1000
            )

            result = json.loads(response.choices[0].message.content)
            return self._parse_ai_response(result)

        except Exception as e:
            logger.warning(f"AI eligibility extraction failed: {e}")
            return EligibilityCriteria()

    def _parse_ai_response(self, data: Dict[str, Any]) -> EligibilityCriteria:
        """Parse AI response into EligibilityCriteria."""
        return EligibilityCriteria(
            summary=data.get('summary'),
            age_requirements=data.get('age_requirements'),
            age_min=data.get('age_min'),
            age_max=data.get('age_max'),
            gender_requirements=data.get('gender_requirements'),
            geographic_requirements=data.get('geographic_requirements', []),
            residency_requirements=data.get('residency_requirements'),
            income_requirements=data.get('income_requirements'),
            referral_requirements=data.get('referral_requirements'),
            diagnosis_requirements=data.get('diagnosis_requirements', []),
            exclusion_criteria=data.get('exclusion_criteria', []),
            priority_populations=data.get('priority_populations', []),
            required_documents=data.get('required_documents', []),
            fees_or_costs=data.get('fees_or_costs'),
            insurance_accepted=data.get('insurance_accepted', []),
            languages_available=data.get('languages_available', [])
        )

    def _merge_results(
        self,
        heuristic: EligibilityCriteria,
        ai: EligibilityCriteria,
        source_url: str = None
    ) -> EligibilityCriteria:
        """Merge heuristic and AI results."""
        result = EligibilityCriteria(source_url=source_url)

        # Prefer AI summary
        result.summary = ai.summary or heuristic.summary

        # Age - prefer more specific
        result.age_requirements = ai.age_requirements or heuristic.age_requirements
        result.age_min = ai.age_min or heuristic.age_min
        result.age_max = ai.age_max or heuristic.age_max

        # Compute age_group from merged age range
        result.age_group = map_age_range_to_group(result.age_min, result.age_max)

        # Gender - prefer heuristic (more reliable pattern matching)
        result.gender_requirements = heuristic.gender_requirements or ai.gender_requirements

        # Geographic - combine
        geo = set(heuristic.geographic_requirements)
        geo.update(ai.geographic_requirements)
        result.geographic_requirements = list(geo)

        # Other fields - prefer AI
        result.residency_requirements = ai.residency_requirements
        result.income_requirements = ai.income_requirements or heuristic.income_requirements
        result.referral_requirements = ai.referral_requirements

        # Lists - combine
        result.diagnosis_requirements = list(set(
            heuristic.diagnosis_requirements + ai.diagnosis_requirements
        ))
        result.exclusion_criteria = list(set(
            heuristic.exclusion_criteria + ai.exclusion_criteria
        ))
        result.priority_populations = list(set(
            heuristic.priority_populations + ai.priority_populations
        ))
        result.required_documents = list(set(
            heuristic.required_documents + ai.required_documents
        ))
        result.languages_available = list(set(
            heuristic.languages_available + ai.languages_available
        ))

        # Other fields
        result.fees_or_costs = ai.fees_or_costs
        result.insurance_accepted = ai.insurance_accepted

        return result
