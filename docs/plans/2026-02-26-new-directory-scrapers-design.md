# New Directory Scrapers Design

**Date:** 2026-02-26
**Status:** Approved

## Problem

The current scraper pipeline uses 3 data sources (211 Alberta via web search, InformAlberta, direct website scraping). Evaluation reports identified critical coverage gaps:

- **Veterans services**: Only 1 service (OSI-CAN) in the database
- **Disability/autism services**: Missing employment support, independent living programs
- **Healthcare access**: Missing public health programs, clinics, AHS-run services
- **Shelter/housing depth**: Missing transitional housing, prevention programs
- **Northern Alberta**: Underrepresented across all categories
- **Contact info**: 60%+ of services missing phone numbers

## Solution

Build 5 direct HTML scrapers for new data sources, integrated as pipeline phases in `scraper.py`.

### Sources (dropped from original 6)

- **Findhelp.ca** — Dropped. Not a directory; corporate brochure site for 211 Ontario operator.
- **Autism Society of Alberta** — Dropped. No member/provider directory on site; only 16 toolkits.
- **ACDS Member Directory** — Replacement for Autism Society gap.

### Final Source List

| # | Source | URL | Data | Difficulty |
|---|--------|-----|------|------------|
| 1 | Veterans Affairs Canada | veterans.gc.ca/en/contact-us | ~91 offices (filter to Alberta ~5) | Easy |
| 2 | ACDS Member Directory | acds.ca/memberships/current-members.html | ~140 disability service orgs by region | Easy |
| 3 | Homeless Hub | homelesshub.ca | Community profiles + resource library | Moderate |
| 4 | AHS Find Healthcare | albertahealthservices.ca/findhealth/ | Facilities + service programs | Moderate |
| 5 | 211 Alberta Direct | ab.211.ca | Full directory browsing | Hard |

## Architecture

### File Structure

```
scraper/sources/
├── __init__.py
├── base.py              # BaseDirectoryScraper with shared logic
├── veterans_affairs.py  # VAC office scraper
├── acds.py              # ACDS member directory
├── homeless_hub.py      # Homeless Hub profiles + resources
├── ahs_findhealth.py    # AHS Find Healthcare
└── ab211_direct.py      # 211 Alberta direct (Playwright)
```

### Base Class (`base.py`)

Provides shared functionality:
- `requests.Session` with configurable User-Agent, timeouts, rate limiting
- `upsert_service(data)` — creates new service or enriches existing (empty fields only)
- `find_existing_service(name, address)` — exact match on service_id, fuzzy name match (>85%)
- `track_field_source(service_id, field, source_name, source_url)` — via ServiceFieldSource model
- `update_confidence(service)` — recalculate confidence score after enrichment
- Logging integration with existing logger pattern

### Pipeline Integration

Each source gets a `--phase` name in `scraper.py`:
- `--phase veterans` → Veterans Affairs Canada
- `--phase acds` → ACDS Member Directory
- `--phase homelesshub` → Homeless Hub
- `--phase ahs` → AHS Find Healthcare
- `--phase 211direct` → 211 Alberta Direct (Playwright)

They slot into `run_scraper()` after existing enrichment phases (informalberta) and before data quality phases (normalize, tags, embeddings).

### Service Matching Logic

When a scraper finds a service:
1. Generate `service_id` via existing `generate_service_id(name, location)`
2. Exact match on `service_id` → enrich empty fields only (never overwrite)
3. Fuzzy name match (>85% similarity) at same city → merge into existing
4. No match → insert as new service

Field source tracked as: `'veterans_affairs'`, `'acds'`, `'homeless_hub'`, `'ahs_findhealth'`, `'211_direct'`

## Per-Source Design

### 1. Veterans Affairs Canada (Easy)

**Approach:** Single HTTP GET + HTML parse

**URL:** `https://www.veterans.gc.ca/en/contact-us`

**Parsing Strategy:**
- Page uses `h3` headings for office names, grouped under `h2` province headings
- Filter to "Alberta" section only
- Extract sibling elements for address, phone (`tel:` links), hours
- Office types: Area Office, CAF Transition Centre, Bureau of Pensions Advocates

**Field Mapping:**
| Source Field | Service Field |
|-------------|--------------|
| Office name | `name` |
| Street address + city | `address`, `location` |
| Phone (tel: link) | `phone`, `contact` |
| Hours text | `hours_of_operation` |
| Office type | tags |
| Page URL | `website_url` |

**Category:** "Veterans Services"
**Expected yield:** ~5 Alberta offices
**Rate limiting:** N/A (single request)

### 2. ACDS Member Directory (Easy)

**Approach:** Single HTTP GET + HTML parse

**URL:** `https://acds.ca/memberships/current-members.html`

**Parsing Strategy:**
- Page organized by region: Calgary, Edmonton, Central, South, Northeast, Northwest
- Each org listed as text block with name, address, phone, fax, website, email
- Entries separated by `<hr>` or `* * *` dividers
- Region identified by heading elements

**Field Mapping:**
| Source Field | Service Field |
|-------------|--------------|
| Organization name | `name` |
| Address lines | `address`, `location` |
| Phone number | `phone`, `contact` |
| Email | `email` |
| Website URL | `website_url` |
| Region heading | `location` (city/region) |

**Category:** "Disability Support Services"
**Expected yield:** ~140 organizations
**Rate limiting:** N/A (single request)

### 3. Homeless Hub (Moderate)

**Approach:** Two-pronged scraping

**Part A — Community Profiles:**
- Scrape Alberta community profile pages: `/community_profile/{city}/`
- Cities: Calgary, Edmonton, Lethbridge, Red Deer, Medicine Hat, Grande Prairie, Fort McMurray
- Extract: homelessness statistics, linked service organizations, community plans
- Server-rendered HTML, straightforward parsing

**Part B — Resource Library:**
- Query Algolia search API directly (app ID + API key visible in page source)
- Filter by province/region for Alberta-relevant resources
- Extract: resource title, organization, URL, topic tags, description

**Field Mapping:**
| Source Field | Service Field |
|-------------|--------------|
| Resource/org title | `name` |
| Organization | `name` or `description` |
| External URL | `website_url` |
| Topic tags | `tags`, `category` |
| City profile | `location` |

**Categories:** "Emergency Shelters", "Transitional Housing", "Homelessness Prevention"
**Expected yield:** 20-50 Alberta-relevant services
**Rate limiting:** 2s between community profile requests; Algolia API has generous limits

### 4. AHS Find Healthcare (Moderate)

**Approach:** ASP.NET ViewState-aware POST requests

**URLs:**
- Facility search: `/findhealth/search.aspx?type=facility`
- Service search: `/findhealth/search.aspx?type=service`

**Parsing Strategy:**
1. GET search page → extract `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`
2. POST with form parameters + ViewState tokens for each facility type + "Whole Province"
3. POST for each service category + "Whole Province"
4. Parse result HTML tables/lists for facility/service details
5. Follow detail page links for full information

**Facility Types to Search (10):**
Addiction & Mental Health Centres, Cancer Care Centres, Community Care Centres, Emergency Departments, Hospitals, Labs, Public Health Centres, Urgent Care Centres, X-Ray & Imaging Clinics, Other

**Service Categories (30+):**
Addiction and Substance Use, Cancer, Mental Health and Wellness, etc.

**Field Mapping:**
| Source Field | Service Field |
|-------------|--------------|
| Facility/service name | `name` |
| Address | `address`, `location` |
| Phone | `phone`, `contact` |
| Facility type | `category`, tags |
| Services offered | `description` |

**Categories:** "Health Care Access", "Addiction Treatment", "Mental Health Counselling"
**Expected yield:** 100-300 facilities/services across Alberta
**Rate limiting:** 2s between POST requests (using `requests.Session` for cookie/state persistence)

### 5. 211 Alberta Direct (Hard)

**Approach:** Playwright headless browser

**URL:** `https://ab.211.ca/`

**Why Playwright:** Cloudflare Turnstile CAPTCHA blocks direct HTTP requests. The search results are rendered client-side via JavaScript.

**Strategy:**
1. Launch Playwright Chromium browser
2. Navigate to ab.211.ca, wait for Turnstile challenge to auto-resolve
3. Browse each topic category (expanding subcategories via `getSubTopics()`)
4. For each subcategory, paginate through all results
5. Extract listing details: name, description, address, phone, category
6. Follow individual service detail pages for full information

**Dedup Strategy:** Cross-reference against existing services discovered via OpenAI web search. Only add/enrich — never duplicate.

**New Dependency:** `playwright` package + browser install (`playwright install chromium`)

**Field Mapping:** Same as existing 211 discovery phase.

**Categories:** Maps to existing SEARCH_CATEGORIES taxonomy
**Expected yield:** 500-1000+ services (many already in database)
**Rate limiting:** 3s between page navigations; respectful browsing pattern

## Dependencies

**New:**
- `playwright>=1.40.0` (for 211 Alberta direct only)

**Existing (no changes):**
- `requests`, `beautifulsoup4`, `lxml` — used by scrapers 1-4
- `sqlalchemy`, `psycopg2-binary` — database access

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| 211 Turnstile blocks Playwright | Fall back to existing web-search approach; monitor Cloudflare challenge type |
| AHS ViewState changes structure | Scraper detects missing tokens and logs warning; manual review |
| ACDS page structure changes | Simple enough to re-parse; monitor HTTP status codes |
| Rate limiting / IP blocking | Configurable delays, respectful User-Agent, robots.txt compliance |
| Duplicate services across sources | Fuzzy matching + existing dedupe phase handles this |
