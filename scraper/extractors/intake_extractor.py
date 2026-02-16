"""
Extracts detailed intake/application procedures from service websites.

This is the KEY extractor for improving process_steps quality.
Transforms generic steps like "Call to learn more" into specific
procedures with phone numbers, required documents, and timelines.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class IntakeStep:
    """A single step in an intake process."""
    step_number: int
    action: str
    details: Optional[str] = None
    required_items: List[str] = field(default_factory=list)
    contact_method: Optional[str] = None  # phone, online, in-person, email
    timing: Optional[str] = None  # same-day, 1-3 days, etc.

    def to_string(self) -> str:
        """Convert step to a readable string."""
        parts = [self.action]
        if self.details:
            parts.append(f"({self.details})")
        if self.timing:
            parts.append(f"[{self.timing}]")
        return " ".join(parts)


@dataclass
class IntakeProcess:
    """Complete intake process for a service."""
    steps: List[IntakeStep] = field(default_factory=list)
    total_time_estimate: Optional[str] = None
    primary_contact_method: Optional[str] = None
    requires_referral: bool = False
    referral_sources: List[str] = field(default_factory=list)
    walk_in_available: bool = False
    appointment_required: bool = False
    online_application_available: bool = False
    phone_intake_available: bool = True
    intake_phone: Optional[str] = None
    intake_email: Optional[str] = None
    intake_hours: Optional[str] = None
    required_documents: List[str] = field(default_factory=list)
    source_url: Optional[str] = None

    def to_process_steps(self) -> List[str]:
        """Convert to simple string list for database storage."""
        return [step.to_string() for step in self.steps]

    def is_complete(self) -> bool:
        """Check if we have meaningful intake information."""
        return len(self.steps) >= 2 or self.intake_phone or self.online_application_available


class IntakeExtractor:
    """
    Extracts detailed intake procedures from webpage content.

    Looks for:
    - Step-by-step instructions
    - Contact methods (phone, online, in-person)
    - Referral requirements
    - Wait times and processing times
    - Required documents for intake
    - Intake hours (may differ from service hours)
    """

    # Patterns for detecting phone numbers
    PHONE_PATTERNS = [
        r'(?:intake|admission|referral)s?\s*(?:line|phone|number|:)?\s*[:.]?\s*(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})',
        r'call\s+(?:us\s+)?(?:at\s+)?(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})',
        r'phone\s*[:.]?\s*(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})',
        r'(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})',
        r'(\d-\d{3}-\d{3}-\d{4})',
    ]

    # Patterns for referral requirements
    REFERRAL_PATTERNS = [
        r'referral\s+(?:is\s+)?required',
        r'require[sd]?\s+(?:a\s+)?referral',
        r'must\s+(?:be|have)\s+(?:a\s+)?referr',
        r'physician\s+referral',
        r'doctor.?s?\s+referral',
    ]

    # Patterns for self-referral
    SELF_REFERRAL_PATTERNS = [
        r'self[- ]?referral',
        r'no\s+referral\s+(?:is\s+)?(?:required|needed)',
        r'referral\s+(?:is\s+)?not\s+(?:required|needed)',
        r'anyone\s+can\s+(?:call|apply|access)',
    ]

    # Patterns for walk-in
    WALK_IN_PATTERNS = [
        r'walk[- ]?in',
        r'no\s+appointment\s+(?:needed|required)',
        r'drop[- ]?in',
    ]

    # Patterns for appointment required
    APPOINTMENT_PATTERNS = [
        r'appointment\s+(?:is\s+)?required',
        r'require[sd]?\s+(?:an?\s+)?appointment',
        r'by\s+appointment\s+only',
        r'must\s+(?:book|schedule|make)\s+(?:an?\s+)?appointment',
    ]

    # Common required documents
    DOCUMENT_PATTERNS = [
        (r'(?:alberta\s+)?health\s*care\s*card', 'Alberta Health Care card'),
        (r'(?:government[- ]?issued\s+)?(?:photo\s+)?id(?:entification)?', 'Government-issued ID'),
        (r'proof\s+of\s+(?:address|residency)', 'Proof of address'),
        (r'proof\s+of\s+income', 'Proof of income'),
        (r'referral\s+(?:letter|form)', 'Referral letter'),
        (r'medical\s+records?', 'Medical records'),
        (r'medication\s+list', 'Current medications list'),
        (r'insurance\s+(?:card|information)', 'Insurance information'),
        (r'emergency\s+contact', 'Emergency contact information'),
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
        self._phone_patterns = [re.compile(p, re.IGNORECASE) for p in self.PHONE_PATTERNS]
        self._referral_patterns = [re.compile(p, re.IGNORECASE) for p in self.REFERRAL_PATTERNS]
        self._self_referral_patterns = [re.compile(p, re.IGNORECASE) for p in self.SELF_REFERRAL_PATTERNS]
        self._walk_in_patterns = [re.compile(p, re.IGNORECASE) for p in self.WALK_IN_PATTERNS]
        self._appointment_patterns = [re.compile(p, re.IGNORECASE) for p in self.APPOINTMENT_PATTERNS]
        self._document_patterns = [(re.compile(p, re.IGNORECASE), name) for p, name in self.DOCUMENT_PATTERNS]

    def extract(self, text: str, html: str, service_name: str, source_url: str = None) -> IntakeProcess:
        """
        Extract intake process from page content.

        Args:
            text: Plain text content
            html: Raw HTML
            service_name: Name of the service
            source_url: URL the content came from

        Returns:
            IntakeProcess with extracted information
        """
        # First try heuristic extraction for structured content
        heuristic_result = self._extract_heuristic(text, html)

        # Then use AI for detailed extraction
        if self.client:
            ai_result = self._extract_with_ai(text, service_name)

            # Merge results, preferring AI for steps but heuristic for phone/docs
            return self._merge_results(heuristic_result, ai_result, source_url)

        heuristic_result.source_url = source_url
        return heuristic_result

    def _extract_heuristic(self, text: str, html: str) -> IntakeProcess:
        """
        Heuristic extraction looking for common patterns.

        Patterns:
        - Numbered lists (1. 2. 3.)
        - "Step 1:", "Step 2:" headers
        - "First...", "Then...", "Finally..." sequences
        - <ol> ordered lists in HTML
        """
        result = IntakeProcess()
        text_lower = text.lower()

        # Extract phone numbers (prioritize intake-specific)
        phones = self._extract_phones(text)
        if phones:
            result.intake_phone = phones[0]

        # Check referral requirements
        result.requires_referral = any(p.search(text_lower) for p in self._referral_patterns)
        if any(p.search(text_lower) for p in self._self_referral_patterns):
            result.requires_referral = False

        # Check walk-in availability
        result.walk_in_available = any(p.search(text_lower) for p in self._walk_in_patterns)

        # Check appointment requirements
        result.appointment_required = any(p.search(text_lower) for p in self._appointment_patterns)

        # Check for online application
        result.online_application_available = any(kw in text_lower for kw in [
            'online application', 'apply online', 'online form',
            'online referral', 'submit online'
        ])

        # Extract required documents
        result.required_documents = self._extract_documents(text)

        # Extract steps from HTML ordered lists
        steps = self._extract_steps_from_html(html)
        if steps:
            result.steps = steps

        # If no HTML steps, try text-based extraction
        if not result.steps:
            result.steps = self._extract_steps_from_text(text)

        return result

    def _extract_phones(self, text: str) -> List[str]:
        """Extract phone numbers from text, prioritizing intake-specific ones."""
        phones = []
        for pattern in self._phone_patterns:
            matches = pattern.findall(text)
            for match in matches:
                # Normalize phone format
                phone = re.sub(r'[^\d]', '', match)
                if len(phone) == 10:
                    formatted = f"{phone[:3]}-{phone[3:6]}-{phone[6:]}"
                    if formatted not in phones:
                        phones.append(formatted)
                elif len(phone) == 11 and phone.startswith('1'):
                    formatted = f"1-{phone[1:4]}-{phone[4:7]}-{phone[7:]}"
                    if formatted not in phones:
                        phones.append(formatted)

        return phones[:3]  # Return up to 3 phone numbers

    def _extract_documents(self, text: str) -> List[str]:
        """Extract required documents from text."""
        documents = []
        for pattern, doc_name in self._document_patterns:
            if pattern.search(text):
                if doc_name not in documents:
                    documents.append(doc_name)
        return documents

    def _extract_steps_from_html(self, html: str) -> List[IntakeStep]:
        """Extract steps from HTML ordered lists."""
        try:
            soup = BeautifulSoup(html, 'lxml')
        except Exception:
            soup = BeautifulSoup(html, 'html.parser')

        steps = []

        # Look for ordered lists
        for ol in soup.find_all('ol'):
            items = ol.find_all('li')
            if len(items) >= 2:
                for i, li in enumerate(items, 1):
                    step_text = li.get_text(strip=True)
                    if len(step_text) > 10:  # Skip very short items
                        steps.append(IntakeStep(
                            step_number=i,
                            action=step_text[:300]
                        ))
                if steps:
                    return steps  # Return first valid list found

        # Look for "Step 1", "Step 2" headings
        step_headings = soup.find_all(string=re.compile(r'step\s*\d', re.IGNORECASE))
        if len(step_headings) >= 2:
            for i, heading in enumerate(step_headings, 1):
                parent = heading.parent
                if parent:
                    # Get following text
                    next_text = ""
                    for sibling in parent.next_siblings:
                        if hasattr(sibling, 'get_text'):
                            next_text = sibling.get_text(strip=True)
                            break
                        elif isinstance(sibling, str) and sibling.strip():
                            next_text = sibling.strip()
                            break

                    step_text = f"{heading.strip()} {next_text}".strip()
                    if len(step_text) > 10:
                        steps.append(IntakeStep(
                            step_number=i,
                            action=step_text[:300]
                        ))

        return steps

    def _extract_steps_from_text(self, text: str) -> List[IntakeStep]:
        """Extract steps from plain text patterns."""
        steps = []

        # Pattern: "1. " or "1) " numbered items
        numbered_pattern = re.compile(r'(?:^|\n)\s*(\d+)[.)]\s*(.+?)(?=\n\s*\d+[.)]|\n\n|$)', re.MULTILINE)
        matches = numbered_pattern.findall(text)

        if len(matches) >= 2:
            for num, step_text in matches[:10]:  # Limit to 10 steps
                step_text = step_text.strip()
                if len(step_text) > 10:
                    steps.append(IntakeStep(
                        step_number=int(num),
                        action=step_text[:300]
                    ))
            return steps

        # Pattern: "First...", "Then...", "Next...", "Finally..."
        sequence_words = ['first', 'second', 'third', 'then', 'next', 'after that', 'finally']
        for i, word in enumerate(sequence_words):
            pattern = re.compile(rf'\b{word}\b[,:]?\s*(.{{20,200}}?)(?:[.!?]|\n)', re.IGNORECASE)
            match = pattern.search(text)
            if match:
                steps.append(IntakeStep(
                    step_number=i + 1,
                    action=f"{word.capitalize()}: {match.group(1).strip()}"
                ))

        return steps

    def _extract_with_ai(self, text: str, service_name: str) -> IntakeProcess:
        """AI-based extraction with detailed prompt."""
        if not self.client:
            return IntakeProcess()

        prompt = """You are extracting detailed intake/application procedures for a social service.

From the webpage content, extract a DETAILED intake process. Look for:

1. STEP-BY-STEP PROCESS: What exactly does someone do to access this service?
   - How do they first make contact? (phone, online form, walk-in, referral)
   - What happens at intake/assessment?
   - What happens after intake?
   - How long does each step take?

2. CONTACT METHODS FOR INTAKE:
   - Is there a specific intake phone number (may differ from main line)?
   - Is there an online application?
   - Can someone walk in?
   - Are appointments required?

3. REFERRAL REQUIREMENTS:
   - Is a referral required? From whom?
   - Can someone self-refer?

4. TIMING:
   - How long from first contact to service?
   - Are there waitlists?
   - Same-day services available?

5. REQUIRED DOCUMENTS:
   - Health card, ID, proof of income, etc.

6. INTAKE HOURS (may differ from service hours)

Return JSON with this structure:
{
    "steps": [
        {
            "step_number": 1,
            "action": "Call intake line at 403-XXX-XXXX",
            "details": "Speak with intake coordinator about your situation",
            "contact_method": "phone",
            "timing": "10-15 minute call"
        }
    ],
    "total_time_estimate": "1-2 weeks from intake to service",
    "primary_contact_method": "phone",
    "requires_referral": false,
    "referral_sources": [],
    "walk_in_available": false,
    "appointment_required": true,
    "online_application_available": true,
    "intake_phone": "403-XXX-XXXX",
    "intake_email": "intake@service.ca",
    "intake_hours": "Mon-Fri 9am-4pm",
    "required_documents": ["Alberta Health Care card", "Government ID"]
}

IMPORTANT:
- Be SPECIFIC. Don't generate generic steps like "call to learn more".
- Extract ACTUAL procedures from the content.
- If information isn't available, use null.
- Include actual phone numbers, emails found in the text."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Service: {service_name}\n\nWebpage content:\n{text[:8000]}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=1500
            )

            result = json.loads(response.choices[0].message.content)
            return self._parse_ai_response(result)

        except Exception as e:
            logger.warning(f"AI extraction failed: {e}")
            return IntakeProcess()

    def _parse_ai_response(self, data: Dict[str, Any]) -> IntakeProcess:
        """Parse AI response into IntakeProcess."""
        steps = []
        for step_data in data.get('steps', []):
            steps.append(IntakeStep(
                step_number=step_data.get('step_number', len(steps) + 1),
                action=step_data.get('action', ''),
                details=step_data.get('details'),
                required_items=step_data.get('required_items', []),
                contact_method=step_data.get('contact_method'),
                timing=step_data.get('timing')
            ))

        return IntakeProcess(
            steps=steps,
            total_time_estimate=data.get('total_time_estimate'),
            primary_contact_method=data.get('primary_contact_method'),
            requires_referral=data.get('requires_referral', False),
            referral_sources=data.get('referral_sources', []),
            walk_in_available=data.get('walk_in_available', False),
            appointment_required=data.get('appointment_required', False),
            online_application_available=data.get('online_application_available', False),
            phone_intake_available=data.get('phone_intake_available', True),
            intake_phone=data.get('intake_phone'),
            intake_email=data.get('intake_email'),
            intake_hours=data.get('intake_hours'),
            required_documents=data.get('required_documents', [])
        )

    def _merge_results(
        self,
        heuristic: IntakeProcess,
        ai: IntakeProcess,
        source_url: str = None
    ) -> IntakeProcess:
        """Merge heuristic and AI results, preferring more specific data."""
        result = IntakeProcess(source_url=source_url)

        # Prefer AI steps if they're more detailed
        if len(ai.steps) >= len(heuristic.steps) and ai.steps:
            result.steps = ai.steps
        elif heuristic.steps:
            result.steps = heuristic.steps

        # Use AI values but override with heuristic if more specific
        result.total_time_estimate = ai.total_time_estimate
        result.primary_contact_method = ai.primary_contact_method or heuristic.primary_contact_method

        # Boolean flags - OR them together
        result.requires_referral = ai.requires_referral or heuristic.requires_referral
        result.walk_in_available = ai.walk_in_available or heuristic.walk_in_available
        result.appointment_required = ai.appointment_required or heuristic.appointment_required
        result.online_application_available = ai.online_application_available or heuristic.online_application_available

        # Prefer heuristic phone (more reliable extraction)
        result.intake_phone = heuristic.intake_phone or ai.intake_phone
        result.intake_email = ai.intake_email or heuristic.intake_email
        result.intake_hours = ai.intake_hours

        # Combine documents lists
        docs = set(heuristic.required_documents)
        docs.update(ai.required_documents)
        result.required_documents = list(docs)

        # Referral sources from AI
        result.referral_sources = ai.referral_sources

        return result
