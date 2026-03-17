# Feedback System Redesign — Design Spec

## Problem

The feedback button is buried at the bottom of the page footer, making it hard to find. There's no way to categorize feedback by type, and no way to flag specific services for review directly from the service detail view. This makes admin triage slow and unstructured.

## Goals

1. Make the feedback button prominent and easy to find (header placement)
2. Add a "Report an issue" option on the expanded service detail view
3. Introduce typed feedback (incorrect info, service closed, missing service, bad search, general)
4. Add a `status` field for admin workflow tracking (new/reviewed/resolved)
5. Produce an admin session prompt for building type-filtered feedback views

## Non-Goals (This Session)

- Admin page UI changes (separate session)
- Feedback notification system (email alerts to admin)
- Auto-actions from feedback (e.g., auto-deactivating flagged services)

---

## Database Schema Changes

Add columns to the existing `feedback` table:

```sql
ALTER TABLE feedback ADD COLUMN type varchar(50) NOT NULL DEFAULT 'general';
ALTER TABLE feedback ADD COLUMN status varchar(20) NOT NULL DEFAULT 'new';
ALTER TABLE feedback ADD COLUMN service_id varchar(255);
ALTER TABLE feedback ADD COLUMN service_name varchar(255);
ALTER TABLE feedback ADD COLUMN search_query varchar(500);
```

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `type` | varchar(50) | NOT NULL | `'general'` | `incorrect_info`, `service_closed`, `missing_service`, `bad_search`, `general` |
| `status` | varchar(20) | NOT NULL | `'new'` | `new`, `reviewed`, `resolved` — for admin workflow |
| `service_id` | varchar(255) | nullable | — | No FK constraint. Matches codebase convention (varchar service IDs). Set for `incorrect_info` and `service_closed` types |
| `service_name` | varchar(255) | nullable | — | Denormalized snapshot — survives service deactivation |
| `search_query` | varchar(500) | nullable | — | Auto-attached for `bad_search` type |

Existing rows backfill to `type='general'`, `status='new'` via column defaults.

The `message` column remains required at the DB level. For `service_closed` type, the frontend auto-fills "Flagged as no longer operating" if the user leaves the message blank.

---

## Frontend Entry Points

### 1. Header Feedback Button

**Location:** In the header bar, left of QuickExitButton.

```
[UCalgary Logo]  ...........  [💬 Feedback] [Quick Exit] [🌐 EN]
```

- Icon: `MessageSquarePlus` from lucide-react
- Responsive: icon-only on mobile (`sm:hidden` for text), icon + "Feedback" label on desktop
- Matches LanguageSwitcher's existing responsive pattern
- Styled as a ghost button consistent with existing header buttons
- Opens feedback modal with types: Missing service, Bad search results (only if search active), General feedback
- Default selection: General feedback

### 2. Service Detail "Report an Issue" Link

**Location:** In the ServiceModal sticky sidebar, below the primary CTA button.

```
┌─────────────────────────┐
│   [Visit Webpage]       │  ← existing primary CTA
│                         │
│   🚩 Report an issue    │  ← new subtle text link
└─────────────────────────┘
```

- Subtle muted text link with small Flag icon
- Not an icon button in the modal header (avoids clutter next to the heart/favorite button)
- Opens feedback modal with types: Incorrect info, Service closed
- Pre-fills `service_id` and `service_name`
- Default selection: Incorrect info

### 3. Remove Footer Feedback Button

- Delete the existing feedback trigger from Home.tsx footer
- Remove associated footer state management
- The header button replaces this — always visible, more discoverable

---

## Feedback Modal Design

**Single `FeedbackModal` component** replacing the existing one. Rendered once at the Home.tsx level (not inside ServiceModal) so it survives service modal closing.

### Props

```typescript
interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  // Context — determines which types show and what's pre-filled
  serviceId?: string;
  serviceName?: string;
  searchQuery?: string;  // current search query, passed from Home.tsx
}
```

### State Management

Home.tsx manages a single `feedbackContext` state where `null` = closed, non-null = open:

```typescript
const [feedbackContext, setFeedbackContext] = useState<{
  serviceId?: string;
  serviceName?: string;
} | null>(null);
```

- Hero receives `openFeedback={() => setFeedbackContext({})}` via props
- ServiceModal receives `openFeedback={(id, name) => setFeedbackContext({ serviceId: id, serviceName: name })}` via props
- Both trigger the same modal instance rendered in Home.tsx
- `searchQuery` is passed directly to FeedbackModal as a separate prop from Home.tsx state (not via feedbackContext), since Home.tsx already holds the current search query
- The "Report an issue" link in ServiceModal calls `openFeedback(service.id, service.name)` using the already-fetched service data from internal component state

The modal resets all internal state (selected type, form fields, contextual fields) when `feedbackContext` becomes `null` (modal closes).

### Type Selector Behavior

| Opened from | Types shown | Default |
|-------------|-------------|---------|
| Header (no search active) | Missing service, General | General |
| Header (search active) | Missing service, Bad search, General | General |
| Service detail | Incorrect info, Service closed | Incorrect info |

### Modal Layout

```
┌──────────────────────────────────────────┐
│  Feedback  /  Report an Issue         ✕  │  ← title based on initial context, not selected type
├──────────────────────────────────────────┤
│                                          │
│  What type of feedback?                  │
│  ○ Incorrect service information         │  ← vertical radio list
│  ○ Service no longer exists              │    (only relevant types shown)
│  ○ Missing service                       │
│  ○ Bad search results                    │
│  ○ General feedback                      │
│                                          │
│  [Context-specific fields — see below]   │
│                                          │
│  Details                                 │
│  ┌────────────────────────────────────┐  │
│  │ Placeholder varies by type...      │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ── Optional ──                          │
│  Name    [________________]              │
│  Email   [________________]              │
│                                          │
│  [        Submit Feedback              ] │
└──────────────────────────────────────────┘
```

**Modal title:** "Report an Issue" when `serviceId` is provided (service context), "Feedback" otherwise. Title does not change when the user switches the selected type.

### Contextual Fields Per Type

**Incorrect info** (`incorrect_info`):
- Read-only service name label (auto-filled)
- Optional "Which fields are wrong?" checkboxes: Phone, Address, Hours, Description, Website, Other
- Checked fields prepended to message text on submit (not stored as separate DB column)
- Placeholder: "Tell us what's wrong with this listing..."

**Service closed** (`service_closed`):
- Read-only service name label (auto-filled)
- Message placeholder: "Any additional details? (optional)"
- If message left blank, frontend auto-fills: "Flagged as no longer operating"

**Missing service** (`missing_service`):
- Required "Service name" text input
- Optional "Website URL" text input
- Both values formatted into message on submit: "Service: {name}\nWebsite: {url}\n\n{details}"
- Placeholder: "Tell us about this service..."

**Bad search results** (`bad_search`):
- Read-only search query label (auto-filled)
- Placeholder: "What were you looking for?"

**General** (`general`):
- No extra fields
- Placeholder: "How can we improve?"

### Preserved From Existing Modal

- Honeypot field (`hp`) for bot prevention
- Success confirmation screen with checkmark
- Toast notifications on success/error
- i18n translation keys (`t('feedback.*')`)
- Existing rate limiting on `/api/feedback`

---

## API Changes

### `POST /api/feedback` (updated)

Update Zod validation to accept new fields:

```typescript
const feedbackSchema = z.object({
  name: z.string().max(255).optional(),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().min(1).max(2000),
  type: z.enum(["incorrect_info", "service_closed", "missing_service", "bad_search", "general"]).default("general"),
  serviceId: z.string().max(255).optional(),
  serviceName: z.string().max(255).optional(),
  searchQuery: z.string().max(500).optional(),
  hp: z.string().max(0).optional(),  // honeypot — max(0) rejects bot-filled values
});
```

Insert logic stores all fields to the `feedback` table. Existing behavior preserved for clients that don't send new fields (defaults to `type='general'`). The existing post-parse honeypot check (`if (validatedData.hp) return fake success`) must be preserved.

---

## Drizzle Schema Update

In `shared/schema.ts`, update the `feedback` table definition:

```typescript
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("general"),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  serviceId: varchar("service_id", { length: 255 }),
  serviceName: varchar("service_name", { length: 255 }),
  searchQuery: varchar("search_query", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## Coexistence with Service Votes

The existing thumbs up/down system on ServiceCard.tsx is a separate, complementary interaction:
- **Votes**: Quick sentiment signal (good/bad), stored in `service_votes` table
- **Feedback**: Structured issue reporting with types and details, stored in `feedback` table

These systems serve different purposes and coexist without conflict.

---

## Files to Modify

| File | Change |
|------|--------|
| `shared/schema.ts` | Add columns to `feedback` table |
| `server/routes/feedback.ts` | Update Zod schema + insert logic |
| `client/src/components/FeedbackModal.tsx` | Full rewrite — typed feedback with contextual fields |
| `client/src/components/Hero.tsx` | Add header feedback button |
| `client/src/components/ServiceModal.tsx` | Add "Report an issue" link in sidebar. Add `openFeedback?: (serviceId: string, serviceName: string) => void` to props interface |
| `client/src/pages/Home.tsx` | Lift feedback state, pass context to Hero + ServiceModal, remove footer button |
| `client/src/lib/i18n/` | Add translation keys for new feedback types and UI strings |

## Files NOT Modified (Deferred to Admin Session)

| File | Future change |
|------|---------------|
| `client/src/pages/admin/Feedback.tsx` | Filter by type, status workflow |
| `server/routes/admin-feedback.ts` | Filter/status update endpoints |

**Backward compatibility note:** The admin GET endpoint (`getAllFeedback()` in `server/storage.ts`) will automatically include new columns via Drizzle. The admin page will continue to work without changes — it just won't surface the new fields until the admin session builds the filtering UI.

## Serialization Formats

**"Which fields are wrong?" checkboxes** (for `incorrect_info` type):
Checked fields are prepended to the message text on submit in this format:
```
Fields reported: Phone, Address, Hours

{user's detail message here}
```

**"Missing service" structured fields:**
Service name and URL are formatted into the message:
```
Service: {service name}
Website: {url or "Not provided"}

{user's detail message here}
```

---

## Admin Session Prompt

After frontend implementation is complete, use the following prompt in a new Claude session to implement the admin-side changes:

```
The feedback system was redesigned. The `feedback` database table now has these columns:
- type: varchar(50) NOT NULL DEFAULT 'general' — values: incorrect_info, service_closed, missing_service, bad_search, general
- status: varchar(20) NOT NULL DEFAULT 'new' — values: new, reviewed, resolved
- service_id: varchar(255) nullable — set for incorrect_info and service_closed types (matches codebase convention of varchar service IDs)
- service_name: varchar(255) nullable — denormalized service name snapshot
- search_query: varchar(500) nullable — set for bad_search type

Update the admin feedback page (client/src/pages/admin/Feedback.tsx) and admin feedback routes (server/routes/admin-feedback.ts):

1. Add a filter bar at the top of the User Messages tab:
   - Dropdown filter by type (All, Incorrect Info, Service Closed, Missing Service, Bad Search, General)
   - Dropdown filter by status (All, New, Reviewed, Resolved)
   - Both filters applied server-side via query params

2. Update the messages table columns to:
   - Type (color-coded badge like category badges on Votes tab)
   - Service (name + link to service if service_id exists, "—" otherwise)
   - Message (existing, line-clamp-2)
   - Status (dropdown to change status inline: new → reviewed → resolved)
   - Date (existing)

3. Add PATCH /api/admin/feedback/:id/status endpoint to update status field.

4. Add server-side filtering: GET /api/admin/feedback?page=X&limit=Y&type=X&status=X

5. "New" feedback count badge on the admin sidebar nav item so admins see unreviewed items at a glance.

See docs/superpowers/specs/2026-03-17-feedback-system-redesign-design.md for the full design spec.
```
