# Admin UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based admin panel for ResourceHub with service CRUD, scraper review pipeline, data quality monitoring, analytics, and operational tools — embedded in the existing React app at `/admin/*`.

**Architecture:** Same-app code-split admin routes. Express API endpoints behind cookie-based auth middleware. Master-detail split UI pattern for services and review queue. New `service_change_requests` table for scraper review pipeline. Existing `service_history` and `scraper_logs` tables added to Drizzle ORM.

**Tech Stack:** React 18, Wouter, TanStack React Query, TanStack Table, Tailwind CSS, Shadcn/ui, Zod, Drizzle ORM, Express, Recharts

**Spec:** `docs/superpowers/specs/2026-03-16-admin-ui-design.md`

---

## File Structure

### New Files (Server)

| File | Responsibility |
|------|----------------|
| `server/routes/admin-services.ts` | Services CRUD + bulk endpoints (9 + 5 = 14 endpoints) |
| `server/routes/admin-review.ts` | Review queue endpoints (5 + 1 bulk = 6 endpoints) |
| `server/routes/admin-dashboard.ts` | Dashboard stats + activity feed (2 endpoints) |
| `server/routes/admin-quality.ts` | Quality summary + issues (2 endpoints) |
| `server/routes/admin-analytics.ts` | Search + service analytics (2 endpoints) |
| `server/routes/admin-scraper.ts` | Scraper run history (2 endpoints) |
| `server/routes/admin-search-test.ts` | Search pipeline debugger (1 endpoint) |
| `server/routes/admin-system.ts` | System status, config, maintenance jobs (5 endpoints) |
| `server/routes/admin-auth.ts` | Login/logout (2 endpoints) |
| `server/middleware/adminSession.ts` | Cookie session middleware (extends existing header auth) |
| `server/search/diagnose.ts` | Extracted diagnosis logic from `diagnose_query.ts` (pure function, no process.exit) |

### New Files (Client)

| File | Responsibility |
|------|----------------|
| `client/src/pages/admin/AdminLayout.tsx` | Sidebar nav + auth guard + outlet for nested routes |
| `client/src/pages/admin/Login.tsx` | API key login form |
| `client/src/pages/admin/Dashboard.tsx` | Stat cards + activity feed |
| `client/src/pages/admin/Services.tsx` | Master-detail service browser |
| `client/src/pages/admin/ServiceEditor.tsx` | *(merged into ServiceForm.tsx component)* |
| `client/src/pages/admin/ServiceCreate.tsx` | Create new service form |
| `client/src/pages/admin/ServiceImport.tsx` | JSON import with DRY_RUN preview |
| `client/src/pages/admin/Review.tsx` | Review queue master-detail |
| `client/src/pages/admin/ReviewDetail.tsx` | *(built inline in Review.tsx right panel)* |
| `client/src/pages/admin/Quality.tsx` | Scorecard + issue queue |
| `client/src/pages/admin/Analytics.tsx` | Search + service tabs with charts |
| `client/src/pages/admin/Scraper.tsx` | Run history + source health |
| `client/src/pages/admin/SearchTest.tsx` | Pipeline debugger UI |
| `client/src/pages/admin/System.tsx` | Maintenance jobs + status + config |
| `client/src/hooks/useAdminAuth.ts` | Auth state hook (check cookie, redirect) |
| `client/src/hooks/useAdminApi.ts` | *(use existing `apiRequest` from `lib/queryClient.ts` — no separate file needed)* |
| `client/src/components/admin/MasterDetailLayout.tsx` | Reusable split layout component |
| `client/src/components/admin/ServiceForm.tsx` | Shared form fields for create/edit |
| `client/src/components/admin/DiffView.tsx` | Field-level before/after diff display |
| `client/src/components/admin/StatCard.tsx` | Dashboard stat card component |

### Modified Files

| File | Change |
|------|--------|
| `shared/schema.ts` | Add `serviceChangeRequests`, `serviceHistory`, `scraperLogs` table definitions |
| `server/storage.ts` | Add 15+ new methods to IStorage interface + DatabaseStorage |
| `server/middleware/adminAuth.ts` | Add cookie validation alongside header auth; split rate limiters |
| `server/routes.ts` | Register new admin route files |
| `server/routes/admin.ts` | Keep existing 2 endpoints, import new route registrars |
| `client/src/App.tsx` | Add lazy-loaded `/admin/*` route |
| `scraper/upserter.py` | Write to `service_change_requests` instead of `services` (with --skip-review bypass) |
| `scraper/pipeline.py` | Log to `scraper_logs` with batch_id, add --skip-review flag |
| `scraper/scraper.py` | Accept --skip-review CLI arg |

### New Files (Tests)

| File | Tests |
|------|-------|
| `server/routes/__tests__/admin-auth.test.ts` | Login/logout, cookie validation |
| `server/routes/__tests__/admin-services.test.ts` | CRUD + bulk endpoints |
| `server/routes/__tests__/admin-review.test.ts` | Review queue endpoints |
| `server/routes/__tests__/admin-quality.test.ts` | Quality metrics |
| `server/__tests__/storage-admin.test.ts` | Storage layer write operations |
| `scraper/tests/test_review_pipeline.py` | Upserter with review mode |

---

## Chunk 1: Foundation (DB Schema, Auth, Storage Layer)

### Task 1: Add existing tables to Drizzle ORM schema

**Files:**
- Modify: `shared/schema.ts`

- [ ] **Step 1: Add `serviceHistory` table definition**

Add after the existing `services` table definition in `shared/schema.ts`:

```typescript
export const serviceHistory = pgTable("service_history", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }),
  contact: text("contact"),
  eligibility: text("eligibility"),
  processSteps: jsonb("process_steps"),
  waitTimes: varchar("wait_times", { length: 255 }),
  requiredDocs: jsonb("required_docs"),
  hoursOfOperation: varchar("hours_of_operation", { length: 500 }),
  languagesSupported: jsonb("languages_supported"),
  serviceFormat: varchar("service_format", { length: 100 }),
  websiteUrl: text("website_url"),
  changedFields: jsonb("changed_fields"),
  changeType: varchar("change_type", { length: 50 }),
  recordedAt: timestamp("recorded_at").defaultNow(),
  confidenceScore: integer("confidence_score").default(100),
});

export type ServiceHistory = typeof serviceHistory.$inferSelect;
```

- [ ] **Step 1b: Add `embeddingUpdatedAt` to services table in Drizzle**

The `embedding_updated_at` column exists in the database but is missing from the Drizzle schema in `shared/schema.ts`. Add to the `services` table definition:

```typescript
  embeddingUpdatedAt: timestamp("embedding_updated_at"),
```

This is needed for the stale embedding warning (comparing `lastUpdated > embeddingUpdatedAt`).

- [ ] **Step 2: Add `scraperLogs` table definition**

```typescript
export const scraperLogs = pgTable("scraper_logs", {
  id: serial("id").primaryKey(),
  runId: varchar("run_id", { length: 100 }).unique().notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: varchar("status", { length: 50 }),
  servicesChecked: integer("services_checked").default(0),
  servicesUpdated: integer("services_updated").default(0),
  servicesCreated: integer("services_created").default(0),
  servicesDeactivated: integer("services_deactivated").default(0),
  errorsCount: integer("errors_count").default(0),
  errors: jsonb("errors"),
  durationSeconds: integer("duration_seconds"),
  // New fields (will be added via ALTER TABLE)
  sourceResults: jsonb("source_results"),
  phasesRun: jsonb("phases_run"),
  config: jsonb("config"),
});

export type ScraperLog = typeof scraperLogs.$inferSelect;
```

- [ ] **Step 3: Add `serviceChangeRequests` table definition**

```typescript
export const serviceChangeRequests = pgTable("service_change_requests", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id"),
  changeType: varchar("change_type", { length: 20 }).notNull(),
  proposedChanges: jsonb("proposed_changes").notNull(),
  previousValues: jsonb("previous_values"),
  source: varchar("source", { length: 20 }).notNull(),
  sourcePlugin: varchar("source_plugin", { length: 100 }),
  sourceUrl: text("source_url"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  batchId: varchar("batch_id", { length: 100 }),
  duplicateOf: integer("duplicate_of"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 100 }),
  reviewNotes: text("review_notes"),
});

export type ServiceChangeRequest = typeof serviceChangeRequests.$inferSelect;
export type InsertServiceChangeRequest = typeof serviceChangeRequests.$inferInsert;
```

- [ ] **Step 4: Run TypeScript type check**

Run: `npm run check`
Expected: PASS (no type errors from new table definitions)

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(schema): add serviceHistory, scraperLogs, serviceChangeRequests to Drizzle ORM"
```

### Task 2: Create database tables and extend scraper_logs

**Files:**
- Create: `scripts/admin-db-setup.mjs`

- [ ] **Step 1: Write the migration script**

```javascript
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Create service_change_requests table
    const createTable = `
      CREATE TABLE IF NOT EXISTS service_change_requests (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id),
        change_type VARCHAR(20) NOT NULL,
        proposed_changes JSONB NOT NULL,
        previous_values JSONB,
        source VARCHAR(20) NOT NULL,
        source_plugin VARCHAR(100),
        source_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        batch_id VARCHAR(100),
        duplicate_of INTEGER REFERENCES services(id),
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewed_by VARCHAR(100),
        review_notes TEXT
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_scr_status ON service_change_requests(status);
      CREATE INDEX IF NOT EXISTS idx_scr_batch_id ON service_change_requests(batch_id);
      CREATE INDEX IF NOT EXISTS idx_scr_service_id ON service_change_requests(service_id);
      CREATE INDEX IF NOT EXISTS idx_scr_submitted_at ON service_change_requests(submitted_at DESC);
    `;

    // 2. Extend scraper_logs with new columns
    const alterScraperLogs = `
      ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS source_results JSONB;
      ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS phases_run JSONB;
      ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS config JSONB;
    `;

    if (DRY_RUN) {
      console.log('[DRY RUN] Would execute:');
      console.log(createTable);
      console.log(createIndexes);
      console.log(alterScraperLogs);
    } else {
      await client.query(createTable);
      console.log('Created service_change_requests table');
      await client.query(createIndexes);
      console.log('Created indexes');
      await client.query(alterScraperLogs);
      console.log('Extended scraper_logs with new columns');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Run in dry-run mode**

Run: `node scripts/admin-db-setup.mjs`
Expected: Prints SQL statements without executing

- [ ] **Step 3: Run for real**

Run: `DRY_RUN=false node scripts/admin-db-setup.mjs`
Expected: "Created service_change_requests table", "Created indexes", "Extended scraper_logs with new columns"

- [ ] **Step 4: Verify tables exist**

Run: `node -e "import('pg').then(({default:pg})=>{const p=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});p.query(\"SELECT table_name FROM information_schema.tables WHERE table_name IN ('service_change_requests','service_history','scraper_logs')\").then(r=>{console.log(r.rows);p.end()})})"`
Expected: All 3 tables listed

- [ ] **Step 5: Commit**

```bash
git add scripts/admin-db-setup.mjs
git commit -m "feat(db): create service_change_requests table, extend scraper_logs"
```

### Task 3: Extend auth middleware for cookie sessions

**Files:**
- Modify: `server/middleware/adminAuth.ts`
- Create: `server/routes/admin-auth.ts`

- [ ] **Step 1: Write failing test for cookie auth**

Create `server/routes/__tests__/admin-auth.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// We'll test the auth flow end-to-end
describe('Admin Auth', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.stubEnv('ADMIN_API_KEY', 'test-admin-key-123');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'test-session-secret');

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Dynamic import to pick up env vars
    const { registerAdminAuthRoutes } = await import('../admin-auth.js');
    const { adminAuth } = await import('../../middleware/adminAuth.js');
    registerAdminAuthRoutes(app);

    // Protected test endpoint
    app.get('/api/admin/test', adminAuth, (_req, res) => {
      res.json({ success: true });
    });
  });

  test('POST /api/admin/auth/login with valid key sets cookie', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ apiKey: 'test-admin-key-123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('admin_session');
  });

  test('POST /api/admin/auth/login with invalid key returns 401', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ apiKey: 'wrong-key' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Protected endpoint accessible with cookie', async () => {
    // Login first
    const loginRes = await request(app)
      .post('/api/admin/auth/login')
      .send({ apiKey: 'test-admin-key-123' });

    const cookie = loginRes.headers['set-cookie'][0];

    // Access protected endpoint with cookie
    const res = await request(app)
      .get('/api/admin/test')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Protected endpoint accessible with Bearer header (backward compat)', async () => {
    const res = await request(app)
      .get('/api/admin/test')
      .set('Authorization', 'Bearer test-admin-key-123');

    expect(res.status).toBe(200);
  });

  test('Protected endpoint returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/admin/test');

    expect(res.status).toBe(401);
  });

  test('POST /api/admin/auth/logout clears cookie', async () => {
    const res = await request(app)
      .post('/api/admin/auth/logout');

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toContain('admin_session=;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/__tests__/admin-auth.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Install cookie-parser and supertest, add env var**

Run: `npm install cookie-parser && npm install -D supertest @types/supertest @types/cookie-parser`

Add `ADMIN_SESSION_SECRET` to `.env` and `.env.example`:
```
ADMIN_SESSION_SECRET=your-random-secret-here
```

- [ ] **Step 4: Implement login/logout routes**

Create `server/routes/admin-auth.ts`:

```typescript
import type { Express, Request, Response } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { createErrorResponse } from "../helpers/errors";

const loginSchema = z.object({
  apiKey: z.string().min(1),
});

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours

function signToken(apiKey: string, secret: string): string {
  return createHash("sha256").update(`${apiKey}:${secret}`).digest("hex");
}

export function verifyToken(token: string, secret: string): boolean {
  const expectedApiKey = process.env.ADMIN_API_KEY;
  if (!expectedApiKey) return false;
  const expected = signToken(expectedApiKey, secret);
  try {
    const tokenBuf = Buffer.from(token, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function registerAdminAuthRoutes(app: Express): void {
  app.post("/api/admin/auth/login", (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(createErrorResponse("Invalid request", undefined, parsed.error.issues));
    }

    const { apiKey } = parsed.data;
    const expectedKey = process.env.ADMIN_API_KEY;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY || "fallback";

    if (!expectedKey) {
      return res.status(404).json({ message: "Not found" });
    }

    // Constant-time comparison
    const hashA = createHash("sha256").update(apiKey).digest();
    const hashB = createHash("sha256").update(expectedKey).digest();
    if (!timingSafeEqual(hashA, hashB)) {
      console.warn(`[AdminAuth] Invalid login attempt from ${req.ip}`);
      return res.status(401).json({ success: false, message: "Invalid API key" });
    }

    const token = signToken(apiKey, sessionSecret);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    console.log(`[AdminAuth] Login successful from ${req.ip}`);
    res.json({ success: true, message: "Logged in" });
  });

  app.post("/api/admin/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true, message: "Logged out" });
  });
}
```

- [ ] **Step 5: Extend adminAuth middleware to accept cookie**

Modify `server/middleware/adminAuth.ts` — add cookie validation:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../routes/admin-auth';

const COOKIE_NAME = "admin_session";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    console.warn('[AdminAuth] ADMIN_API_KEY not configured - admin endpoints disabled');
    return res.status(404).json({ message: 'Not found' });
  }

  // Check Bearer header first (backward compat with CLI scripts)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (constantTimeCompare(token, adminApiKey)) {
      console.log(`[AdminAuth] Header auth granted — ${req.method} ${req.path} from ${req.ip}`);
      return next();
    }
  }

  // Check cookie session
  const sessionToken = req.cookies?.[COOKIE_NAME];
  if (sessionToken) {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY || "fallback";
    if (verifyToken(sessionToken, secret)) {
      console.log(`[AdminAuth] Cookie auth granted — ${req.method} ${req.path} from ${req.ip}`);
      return next();
    }
  }

  console.warn(`[AdminAuth] Unauthorized access attempt — ${req.method} ${req.path} from ${req.ip}`);
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

function constantTimeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

// Split rate limiters: reads vs writes
export const adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many admin write requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Keep old name for backward compat with existing endpoints
export const adminLimiter = adminWriteLimiter;
```

- [ ] **Step 6: Add cookie-parser to Express app**

Modify `server/index.ts` — add `import cookieParser from 'cookie-parser';` and `app.use(cookieParser());` before route registration.

- [ ] **Step 7: Run tests**

Run: `npx vitest run server/routes/__tests__/admin-auth.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 8: Commit**

```bash
git add server/middleware/adminAuth.ts server/routes/admin-auth.ts server/routes/__tests__/admin-auth.test.ts server/index.ts package.json package-lock.json
git commit -m "feat(auth): add cookie-based admin sessions with login/logout endpoints"
```

### Task 4: Add service write operations to storage layer

**Files:**
- Modify: `server/storage.ts`
- Create: `server/__tests__/storage-admin.test.ts`

- [ ] **Step 1: Write failing tests for service CRUD storage methods**

Create `server/__tests__/storage-admin.test.ts`:

```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import { storage } from '../storage';

// These are integration tests requiring DATABASE_URL
describe('Admin Storage Operations', () => {
  let testServiceId: number;

  test('createService inserts a new service and returns it', async () => {
    const result = await storage.createService({
      name: 'Test Admin Service',
      category: 'Mental Health Support',
      location: 'Calgary',
      phone: '403-555-0000',
      description: 'Test service created by admin UI',
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Admin Service');
    expect(result.isActive).toBe(true);
    expect(result.serviceId).toContain('test-admin-service');
    testServiceId = result.id;
  });

  test('updateService partially updates fields and logs to history', async () => {
    const result = await storage.updateService(testServiceId, {
      phone: '403-555-1111',
      description: 'Updated description',
    });

    expect(result.phone).toBe('403-555-1111');
    expect(result.description).toBe('Updated description');
    expect(result.name).toBe('Test Admin Service'); // unchanged
  });

  test('deactivateService sets isActive=false', async () => {
    const result = await storage.deactivateService(testServiceId, 'Test deactivation');
    expect(result.isActive).toBe(false);
  });

  test('restoreService sets isActive=true', async () => {
    const result = await storage.restoreService(testServiceId);
    expect(result.isActive).toBe(true);
  });

  test('getServiceHistory returns change log', async () => {
    const history = await storage.getServiceHistory(testServiceId);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].changeType).toBeDefined();
  });

  // Cleanup
  test('cleanup: deactivate test service', async () => {
    await storage.deactivateService(testServiceId, 'Test cleanup');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/storage-admin.test.ts`
Expected: FAIL — methods don't exist on storage

- [ ] **Step 3: Add method signatures to IStorage interface**

Add to the `IStorage` interface in `server/storage.ts`:

```typescript
  // Admin CRUD
  createService(data: Partial<Service> & { name: string; category: string }): Promise<Service>;
  updateService(id: number, changes: Partial<Service>): Promise<Service>;
  deactivateService(id: number, reason: string): Promise<Service>;
  restoreService(id: number): Promise<Service>;
  getServiceHistory(serviceId: number): Promise<ServiceHistory[]>;
  getAdminServices(params: {
    q?: string;
    category?: string;
    status?: 'active' | 'inactive' | 'all';
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ services: Service[]; total: number }>;
  getAdminServiceDetail(id: number): Promise<Service | undefined>;

  // Bulk operations
  bulkUpdateServices(ids: number[], changes: Partial<Service>, reason: string): Promise<number>;
  bulkDeactivateServices(ids: number[], reason: string): Promise<number>;

  // Review queue
  createChangeRequest(data: InsertServiceChangeRequest): Promise<ServiceChangeRequest>;
  getChangeRequests(params: {
    status?: string;
    source?: string;
    changeType?: string;
    batchId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ requests: ServiceChangeRequest[]; total: number }>;
  getChangeRequestById(id: number): Promise<ServiceChangeRequest | undefined>;
  approveChangeRequest(id: number, reviewedBy?: string): Promise<Service>;
  rejectChangeRequest(id: number, reason: string, reviewedBy?: string): Promise<void>;
  bulkApproveChangeRequests(ids: number[], reviewedBy?: string): Promise<number>;

  // Quality
  getQualitySummary(): Promise<Record<string, number>>;
  getQualityIssues(params: {
    severity?: string;
    issueType?: string;
    page?: number;
    limit?: number;
  }): Promise<{ issues: any[]; total: number }>;

  // Dashboard
  getDashboardStats(): Promise<{
    activeServices: number;
    pendingReviews: number;
    searchesToday: number;
    qualityScore: number;
  }>;
  getRecentActivity(limit?: number): Promise<ServiceHistory[]>;
```

- [ ] **Step 4: Implement createService**

Add to `DatabaseStorage` class:

```typescript
  async createService(data: Partial<Service> & { name: string; category: string }): Promise<Service> {
    const serviceId = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 200);

    const [service] = await db
      .insert(services)
      .values({
        ...data,
        serviceId: `${serviceId}-${Date.now()}`,
        isActive: true,
        lastUpdated: new Date(),
        lastChecked: new Date(),
      })
      .returning();

    // Log to service_history
    await db.insert(serviceHistory).values({
      serviceId: service.serviceId,
      name: service.name,
      category: service.category,
      description: service.description,
      location: service.location,
      changeType: 'created',
      changedFields: JSON.stringify(Object.keys(data)),
    });

    return service;
  }
```

- [ ] **Step 5: Implement updateService**

```typescript
  async updateService(id: number, changes: Partial<Service>): Promise<Service> {
    const [existing] = await db.select().from(services).where(eq(services.id, id));
    if (!existing) throw new Error(`Service ${id} not found`);

    const [updated] = await db
      .update(services)
      .set({ ...changes, lastUpdated: new Date() })
      .where(eq(services.id, id))
      .returning();

    // Log changed fields to history
    const changedKeys = Object.keys(changes).filter(
      k => (changes as any)[k] !== (existing as any)[k]
    );
    if (changedKeys.length > 0) {
      await db.insert(serviceHistory).values({
        serviceId: updated.serviceId,
        name: updated.name,
        category: updated.category,
        description: updated.description,
        location: updated.location,
        changeType: 'updated',
        changedFields: JSON.stringify(changedKeys),
        confidenceScore: updated.confidenceScore,
      });
    }

    return updated;
  }
```

- [ ] **Step 6: Implement deactivateService and restoreService**

```typescript
  async deactivateService(id: number, reason: string): Promise<Service> {
    const [service] = await db
      .update(services)
      .set({ isActive: false, lastUpdated: new Date() })
      .where(eq(services.id, id))
      .returning();

    if (!service) throw new Error(`Service ${id} not found`);

    await db.insert(serviceHistory).values({
      serviceId: service.serviceId,
      name: service.name,
      category: service.category,
      changeType: 'deactivated',
      changedFields: JSON.stringify({ reason }),
    });

    return service;
  }

  async restoreService(id: number): Promise<Service> {
    const [service] = await db
      .update(services)
      .set({ isActive: true, lastUpdated: new Date() })
      .where(eq(services.id, id))
      .returning();

    if (!service) throw new Error(`Service ${id} not found`);

    await db.insert(serviceHistory).values({
      serviceId: service.serviceId,
      name: service.name,
      category: service.category,
      changeType: 'updated',
      changedFields: JSON.stringify(['isActive']),
    });

    return service;
  }
```

- [ ] **Step 7: Implement getServiceHistory**

```typescript
  async getServiceHistory(serviceId: number): Promise<ServiceHistory[]> {
    // Look up the string service_id from the integer id
    const [svc] = await db.select({ serviceId: services.serviceId }).from(services).where(eq(services.id, serviceId));
    if (!svc) return [];

    return db
      .select()
      .from(serviceHistory)
      .where(eq(serviceHistory.serviceId, svc.serviceId))
      .orderBy(desc(serviceHistory.recordedAt))
      .limit(100);
  }
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run server/__tests__/storage-admin.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 9: Commit**

```bash
git add server/storage.ts server/__tests__/storage-admin.test.ts
git commit -m "feat(storage): add service CRUD + history methods to storage layer"
```

### Task 5: Implement remaining storage methods (review queue, quality, dashboard)

**Files:**
- Modify: `server/storage.ts`

- [ ] **Step 1: Implement createChangeRequest and getChangeRequests**

```typescript
  async createChangeRequest(data: InsertServiceChangeRequest): Promise<ServiceChangeRequest> {
    const [request] = await db
      .insert(serviceChangeRequests)
      .values(data)
      .returning();
    return request;
  }

  async getChangeRequests(params: {
    status?: string;
    source?: string;
    changeType?: string;
    batchId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ requests: ServiceChangeRequest[]; total: number }> {
    const { status, source, changeType, batchId, page = 1, limit = 25 } = params;
    const conditions = [];

    if (status) conditions.push(eq(serviceChangeRequests.status, status));
    if (source) conditions.push(eq(serviceChangeRequests.source, source));
    if (changeType) conditions.push(eq(serviceChangeRequests.changeType, changeType));
    if (batchId) conditions.push(eq(serviceChangeRequests.batchId, batchId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceChangeRequests)
      .where(where);

    const requests = await db
      .select()
      .from(serviceChangeRequests)
      .where(where)
      .orderBy(desc(serviceChangeRequests.submittedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return { requests, total: Number(countResult.count) };
  }
```

- [ ] **Step 2: Implement approveChangeRequest**

```typescript
  async approveChangeRequest(id: number, reviewedBy?: string): Promise<Service> {
    const [request] = await db
      .select()
      .from(serviceChangeRequests)
      .where(eq(serviceChangeRequests.id, id));

    if (!request) throw new Error(`Change request ${id} not found`);
    if (request.status !== 'pending') throw new Error(`Change request ${id} is already ${request.status}`);

    const changes = request.proposedChanges as Record<string, any>;

    let service: Service;
    if (request.changeType === 'create') {
      service = await this.createService(changes as any);
    } else if (request.changeType === 'update' && request.serviceId) {
      service = await this.updateService(request.serviceId, changes);
    } else if (request.changeType === 'deactivate' && request.serviceId) {
      service = await this.deactivateService(request.serviceId, request.reviewNotes || 'Approved deactivation');
    } else {
      throw new Error(`Invalid change request type: ${request.changeType}`);
    }

    // Mark as approved
    await db
      .update(serviceChangeRequests)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: reviewedBy || 'admin',
      })
      .where(eq(serviceChangeRequests.id, id));

    return service;
  }
```

- [ ] **Step 3: Implement rejectChangeRequest and bulkApproveChangeRequests**

```typescript
  async rejectChangeRequest(id: number, reason: string, reviewedBy?: string): Promise<void> {
    const [request] = await db
      .select()
      .from(serviceChangeRequests)
      .where(eq(serviceChangeRequests.id, id));

    if (!request) throw new Error(`Change request ${id} not found`);

    await db
      .update(serviceChangeRequests)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: reviewedBy || 'admin',
        reviewNotes: reason,
      })
      .where(eq(serviceChangeRequests.id, id));
  }

  async bulkApproveChangeRequests(ids: number[], reviewedBy?: string): Promise<number> {
    let approved = 0;
    for (const id of ids) {
      try {
        await this.approveChangeRequest(id, reviewedBy);
        approved++;
      } catch (err) {
        console.error(`Failed to approve change request ${id}:`, err);
      }
    }
    return approved;
  }
```

- [ ] **Step 4: Implement getDashboardStats and getQualitySummary**

```typescript
  async getDashboardStats(): Promise<{
    activeServices: number;
    pendingReviews: number;
    searchesToday: number;
    qualityScore: number;
  }> {
    const [activeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(services)
      .where(eq(services.isActive, true));

    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceChangeRequests)
      .where(eq(serviceChangeRequests.status, 'pending'));

    const [searchResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(searchAnalytics)
      .where(gte(searchAnalytics.clickedAt, sql`CURRENT_DATE`));

    // Quality score: % of active services with phone OR email OR website
    const [qualityResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(services)
      .where(and(
        eq(services.isActive, true),
        or(
          isNotNull(services.phone),
          isNotNull(services.email),
          isNotNull(services.websiteUrl),
        ),
      ));

    const activeCount = Number(activeResult.count);
    const reachable = Number(qualityResult.count);
    const qualityScore = activeCount > 0 ? Math.round((reachable / activeCount) * 100) : 0;

    return {
      activeServices: activeCount,
      pendingReviews: Number(pendingResult.count),
      searchesToday: Number(searchResult.count),
      qualityScore,
    };
  }

  async getRecentActivity(limit = 20): Promise<ServiceHistory[]> {
    return db
      .select()
      .from(serviceHistory)
      .orderBy(desc(serviceHistory.recordedAt))
      .limit(limit);
  }

  async getQualitySummary(): Promise<Record<string, number>> {
    const [total] = await db
      .select({ count: sql<number>`count(*)` })
      .from(services)
      .where(eq(services.isActive, true));

    const totalCount = Number(total.count);
    if (totalCount === 0) return {};

    const fields = ['phone', 'email', 'website_url', 'address', 'description',
      'hours_of_operation', 'eligibility', 'latitude', 'tags'] as const;

    const result: Record<string, number> = { total: totalCount };

    for (const field of fields) {
      const [r] = await db
        .select({ count: sql<number>`count(*)` })
        .from(services)
        .where(and(
          eq(services.isActive, true),
          isNotNull(sql.raw(`"${field}"`)),
          sql.raw(`"${field}" != ''`),
        ));
      result[field] = Math.round((Number(r.count) / totalCount) * 100);
    }

    return result;
  }

  async getQualityIssues(params: {
    severity?: string;
    issueType?: string;
    page?: number;
    limit?: number;
  }): Promise<{ issues: any[]; total: number }> {
    const { page = 1, limit = 25 } = params;

    // Find services with missing critical fields
    const issues = await db
      .select({
        id: services.id,
        name: services.name,
        category: services.category,
        phone: services.phone,
        email: services.email,
        websiteUrl: services.websiteUrl,
        description: services.description,
        confidenceScore: services.confidenceScore,
        latitude: services.latitude,
      })
      .from(services)
      .where(and(
        eq(services.isActive, true),
        or(
          isNull(services.phone),
          isNull(services.email),
          isNull(services.websiteUrl),
          isNull(services.description),
          lt(services.confidenceScore, 30),
          isNull(services.latitude),
        ),
      ))
      .orderBy(asc(services.confidenceScore))
      .limit(limit)
      .offset((page - 1) * limit);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(services)
      .where(and(
        eq(services.isActive, true),
        or(
          isNull(services.phone),
          isNull(services.email),
          isNull(services.websiteUrl),
          isNull(services.description),
          lt(services.confidenceScore, 30),
          isNull(services.latitude),
        ),
      ));

    return { issues, total: Number(countResult.count) };
  }
```

- [ ] **Step 5: Implement bulkUpdateServices and bulkDeactivateServices**

```typescript
  async bulkUpdateServices(ids: number[], changes: Partial<Service>, reason: string): Promise<number> {
    let updated = 0;
    for (const id of ids) {
      try {
        await this.updateService(id, changes);
        updated++;
      } catch (err) {
        console.error(`Failed to update service ${id}:`, err);
      }
    }
    return updated;
  }

  async bulkDeactivateServices(ids: number[], reason: string): Promise<number> {
    let deactivated = 0;
    for (const id of ids) {
      try {
        await this.deactivateService(id, reason);
        deactivated++;
      } catch (err) {
        console.error(`Failed to deactivate service ${id}:`, err);
      }
    }
    return deactivated;
  }
```

- [ ] **Step 6: Implement getChangeRequestById and updateChangeRequest**

```typescript
  async getChangeRequestById(id: number): Promise<ServiceChangeRequest | undefined> {
    const [request] = await db
      .select()
      .from(serviceChangeRequests)
      .where(eq(serviceChangeRequests.id, id));
    return request;
  }

  async updateChangeRequest(id: number, changes: Partial<InsertServiceChangeRequest>): Promise<ServiceChangeRequest> {
    const [updated] = await db
      .update(serviceChangeRequests)
      .set(changes)
      .where(eq(serviceChangeRequests.id, id))
      .returning();
    if (!updated) throw new Error(`Change request ${id} not found`);
    return updated;
  }
```

- [ ] **Step 7: Implement getScraperRuns**

```typescript
  async getScraperRuns(params: { page?: number; limit?: number }): Promise<{ runs: ScraperLog[]; total: number }> {
    const { page = 1, limit = 20 } = params;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scraperLogs);

    const runs = await db
      .select()
      .from(scraperLogs)
      .orderBy(desc(scraperLogs.startedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return { runs, total: Number(countResult.count) };
  }

  async getScraperRunById(id: number): Promise<ScraperLog | undefined> {
    const [run] = await db.select().from(scraperLogs).where(eq(scraperLogs.id, id));
    return run;
  }
```

- [ ] **Step 8: Implement getAdminServices (paginated list)**

```typescript
  async getAdminServices(params: {
    q?: string;
    category?: string;
    status?: 'active' | 'inactive' | 'all';
    location?: string;
    hasEmbedding?: boolean;
    hasGeocoding?: boolean;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ services: Service[]; total: number }> {
    const { q, category, status = 'active', location, hasEmbedding, hasGeocoding, page = 1, limit = 25, sort = 'name', order = 'asc' } = params;
    const conditions = [];

    if (status === 'active') conditions.push(eq(services.isActive, true));
    else if (status === 'inactive') conditions.push(eq(services.isActive, false));

    if (category) conditions.push(eq(services.category, category));
    if (location) conditions.push(ilike(services.location, `%${location}%`));
    if (hasEmbedding === true) conditions.push(isNotNull(services.embedding));
    if (hasEmbedding === false) conditions.push(isNull(services.embedding));
    if (hasGeocoding === true) conditions.push(isNotNull(services.latitude));
    if (hasGeocoding === false) conditions.push(isNull(services.latitude));

    if (q) {
      const term = `%${q}%`;
      conditions.push(or(
        ilike(services.name, term),
        ilike(services.category, term),
        ilike(services.location, term),
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn = sort === 'confidence' ? services.confidenceScore
      : sort === 'category' ? services.category
      : sort === 'lastUpdated' ? services.lastUpdated
      : services.name;
    const orderFn = order === 'desc' ? desc : asc;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(services)
      .where(where);

    const result = await db
      .select()
      .from(services)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset((page - 1) * limit);

    return { services: result, total: Number(countResult.count) };
  }

  async getAdminServiceDetail(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }
```

- [ ] **Step 6: Run type check and existing tests**

Run: `npm run check && npx vitest run server/__tests__/storage-admin.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/storage.ts
git commit -m "feat(storage): add review queue, quality, dashboard, paginated services methods"
```

---

## Chunk 2: Admin API Endpoints

### Task 6: Register admin route structure

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/routes/admin.ts`

- [ ] **Step 1: Create route registrar files (stubs)**

Create each file with an empty registrar:

`server/routes/admin-services.ts`:
```typescript
import type { Express } from "express";
export function registerAdminServiceRoutes(app: Express): void {}
```

Repeat for: `admin-review.ts`, `admin-dashboard.ts`, `admin-quality.ts`, `admin-analytics.ts`, `admin-scraper.ts`, `admin-search-test.ts`, `admin-system.ts`

- [ ] **Step 2: Wire up in routes.ts**

Modify `server/routes.ts` to import and register all admin route files:

```typescript
import { registerAdminAuthRoutes } from "./routes/admin-auth";
import { registerAdminServiceRoutes } from "./routes/admin-services";
import { registerAdminReviewRoutes } from "./routes/admin-review";
import { registerAdminDashboardRoutes } from "./routes/admin-dashboard";
import { registerAdminQualityRoutes } from "./routes/admin-quality";
import { registerAdminAnalyticsRoutes } from "./routes/admin-analytics";
import { registerAdminScraperRoutes } from "./routes/admin-scraper";
import { registerAdminSearchTestRoutes } from "./routes/admin-search-test";
import { registerAdminSystemRoutes } from "./routes/admin-system";

// In registerRoutes():
  registerAdminAuthRoutes(app);
  registerAdminServiceRoutes(app);
  registerAdminReviewRoutes(app);
  registerAdminDashboardRoutes(app);
  registerAdminQualityRoutes(app);
  registerAdminAnalyticsRoutes(app);
  registerAdminScraperRoutes(app);
  registerAdminSearchTestRoutes(app);
  registerAdminSystemRoutes(app);
```

- [ ] **Step 3: Run type check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts server/routes/admin-*.ts
git commit -m "feat(routes): scaffold admin route registrar files"
```

### Task 7: Implement services CRUD endpoints

**Files:**
- Modify: `server/routes/admin-services.ts`

- [ ] **Step 1: Implement the full services route file**

```typescript
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter, adminWriteLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";

const serviceCreateSchema = z.object({
  name: z.string().min(1).max(500),
  category: z.string().min(1).max(255),
  location: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  websiteUrl: z.string().optional(),
  description: z.string().optional(),
  eligibility: z.string().optional(),
  hoursOfOperation: z.string().optional(),
  waitTimes: z.string().optional(),
  serviceFormat: z.string().optional(),
  tags: z.array(z.string()).optional(),
  genderRestriction: z.string().optional(),
  ageGroup: z.string().optional(),
  is24_7: z.boolean().optional(),
  isFaithBased: z.boolean().optional(),
  is12Step: z.boolean().optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
});

const serviceUpdateSchema = serviceCreateSchema.partial();

const bulkUpdateSchema = z.object({
  ids: z.array(z.number()).min(1).max(50),
  changes: z.record(z.any()),
  reason: z.string().min(1),
  dryRun: z.boolean().default(true),
});

const bulkDeactivateSchema = z.object({
  ids: z.array(z.number()).min(1).max(50),
  reason: z.string().min(1),
  dryRun: z.boolean().default(true),
});

export function registerAdminServiceRoutes(app: Express): void {
  // GET /api/admin/services — paginated list
  app.get("/api/admin/services", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const { q, category, status, page, limit, sort, order } = req.query;
      const result = await storage.getAdminServices({
        q: q as string,
        category: category as string,
        status: (status as 'active' | 'inactive' | 'all') || 'active',
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 25,
        sort: sort as string,
        order: (order as 'asc' | 'desc') || 'asc',
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Admin services list error:", err);
      res.status(500).json(createErrorResponse("Failed to fetch services"));
    }
  });

  // GET /api/admin/services/export — CSV or JSON download
  app.get("/api/admin/services/export", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const { format = 'json', status, category } = req.query;
      const result = await storage.getAdminServices({
        status: (status as any) || 'all',
        category: category as string,
        limit: 10000,
      });

      if (format === 'csv') {
        const headers = ['id', 'name', 'category', 'location', 'phone', 'email', 'address', 'websiteUrl', 'description', 'isActive', 'confidenceScore'];
        const csv = [
          headers.join(','),
          ...result.services.map(s => headers.map(h => `"${String((s as any)[h] || '').replace(/"/g, '""')}"`).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=services.csv');
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=services.json');
        res.json(result.services);
      }
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json(createErrorResponse("Failed to export services"));
    }
  });

  // GET /api/admin/services/:id — single service detail
  app.get("/api/admin/services/:id", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const service = await storage.getAdminServiceDetail(id);
      if (!service) return res.status(404).json(createErrorResponse("Service not found"));
      res.json({ success: true, service });
    } catch (err) {
      console.error("Admin service detail error:", err);
      res.status(500).json(createErrorResponse("Failed to fetch service"));
    }
  });

  // POST /api/admin/services — create
  app.post("/api/admin/services", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = serviceCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(createErrorResponse("Validation failed", undefined, parsed.error.issues));

      const service = await storage.createService(parsed.data);
      res.status(201).json({ success: true, service });
    } catch (err) {
      console.error("Create service error:", err);
      res.status(500).json(createErrorResponse("Failed to create service"));
    }
  });

  // PATCH /api/admin/services/:id — update
  app.patch("/api/admin/services/:id", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const parsed = serviceUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(createErrorResponse("Validation failed", undefined, parsed.error.issues));

      const service = await storage.updateService(id, parsed.data);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Update service error:", err);
      res.status(500).json(createErrorResponse("Failed to update service"));
    }
  });

  // POST /api/admin/services/:id/deactivate
  app.post("/api/admin/services/:id/deactivate", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
      const service = await storage.deactivateService(id, reason);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Deactivate error:", err);
      res.status(500).json(createErrorResponse("Failed to deactivate service"));
    }
  });

  // POST /api/admin/services/:id/restore
  app.post("/api/admin/services/:id/restore", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const service = await storage.restoreService(id);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Restore error:", err);
      res.status(500).json(createErrorResponse("Failed to restore service"));
    }
  });

  // POST /api/admin/services/:id/regenerate-embedding
  app.post("/api/admin/services/:id/regenerate-embedding", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const service = await storage.getAdminServiceDetail(id);
      if (!service) return res.status(404).json(createErrorResponse("Service not found"));

      // Use existing embedding generation logic
      const { getOpenAI } = await import("../helpers/openai");
      const openai = getOpenAI();
      const text = `${service.name} ${service.description || ''} ${service.category} ${(service.tags as string[] || []).join(' ')}`;

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text.slice(0, 8000),
        dimensions: 1536,
      });

      const embedding = embeddingResponse.data[0].embedding;
      const embeddingStr = `[${embedding.join(',')}]`;

      await db.execute(sql`UPDATE services SET embedding = ${embeddingStr}::vector, embedding_updated_at = NOW() WHERE id = ${id}`);

      res.json({ success: true, message: "Embedding regenerated" });
    } catch (err) {
      console.error("Regenerate embedding error:", err);
      res.status(500).json(createErrorResponse("Failed to regenerate embedding"));
    }
  });

  // POST /api/admin/services/:id/geocode
  app.post("/api/admin/services/:id/geocode", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const service = await storage.getAdminServiceDetail(id);
      if (!service) return res.status(404).json(createErrorResponse("Service not found"));

      const address = service.address || service.location;
      if (!address) return res.status(400).json(createErrorResponse("No address to geocode"));

      const token = process.env.MAPBOX_SECRET_TOKEN;
      if (!token) return res.status(500).json(createErrorResponse("Geocoding not configured"));

      const encoded = encodeURIComponent(address);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=CA&bbox=-120.0,49.0,-110.0,60.0&limit=1`;
      const geoRes = await fetch(url);
      const geoData = await geoRes.json();

      if (!geoData.features?.length) {
        return res.status(404).json(createErrorResponse("Address not found"));
      }

      const [lng, lat] = geoData.features[0].center;
      await storage.updateService(id, {
        latitude: lat,
        longitude: lng,
      } as any);

      res.json({ success: true, latitude: lat, longitude: lng });
    } catch (err) {
      console.error("Geocode error:", err);
      res.status(500).json(createErrorResponse("Failed to geocode service"));
    }
  });

  // GET /api/admin/services/:id/history
  app.get("/api/admin/services/:id/history", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const history = await storage.getServiceHistory(id);
      res.json({ success: true, history });
    } catch (err) {
      console.error("Service history error:", err);
      res.status(500).json(createErrorResponse("Failed to fetch service history"));
    }
  });

  // Bulk operations — register BEFORE :id routes to avoid conflicts
  // POST /api/admin/services/bulk-update
  app.post("/api/admin/services/bulk-update", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(createErrorResponse("Validation failed", undefined, parsed.error.issues));

      const { ids, changes, reason, dryRun } = parsed.data;

      if (dryRun) {
        return res.json({ success: true, dryRun: true, count: ids.length, changes });
      }

      const updated = await storage.bulkUpdateServices(ids, changes, reason);
      res.json({ success: true, updated });
    } catch (err) {
      console.error("Bulk update error:", err);
      res.status(500).json(createErrorResponse("Failed to bulk update"));
    }
  });

  // POST /api/admin/services/bulk-deactivate
  app.post("/api/admin/services/bulk-deactivate", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = bulkDeactivateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(createErrorResponse("Validation failed", undefined, parsed.error.issues));

      const { ids, reason, dryRun } = parsed.data;

      if (dryRun) {
        return res.json({ success: true, dryRun: true, count: ids.length });
      }

      const deactivated = await storage.bulkDeactivateServices(ids, reason);
      res.json({ success: true, deactivated });
    } catch (err) {
      console.error("Bulk deactivate error:", err);
      res.status(500).json(createErrorResponse("Failed to bulk deactivate"));
    }
  });

  // POST /api/admin/services/bulk-regenerate-embeddings
  app.post("/api/admin/services/bulk-regenerate-embeddings", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const { ids } = z.object({ ids: z.array(z.number()).min(1).max(50) }).parse(req.body);
      // Return immediately, process in background
      res.json({ success: true, message: `Regenerating embeddings for ${ids.length} services`, count: ids.length });

      // Background processing (fire-and-forget)
      for (const id of ids) {
        try {
          const service = await storage.getAdminServiceDetail(id);
          if (!service) continue;
          const { getOpenAI } = await import("../helpers/openai");
          const openai = getOpenAI();
          const text = `${service.name} ${service.description || ''} ${service.category} ${(service.tags as string[] || []).join(' ')}`;
          const embRes = await openai.embeddings.create({ model: "text-embedding-3-large", input: text.slice(0, 8000), dimensions: 1536 });
          const embedding = embRes.data[0].embedding;
          await db.execute(sql`UPDATE services SET embedding = ${`[${embedding.join(',')}]`}::vector, embedding_updated_at = NOW() WHERE id = ${id}`);
        } catch (err) {
          console.error(`Failed to re-embed service ${id}:`, err);
        }
      }
    } catch (err) {
      console.error("Bulk regenerate error:", err);
      res.status(500).json(createErrorResponse("Failed to start embedding regeneration"));
    }
  });

  // POST /api/admin/services/import
  app.post("/api/admin/services/import", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const { services: serviceList, dryRun = true } = z.object({
        services: z.array(serviceCreateSchema).min(1).max(50),
        dryRun: z.boolean().default(true),
      }).parse(req.body);

      if (dryRun) {
        return res.json({
          success: true,
          dryRun: true,
          count: serviceList.length,
          preview: serviceList.map(s => ({ name: s.name, category: s.category })),
        });
      }

      const created = [];
      for (const data of serviceList) {
        const service = await storage.createService(data);
        created.push({ id: service.id, name: service.name });
      }

      res.status(201).json({ success: true, created: created.length, services: created });
    } catch (err) {
      console.error("Import error:", err);
      res.status(500).json(createErrorResponse("Failed to import services"));
    }
  });
}
```

**IMPORTANT — Route ordering:** Express matches routes in registration order. In the code above, named routes (`/export`, `/bulk-update`, `/bulk-deactivate`, `/bulk-regenerate-embeddings`, `/import`) MUST be registered BEFORE parameterized routes (`/:id`). The implementer must reorder the function body so the named-path handlers appear first, followed by the `/:id` handlers. Failing to do this will cause `/api/admin/services/export` to match `/:id` with `id="export"`.

**IMPORTANT — Missing import:** The `regenerate-embedding` and `bulk-regenerate-embeddings` handlers use `db` and `sql` directly from Drizzle. Add these imports at the top of the file:

```typescript
import { db } from "../storage";  // or wherever db is exported
import { sql } from "drizzle-orm";
```

Alternatively, move the embedding SQL into a storage method (`storage.regenerateEmbedding(id)`) to keep routes clean.

- [ ] **Step 2: Run type check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/routes/admin-services.ts
git commit -m "feat(api): implement 14 admin service CRUD + bulk endpoints"
```

### Task 8: Implement review queue endpoints

**Files:**
- Modify: `server/routes/admin-review.ts`

- [ ] **Step 1: Implement review route file**

Follow the same Express pattern as Task 7. Endpoints:
- `GET /api/admin/review` — calls `storage.getChangeRequests()`
- `GET /api/admin/review/:id` — calls `storage.getChangeRequestById()`, checks for duplicates (matching phone/name)
- `POST /api/admin/review/:id/approve` — calls `storage.approveChangeRequest()`
- `POST /api/admin/review/:id/reject` — calls `storage.rejectChangeRequest()` with reason
- `PATCH /api/admin/review/:id` — calls `storage.updateChangeRequest(id, { proposedChanges })` to modify proposed changes before approving
- `POST /api/admin/review/bulk-approve` — calls `storage.bulkApproveChangeRequests()`, max 50

Duplicate detection in GET /:id: query `services` for matching phone or name substring (`ILIKE '%name%'`) against `proposedChanges.name`. Return `duplicateWarning: { serviceId, name, matchType }` if found. (Uses simple ILIKE matching rather than Levenshtein, avoiding `fuzzystrmatch` extension dependency.)

- [ ] **Step 2: Run type check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/routes/admin-review.ts
git commit -m "feat(api): implement 6 review queue endpoints with duplicate detection"
```

### Task 9: Implement remaining API endpoints

**Files:**
- Modify: `server/routes/admin-dashboard.ts`
- Modify: `server/routes/admin-quality.ts`
- Modify: `server/routes/admin-analytics.ts`
- Modify: `server/routes/admin-scraper.ts`
- Modify: `server/routes/admin-search-test.ts`
- Modify: `server/routes/admin-system.ts`

- [ ] **Step 1: Implement dashboard endpoints**

`admin-dashboard.ts`:
- `GET /api/admin/dashboard/stats` → `storage.getDashboardStats()`
- `GET /api/admin/activity` → `storage.getRecentActivity(limit)`

- [ ] **Step 2: Implement quality endpoints**

`admin-quality.ts`:
- `GET /api/admin/quality/summary` → `storage.getQualitySummary()`
- `GET /api/admin/quality/issues` → `storage.getQualityIssues(params)`

- [ ] **Step 3: Implement analytics endpoints**

`admin-analytics.ts`:
- `GET /api/admin/analytics/searches` → query `search_analytics` grouped by query, with counts and click rates
- `GET /api/admin/analytics/services` → query `search_analytics` grouped by service_id, join with services for names

Both accept `days` query param (7/30/90) to filter by date range.

- [ ] **Step 4: Implement scraper endpoints**

`admin-scraper.ts`:
- `GET /api/admin/scraper/runs` → query `scraper_logs` ordered by `started_at DESC`, paginated
- `GET /api/admin/scraper/runs/:id` → single run detail by id

- [ ] **Step 5: Implement search test endpoint**

Create `server/search/diagnose.ts` — extract logic from `server/evaluation/diagnose_query.ts`:

```typescript
import { search } from './index';
import { analyzeQuery } from './analyzer';

export async function diagnoseQuery(query: string, filters?: any) {
  const analysis = analyzeQuery(query);

  const startTime = Date.now();
  const response = await search({
    query,
    page: 1,
    pageSize: 20,
    debug: true,
    ...filters,
  });
  const searchTimeMs = Date.now() - startTime;

  return { analysis, response, searchTimeMs };
}
```

`admin-search-test.ts`:
- `POST /api/admin/search-test` → calls `diagnoseQuery()`, returns structured JSON

- [ ] **Step 6: Implement system endpoints**

`admin-system.ts`:
- `GET /api/admin/system/status` → DB ping, cache stats, service counts, last scraper run
- `GET /api/admin/system/config` → return retention period (env var or default 6 months)
- `POST /api/admin/system/regenerate-all-embeddings` → if `dryRun`, return cost estimate; else iterate all active services
- `POST /api/admin/system/recompute-affinities` → wrap `compute-click-affinities.mjs` logic
- `POST /api/admin/system/purge-analytics` → DELETE from `search_analytics` WHERE `clicked_at` < retention cutoff

Plus keep existing: `POST /api/admin/refresh-search` and `POST /api/admin/persist-enrichments` (already in `admin.ts`)

- [ ] **Step 7: Run type check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/routes/admin-*.ts server/search/diagnose.ts
git commit -m "feat(api): implement dashboard, quality, analytics, scraper, search-test, system endpoints"
```

---

## Chunk 3: Admin Frontend

### Task 10: Set up admin routing and layout shell

**Files:**
- Create: `client/src/pages/admin/AdminLayout.tsx`
- Create: `client/src/hooks/useAdminAuth.ts`
- Create: `client/src/pages/admin/Login.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Install TanStack Table**

Run: `npm install @tanstack/react-table`

- [ ] **Step 2: Create auth hook**

`client/src/hooks/useAdminAuth.ts`:

```typescript
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if we can access a protected endpoint
    apiRequest('GET', '/api/admin/dashboard/stats')
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        setIsAuthenticated(false);
        setLocation('/admin/login');
      });
  }, []);

  const login = async (apiKey: string) => {
    const res = await apiRequest('POST', '/api/admin/auth/login', { apiKey });
    if (res.ok) {
      setIsAuthenticated(true);
      setLocation('/admin');
    }
    return res;
  };

  const logout = async () => {
    await apiRequest('POST', '/api/admin/auth/logout');
    setIsAuthenticated(false);
    setLocation('/admin/login');
  };

  return { isAuthenticated, login, logout };
}
```

- [ ] **Step 3: Create Login page**

`client/src/pages/admin/Login.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminLogin() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(apiKey);
    } catch {
      setError('Invalid API key');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ResourceHub Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter admin API key"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create AdminLayout with sidebar**

`client/src/pages/admin/AdminLayout.tsx`:

```tsx
import { Suspense, lazy } from 'react';
import { Route, Switch, Link, useLocation } from 'wouter';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const Dashboard = lazy(() => import('./Dashboard'));
const Services = lazy(() => import('./Services'));
const ServiceCreate = lazy(() => import('./ServiceCreate'));
const ServiceImport = lazy(() => import('./ServiceImport'));
const Review = lazy(() => import('./Review'));
const Quality = lazy(() => import('./Quality'));
const Analytics = lazy(() => import('./Analytics'));
const Scraper = lazy(() => import('./Scraper'));
const SearchTest = lazy(() => import('./SearchTest'));
const System = lazy(() => import('./System'));

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: '▦' },
  { path: '/admin/services', label: 'Services', icon: '◉' },
  { path: '/admin/review', label: 'Review', icon: '✓' },
  { path: '/admin/quality', label: 'Quality', icon: '★' },
  { path: '/admin/analytics', label: 'Analytics', icon: '◷' },
  { path: '/admin/scraper', label: 'Scraper', icon: '⟳' },
  { path: '/admin/search-test', label: 'Search Test', icon: '⌕' },
  { path: '/admin/system', label: 'System', icon: '⚙' },
];

export default function AdminLayout() {
  const { isAuthenticated, logout } = useAdminAuth();
  const [location] = useLocation();

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!isAuthenticated) return null; // useAdminAuth redirects to login

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
        <div className="p-4 text-lg font-bold text-indigo-400">ResourceHub</div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} href={item.path}>
              <a className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                location === item.path || (item.path !== '/admin' && location.startsWith(item.path))
                  ? 'bg-slate-800 text-white border-l-2 border-indigo-400'
                  : 'hover:bg-slate-800'
              }`}>
                <span>{item.icon}</span>
                {item.label}
              </a>
            </Link>
          ))}
        </nav>
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 w-full">
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 overflow-auto">
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
          <Switch>
            <Route path="/admin" component={Dashboard} />
            <Route path="/admin/services/new" component={ServiceCreate} />
            <Route path="/admin/services/import" component={ServiceImport} />
            <Route path="/admin/services" component={Services} />
            <Route path="/admin/review" component={Review} />
            <Route path="/admin/quality" component={Quality} />
            <Route path="/admin/analytics" component={Analytics} />
            <Route path="/admin/scraper" component={Scraper} />
            <Route path="/admin/search-test" component={SearchTest} />
            <Route path="/admin/system" component={System} />
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Add admin routes to App.tsx**

Modify `client/src/App.tsx` — add lazy-loaded admin routes:

```tsx
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminLogin = lazy(() => import("@/pages/admin/Login"));

// In Router component's Switch:
<Route path="/admin/login" component={AdminLogin} />
<Route path="/admin/:rest*" component={AdminLayout} />
```

- [ ] **Step 6: Create stub pages for all admin views**

Create each page file with a minimal placeholder:

```tsx
// client/src/pages/admin/Dashboard.tsx (and similar for each page)
export default function Dashboard() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-slate-500 mt-2">Coming soon...</p></div>;
}
```

Create stubs for: `Dashboard.tsx`, `Services.tsx`, `ServiceCreate.tsx`, `ServiceImport.tsx`, `Review.tsx`, `Quality.tsx`, `Analytics.tsx`, `Scraper.tsx`, `SearchTest.tsx`, `System.tsx`

- [ ] **Step 7: Run dev server and verify routing works**

Run: `npm run dev`
Expected: Navigate to `http://localhost:5173/admin/login` — see login form. After login, sidebar visible with all nav items. Each route shows its stub page.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/admin/ client/src/hooks/ client/src/App.tsx package.json package-lock.json
git commit -m "feat(admin): add admin layout shell with sidebar, auth, routing, and stub pages"
```

### Task 11: Implement Dashboard page

**Files:**
- Modify: `client/src/pages/admin/Dashboard.tsx`
- Create: `client/src/components/admin/StatCard.tsx`

- [ ] **Step 1: Create StatCard component**

```tsx
// client/src/components/admin/StatCard.tsx
import { Card, CardContent } from '@/components/ui/card';

export function StatCard({ label, value, color = 'text-indigo-500' }: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
        <div className="text-sm text-slate-500 mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement Dashboard with stat cards + activity feed**

Replace `Dashboard.tsx` stub with full implementation using `useQuery` to fetch `GET /api/admin/dashboard/stats` and `GET /api/admin/activity`. Display 4 StatCards in a grid + scrollable activity feed list.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/Dashboard.tsx client/src/components/admin/StatCard.tsx
git commit -m "feat(admin): implement dashboard page with stat cards and activity feed"
```

### Task 12: Implement Services page (master-detail split)

**Files:**
- Create: `client/src/components/admin/MasterDetailLayout.tsx`
- Create: `client/src/components/admin/ServiceForm.tsx`
- Modify: `client/src/pages/admin/Services.tsx`

- [ ] **Step 1: Create MasterDetailLayout component**

Reusable split view: left panel (scrollable list, 45% width) + right panel (detail/edit, 55% width). Accepts `left` and `right` as render props. Stacks vertically below 768px.

- [ ] **Step 2: Create ServiceForm component**

Form with all service field sections (Identity, Contact, Details, Structured Data, Properties, Quality, Geolocation, Analytics read-only). Uses React Hook Form + Zod resolver for validation. Shared between Services editor, ServiceCreate, and Review edit-before-approve.

- [ ] **Step 3: Implement Services page**

Left panel: `useQuery` for `GET /api/admin/services` with search input, category filter, status filter, pagination. Display as a compact list with name, category, location, confidence badge.

Right panel: On service selection, fetch `GET /api/admin/services/:id`. Render ServiceForm. Save button calls `PATCH /api/admin/services/:id`. History button toggles a timeline view from `GET /api/admin/services/:id/history`. Deactivate/Restore buttons with confirmation dialogs. Stale embedding warning when `lastUpdated > embeddingUpdatedAt`.

URL state: `?q=&category=&status=&page=&selected=` synced with Wouter query params.

- [ ] **Step 4: Implement ServiceCreate and ServiceImport**

`ServiceCreate.tsx`: Same ServiceForm in create mode. Submit calls `POST /api/admin/services`.

`ServiceImport.tsx`: File upload (JSON), preview table with DRY_RUN, confirm button calls `POST /api/admin/services/import` with `dryRun: false`.

- [ ] **Step 5: Run dev server and test CRUD flow**

Run: `npm run dev`
Expected: Navigate to `/admin/services`. Search, filter, select a service, edit fields, save. Create new service. Deactivate and restore.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/Services.tsx client/src/pages/admin/ServiceCreate.tsx client/src/pages/admin/ServiceImport.tsx client/src/components/admin/
git commit -m "feat(admin): implement services page with master-detail CRUD, create, and import"
```

### Task 13: Implement Review Queue page

**Files:**
- Create: `client/src/components/admin/DiffView.tsx`
- Modify: `client/src/pages/admin/Review.tsx`

- [ ] **Step 1: Create DiffView component**

Takes `previousValues` and `proposedChanges` objects. Shows only changed fields with red (old value, strikethrough) / green (new value) highlighting. "Show all fields" toggle. Unchanged field count.

- [ ] **Step 2: Implement Review page**

Left panel: `useQuery` for `GET /api/admin/review?status=pending`. Filter by source, type. Badge per item (NEW/UPDATE/REMOVE). Pending count in header.

Right panel: For selected change request, show:
- New services: all proposed fields in read-only view + source URL
- Updates: DiffView component + "Show all fields" toggle
- Deactivations: reason + current service data

Duplicate warning banner when `GET /api/admin/review/:id` returns `duplicateWarning`.

Service preview: renders existing `ServiceCard` component with proposed data.

Action buttons: Approve (`POST /review/:id/approve`), Edit & Approve (opens ServiceForm pre-filled with proposed data, then PATCH + approve), Reject (dialog with reason, `POST /review/:id/reject`).

Bulk approve: checkbox selection + "Approve Selected" button → `POST /review/bulk-approve`.

Post-approval prompt: "Refresh search view?" → calls `POST /api/admin/refresh-search`.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/Review.tsx client/src/components/admin/DiffView.tsx
git commit -m "feat(admin): implement review queue with diff view, duplicate detection, approve/reject"
```

### Task 14: Implement remaining pages

**Files:**
- Modify: `client/src/pages/admin/Quality.tsx`
- Modify: `client/src/pages/admin/Analytics.tsx`
- Modify: `client/src/pages/admin/Scraper.tsx`
- Modify: `client/src/pages/admin/SearchTest.tsx`
- Modify: `client/src/pages/admin/System.tsx`

- [ ] **Step 1: Implement Quality page**

Top: Completeness scorecard — horizontal bars for each field showing % populated. Fetch from `GET /api/admin/quality/summary`.

Bottom: Issue queue table from `GET /api/admin/quality/issues`. Filter by severity, issue type. Click row → navigate to `/admin/services?selected={id}`.

- [ ] **Step 2: Implement Analytics page**

Two tabs (Search / Services). Time range selector (7d/30d/90d).

Search tab: Top queries table, search volume line chart (Recharts `LineChart`), click-through rate. Data from `GET /api/admin/analytics/searches?days=30`.

Service tab: Most clicked ranking, least clicked active services, popularity trends line chart. Data from `GET /api/admin/analytics/services?days=30`.

- [ ] **Step 3: Implement Scraper page**

Last run summary card at top. Source plugin health table. Run history list (scrollable, expandable error details). Data from `GET /api/admin/scraper/runs`.

- [ ] **Step 4: Implement SearchTest page**

Input: query text box + optional filters. Submit calls `POST /api/admin/search-test`.

Output: collapsible sections for each pipeline stage (Query Analysis, LLM Enhancement, SQL Results, Semantic Results, RRF Merge, Boost Breakdown, Final Results).

- [ ] **Step 5: Implement System page**

Maintenance jobs: 4 buttons with last-run timestamps. Each calls its respective POST endpoint with loading state.

Status section: DB health, cache stats, service counts. From `GET /api/admin/system/status`.

Config section: Retention period dropdown. From `GET /api/admin/system/config`.

- [ ] **Step 6: Run full dev server test**

Run: `npm run dev`
Expected: All 8 admin pages functional. Navigate through each, verify data loads.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/
git commit -m "feat(admin): implement quality, analytics, scraper, search-test, and system pages"
```

---

## Chunk 4: Scraper Integration

### Task 15: Modify scraper for review pipeline

**Files:**
- Modify: `scraper/upserter.py`
- Modify: `scraper/pipeline.py`
- Modify: `scraper/scraper.py`
- Create: `scraper/tests/test_review_pipeline.py`

- [ ] **Step 1: Write failing test for review mode upsert**

`scraper/tests/test_review_pipeline.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from upserter import upsert_service, RawService

class TestReviewPipeline:
    def test_upsert_creates_change_request_when_review_enabled(self):
        """When review_mode=True, upsert should write to service_change_requests instead of services."""
        session = MagicMock()
        log = MagicMock()
        raw = RawService(name="Test Service", category="Mental Health", source_url="https://example.com")

        result = upsert_service(session, log, raw, "test_source", review_mode=True)

        assert result in ("created", "enriched")
        # Verify change_request was created, not direct service insert
        # Check session.execute calls for INSERT INTO service_change_requests

    def test_upsert_writes_directly_when_skip_review(self):
        """When review_mode=False (default), upsert writes directly to services as before."""
        session = MagicMock()
        log = MagicMock()
        raw = RawService(name="Test Service", category="Mental Health", source_url="https://example.com")

        result = upsert_service(session, log, raw, "test_source", review_mode=False)
        assert result in ("created", "enriched", "skipped")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scraper && pytest tests/test_review_pipeline.py -v`
Expected: FAIL — `review_mode` parameter not accepted

- [ ] **Step 3: Add review_mode parameter to upsert_service**

Modify `scraper/upserter.py`:
- Add `review_mode: bool = False` and `batch_id: Optional[str] = None` params
- When `review_mode=True`:
  - Instead of creating/updating the service directly, INSERT into `service_change_requests`
  - Set `change_type` to 'create' or 'update'
  - Store `proposed_changes` as the raw service data JSON
  - Store `previous_values` as the existing service data (for updates)
  - Set `source`, `source_plugin`, `source_url`, `batch_id`
- When `review_mode=False` (default): existing behavior unchanged

- [ ] **Step 4: Modify pipeline.py for batch tracking and review mode**

- Generate `batch_id` at Pipeline init: `f"scraper-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}"`
- Pass `review_mode` and `batch_id` through to `upsert_service()`
- At run end, INSERT into `scraper_logs` with `run_id=batch_id`, stats, and new `source_results`/`phases_run`/`config` fields

- [ ] **Step 5: Add --skip-review CLI arg to scraper.py**

Modify `scraper/scraper.py`:
- Add `--skip-review` argparse flag
- Default behavior: `review_mode=True` (writes to change_requests)
- With `--skip-review`: `review_mode=False` (writes directly, but still creates change_requests with status='approved')

- [ ] **Step 6: Run tests**

Run: `cd scraper && pytest tests/test_review_pipeline.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scraper/upserter.py scraper/pipeline.py scraper/scraper.py scraper/tests/test_review_pipeline.py
git commit -m "feat(scraper): add review pipeline mode with --skip-review bypass"
```

---

## Chunk 5: Integration Testing & Polish

### Task 16: Run full type check and test suite

- [ ] **Step 1: TypeScript type check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 2: Run all server tests**

Run: `npx vitest run`
Expected: All tests PASS (existing + new admin tests)

- [ ] **Step 3: Run scraper tests**

Run: `cd scraper && pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 4: Build production bundle**

Run: `npm run build`
Expected: PASS — admin chunk code-split from public bundle

- [ ] **Step 5: Verify admin chunk is separate**

Check `dist/` output — there should be a separate chunk for admin pages that is NOT loaded on the public `/` route.

- [ ] **Step 6: Commit any fixes**

Stage only the files you changed (do NOT use `git add -A`):

```bash
git add <specific changed files>
git commit -m "fix: resolve type errors and test failures from admin UI integration"
```

### Task 17: Bump cache version and update CLAUDE.md

- [ ] **Step 1: Bump search cache version**

Increment the cache version constant in `server/search/index.ts` (currently v157 or similar).

- [ ] **Step 2: Update CLAUDE.md**

Add admin UI section to Key Files table. Update cache version reference. Add admin routes and components to the file listing.

- [ ] **Step 3: Commit**

```bash
git add server/search/index.ts CLAUDE.md
git commit -m "chore: bump cache version, update CLAUDE.md with admin UI references"
```
