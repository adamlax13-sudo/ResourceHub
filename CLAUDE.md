# CLAUDE.md — Project Context for AI Sessions

<!-- LIVING DOCUMENT: Claude should update this file when discovering new key files,
     commands, conventions, architecture changes, or important patterns during sessions.
     Keep sections concise. Only add information that would help future sessions. -->

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
| `scraper/sources/plugin.py` | Source plugin interface (replaces old base.py) |
| `scraper/upserter.py` | Service upsert logic for discovery phase |
| `scraper/finalize.py` | Finalize phase: contacts, tags, embeddings, dedup, views |
| `scraper/pipeline.py` | 3-phase pipeline orchestrator |

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

### Scraper Pipeline (v2)
Three phases: discover → enrich → finalize.

- **Discover**: Source plugins scrape directories (211, AHS, CRA, etc.) with no AI cost.
- **Enrich**: Claude extracts process steps, eligibility, hours from service websites.
- **Finalize**: Normalize contacts, enhance tags, generate embeddings, deduplicate, refresh views.

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

## Maintaining This File

This is a living document. Update it when you discover:
- New key files or modules that future sessions should know about
- New commands, scripts, or workflow changes
- Architecture changes (new pipeline phases, new tables, new endpoints)
- Coding conventions or patterns established during implementation
- Important gotchas or non-obvious behaviors

Keep each section concise. Remove outdated information rather than letting it accumulate.
