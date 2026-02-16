"""
Specialized extractors for social service website content.

Each extractor focuses on a specific type of information:
- IntakeExtractor: Application/intake procedures
- EligibilityExtractor: Eligibility criteria
"""

from .intake_extractor import IntakeExtractor, IntakeProcess, IntakeStep
from .eligibility_extractor import EligibilityExtractor, EligibilityCriteria

__all__ = [
    "IntakeExtractor",
    "IntakeProcess",
    "IntakeStep",
    "EligibilityExtractor",
    "EligibilityCriteria",
]
