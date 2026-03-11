# CLAUDE.md — Project Context for AI Sessions

<!-- LIVING DOCUMENT: Claude should update this file when discovering new key files,
     commands, conventions, architecture changes, or important patterns during sessions.
     Keep sections concise. Only add information that would help future sessions. -->

## What This Project Is

ResourceHub is an Alberta social services directory. Users search for recovery, support, housing, disability, healthcare, and emergency services. The search is AI-powered with semantic understanding, intent detection, and crisis service pinning.

Live at https://resourcehub-wwg6.onrender.com. Deployed on Render.com (free tier).

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Shadcn/ui, Wouter routing
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM
- **Database:** PostgreSQL with pgvector extension
- **Scraper:** Python, BeautifulSoup, SQLAlchemy, Playwright (for JS-heavy sites)
- **AI:** OpenAI (embeddings, web search, gpt-4o-mini for reranking + intent), Anthropic Claude (extraction)

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
python scraper.py --phase discover   # Single phase
python scraper.py --dry-run          # Preview mode
pytest tests/ -v                     # Run scraper tests
```

## Key Files

| File | Purpose |
|------|---------|
| `server/routes.ts` | API route definitions — all endpoints registered here |
| `server/storage.ts` | Database access layer (34KB) — all DB queries |
| `server/search/index.ts` | Search orchestrator entry point |
| `server/search/strategies/scoring/index.ts` | Ranking/boosting orchestrator (imports sub-modules) |
| `server/search/strategies/scoring/quality-boost.ts` | Data quality boost — promotes high-confidence, well-described services |
| `server/search/strategies/scoring/preference-boost.ts` | Preference boosts for filter toggles (faith-based, 12-step, 24/7) |
| `server/search/strategies/scoring/filter-match-boost.ts` | Filter-match boosts for explicit DB matches |
| `server/search/strategies/comprehensive.ts` | Main search strategy |
| `server/search/analyzer.ts` | Query analysis, typo correction, intent detection, attribute extraction |
| `server/search/types.ts` | Search type definitions including QueryAttributes, QueryAnalysis |
| `server/search/config.ts` | Search configuration and thresholds (48KB) |
| `shared/schema.ts` | Drizzle ORM schema — all table definitions |
| `shared/routes.ts` | Shared Zod schemas for API request/response types |
| `scraper/scraper.py` | Scraper pipeline entry point |
| `scraper/sources/plugin.py` | Source plugin interface (replaces old base.py) |
| `scraper/upserter.py` | Service upsert logic for discovery phase |
| `scraper/finalize.py` | Finalize phase: contacts, tags, embeddings, dedup, views |
| `scraper/pipeline.py` | 3-phase pipeline orchestrator |
| `server/helpers/keywords.ts` | Typo correction, keyword expansion, stemming |
| `server/evaluation/deterministic_evaluator.ts` | API-free search quality scoring |
| `server/evaluation/comprehensive_test_queries.ts` | 96 test queries across all intents |
| `server/evaluation/run_baseline_api.mjs` | Run baseline eval via production API |
| `server/evaluation/diagnose_query.ts` | Debug single query through pipeline |
| `server/helpers/openai.ts` | Shared OpenAI singleton (`getOpenAI()`) + `extractJSON()` helper |
| `server/search/llm-intent.ts` | LLM intent classification (enhances regex, LRU cached 24h) |
| `server/search/strategies/scoring/llm-rerank.ts` | LLM reranking of top 20 RRF candidates for Tier 3 searches |
| `server/search/strategies/scoring/click-affinity-boost.ts` | Click-through affinity boost (1.0-1.3x, LRU cached 1h) |
| `server/evaluation/ci_runner.mjs` | CI test runner — 38 queries with per-intent thresholds |
| `.github/workflows/search-eval.yml` | GitHub Actions CI for search quality regression testing |
| `scripts/compute-click-affinities.mjs` | Batch job: compute (query, service) affinity scores from click data |
| `server/search/distance.ts` | Haversine distance + attachDistances/sortByDistance/filterByMaxDistance |
| `server/routes/location.ts` | `/api/mapbox-token` + `/api/geocode` endpoints |
| `client/src/components/MapView.tsx` | Lazy-loaded Mapbox map component (in separate ~1.7MB chunk) |
| `scripts/batch-geocode-services.mjs` | One-time batch geocoding of services via Mapbox API |
| `server/search/filters.ts` | Hard filter application (categories, gender, age, etc.) |
| `client/src/components/RefinePanel.tsx` | Filter UI — categories (38 in 7 groups), gender, age, preferences, languages |
| `server/routes/search.ts` | Search route handler — constructs `activeFilters` from input |
| `scripts/fix-tag-quality.mjs` | Tag quality fix: "men" false positive, normalize duplicates, regen embeddings |

## Architecture Notes

### Search Pipeline
1. Normalize query + correct typos
2. Analyze intent via regex (`analyzeQuery()`) + extract service attributes
3. Enhance with LLM structured understanding (`enhanceIntentWithLLM()` — returns intents + attributes + semantic rewrite)
4. **Crisis routing**: Direct crisis (suicidal ideation) → full helpline replacement. Situational crisis (DV, homelessness) → pin 988 + keep search results.
5. Check precomputed cache for popular queries
6. Stage 1: Fast SQL search (indexed, uses expanded keywords)
7. Stage 2: Semantic search (pgvector embeddings, uses LLM semantic rewrite if available)
8. Merge results via Reciprocal Rank Fusion
9. Apply filters (age, gender, exclusions, diversity)
10. **Tier 3 fresh searches:** LLM rerank top 20 candidates (`llmRerank()` → falls back to `boostByIntent()`)
    **Tier 2 / cached:** Regex-based `boostByIntent()` scoring
11. Apply data quality boost (confidence score, description richness)
12. Apply click-through affinity boost (`applyClickAffinityBoost()` — on all 3 cache paths)
13. Apply distance processing if user coords provided (`applyDistanceProcessing()` — on all 3 cache paths)
14. Trim to relevant results (`trimToRelevant()` — 20% threshold, category rescue, clamp to [13, 50])
15. Return paginated results with summary

### Search Caching
- Cache stores **unfiltered** results; UI filters (age, gender, preferences) are applied **post-cache**
- Cache version constant in `server/search/index.ts` must be bumped when changing filter/scoring behavior
- Scoring sub-modules are in `server/search/strategies/scoring/` (modular files, not one monolith)

### Database Tables (most important)
- `services` — current service data (name, category, location, contact, etc.)
- `service_history` — change log for every modification
- `ai_service_enrichments` — cached AI-generated descriptions
- `search_analytics` — click tracking for ranking improvements
- `query_service_affinities` — computed (query, service) click affinity scores (populated by `scripts/compute-click-affinities.mjs`)
- `service_field_source` — tracks which scraper provided each field

### Scraper Pipeline (v2)
Three phases: discover → enrich → finalize.

- **Discover**: Source plugins scrape directories (211, AHS, CRA, etc.) with no AI cost.
- **Enrich**: Claude extracts process steps, eligibility, hours from service websites.
- **Finalize**: Normalize contacts, geocode services (Mapbox), enhance tags, generate embeddings, deduplicate, refresh views.

Run with `python scraper.py` (all phases) or `--phase discover|enrich|finalize`.

## Coding Conventions

### TypeScript (server + client)
- Zod for all input validation
- Drizzle ORM for database queries (no raw SQL in application code)
- Express middleware pattern for cross-cutting concerns
- Error responses use `{ success: false, message: string }` format

### Python (scraper)
- SQLAlchemy for database access
- Source plugin interface for directory scrapers (see `scraper/sources/plugin.py`)
- Confidence scoring tracks data quality per source
- Field source tracking for data lineage

## Environment Variables

See `.env.example` for required variables. Key ones:
- `DATABASE_URL` — PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key
- `ANTHROPIC_API_KEY` — Claude API key (optional, better extraction)
- `ADMIN_API_KEY` — protects admin endpoints
- `MAPBOX_PUBLIC_TOKEN` — client-side map rendering (URL-restrict in Mapbox dashboard)
- `MAPBOX_SECRET_TOKEN` — server-side geocoding only (never exposed to client)

## MCP Servers

A **PostgreSQL MCP server** is configured in the project-level Claude Code settings (`~/.claude/projects/.../settings.json` — outside the repo, not tracked by git). It connects directly to the production Render.com database using the same `DATABASE_URL` from `.env`.

- Config location: `~/.claude/projects/-Users-adamyeo-Desktop-ResourceHub/settings.json`
- Uses: `npx -y @modelcontextprotocol/server-postgres` with the connection string baked into args
- If DB credentials rotate, update **both** `.env` and the MCP `settings.json`
- After any MCP config change, **restart the Claude Code session** for it to take effect
- The `claude` CLI is not on PATH inside Claude Code sessions — edit the settings.json directly instead of using `claude mcp add`

## Deployment

Render.com with `render.yaml` blueprint. Auto-deploys on push to main. Monthly scraper cron job runs on the 1st at 2 AM UTC. See DEPLOYMENT.md for full details.

Live URL: https://resourcehub-wwg6.onrender.com

### Build format & ESM/CJS compat
The server is built with esbuild to **CJS** format (`script/build.ts` → `dist/index.cjs`). The package is `"type": "module"`, so `npm run dev` (tsx) runs in ESM where `__dirname` doesn't exist, but esbuild's CJS output provides it natively.

**Pattern for `__dirname`:** Use the `_currentDir` variable defined in `server/index.ts`:
```ts
// @ts-ignore
const _currentDir: string = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
```
This works in both modes. The esbuild warning about `import.meta` is harmless (dead code path in CJS). Use `_currentDir` instead of `__dirname` in `server/index.ts`. Other server files that aren't bundled (e.g. `server/evaluation/`) can use the `fileURLToPath` shim directly.

## Git Safety Rules (CRITICAL)

### Subagent + Git = Danger
Subagents dispatched via the `Task` tool (without `isolation: "worktree"`) share the main `.git/index`. If a subagent runs git commands (add, reset, checkout), it **corrupts the staging area** for the main agent. This has caused mass file deletions in production.

**Rules:**
1. **Use `isolation: "worktree"` for any subagent that writes code.** This gives it its own git state.
2. **Never chain `git add <file> && git commit`** — always inspect what's staged first.
3. **Before every commit, run `git diff --cached --stat`** to verify only intended files are staged. If the number of files doesn't match what you expect, STOP and investigate.
4. **After subagent work completes, run `git status`** to check for unexpected index changes before doing any git operations.
5. **If a commit shows unexpected file counts** (e.g., "236 files changed" when you expected 1), do NOT push. Investigate immediately.

### Worktree Merge Index Corruption (RECURRING BUG)
After merging worktree branches back into main (the `Merge branch 'worktree-agent-*'` commits), the `.git/index` often becomes corrupted — `git status` will show **every file staged for deletion** while simultaneously listing them all as untracked. This is a cosmetic index issue, NOT actual data loss.

**MANDATORY: After ANY push that includes worktree merge commits, immediately run:**
```bash
git reset HEAD
git status  # Should show "nothing to commit, working tree clean"
```
This rebuilds the index from the last commit. Do this **every time** after pushing worktree merges, even if `git status` looks fine — check proactively rather than discovering the corruption later when staging new changes.

## Maintaining This File

This is a living document. Update it when you discover:
- New key files or modules that future sessions should know about
- New commands, scripts, or workflow changes
- Architecture changes (new pipeline phases, new tables, new endpoints)
- Coding conventions or patterns established during implementation
- Important gotchas or non-obvious behaviors

Keep each section concise. Remove outdated information rather than letting it accumulate.
