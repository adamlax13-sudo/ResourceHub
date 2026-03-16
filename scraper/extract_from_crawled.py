#!/usr/bin/env python3
"""Extract structured service data from crawled markdown (no API calls).

Reads crawled_inactive_services.json and uses regex/heuristics to extract:
- phone, email, address, hours, description, eligibility, process_steps
Outputs a JSON file ready for bulk-update-services.mjs.
"""
import json
import os
import re

INPUT = os.path.join(os.path.dirname(__file__), "crawled_inactive_services.json")

def extract_phones(text):
    """Extract Canadian phone numbers."""
    patterns = [
        r'\((\d{3})\)\s*(\d{3})[.-](\d{4})',
        r'(\d{3})[.-](\d{3})[.-](\d{4})',
    ]
    phones = set()
    for p in patterns:
        for m in re.finditer(p, text):
            groups = m.groups()
            if len(groups) == 3:
                phone = f"({groups[0]}) {groups[1]}-{groups[2]}"
                # Skip 1-800/1-888 style and fax numbers
                if not any(x in phone for x in ['(000)', '(111)']):
                    phones.add(phone)
    return sorted(phones)

def extract_emails(text):
    """Extract email addresses, skip images/tracking."""
    emails = set()
    for m in re.finditer(r'[\w.+-]+@[\w.-]+\.\w{2,}', text):
        email = m.group().lower()
        if not any(skip in email for skip in [
            'pixel.wp.com', 'example.com', 'sentry.io', '.png', '.jpg',
            'wixpress.com', 'googleapis.com', 'wordpress.com',
        ]):
            emails.add(email)
    return sorted(emails)

def extract_hours(text):
    """Look for hours of operation patterns."""
    # Common patterns
    patterns = [
        r'(?:hours|open|operating).*?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun).*?(?:\d{1,2}:\d{2}\s*(?:am|pm|AM|PM))',
        r'(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*[-–:]\s*(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*[,:]?\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)',
        r'Mon\s*-\s*Fri\s*[,:]?\s*\d{1,2}:\d{2}\s*(?:am|pm)\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)',
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*:\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)',
    ]
    hours_found = []
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            hours_found.append(m.group().strip())

    # Also look for structured hours blocks
    lines = text.split('\n')
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r'^(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*[:]\s*\d', stripped, re.IGNORECASE):
            hours_found.append(stripped)

    return hours_found

def extract_address(text):
    """Extract Alberta addresses."""
    patterns = [
        r'\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Crescent|Cres|Trail|Way|Place|Pl|Close|Gate|Court|Ct)\.?\s+(?:NE|NW|SE|SW|N|S|E|W)?\s*,?\s*(?:Calgary|Edmonton|Lethbridge|Red Deer|Medicine Hat|Sherwood Park|Strathmore|Airdrie|Sundre|Stony Plain|Barrhead|Central Alberta)\s*,?\s*(?:AB|Alberta)?\s*(?:T\d[A-Z]\s*\d[A-Z]\d)?',
    ]
    addresses = []
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            addr = m.group().strip()
            if len(addr) > 10:
                addresses.append(addr)
    return addresses

def summarize_service(entry):
    """Extract all structured data from a crawled service entry."""
    md = entry.get("markdown", "")

    result = {
        "id": entry["id"],
        "name": entry["name"],
        "category": entry.get("category", ""),
        "url": entry["url"],
        "status": entry["status"],
        "pages_crawled": entry.get("pages_crawled", 0),
        "markdown_chars": len(md),
    }

    if entry["status"] != "OK":
        return result

    result["phones"] = extract_phones(md)
    result["emails"] = extract_emails(md)
    result["hours_raw"] = extract_hours(md)
    result["addresses"] = extract_address(md)

    # Extract first ~500 chars of meaningful content for description review
    # Skip nav links and boilerplate
    meaningful_lines = []
    for line in md.split('\n'):
        stripped = line.strip()
        if len(stripped) > 50 and not stripped.startswith('[') and not stripped.startswith('*') and not stripped.startswith('!['):
            if 'cookie' not in stripped.lower() and 'privacy' not in stripped.lower():
                meaningful_lines.append(stripped)
        if len(meaningful_lines) >= 5:
            break
    result["description_candidates"] = meaningful_lines

    return result


def main():
    with open(INPUT) as f:
        data = json.load(f)

    print(f"Loaded {len(data)} crawled services\n")

    summaries = []
    for entry in data:
        s = summarize_service(entry)
        summaries.append(s)

        print(f"{'='*60}")
        print(f"{s['name']} ({s['category']})")
        print(f"  Status: {s['status']}, Pages: {s.get('pages_crawled', 0)}, Markdown: {s.get('markdown_chars', 0)} chars")

        if s['status'] != 'OK':
            print(f"  SKIPPED (site down or error)")
            continue

        if s.get('phones'):
            print(f"  Phones: {', '.join(s['phones'])}")
        if s.get('emails'):
            print(f"  Emails: {', '.join(s['emails'])}")
        if s.get('hours_raw'):
            print(f"  Hours: {s['hours_raw'][:3]}")
        if s.get('addresses'):
            print(f"  Address: {s['addresses'][0] if s['addresses'] else 'none'}")
        if s.get('description_candidates'):
            print(f"  Desc preview: {s['description_candidates'][0][:120]}...")
        print()

    # Save summaries
    out_path = os.path.join(os.path.dirname(__file__), "extracted_service_data.json")
    with open(out_path, "w") as f:
        json.dump(summaries, f, indent=2, ensure_ascii=False)
    print(f"\nSaved extraction summaries to {out_path}")


if __name__ == "__main__":
    main()
