# Admin UI — Design Spec

## Overview

A web-based admin panel for ResourceHub, embedded in the existing React app at `/admin/*`. Replaces CLI-only scripts with a full CRUD interface, review pipeline for scraper output, data quality monitoring, search analytics, and operational tools. Designed for solo use now with a clean path to multi-user GOA handoff.

## Architecture

- **Same React app**, code-split `/admin/*` routes via `React.lazy()` — zero impact on public bundle size
- **Sidebar navigation** — fixed left, dark theme, icon+label, collapsible on smaller screens
- **38 API endpoints** under `/api/admin/*`, all behind existing `adminAuth` middleware
- **1 new database table**: `service_change_requests`
- **2 existing tables to add to Drizzle ORM**: `service_history` (exists in DB, not in `shared/schema.ts`), `scraper_logs` (exists in DB as `scraper_logs`, not in `shared/schema.ts`) — extend with new fields for review pipeline
- **Storage layer**: `server/storage.ts` has 0 write operations for services — `createService`, `updateService`, `deactivateService`, `restoreService` must all be built
- **Scraper modification**: `upserter.py` writes to `service_change_requests` instead of `services` (with `--skip-review` bypass flag)
- **Soft deletes only** — no destructive DB operations anywhere in the admin UI

### Tech Stack

All existing — no new frameworks:
- React 18, Wouter, TanStack React Query, Tailwind CSS, Shadcn/ui, Zod, Drizzle ORM
- **Add**: `@tanstack/react-table` (sortable/filterable data tables — not currently in `package.json`)
- **Already in deps**: Recharts (analytics charts), React Hook Form, `@tanstack/react-query`

### Frontend Routing

```
/admin/login        → API key login
/admin              → Dashboard
/admin/services     → Service CRUD (master-detail split)
/admin/services/new → Create service form
/admin/services/import → JSON import with preview
/admin/review       → Review queue (scraper changes)
/admin/quality      → Data quality scorecard + issue queue
/admin/analytics    → Search behavior + service performance
/admin/scraper      → Scraper run history + source health
/admin/search-test  → Search pipeline debugger
/admin/system       → Maintenance jobs + settings
```

All admin routes are lazy-loaded as a single chunk. Wouter guards redirect unauthenticated users to `/admin/login`.

---

## Authentication & Security

### Auth Model
- **Login**: API key entered on `/admin/login`, validated against `ADMIN_API_KEY` env var
- **Session**: HTTP-only, Secure, SameSite=Strict cookie with 4h expiry
- **Logout**: `POST /api/admin/auth/logout` clears cookie
- **Middleware**: Extend existing `adminAuth` middleware (currently header-based only) to also accept cookie. Keep header validation for backward compatibility with CLI scripts.
- **Future**: Swappable to session-based user accounts (Azure AD for GOA) — middleware interface stays the same

### Security Layers
1. **Soft deletes only** — `isActive = false`, never `DELETE FROM`
2. **DRY_RUN preview** for all bulk/import operations — show "here's what will change" before applying
3. **Batch size limits** — max 50 services per bulk operation
4. **Full audit trail** — every change logged to `service_history` (existing) + `service_change_requests` (new)
5. **Zod validation** on every endpoint input
6. **Drizzle ORM** — no raw SQL, prevents injection
7. **Rate limiting** — separate limiters for admin reads vs writes:
   - **Read endpoints** (GET): 200 req/15min (dashboard loads multiple GETs per page)
   - **Write endpoints** (POST/PATCH): 10 req/15min (existing `adminLimiter` — apply only to writes)
   - The existing `adminLimiter` (10 req/15min on all admin routes) must be split into `adminReadLimiter` and `adminWriteLimiter`
8. **CSRF protection** — CORS origin allowlisting is the current defense. Token-based CSRF is NOT implemented yet (the `middleware/csrf.ts` mentioned in `server/index.ts` does not exist). For v1, CORS + SameSite=Strict cookie is sufficient. Token-based CSRF can be added in v2 if GOA requires it.
9. **Content Security Policy** — strict CSP headers via Helmet (existing)

### GOA-Specific Readiness
- Auth middleware is interface-based — swap API key for Azure AD without rewriting routes
- `search_analytics` retention policy configurable on System page (default 6 months, FOIP compliance)
- `reviewed_by` field on change requests tracks who approved what (audit trail for multi-user)
- Admin API endpoints are cleanly separable if GOA wants admin behind VPN

---

## Pages

### 1. Dashboard (`/admin`)

**Purpose**: At-a-glance health overview + recent activity.

**Stat cards** (top row):
- Active services count
- Pending reviews count (links to review queue)
- Searches today
- Data quality score (aggregate completeness %)

**Global activity feed** (below stats):
- Recent changes across all services from `service_history`
- Each entry shows: service name, what changed, when, source (admin/scraper)
- Click any entry → navigates to that service in the editor

**Quick action links**: Add service, Start review, View quality issues

### 2. Services (`/admin/services`)

**Purpose**: Primary CRUD workspace. Master-detail split view.

**Left panel — Service list**:
- Server-side search (name, category, location)
- Filters: category dropdown, status (active/inactive/all), location, has-embedding, has-geocoding
- Sortable by: name, category, confidence score, last updated
- Checkbox selection for bulk operations
- Pagination (25 per page, server-side)
- Inactive services shown dimmed with strikethrough

**Right panel — Service detail/editor**:
- All service fields (39 total in DB) organized into sections:
  - **Identity**: name, category, serviceId (read-only), location
  - **Contact**: phone, email, websiteUrl, address, contact (legacy, read-only)
  - **Details**: description, eligibility, hoursOfOperation, waitTimes, serviceFormat
  - **Structured data**: processSteps, requiredDocs, languagesSupported, tags (JSON array editors)
  - **Properties**: genderRestriction, ageGroup, is24_7, isFaithBased, is12Step
  - **Data quality**: confidenceScore, enrichmentSource, enrichmentDate, sourcePageHash (read-only), lastUpdated, lastChecked
  - **Geolocation**: latitude, longitude, geocodeSource, geocodedAt (read-only, with "Geocode" button)
  - **Analytics** (read-only): popularityScore, clickCount, embeddingUpdatedAt
- Fields marked read-only are displayed but not editable (system-managed)
- **Save** button with Zod validation
- **History** button → shows per-service change log from `service_history` as a timeline
- **Deactivate** button → confirmation dialog with reason field
- **Stale embedding warning**: After editing name/description/tags, banner shows "Embedding is stale — fields changed since last embed" with "Regenerate" button. Detection: compare `embeddingUpdatedAt` against `lastUpdated` — if `lastUpdated > embeddingUpdatedAt`, embedding is stale. Note: `embeddingUpdatedAt` exists in DB but must be added to Drizzle schema.

**Bulk actions** (when services selected):
- Bulk deactivate (with shared reason)
- Bulk update category
- Bulk regenerate embeddings

**Additional features**:
- **Create new**: `/admin/services/new` — same form, empty state
- **JSON import**: `/admin/services/import` — upload JSON file, see preview table of what will be created, confirm to apply
- **Export**: Download all services as CSV or JSON (filtered by current view)

**URL state**: Filters, search term, selected service ID, and page are in URL params so views are bookmarkable/shareable.

### 3. Review Queue (`/admin/review`)

**Purpose**: Approve/reject scraper and import changes before they go live.

**Layout**: Master-detail split (same pattern as services page).

**Left panel — Change request list**:
- Filter by: source (scraper/import/admin), type (create/update/deactivate), date range
- Sort by: submitted date, source, type
- Badge per item: NEW (green), UPDATE (orange), REMOVE (red)
- Shows: service name, source plugin, time submitted, fields changed count
- Pending count badge in header

**Right panel — Change detail**:

*For new services*:
- Shows all proposed fields in a clean read-only view
- Source URL link for verification
- Confidence score from scraper

*For updates*:
- **Field-level diff view**: only changed fields shown with red (old) / green (new) highlighting
- "Show all fields" toggle to see unchanged fields
- Unchanged field count displayed

*For deactivations*:
- Shows reason (e.g., "URL returned 404")
- Shows current service data for context

**Duplicate detection**:
- When a new service has matching phone, similar name (Levenshtein), or overlapping address with existing service, show warning banner with link to the potential duplicate
- Reviewer can: ignore warning, reject as duplicate, or merge fields

**Service preview**:
- "Preview" button renders the public `ServiceCard` component with proposed data
- Shows exactly how the service will appear in search results

**Action buttons**:
- **Approve** — applies changes to `services` table, triggers embedding regeneration if name/description changed, logs to `service_history`
- **Edit & Approve** — opens proposed data in an editable form, saves edits + approves in one action
- **Reject** — prompts for reason, archives the change request
- **Bulk approve** — select multiple low-risk changes (e.g., all phone updates from 211), approve in batch

**Admin-originated changes bypass review**:
- Services created or edited directly via the admin UI (not via scraper/import) are applied immediately to `services` table — no review queue step
- These changes are still logged to `service_history` for audit trail
- A `service_change_requests` record is created with status `'approved'` for completeness

**Post-approval automation**:
- Embedding generated for new/updated services (when name/description/tags changed)
- After batch review session, prompt: "Refresh search view to make changes live?" (one-click)
- Single approvals also show this prompt (materialized view won't reflect the change until refreshed)

### 4. Data Quality (`/admin/quality`)

**Purpose**: Identify and fix data completeness issues.

**Top section — Completeness scorecard**:
- Field-level bars showing % of active services with each field populated:
  - Phone, email, website, address, description, hours, eligibility
  - Geocoding, embeddings, source URLs, confidence score > 50
- Overall quality score (weighted average)
- Trend indicator (up/down vs last month)

**Bottom section — Issue queue**:
- Prioritized list of actionable issues, sorted by severity:
  - **Critical**: No phone AND no email AND no website (unreachable service)
  - **High**: Confidence score < 30, no description, no source URL
  - **Medium**: Missing geocoding, missing hours, no embedding
  - **Low**: Missing eligibility, no tags
- Each issue shows: service name, issue type, severity badge
- Click → navigates to that service in the service editor (right panel)
- Filter by: issue type, severity, category

### 5. Analytics (`/admin/analytics`)

**Purpose**: Understand search behavior and service performance.

**Time range selector**: Last 7d, 30d, 90d, custom date range. Applies to all charts.

**Data collection prerequisite**: The current `search_analytics` table only logs click events, not all searches. To support the full analytics dashboard, search logging must be extended:
- Log every search query (not just clicks) with: query text, result count, detected intent, timestamp
- This can be a lightweight `search_queries` table or additional rows in `search_analytics` with `event_type = 'search'`
- Without this extension, only click-derived metrics are available (top clicked queries, most clicked services)

**Search tab**:
- **Top queries** — table with query text, search count, click-through rate *(requires search logging)*
- **Zero-result searches** — queries that returned no results *(requires search logging)*
- **Search volume over time** — line chart (Recharts) *(requires search logging)*
- **Intent distribution** — pie/bar chart of detected intents *(requires intent field in search logging)*
- **Fallback if search logging not yet implemented**: Show only click-derived data (top clicked queries, click volume over time)

**Service tab**:
- **Most clicked services** — ranked list with click counts *(available from existing click data)*
- **Least clicked active services** — active services with lowest click counts (possible categorization issue) *(available from existing data)*
- **Click-through rates by category** — which categories get the most clicks *(available from existing data)*
- **Popularity trends** — line chart of top services over time *(available from existing data)*

### 6. Scraper Status (`/admin/scraper`)

**Purpose**: Monitor scraper health and review output.

**Last run summary card**:
- Run date, duration, overall status (success/partial/failed)
- Counts: services discovered, change requests created (new/updated/deactivated), errors
- Link to review queue filtered to this batch

**Source plugin table**:
- Per-plugin row: name, last run status, services found, errors, last successful date
- Color-coded: green (healthy), yellow (partial), red (failed)

**Run history** (scrollable list):
- Previous runs with same summary data
- Click to expand error details

### 7. Search Testing (`/admin/search-test`)

**Purpose**: Debug search quality without CLI. Surfaces `diagnose_query.ts` functionality.

**Input**: Search query text box + optional filters (category, location, age, gender)

**Output** (expandable sections):
1. **Query Analysis**: detected intent, sub-intents, extracted attributes, typo corrections, keyword expansion
2. **LLM Enhancement**: semantic rewrite, LLM intents + confidence scores
3. **SQL Results**: services found by keyword search, with match reasons
4. **Semantic Results**: services found by embedding similarity, with cosine scores
5. **RRF Merge**: combined ranking with per-source rank contribution
6. **Boost Breakdown**: per-service table showing each boost applied (intent, quality, sub-intent, click affinity, filter match) and final score
7. **Final Results**: ordered list as the user would see it, with "why this ranked here" explanation

### 8. System (`/admin/system`)

**Purpose**: Maintenance operations and configuration.

**Maintenance jobs** (button + last-run timestamp for each):
- Refresh search materialized view (existing endpoint)
- Persist AI enrichments to services (existing endpoint)
- Recompute click affinities
- Regenerate all embeddings (with cost estimate + confirmation)

**Configuration**:
- Search cache version (read-only display, bump requires code change)
- Analytics data retention period (dropdown: 3/6/12 months, default 6)
- Auto-purge toggle for expired analytics data

**Status**:
- Database connection health
- Cached query count + cache hit rate
- Last scraper run date
- Service counts by status (active/inactive)

---

## API Endpoints (38 total)

### Authentication (2)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/auth/login` | Validate API key, set session cookie |
| POST | `/api/admin/auth/logout` | Clear session cookie |

### Services CRUD (9)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/services` | Paginated list with search/filter/sort. Params: `q`, `category`, `status`, `location`, `page`, `limit`, `sort`, `order` |
| GET | `/api/admin/services/:id` | Full service detail + enrichment data + quality issues |
| POST | `/api/admin/services` | Create single service (Zod validated) |
| PATCH | `/api/admin/services/:id` | Update service fields (partial, Zod validated). Logs to `service_history`. |
| POST | `/api/admin/services/:id/deactivate` | Soft delete. Body: `{ reason: string }` |
| POST | `/api/admin/services/:id/restore` | Reactivate deactivated service |
| POST | `/api/admin/services/:id/regenerate-embedding` | Re-embed after edits. Returns new embedding timestamp. |
| POST | `/api/admin/services/:id/geocode` | Server-side geocode: looks up service address via Mapbox, writes lat/lng back to service record. |
| GET | `/api/admin/services/:id/history` | Per-service change log from `service_history` |

### Services Bulk Operations (5)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/services/bulk-update` | Update fields on multiple services. Body: `{ ids: number[], changes: object, reason: string, dryRun: boolean }`. Max 50. |
| POST | `/api/admin/services/bulk-deactivate` | Deactivate multiple. Body: `{ ids: number[], reason: string, dryRun: boolean }`. Max 50. |
| POST | `/api/admin/services/bulk-regenerate-embeddings` | Re-embed multiple services. Body: `{ ids: number[] }`. Max 50. Returns job status. |
| POST | `/api/admin/services/import` | JSON upload. Body: `{ services: object[], dryRun: boolean }`. Returns preview or applies. |
| GET | `/api/admin/services/export` | Download CSV or JSON. Params: `format`, `status`, `category`. Streams response for large datasets (800+ services). |

### Review Queue (5)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/review` | Paginated list of change requests. Params: `status`, `source`, `changeType`, `batchId`, `page`, `limit` |
| GET | `/api/admin/review/:id` | Single change request with diff data + duplicate warnings |
| POST | `/api/admin/review/:id/approve` | Apply changes to `services`, log to history, trigger embedding if needed |
| POST | `/api/admin/review/:id/reject` | Reject with reason. Body: `{ reason: string }` |
| PATCH | `/api/admin/review/:id` | Edit proposed changes before approving. Body: `{ changes: object }` |

### Dashboard (1)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/dashboard/stats` | All dashboard stat cards in one call: active count, pending reviews, searches today, quality score |

### Activity & Quality (3)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/activity` | Global recent changes feed. Params: `limit`, `offset` |
| GET | `/api/admin/quality/summary` | Aggregate completeness metrics (field-level %, overall score) |
| GET | `/api/admin/quality/issues` | Paginated issue list. Params: `severity`, `issueType`, `page`, `limit` |

### Analytics (2)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/analytics/searches` | Search query stats. Params: `days` (7/30/90), `page`, `limit` |
| GET | `/api/admin/analytics/services` | Service performance stats. Params: `days`, `page`, `limit` |

### Scraper (2)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/scraper/runs` | Paginated scraper run history |
| GET | `/api/admin/scraper/runs/:id` | Single run detail with per-source breakdown + errors |

### Search Testing (1)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/search-test` | Run query through full pipeline with debug output. Body: `{ query: string, filters?: object }` |

### System (2 existing + 5 new = 7)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/refresh-search` | *(existing)* Refresh materialized view + clear cache |
| POST | `/api/admin/persist-enrichments` | *(existing)* Backfill AI enrichments to services |
| POST | `/api/admin/system/recompute-affinities` | Trigger click affinity recomputation (wraps `compute-click-affinities.mjs` logic) |
| POST | `/api/admin/system/purge-analytics` | Purge `search_analytics` records older than configured retention period |
| POST | `/api/admin/system/regenerate-all-embeddings` | Re-embed all active services. Returns cost estimate if `dryRun: true`, executes if `dryRun: false`. |
| GET | `/api/admin/system/status` | System health: DB connection, cached query count, cache hit rate, last scraper run, service counts by status |
| GET | `/api/admin/system/config` | Read system configuration (analytics retention period, auto-purge toggle). Stored in a `system_config` key-value row or env vars. |

### Review Bulk (1)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/review/bulk-approve` | Approve multiple change requests. Body: `{ ids: number[] }`. Max 50. Applies all changes, triggers embeddings. |

---

## Database Changes

### New Table: `service_change_requests`

```
service_change_requests
├── id                 serial PRIMARY KEY
├── service_id         integer REFERENCES services(id) — nullable (null for creates)
│                      NOTE: uses integer PK, unlike service_history which uses varchar service_id slug.
├── change_type        varchar(20) NOT NULL — 'create' | 'update' | 'deactivate'
├── proposed_changes   jsonb NOT NULL — full proposed field values
├── previous_values    jsonb — current field values at time of submission (for diffs)
├── source             varchar(20) NOT NULL — 'scraper' | 'import' | 'admin'
├── source_plugin      varchar(100) — which scraper plugin (e.g., '211_alberta')
├── source_url         text — provenance link
├── status             varchar(20) NOT NULL DEFAULT 'pending' — 'pending' | 'approved' | 'rejected'
├── batch_id           varchar(100) — groups changes from same scraper run or import
├── duplicate_of       integer REFERENCES services(id) — flagged duplicate
├── submitted_at       timestamp NOT NULL DEFAULT now()
├── reviewed_at        timestamp
├── reviewed_by        varchar(100) — admin identifier (for multi-user audit)
└── review_notes       text
```

Indexes: `status`, `batch_id`, `service_id`, `submitted_at DESC`

### Existing Tables to Add to Drizzle ORM

These tables exist in the database (created by `scraper/init_db.sql`) but are NOT in `shared/schema.ts`. They must be added to Drizzle ORM for the admin UI to use them.

**`service_history`** (exists — used for audit trail):
```
service_history (existing in DB)
├── id                 serial PRIMARY KEY
├── service_id         varchar(255) REFERENCES services(service_id)
├── name               varchar(500) NOT NULL
├── category           varchar(255) NOT NULL
├── description        text
├── location           varchar(500)
├── contact            text
├── eligibility        text
├── process_steps      jsonb
├── wait_times         varchar(255)
├── required_docs      jsonb
├── hours_of_operation varchar(500)
├── languages_supported jsonb
├── service_format     varchar(100)
├── website_url        text
├── changed_fields     jsonb — which fields changed
├── change_type        varchar(50) — 'created' | 'updated' | 'deactivated'
├── recorded_at        timestamp DEFAULT now()
└── confidence_score   integer
```
Already indexed on `service_id`, `recorded_at`, and composite `(service_id, recorded_at)`.

**FK convention mismatch**: `service_history.service_id` is a varchar referencing `services.service_id` (slug), while `service_change_requests.service_id` uses the integer `services.id`. New storage methods must handle this: when writing to `service_history` after approving a change request, look up the string `serviceId` slug from the integer `id`. The existing `changed_fields` JSONB column should carry the full diff (all fields, not just the 15 columns in the history table), since the history table schema is incomplete for modern fields (missing phone, email, address, tags, ageGroup, etc.).

**`scraper_logs`** (exists — extend for review pipeline):
```
scraper_logs (existing in DB)
├── id                    serial PRIMARY KEY
├── run_id                varchar(100) UNIQUE NOT NULL
├── started_at            timestamp DEFAULT now()
├── completed_at          timestamp
├── status                varchar(50)
├── services_checked      integer DEFAULT 0
├── services_updated      integer DEFAULT 0
├── services_created      integer DEFAULT 0
├── services_deactivated  integer DEFAULT 0
├── errors_count          integer DEFAULT 0
├── errors                jsonb
└── duration_seconds      integer
```
Already indexed on `started_at` and `run_id`.

**Fields to ADD to `scraper_logs`** (via ALTER TABLE):
- `source_results` jsonb — per-plugin breakdown: `{ plugin_name: { found, created, updated, errors } }`
- `phases_run` jsonb — which phases executed: `['discover', 'enrich', 'finalize']`
- `config` jsonb — run options (phases, dry_run, skip_review, etc.)

The existing `run_id` serves the same purpose as the proposed `batch_id` in `service_change_requests`. Use `run_id` as the foreign key.

### Existing Table: No Schema Changes

`services`, `ai_service_enrichments`, `service_field_source` — no modifications needed. The review pipeline adds a new workflow layer on top.

**`search_analytics`** — no schema changes, but the Analytics page's full feature set (zero-result searches, search volume, intent distribution) requires extending search tracking beyond clicks. Options:
- Add `event_type` column to `search_analytics` ('click' | 'search') and log all searches, not just clicks
- Or create a separate lightweight `search_queries` table (query, result_count, intent, timestamp)
- The Analytics page has a fallback mode that works with click-only data if this extension is deferred

### Storage Layer Gaps

`server/storage.ts` currently has **zero write operations** for services. The following methods must be added to the `IStorage` interface and `DatabaseStorage` implementation:

- `createService(data)` → INSERT into services + log to service_history
- `updateService(id, changes)` → partial UPDATE + log to service_history
- `deactivateService(id, reason)` → SET isActive=false + log to service_history
- `restoreService(id)` → SET isActive=true + log to service_history
- `bulkUpdateServices(ids, changes, reason)` → batch UPDATE + history
- `bulkDeactivateServices(ids, reason)` → batch soft delete + history
- `createChangeRequest(data)` → INSERT into service_change_requests
- `getChangeRequests(filters, pagination)` → paginated query
- `approveChangeRequest(id)` → apply to services + update status
- `rejectChangeRequest(id, reason)` → update status + notes
- `getScraperRuns(pagination)` → query scraper_logs
- `getQualitySummary()` → aggregate field completeness query
- `getQualityIssues(filters, pagination)` → services with missing fields

---

## Scraper-Side Changes

The Python scraper (`scraper/upserter.py`) must be modified to support the review pipeline:

### Default behavior (with review)
1. Scraper runs discover → enrich phases as normal
2. Scraper runs finalize sub-phases that prepare data for review:
   - **Runs during scraper**: normalize_contacts, geocode_services, enhance_tags, dedupe (duplicate detection feeds review queue warnings)
   - **Deferred to post-approval**: generate_embeddings, refresh_views (these depend on final data after reviewer edits)
3. `upserter.py` creates `service_change_requests` records with status `'pending'` (includes geocoded coords, normalized contacts, enhanced tags)
4. Scraper logs run summary to existing `scraper_logs` table (with new fields)
5. Admin reviews and approves in the admin UI
6. On approve: changes applied to `services`, embedding generated, `service_field_source` updated
7. After review session: admin triggers materialized view refresh

### Bypass flag (`--skip-review`)
For emergencies or initial data loading, `python scraper.py --skip-review` writes directly to `services` as it does today. Change requests are still created but with status `'approved'` for audit trail.

### Batch tracking
Each scraper run generates a unique `run_id` (e.g., `scraper-2026-03-16-020000`), logged to the existing `scraper_logs` table. All `service_change_requests` from that run reference this `run_id` via their `batch_id` field, linking review items to their scraper run.

---

## UI Patterns & Shared Components

### Master-Detail Split
Used by Services and Review Queue pages. Reusable layout component:
- Left panel: scrollable list with search/filter header
- Right panel: detail/edit view
- Left panel highlights selected item
- Responsive: stacks vertically on tablet-width screens

### Confirmation Dialogs
All destructive or bulk actions use Shadcn Dialog component:
- Deactivate service → "Are you sure? This will remove it from search results." + reason field
- Bulk operations → preview count + DRY_RUN results before confirm
- Reject change request → reason field required

### Toast Notifications
Success/error feedback for all operations (save, approve, reject, bulk actions). Non-blocking, auto-dismiss after 5s.

### Empty States
Each page has a designed empty state:
- Review queue: "No pending reviews. All clear!"
- Quality issues: "No issues found. Data quality is excellent."
- Search test: "Enter a query above to see the full scoring pipeline."

### Loading States
Skeleton loaders for lists and detail panels during data fetch. TanStack React Query handles caching and background refetch.

### URL State Persistence
Filters, search terms, selected IDs, pagination, and active tabs are stored in URL query params via Wouter. Views are bookmarkable and shareable.

---

## Error Handling

- All API errors return `{ success: false, message: string }` (existing pattern)
- Network failures show toast with retry option
- Validation errors highlight specific form fields with Zod error messages
- Stale data conflicts (concurrent edit): show "This service was modified by another session. Reload to see changes." with reload button
- Rate limit (429): show "Too many requests. Please wait." with countdown

---

## Scope Boundaries

### In scope (v1)
- All 8 pages described above
- All 38 API endpoints
- 1 new database table (`service_change_requests`)
- 2 existing tables added to Drizzle ORM (`service_history`, `scraper_logs`) with `scraper_logs` extended
- 13+ new storage layer methods in `server/storage.ts`
- Scraper modification for review pipeline (`upserter.py`, `pipeline.py`)
- Code-splitting for zero public bundle impact
- Add `@tanstack/react-table` dependency

### Out of scope (v2+)
- Multi-user accounts and role-based access control
- Email/Slack notifications for scraper completion or review requests
- Scheduled jobs from the UI (triggering scraper runs)
- Mobile-optimized admin layout (desktop-first, usable on tablet)
- Keyboard shortcuts for rapid review queue navigation
- Dark/light theme toggle for admin panel

### Implementation Prerequisites
Before building the admin UI:
1. Add `service_history` and `scraper_logs` table definitions to `shared/schema.ts` (Drizzle ORM)
2. Run `ALTER TABLE scraper_logs ADD COLUMN source_results jsonb, ADD COLUMN phases_run jsonb, ADD COLUMN config jsonb`
3. Create `service_change_requests` table via Drizzle migration
4. Add `@tanstack/react-table` to package.json
5. Extend `adminAuth` middleware to support cookie-based sessions alongside header-based auth
