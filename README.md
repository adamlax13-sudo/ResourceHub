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
