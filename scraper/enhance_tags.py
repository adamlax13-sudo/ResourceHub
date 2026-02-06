"""
Enhance Tags Script

Updates service tags to include key searchable information:
- Location/city names
- Service types (residential, counselling, peer support, etc.)
- Target populations (youth, women, Indigenous, seniors, etc.)
- Treatment types (addiction, mental health, crisis, etc.)
- Service format (virtual, in-person, 24/7, etc.)

This improves search accuracy by ensuring services can be found by these keywords.

Usage:
  python enhance_tags.py           # Run full tag enhancement
  python enhance_tags.py --dry-run # Preview changes without saving
"""
import argparse
import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Set

from dotenv import load_dotenv
from sqlalchemy import create_engine
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
# Keyword Mappings
# ──────────────────────────────────────────────────────────────────────────────

# Alberta cities and regions
ALBERTA_LOCATIONS = {
    "calgary": ["calgary", "yyc"],
    "edmonton": ["edmonton", "yeg"],
    "red deer": ["red deer"],
    "lethbridge": ["lethbridge"],
    "medicine hat": ["medicine hat"],
    "grande prairie": ["grande prairie"],
    "fort mcmurray": ["fort mcmurray", "wood buffalo"],
    "airdrie": ["airdrie"],
    "st. albert": ["st. albert", "st albert"],
    "spruce grove": ["spruce grove"],
    "leduc": ["leduc"],
    "lloydminster": ["lloydminster"],
    "camrose": ["camrose"],
    "cold lake": ["cold lake"],
    "brooks": ["brooks"],
    "okotoks": ["okotoks"],
    "cochrane": ["cochrane"],
    "high river": ["high river"],
    "wetaskiwin": ["wetaskiwin"],
    "banff": ["banff"],
    "canmore": ["canmore"],
    "pincher creek": ["pincher creek"],
    "drumheller": ["drumheller"],
    "hinton": ["hinton"],
    "jasper": ["jasper"],
    "slave lake": ["slave lake"],
    "peace river": ["peace river"],
    "high level": ["high level"],
    "fort saskatchewan": ["fort saskatchewan"],
    "sherwood park": ["sherwood park"],
    "stony plain": ["stony plain"],
    "alberta": ["alberta", "province-wide", "provincewide"],
}

# Service types
SERVICE_TYPES = {
    "residential": ["residential", "inpatient", "live-in", "bed-based", "treatment centre", "treatment center"],
    "outpatient": ["outpatient", "day program", "day treatment"],
    "counselling": ["counselling", "counseling", "therapy", "psychotherapy", "therapist"],
    "peer support": ["peer support", "peer-led", "lived experience", "peer mentor"],
    "crisis": ["crisis", "emergency", "urgent", "24/7", "24 hour", "hotline", "helpline"],
    "shelter": ["shelter", "emergency housing", "safe house", "refuge"],
    "detox": ["detox", "detoxification", "withdrawal management", "medically supported detox"],
    "harm reduction": ["harm reduction", "needle exchange", "safe consumption", "naloxone", "supervised injection"],
    "support group": ["support group", "group therapy", "aa", "na", "alcoholics anonymous", "narcotics anonymous", "12 step", "12-step"],
    "case management": ["case management", "navigation", "resource navigation", "system navigation"],
    "drop-in": ["drop-in", "walk-in", "no appointment"],
    "mobile": ["mobile", "outreach", "street team"],
    "online": ["online", "virtual", "telehealth", "phone", "text", "chat"],
    "transitional housing": ["transitional", "supportive housing", "second stage"],
    "food bank": ["food bank", "food hamper", "meal program", "food assistance"],
    "employment": ["employment", "job", "career", "vocational", "job training"],
    "legal": ["legal", "law", "legal aid", "court"],
}

# Target populations
TARGET_POPULATIONS = {
    "youth": ["youth", "teen", "adolescent", "young adult", "under 18", "12-17", "13-24", "18-24"],
    "adult": ["adult", "18+", "19+"],
    "senior": ["senior", "elder", "older adult", "65+", "aging"],
    "women": ["women", "woman", "female", "mothers", "pregnant", "maternal"],
    "men": ["men", "man", "male", "fathers"],
    "lgbtq+": ["lgbtq", "lgbt", "lgbtq+", "2slgbtq+", "queer", "transgender", "trans", "non-binary", "rainbow"],
    "indigenous": ["indigenous", "first nations", "métis", "metis", "inuit", "aboriginal", "native"],
    "newcomer": ["newcomer", "immigrant", "refugee", "new canadian"],
    "family": ["family", "families", "parent", "child", "children"],
    "veteran": ["veteran", "military", "armed forces", "rcmp"],
    "homeless": ["homeless", "unhoused", "street-involved", "rough sleeper"],
}

# Treatment/issue types
TREATMENT_TYPES = {
    "addiction": ["addiction", "substance use", "substance abuse", "drug", "alcohol", "opioid", "meth", "cocaine", "fentanyl"],
    "mental health": ["mental health", "depression", "anxiety", "ptsd", "bipolar", "schizophrenia", "psychiatric"],
    "gambling": ["gambling", "gaming addiction"],
    "eating disorder": ["eating disorder", "anorexia", "bulimia", "binge eating"],
    "trauma": ["trauma", "ptsd", "abuse survivor", "childhood trauma", "sexual abuse"],
    "grief": ["grief", "bereavement", "loss", "death"],
    "domestic violence": ["domestic violence", "intimate partner violence", "family violence", "abuse"],
    "sexual assault": ["sexual assault", "sexual abuse", "rape", "sexual violence"],
    "dual diagnosis": ["dual diagnosis", "concurrent disorder", "co-occurring"],
    "recovery": ["recovery", "sobriety", "sober", "abstinence", "clean"],
}

# Service formats
SERVICE_FORMATS = {
    "in-person": ["in-person", "in person", "face-to-face", "on-site"],
    "virtual": ["virtual", "online", "remote", "telehealth", "video", "zoom"],
    "hybrid": ["hybrid", "both in-person and virtual"],
    "24/7": ["24/7", "24 hour", "around the clock", "always open"],
    "free": ["free", "no cost", "no fee", "publicly funded"],
    "sliding scale": ["sliding scale", "income-based", "ability to pay"],
}


# ──────────────────────────────────────────────────────────────────────────────
# Tag Extraction Functions
# ──────────────────────────────────────────────────────────────────────────────

def extract_keywords_from_text(text: str, keyword_map: Dict[str, List[str]]) -> Set[str]:
    """Extract matching keywords from text based on keyword map."""
    if not text:
        return set()

    text_lower = text.lower()
    found = set()

    for tag, keywords in keyword_map.items():
        for keyword in keywords:
            if keyword in text_lower:
                found.add(tag)
                break  # Found this tag, move to next

    return found


def extract_city_from_location(location: str) -> Set[str]:
    """Extract city name from location field."""
    if not location:
        return set()

    location_lower = location.lower()
    found = set()

    for city, variants in ALBERTA_LOCATIONS.items():
        for variant in variants:
            if variant in location_lower:
                found.add(city)
                break

    return found


def build_comprehensive_tags(service: Service) -> List[str]:
    """Build comprehensive tags for a service based on all its fields."""
    tags = set()

    # Combine all text fields for analysis
    text_fields = [
        service.name or "",
        service.description or "",
        service.category or "",
        service.eligibility or "",
        service.notes or "",
    ]
    combined_text = " ".join(text_fields)

    # Extract location tags
    location_tags = extract_city_from_location(service.location)
    # Also check name and description for location mentions
    for city, variants in ALBERTA_LOCATIONS.items():
        for variant in variants:
            if variant in combined_text.lower():
                location_tags.add(city)
                break
    tags.update(location_tags)

    # Extract service type tags
    service_type_tags = extract_keywords_from_text(combined_text, SERVICE_TYPES)
    tags.update(service_type_tags)

    # Extract target population tags
    population_tags = extract_keywords_from_text(combined_text, TARGET_POPULATIONS)
    tags.update(population_tags)

    # Extract treatment type tags
    treatment_tags = extract_keywords_from_text(combined_text, TREATMENT_TYPES)
    tags.update(treatment_tags)

    # Extract service format tags
    format_tags = extract_keywords_from_text(combined_text, SERVICE_FORMATS)
    # Also use the service_format field directly
    if service.service_format:
        sf = service.service_format.lower()
        if "virtual" in sf or "online" in sf:
            format_tags.add("virtual")
        if "in-person" in sf or "in person" in sf:
            format_tags.add("in-person")
        if "hybrid" in sf:
            format_tags.add("hybrid")
    tags.update(format_tags)

    # Add category as a tag
    if service.category:
        tags.add(service.category.lower().strip())

    # Add existing tags (preserve what's already there)
    if service.tags:
        if isinstance(service.tags, list):
            for tag in service.tags:
                if isinstance(tag, str):
                    tags.add(tag.lower().strip())

    # Clean up tags
    cleaned_tags = []
    for tag in tags:
        if tag and len(tag) > 1:  # Skip empty or single-char tags
            cleaned_tags.append(tag)

    return sorted(list(set(cleaned_tags)))


# ──────────────────────────────────────────────────────────────────────────────
# Main Enhancement Function
# ──────────────────────────────────────────────────────────────────────────────

def enhance_service_tags(service: Service, dry_run: bool = False) -> Dict:
    """Enhance tags for a single service. Returns dict of changes."""
    old_tags = service.tags if isinstance(service.tags, list) else []
    new_tags = build_comprehensive_tags(service)

    # Calculate what's being added
    old_set = set(old_tags) if old_tags else set()
    new_set = set(new_tags)
    added = new_set - old_set

    if added or len(new_tags) != len(old_tags):
        if not dry_run:
            service.tags = new_tags
            service.last_updated = datetime.now()

        return {
            "old_count": len(old_tags),
            "new_count": len(new_tags),
            "added": list(added)[:10],  # Show first 10 added
        }

    return {}


def run_enhancement(dry_run: bool = False):
    """Run tag enhancement on all services."""
    session = SessionLocal()

    try:
        all_services = session.query(Service).filter(Service.is_active == True).all()
        logger.info(f"Processing {len(all_services)} active services...")

        updated_count = 0
        total_tags_added = 0

        # Track tag distribution
        tag_counts: Dict[str, int] = {}

        for i, service in enumerate(all_services):
            changes = enhance_service_tags(service, dry_run=dry_run)

            if changes:
                updated_count += 1
                added_count = len(changes.get("added", []))
                total_tags_added += added_count

                # Track tag distribution
                if not dry_run:
                    for tag in service.tags:
                        tag_counts[tag] = tag_counts.get(tag, 0) + 1

            # Progress update
            if (i + 1) % 100 == 0:
                logger.info(f"  Processed {i + 1}/{len(all_services)}...")

        if not dry_run:
            session.commit()
            logger.info("Changes committed to database.")
        else:
            logger.info("DRY RUN - No changes saved.")

        # Summary
        logger.info("=" * 60)
        logger.info("TAG ENHANCEMENT SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total services processed: {len(all_services)}")
        logger.info(f"Services with tag updates: {updated_count}")
        logger.info(f"Total new tags added:      {total_tags_added}")

        if not dry_run and tag_counts:
            logger.info("\nTop 20 most common tags:")
            sorted_tags = sorted(tag_counts.items(), key=lambda x: -x[1])[:20]
            for tag, count in sorted_tags:
                logger.info(f"  {tag}: {count}")

    except Exception as e:
        logger.error(f"Enhancement failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


def show_sample(limit: int = 5):
    """Show sample of enhanced tags."""
    session = SessionLocal()
    try:
        services = session.query(Service).filter(Service.is_active == True).limit(limit).all()

        for svc in services:
            print(f"\n{'='*60}")
            print(f"Service: {svc.name}")
            print(f"Location: {svc.location}")
            print(f"Category: {svc.category}")
            print(f"{'='*60}")

            new_tags = build_comprehensive_tags(svc)
            old_tags = svc.tags if isinstance(svc.tags, list) else []

            print(f"Current tags ({len(old_tags)}): {old_tags}")
            print(f"Enhanced tags ({len(new_tags)}): {new_tags}")

            added = set(new_tags) - set(old_tags) if old_tags else set(new_tags)
            if added:
                print(f"NEW tags to add: {list(added)}")
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enhance Service Tags")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without saving to database",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=0,
        help="Show sample of N enhanced records",
    )
    args = parser.parse_args()

    if args.sample > 0:
        show_sample(args.sample)
    else:
        run_enhancement(dry_run=args.dry_run)
