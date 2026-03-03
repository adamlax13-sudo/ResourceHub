# Phase 1: Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create foundational project documentation — root README, CLAUDE.md, and API reference — so a solo developer can context-switch back into the project quickly and new sessions start with full project awareness.

**Architecture:** Three standalone markdown files. No code changes. README covers user/contributor onboarding, CLAUDE.md covers AI-assisted development context, API.md covers the HTTP interface. Each file is self-contained and references the others.

**Tech Stack:** Markdown only. No tooling or build changes.

---

### Task 1: Create root README.md

**Files:**
- Create: `README.md`

**Step 1: Write the README**

Create `README.md` at the project root with this content:

```markdown
# ResourceHub

Alberta social services directory with AI-powered semantic search. Helps people find recovery, support, housing, disability, healthcare, and emergency services across Alberta.

Live at [recoveryoncampusalberta.ca](https://recoveryoncampusalberta.ca)

## Architecture

```
scraper (Python)     server (Node.js/Express)     client (React/Vite)
  │                        │                            │
  │  ┌────────────────┐    │                            │
  ├──│  211 Alberta    │    │                            │
  ├──│  InformAlberta  │    │  ┌──────────────────┐      │
  ├──│  AHS Healthcare │───▶│  │  PostgreSQL       │      │
  ├──│  Homeless Hub   │    │  │  + pgvector       │◀─────│
  ├──│  Veterans CA    │    │  └──────────────────┘      │
  ├──│  ACDS Directory │    │                            │
  └──│  Website crawls │    │  Search: SQL + semantic    │
     └────────────────┘    │  Scoring + intent analysis │
                           │  Crisis service pinning    │
                           └────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.9+
- PostgreSQL 15+ with pgvector extension

### 1. Install dependencies

```bash
npm install
cd scraper && pip install -r requirements.txt && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database URL and API keys
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key (embeddings, web search) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL (`https://api.openai.com/v1`) |
| `ADMIN_API_KEY` | API key for admin endpoints |
| `ANTHROPIC_API_KEY` | Optional. Claude API key (better extraction accuracy) |

### 3. Set up database

```bash
npm run db:push
```

### 4. Run development server

```bash
npm run dev
```

Client runs on `http://localhost:5173`, server on `http://localhost:5000`.

### 5. Populate data (optional)

```bash
cd scraper
python scraper.py --phase 211        # Discover services from 211 Alberta
python scraper.py --phase embeddings  # Generate search embeddings
python scraper.py --phase refresh     # Refresh materialized search view
```

## Scraper Pipeline

The scraper (`scraper/scraper.py`) runs as a multi-phase pipeline. Run all phases with `python scraper.py` or individual phases with `--phase`:

| Phase | Command | Description |
|-------|---------|-------------|
| 211 Discovery | `--phase 211` | Find services via 211 Alberta web search |
| Enrichment | `--phase enrich` | AI extraction of service details |
| InformAlberta | `--phase informalberta` | Enrich from InformAlberta directory |
| Veterans | `--phase veterans` | Veterans Affairs Canada offices |
| ACDS | `--phase acds` | ACDS member directory |
| Homeless Hub | `--phase homelesshub` | Homeless Hub + Algolia API |
| AHS Healthcare | `--phase ahs` | AHS Find Healthcare facilities |
| 211 Direct | `--phase 211direct` | 211 Alberta direct (Playwright) |
| Website Scrape | `--phase websites` | Shallow website scraping |
| Deep Crawl | `--phase deepcrawl` | Multi-page website crawling |
| Extraction | `--phase extract` | AI extraction of intake/eligibility |
| Normalize | `--phase normalize` | Phone, email, address standardization |
| Tags | `--phase tags` | AI-powered tag enhancement |
| Embeddings | `--phase embeddings` | Vector embeddings for semantic search |
| Deduplication | `--phase dedupe` | Merge duplicate services |
| Recovery | `--phase recover` | Reactivate found inactive services |
| View Refresh | `--phase refresh` | Refresh materialized search view |

Other options: `--dry-run` (preview without saving), `--mode daily|quick` (shorter runs).

## Project Structure

```
├── client/              React frontend (Vite, Tailwind, Shadcn/ui)
│   └── src/
│       ├── pages/       Main search page
│       ├── components/  UI components
│       ├── contexts/    React contexts
│       ├── hooks/       Custom hooks
│       └── locales/     i18n translations
├── server/              Express backend
│   ├── search/          Search orchestration module
│   │   ├── strategies/  Search strategies (scoring, filtering, merging)
│   │   ├── analyzer.ts  Query intent analysis
│   │   └── config.ts    Search configuration
│   ├── evaluation/      Search quality testing framework
│   ├── helpers/         Utility functions
│   ├── middleware/      Rate limiting, auth, CSRF
│   ├── routes/          Route handlers
│   ├── routes.ts        API route definitions
│   └── storage.ts       Database access layer
├── scraper/             Python scraping pipeline
│   ├── sources/         Directory scraper modules
│   ├── deep_crawler/    Website crawling module
│   ├── extractors/      AI extraction modules
│   ├── scoring/         Confidence scoring
│   └── tests/           Pytest test suite
├── shared/              Shared TypeScript types & schema
│   ├── schema.ts        Drizzle ORM schema
│   └── routes.ts        API route types & Zod schemas
├── scripts/             Data maintenance scripts
├── migrations/          Database migrations
└── docs/                Documentation & plans
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (client + server) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push schema to database |
| `npm run evaluate` | Run search quality evaluation |

## Search System

The search uses a two-stage approach:

1. **Fast SQL search** — indexed keyword/category matching
2. **Semantic search** — vector similarity via pgvector embeddings

Results are merged using Reciprocal Rank Fusion, then scored by intent match, name similarity, category relevance, and click popularity. Crisis services are always pinned to the top.

Query analysis includes typo correction, location extraction, intent detection, and demographic preference detection (age, gender, community).

## Deployment

Deployed on Render.com. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

## API Reference

See [docs/API.md](docs/API.md) for endpoint documentation.
```

**Step 2: Verify the file renders correctly**

Run: `head -5 README.md`
Expected: Shows the title and description lines

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add root README with project overview and quick start"
```

---

### Task 2: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write CLAUDE.md**

Create `CLAUDE.md` at the project root with this content:

```markdown
# CLAUDE.md — Project Context for AI Sessions

## What This Project Is

ResourceHub is an Alberta social services directory. Users search for recovery, support, housing, disability, healthcare, and emergency services. The search is AI-powered with semantic understanding, intent detection, and crisis service pinning.

Live at recoveryoncampusalberta.ca. Deployed on Render.com (free tier).

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Shadcn/ui, Wouter routing
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM
- **Database:** PostgreSQL with pgvector extension
- **Scraper:** Python, BeautifulSoup, SQLAlchemy, Playwright (for JS-heavy sites)
- **AI:** OpenAI (embeddings, web search), Anthropic Claude (extraction)

## Common Commands

```bash
# Development
npm run dev              # Start dev server (client :5173 + server :5000)
npm run check            # TypeScript type checking
npm run build            # Production build
npm run db:push          # Push schema changes to database

# Search evaluation
npm run evaluate         # Run search quality evaluation
npm run evaluate:comprehensive  # Auto-optimization run

# Scraper (from /scraper directory)
python scraper.py                    # Full pipeline
python scraper.py --phase embeddings # Single phase
python scraper.py --dry-run          # Preview mode
pytest tests/ -v                     # Run scraper tests
```

## Key Files

| File | Purpose |
|------|---------|
| `server/routes.ts` | API route definitions — all endpoints registered here |
| `server/storage.ts` | Database access layer (34KB) — all DB queries |
| `server/search/index.ts` | Search orchestrator entry point |
| `server/search/strategies/scoring.ts` | Ranking/boosting logic (78KB, largest module) |
| `server/search/strategies/comprehensive.ts` | Main search strategy |
| `server/search/analyzer.ts` | Query analysis, typo correction, intent detection |
| `server/search/config.ts` | Search configuration and thresholds (48KB) |
| `shared/schema.ts` | Drizzle ORM schema — all table definitions |
| `shared/routes.ts` | Shared Zod schemas for API request/response types |
| `scraper/scraper.py` | Scraper pipeline entry point |
| `scraper/sources/base.py` | Base class for directory scrapers |

## Architecture Notes

### Search Pipeline
1. Normalize query + correct typos
2. Analyze intent (category, location, demographics, urgency)
3. Check precomputed cache for popular queries
4. Stage 1: Fast SQL search (indexed)
5. Stage 2: Semantic search (pgvector embeddings)
6. Merge results via Reciprocal Rank Fusion
7. Apply filters (age, gender, exclusions, diversity)
8. Apply intent-based boosting and scoring
9. Pin crisis services if detected
10. Return paginated results with summary

### Database Tables (most important)
- `services` — current service data (name, category, location, contact, etc.)
- `service_history` — change log for every modification
- `ai_service_enrichments` — cached AI-generated descriptions
- `search_analytics` — click tracking for ranking improvements
- `service_field_source` — tracks which scraper provided each field

### Scraper Pipeline
Phases run in sequence: discovery → enrichment → directory scrapers → crawling → extraction → normalization → tagging → embeddings → deduplication → recovery → view refresh.

Each phase can run independently with `--phase <name>`.

## Coding Conventions

### TypeScript (server + client)
- Zod for all input validation
- Drizzle ORM for database queries (no raw SQL in application code)
- Express middleware pattern for cross-cutting concerns
- Error responses use `{ success: false, message: string }` format

### Python (scraper)
- SQLAlchemy for database access
- BaseDirectoryScraper class for new directory scrapers (see `scraper/sources/base.py`)
- Confidence scoring tracks data quality per source
- Field source tracking for data lineage

## Environment Variables

See `.env.example` for required variables. Key ones:
- `DATABASE_URL` — PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key
- `ANTHROPIC_API_KEY` — Claude API key (optional, better extraction)
- `ADMIN_API_KEY` — protects admin endpoints

## Deployment

Render.com with `render.yaml` blueprint. Auto-deploys on push to main. Monthly scraper cron job runs on the 1st at 2 AM UTC. See DEPLOYMENT.md for full details.
```

**Step 2: Verify the file**

Run: `wc -l CLAUDE.md`
Expected: ~100 lines

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project context for AI sessions"
```

---

### Task 3: Create API reference

**Files:**
- Create: `docs/API.md`

**Step 1: Write the API reference**

Create `docs/API.md` with this content:

```markdown
# API Reference

Base URL: `https://recoveryoncampusalberta.ca` (production) or `http://localhost:5000` (development)

## Search

### POST /api/search

Search for services using natural language queries.

**Rate limit:** Strict (see `server/middleware/rateLimiter.ts`)

**Request body:**

```json
{
  "query": "food bank near Calgary",
  "location": "Calgary",
  "page": 1,
  "pageSize": 20,
  "debug": false,
  "hp": ""
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query (1-200 chars) |
| `location` | string | No | Location filter |
| `page` | number | No | Page number (default: 1) |
| `pageSize` | number | No | Results per page (1-50, default: 20) |
| `debug` | boolean | No | Include score explanations in response |
| `hp` | string | No | Honeypot field — must be empty |

**Response (200):**

```json
{
  "services": [
    {
      "id": "calgary-food-bank",
      "name": "Calgary Food Bank",
      "category": "Food & Basic Needs",
      "description": "Provides emergency food hampers...",
      "location": "Calgary",
      "waitTimes": "Same day"
    }
  ],
  "summary": "Found 12 food assistance services near Calgary.",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalResults": 12,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

When `debug: true`, each service includes a `scoreExplanation` array:

```json
{
  "scoreExplanation": [
    { "factor": "intent_match", "value": 1.5, "reason": "Category matches food_assistance intent" },
    { "factor": "name_match", "value": 2.0, "reason": "Query keyword 'food bank' found in service name" }
  ]
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid input (Zod validation) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Service Details

### GET /api/services/:id

Get full details for a specific service. Called when a user expands a search result card.

**Response (200):**

```json
{
  "id": "calgary-food-bank",
  "name": "Calgary Food Bank",
  "category": "Food & Basic Needs",
  "description": "Full description of the service...",
  "location": "Calgary, AB",
  "contact": "403-253-2059",
  "websiteUrl": "https://calgaryfoodbank.com",
  "eligibility": "Open to all Calgary residents in need",
  "process": ["Call to register", "Bring ID to pickup"],
  "waitTimes": "Same day",
  "requiredDocs": ["Photo ID", "Proof of address"],
  "phone": "403-253-2059",
  "email": "info@calgaryfoodbank.com",
  "address": "5000 11 Street SE, Calgary, AB"
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid service ID |
| 404 | Service not found |

---

## Feedback

### POST /api/feedback

Submit user feedback.

**Rate limit:** Feedback-specific (more restrictive)

**Request body:**

```json
{
  "name": "Jane",
  "email": "jane@example.com",
  "message": "The search results for mental health were very helpful!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Feedback text (1-2000 chars) |
| `name` | string | No | Submitter name |
| `email` | string | No | Submitter email |
| `hp` | string | No | Honeypot — must be empty |

**Response (200):** `{ "success": true, "id": 42 }`

---

## Click Tracking

### POST /api/track-click

Track when a user clicks a search result. Used to improve rankings over time.

**Request body:**

```json
{
  "serviceId": "calgary-food-bank",
  "query": "food bank",
  "position": 3
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serviceId` | string | Yes | ID of clicked service |
| `query` | string | Yes | Search query that produced this result |
| `position` | number | No | Position in results (1-indexed) |

**Response (200):** `{ "success": true }`

---

## Analytics

### GET /api/analytics/popular-searches

Get most popular search queries.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Max results (1-100) |

**Response (200):**

```json
{
  "success": true,
  "searches": [
    { "query": "food bank", "count": 145 },
    { "query": "mental health", "count": 98 }
  ]
}
```

---

## Admin Endpoints

All admin endpoints require the `X-Admin-Key` header matching the `ADMIN_API_KEY` environment variable.

### POST /api/admin/refresh-search

Refresh the materialized search view and clear the search cache. Call after marking services as inactive or making bulk data changes.

**Headers:** `X-Admin-Key: <ADMIN_API_KEY>`

**Response (200):** `{ "success": true, "message": "Search view refreshed and cache cleared" }`

### POST /api/admin/persist-enrichments

Copy AI enrichment data to the services table for empty fields only. Reduces future enrichment lookups.

**Headers:** `X-Admin-Key: <ADMIN_API_KEY>`

**Response (200):**

```json
{
  "success": true,
  "message": "Persisted enrichments to 15 services (42 fields total)",
  "servicesUpdated": 15,
  "totalFieldsUpdated": 42,
  "enrichmentsProcessed": 200
}
```

---

## Health Check

### GET /api/health

Returns application health status. Not rate limited.

---

## CSRF Protection

All non-GET requests require a CSRF token.

### GET /api/csrf-token

Returns a CSRF token to include in subsequent requests.

**Response (200):** `{ "csrfToken": "..." }`

Include the token in request headers or body for POST/PUT/DELETE requests.

---

## Error Format

All error responses follow this structure:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": "Technical detail (development only)",
  "errors": [{ "path": ["field"], "message": "Validation error" }]
}
```

The `error` field is only populated in development (`NODE_ENV !== 'production'`). The `errors` array is only present for Zod validation failures.
```

**Step 2: Verify the file**

Run: `wc -l docs/API.md`
Expected: ~200 lines

**Step 3: Commit**

```bash
git add docs/API.md
git commit -m "docs: add API endpoint reference"
```

---

### Task 4: Final verification and cross-linking

**Files:**
- Modify: `README.md` (verify links work)
- Modify: `CLAUDE.md` (verify references are accurate)

**Step 1: Verify all referenced files exist**

Run: `ls -la README.md CLAUDE.md docs/API.md DEPLOYMENT.md .env.example`
Expected: All five files should exist

**Step 2: Verify internal links**

Check that these referenced paths exist:
- `server/routes.ts`
- `server/storage.ts`
- `server/search/index.ts`
- `server/search/strategies/scoring.ts`
- `shared/schema.ts`
- `scraper/scraper.py`
- `scraper/sources/base.py`

Run: `ls server/routes.ts server/storage.ts server/search/index.ts server/search/strategies/scoring.ts shared/schema.ts scraper/scraper.py scraper/sources/base.py`
Expected: All files listed without errors

**Step 3: Commit the cross-linking verification (if any edits were needed)**

Only commit if changes were made to fix broken references.
