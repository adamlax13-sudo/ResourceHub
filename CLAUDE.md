# CLAUDE.md — Project Context for AI Sessions

<!-- LIVING DOCUMENT: Claude should update this file when discovering new key files,
     commands, conventions, architecture changes, or important patterns during sessions.
     Keep sections concise. Only add information that would help future sessions. -->

## What This Project Is

ResourceHub is an Alberta social services directory. Users search for recovery, support, housing, disability, healthcare, and emergency services. The search is AI-powered with semantic understanding, intent detection, and crisis service pinning.

Live at https://resourcehub-wwg6.onrender.com. Deployed on Render.com (Hobby tier — no spin-down, persistent instances).

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

See `memory-bank/Key-Files.md` for the full file reference (server, search, scoring, evaluation, client, scraper, data scripts).

Essential entry points: `server/routes.ts` (all endpoints), `server/storage.ts` (re-export shim → `server/storage/index.ts` facade), `server/search/index.ts` (search orchestrator), `shared/schema.ts` (DB schema), `scraper/scraper.py` (scraper entry).

### Storage Architecture

`server/storage.ts` is a re-export shim. The real implementation lives in `server/storage/`:

| File | Domain | Key Responsibilities |
|------|--------|---------------------|
| `index.ts` | Facade | Instantiates domain modules, wires cross-domain side effects |
| `storage-impl.ts` | Legacy | DatabaseStorage class — remaining methods not yet extracted |
| `search-storage.ts` | Search | Confidence cache, alias cache, semantic/SQL search, cache ops |
| `service-storage.ts` | Services | CRUD with side-effect callbacks (invalidateCache, refreshInfra) |
| `review-storage.ts` | Reviews | Change request CRUD (approveChangeRequest stays on facade) |
| `analytics-storage.ts` | Analytics | Click tracking, votes, search quality metrics |
| `quality-storage.ts` | Quality | Data quality summary + issues |
| `dashboard-storage.ts` | Dashboard | Stats, recent activity, scraper runs |

Cross-domain side effects flow through the facade via callback injection — e.g., `updateService()` receives `invalidateConfidenceCache` and `refreshSearchInfrastructure` callbacks from the facade, keeping domain modules decoupled.

**Data scripts** in `scripts/` use `DRY_RUN=true` by default. Run with `DRY_RUN=false` to apply. Check `scripts/archive/` first if a data operation may have been done before.

## Architecture Notes

See `memory-bank/Architecture.md` for full details (search pipeline, scoring modules, DB schema, scraper pipeline, deployment).

**Key rules to remember every session:**
- Cache stores **unfiltered** results; UI filters are applied **post-cache**
- Cache version constant in `server/search/index.ts` must be bumped when changing filter/scoring behavior
- Crisis routing is **safety-critical** — false positives are better than false negatives
- Query understanding pipeline: `server/search/understand.ts` orchestrates `analyzeQuery()` (sync) → `buildCacheKey()` → `enhanceIntentWithLLM()` (async parallel). Types split: `BaseAnalysis` (sync fields) extends to `EnhancedAnalysis` (+ LLM attributes).
- Admin shared constants: `client/src/lib/admin-constants.ts` has FIELD_LABELS, SEVERITY_COLORS, `confidenceColor()`, `formatRelativeTime()`. `useSessionFilters` hook for filter persistence.

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

### Build format
Server builds to CJS via esbuild (`dist/index.cjs`). For `__dirname` compatibility in ESM/CJS, see `memory-bank/Learning-ESM-CJS-Dirname-Compat.md`.

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

## Memory Bank

A structured knowledge base lives in `memory-bank/` at the project root. Notes use Obsidian-style `[[wikilinks]]` and a flat directory structure.

**Before complex tasks:** Read `memory-bank/Project-Overview.md` and follow links to relevant index notes (`Architecture.md`, `Decisions-Index.md`) for context.

**After significant work:**
- **Architectural decisions** — Create a `Decision-*.md` note and add it to `memory-bank/Decisions-Index.md`
- **Non-obvious learnings** — Create a `Learning-*.md` note and add it to `memory-bank/Learnings-Index.md`
- **Major milestones** — Create a `Progress-*.md` note and add it to `memory-bank/Progress-Index.md`

Use the `/memory-bank` skill for full conventions on creating and managing notes.

## Maintaining This File

This is a living document. Update it when you discover:
- New key files or modules that future sessions should know about
- New commands, scripts, or workflow changes
- Architecture changes (new pipeline phases, new tables, new endpoints)
- Coding conventions or patterns established during implementation
- Important gotchas or non-obvious behaviors

Keep each section concise. Remove outdated information rather than letting it accumulate.
