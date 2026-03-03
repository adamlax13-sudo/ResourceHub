# UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add eight UX features to ResourceHub that improve search engagement, accessibility, and result precision for both direct service seekers and caseworkers.

**Architecture:** All personalization is localStorage-only (no user accounts). Filter state lives in `SearchContext` and syncs to URL params. New backend endpoints are minimal: one new DB table (`service_votes`), one new API endpoint (`POST /api/service-vote`), and an extended search Zod schema for filter params.

**Tech Stack:** React 18, Framer Motion, Shadcn/ui (Sheet, Dialog, Badge), Drizzle ORM, Express, Zod, Web Speech API, Lucide icons.

---

## Feature → Task Map

| Feature | Tasks |
|---------|-------|
| Thumbs micro-feedback | 1, 2 |
| Refine filter panel | 3, 4 |
| SearchContext filter state + URL sync | 5 |
| Category quick-start tiles | 6 |
| Emergency fast-path | 7 |
| Voice search | 8 |
| Guided intake wizard | 9 |
| Collapsible refine panel (UI) | 10 |
| Thumbs UI on ServiceCard | 11 |
| Favorites + PDF export | 12 |
| Share results button | 13 |

---

## Task 1: Add `service_votes` table to schema

**Files:**
- Modify: `shared/schema.ts`

**Step 1: Add the table definition**

At the end of `shared/schema.ts`, add:

```typescript
// Service vote feedback (thumbs up/down on search result cards)
export const serviceVotes = pgTable("service_votes", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).notNull(),
  vote: varchar("vote", { length: 10 }).notNull(), // 'up' or 'down'
  queryContext: text("query_context"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Step 2: Push schema to database**

```bash
npm run db:push
```

Expected: Drizzle applies the new table. No errors.

**Step 3: Verify TypeScript compiles**

```bash
npm run check
```

Expected: No type errors.

**Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(schema): add service_votes table for thumbs feedback"
```

---

## Task 2: Add `POST /api/service-vote` endpoint

**Files:**
- Modify: `server/routes/feedback.ts`
- Modify: `server/storage.ts`

**Step 1: Add storage method**

In `server/storage.ts`, find the `IStorage` interface and the `DatabaseStorage` class. Add:

```typescript
// In IStorage interface:
createServiceVote(serviceId: string, vote: 'up' | 'down', queryContext?: string): Promise<void>;

// In DatabaseStorage class:
async createServiceVote(serviceId: string, vote: 'up' | 'down', queryContext?: string): Promise<void> {
  await db.insert(serviceVotes).values({ serviceId, vote, queryContext: queryContext ?? null });
}
```

Import `serviceVotes` from `@shared/schema` at the top of `storage.ts`.

**Step 2: Add the endpoint to `server/routes/feedback.ts`**

At the bottom of `registerFeedbackRoutes`, before the closing `}`, add:

```typescript
app.post("/api/service-vote", feedbackLimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      serviceId: z.string().min(1).max(255),
      vote: z.enum(['up', 'down']),
      queryContext: z.string().max(500).optional(),
    });
    const { serviceId, vote, queryContext } = schema.parse(req.body);
    await storage.createServiceVote(serviceId, vote, queryContext);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(createErrorResponse("Invalid vote data", undefined, err.errors));
    } else {
      res.status(500).json(createErrorResponse("Failed to record vote"));
    }
  }
});
```

**Step 3: Test the endpoint**

Start the dev server: `npm run dev`

In a separate terminal:
```bash
curl -s -X POST http://localhost:5000/api/service-vote \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"test-123","vote":"up","queryContext":"housing edmonton"}' | jq .
```

Expected: `{"success":true}`

**Step 4: Commit**

```bash
git add server/routes/feedback.ts server/storage.ts
git commit -m "feat(api): add POST /api/service-vote endpoint"
```

---

## Task 3: Extend search API schema with filter fields

**Files:**
- Modify: `shared/routes.ts`
- Modify: `server/search/types.ts`

**Step 1: Extend the Zod input schema in `shared/routes.ts`**

In `api.search.query.input`, after `debug: z.boolean().optional()`, add:

```typescript
// Explicit filters (applied as hard constraints, not boosts)
category: z.string().optional(),
genderRestriction: z.enum(['all', 'women_only', 'men_only']).optional(),
ageGroup: z.enum(['all_ages', 'youth', 'adult', 'senior']).optional(),
is24_7: z.boolean().optional(),
isFaithBased: z.boolean().optional(),
is12Step: z.boolean().optional(),
languagesSupported: z.array(z.string()).optional(),
serviceFormat: z.string().optional(),
```

**Step 2: Add filter fields to `SearchInput` in `server/search/types.ts`**

After `debug?: boolean;`, add:

```typescript
// Explicit filters from UI (applied as hard constraints)
filters?: {
  category?: string;
  genderRestriction?: 'all' | 'women_only' | 'men_only';
  ageGroup?: 'all_ages' | 'youth' | 'adult' | 'senior';
  is24_7?: boolean;
  isFaithBased?: boolean;
  is12Step?: boolean;
  languagesSupported?: string[];
  serviceFormat?: string;
};
```

**Step 3: Pass filters from route handler to search orchestrator**

In `server/routes/search.ts`, update the `search(...)` call:

```typescript
const result = await search({
  query: input.query,
  location: input.location,
  page: input.page ?? 1,
  pageSize: input.pageSize ?? 20,
  debug: input.debug,
  filters: {
    category: input.category,
    genderRestriction: input.genderRestriction,
    ageGroup: input.ageGroup,
    is24_7: input.is24_7,
    isFaithBased: input.isFaithBased,
    is12Step: input.is12Step,
    languagesSupported: input.languagesSupported,
    serviceFormat: input.serviceFormat,
  },
});
```

**Step 4: Verify TypeScript compiles**

```bash
npm run check
```

Expected: No errors.

**Step 5: Commit**

```bash
git add shared/routes.ts server/search/types.ts server/routes/search.ts
git commit -m "feat(api): extend search schema with explicit filter fields"
```

---

## Task 4: Apply filters as hard constraints in search pipeline

**Files:**
- Modify: `server/search/strategies/comprehensive.ts`

**Step 1: Find where filters are applied**

Open `server/search/strategies/comprehensive.ts`. Find the method that handles service filtering (around "Apply filters" comment, which is step 7 in the pipeline described in CLAUDE.md). Look for where `genderRestriction`, `ageGroup` etc. are referenced.

**Step 2: Add explicit filter application**

In the `ComprehensiveSearchStrategy`, find the main `search` method. After the existing filter/scoring logic but before returning results, add a hard-filter pass that respects `input.filters`:

```typescript
// Hard-filter pass: apply explicit UI filters as constraints
if (input.filters) {
  const { category, genderRestriction, ageGroup, is24_7, isFaithBased, is12Step, languagesSupported, serviceFormat } = input.filters;

  results = results.filter(service => {
    if (category && service.category !== category) return false;
    if (genderRestriction && genderRestriction !== 'all' && service.genderRestriction !== genderRestriction) return false;
    if (ageGroup && ageGroup !== 'all_ages' && service.ageGroup !== ageGroup) return false;
    if (is24_7 && !service.is24_7) return false;
    if (isFaithBased !== undefined && service.isFaithBased !== isFaithBased) return false;
    if (is12Step !== undefined && service.is12Step !== is12Step) return false;
    if (serviceFormat && service.serviceFormat !== serviceFormat) return false;
    if (languagesSupported && languagesSupported.length > 0) {
      const svcLangs = (service.languagesSupported as string[] | null) ?? [];
      if (!languagesSupported.some(lang => svcLangs.includes(lang))) return false;
    }
    return true;
  });
}
```

Note: `results` must be an array of service objects with these fields. If the results at this point are `LiteService` objects (without raw DB fields), apply filtering at the DB results stage before converting to `LiteService`.

Explore `comprehensive.ts` carefully to identify the right insertion point. The filter should run on raw DB service objects, not after conversion to `LiteService`.

**Step 3: Test a filter manually**

Start the dev server, then test:

```bash
curl -s -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"addiction support","is24_7":true}' | jq '.services | length'
```

Compare the count with and without `is24_7: true`. Should be fewer results with filter applied.

**Step 4: Commit**

```bash
git add server/search/strategies/comprehensive.ts
git commit -m "feat(search): apply explicit UI filters as hard constraints in pipeline"
```

---

## Task 5: Extend SearchContext with filter state and URL sync

**Files:**
- Modify: `client/src/contexts/SearchContext.tsx`

**Step 1: Add filter types and state**

Replace the current `SearchState` interface and context with this extended version:

```typescript
export interface SearchFilters {
  category?: string;
  genderRestriction?: 'all' | 'women_only' | 'men_only';
  ageGroup?: 'all_ages' | 'youth' | 'adult' | 'senior';
  is24_7?: boolean;
  isFaithBased?: boolean;
  is12Step?: boolean;
  languagesSupported?: string[];
  serviceFormat?: string;
}

interface SearchState {
  query: string;
  locations: string[];
  services: ServiceSummary[];
  hasSearched: boolean;
  filters: SearchFilters;
}

interface SearchContextType {
  searchState: SearchState;
  setSearchResults: (query: string, services: ServiceSummary[], locations?: string[]) => void;
  setLocations: (locations: string[]) => void;
  toggleLocation: (location: string) => void;
  clearSearch: () => void;
  setFilters: (filters: SearchFilters) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}
```

Update `defaultState` to include `filters: {}`.

**Step 2: Add filter methods to the provider**

```typescript
const setFilters = useCallback((filters: SearchFilters) => {
  setSearchState(prev => ({ ...prev, filters }));
}, []);

const clearFilters = useCallback(() => {
  setSearchState(prev => ({ ...prev, filters: {} }));
}, []);

// Compute active filter count for badge display
const activeFilterCount = Object.values(searchState.filters).filter(v =>
  v !== undefined && v !== 'all' && v !== 'all_ages' && !(Array.isArray(v) && v.length === 0)
).length;
```

**Step 3: Add URL sync (read on mount, write on search)**

At the top of `SearchProvider`, add URL param reading on mount:

```typescript
// On mount: restore state from URL params (for shared links)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  const loc = params.get('loc');
  if (q) {
    // URL params will trigger a search in Home.tsx via a separate effect
    // Just restore query/location to state so Hero shows the right values
    setSearchState(prev => ({
      ...prev,
      query: q,
      locations: loc ? [loc] : prev.locations,
    }));
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Add a helper to update URL (called after searches):

```typescript
export function updateSearchUrl(query: string, location?: string, filters?: SearchFilters) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (location) params.set('loc', location);
  if (filters?.category) params.set('cat', filters.category);
  if (filters?.genderRestriction && filters.genderRestriction !== 'all') params.set('gender', filters.genderRestriction);
  if (filters?.is24_7) params.set('24h', '1');
  if (filters?.isFaithBased) params.set('faith', '1');
  if (filters?.is12Step) params.set('12step', '1');
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}
```

**Step 4: Export the new types and the helper**

Add to exports at the bottom:

```typescript
export type { SearchFilters };
```

**Step 5: Verify TypeScript compiles**

```bash
npm run check
```

Expected: No errors.

**Step 6: Commit**

```bash
git add client/src/contexts/SearchContext.tsx
git commit -m "feat(context): add filter state, URL sync, and activeFilterCount to SearchContext"
```

---

## Task 6: CategoryTiles landing component

**Files:**
- Create: `client/src/components/CategoryTiles.tsx`
- Modify: `client/src/pages/Home.tsx`

**Step 1: Create `CategoryTiles.tsx`**

```tsx
import { motion } from "framer-motion";

export const CATEGORIES = [
  { label: "Crisis Support",         icon: "🆘", gradient: "from-red-500/20 to-orange-400/20",    query: "crisis support emergency help" },
  { label: "Addiction Recovery",     icon: "🌱", gradient: "from-green-500/20 to-teal-400/20",   query: "addiction recovery treatment" },
  { label: "Mental Health",          icon: "🧠", gradient: "from-purple-500/20 to-indigo-400/20", query: "mental health counselling therapy" },
  { label: "Housing",                icon: "🏠", gradient: "from-blue-500/20 to-cyan-400/20",    query: "housing shelter accommodation" },
  { label: "Food & Basic Needs",     icon: "🍽️", gradient: "from-yellow-500/20 to-amber-400/20", query: "food bank meals basic needs" },
  { label: "Disability Support",     icon: "♿", gradient: "from-slate-500/20 to-zinc-400/20",   query: "disability support accessibility" },
  { label: "Healthcare",             icon: "⚕️", gradient: "from-rose-500/20 to-pink-400/20",   query: "healthcare medical clinic" },
  { label: "Employment",             icon: "💼", gradient: "from-orange-500/20 to-yellow-400/20", query: "employment job training work" },
] as const;

interface CategoryTilesProps {
  onSelect: (query: string) => void;
}

export function CategoryTiles({ onSelect }: CategoryTilesProps) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <p className="text-center text-muted-foreground mb-6 text-sm">
        Not sure where to start? Browse by category:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat, i) => (
          <motion.button
            key={cat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => onSelect(cat.query)}
            className={`
              flex flex-col items-center gap-2 p-4 rounded-2xl border border-border/50
              bg-gradient-to-br ${cat.gradient} backdrop-blur-sm
              hover:border-primary/40 hover:scale-105 transition-all duration-200
              cursor-pointer text-center
            `}
          >
            <span className="text-3xl" role="img" aria-label={cat.label}>{cat.icon}</span>
            <span className="text-xs font-semibold text-foreground leading-tight">{cat.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Replace the flip-card tutorial in `Home.tsx` with `CategoryTiles`**

In `Home.tsx`:
- Import `CategoryTiles` at the top
- Find where the flip-cards are rendered (the section that shows when `!searchState.hasSearched`)
- Replace the flip-card grid with `<CategoryTiles onSelect={handleCategorySelect} />`

Add the handler (just above the JSX return):

```typescript
const handleCategorySelect = useCallback((query: string) => {
  handleSearch(query, searchState.locations);
}, [handleSearch, searchState.locations]);
```

Where `handleSearch` is the existing function that calls `searchMutation.mutate(...)`.

**Step 3: Verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`. Confirm:
- Category tiles show on landing (no search results)
- Clicking a tile triggers a search
- Tiles disappear once `hasSearched` is true

**Step 4: Commit**

```bash
git add client/src/components/CategoryTiles.tsx client/src/pages/Home.tsx
git commit -m "feat(ui): add category quick-start tiles to landing state"
```

---

## Task 7: Emergency fast-path button in Hero

**Files:**
- Modify: `client/src/components/Hero.tsx`

**Step 1: Add the emergency button prop interface**

Update `HeroProps` in `Hero.tsx` to add:

```typescript
onEmergencySearch: () => void;
```

**Step 2: Add the button to the Hero JSX**

Inside the hero form, before the search input container, add:

```tsx
{/* Emergency fast-path */}
<button
  type="button"
  onClick={onEmergencySearch}
  className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl
             shadow-lg animate-pulse hover:animate-none transition-all duration-200
             flex items-center justify-center gap-2 text-sm"
>
  <span>🆘</span>
  I need help right now
</button>
```

**Step 3: Wire it up in `Home.tsx`**

Add an `handleEmergencySearch` function in `Home.tsx`:

```typescript
const handleEmergencySearch = useCallback(() => {
  handleSearch("crisis support emergency help right now", searchState.locations);
}, [handleSearch, searchState.locations]);
```

Pass it to `<Hero onEmergencySearch={handleEmergencySearch} ... />`.

**Step 4: Check TypeScript**

```bash
npm run check
```

**Step 5: Verify visually**

Open `http://localhost:5173`. Confirm:
- Red button visible below/near the search bar
- Clicking it triggers a search for crisis services
- Crisis services appear pinned at top of results (existing backend pinning)

**Step 6: Commit**

```bash
git add client/src/components/Hero.tsx client/src/pages/Home.tsx
git commit -m "feat(ui): add emergency fast-path button to hero"
```

---

## Task 8: Voice search mic button in Hero

**Files:**
- Modify: `client/src/components/Hero.tsx`

**Step 1: Add a custom hook for speech recognition**

At the top of `Hero.tsx` (or in a new `client/src/hooks/use-speech.ts` file), add:

```typescript
function useSpeechRecognition(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-CA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [onResult]);

  return { isSupported, isListening, startListening };
}
```

**Step 2: Add the mic button inside the search input field**

In the `HeroForm` component (or wherever the search `<input>` is rendered), find the input container. Add a mic button as a trailing element:

```tsx
const { isSupported, isListening, startListening } = useSpeechRecognition((text) => {
  setQuery(text);        // fill the input
  handleSubmit(text);   // trigger search immediately
});

// Inside the input wrapper div:
{isSupported && (
  <button
    type="button"
    onClick={startListening}
    disabled={isListening}
    aria-label={isListening ? "Listening..." : "Search by voice"}
    className="absolute right-14 top-1/2 -translate-y-1/2 p-2 text-muted-foreground
               hover:text-primary transition-colors"
  >
    <Mic className={`w-5 h-5 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
  </button>
)}
```

Import `Mic` from `lucide-react`.

**Step 3: Verify**

```bash
npm run dev
```

Open in Chrome (best Speech API support). Confirm:
- Mic icon appears in search input
- Clicking → browser asks for mic permission
- Speaking a phrase fills input and triggers search
- Firefox: mic icon hidden (Speech API not supported)

**Step 4: Commit**

```bash
git add client/src/components/Hero.tsx
git commit -m "feat(ui): add voice search with Web Speech API to Hero"
```

---

## Task 9: Guided intake wizard

**Files:**
- Create: `client/src/components/IntakeWizard.tsx`
- Modify: `client/src/components/Hero.tsx`

**Step 1: Create `IntakeWizard.tsx`**

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/components/CategoryTiles";
import { motion, AnimatePresence } from "framer-motion";

const WHO_OPTIONS = [
  { label: "Myself", value: "I am looking for" },
  { label: "Someone I care for", value: "Looking for help for someone who needs" },
  { label: "A client I'm supporting", value: "Finding services for a client needing" },
];

const REQUIREMENT_OPTIONS = [
  { label: "Women-only services", key: "women_only" },
  { label: "French language", key: "french" },
  { label: "Walk-in (no appointment)", key: "walk_in" },
  { label: "Available 24/7", key: "24_7" },
  { label: "Faith-based", key: "faith_based" },
  { label: "No referral needed", key: "no_referral" },
];

interface IntakeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string, filters: Record<string, unknown>) => void;
}

export function IntakeWizard({ open, onOpenChange, onSearch }: IntakeWizardProps) {
  const [step, setStep] = useState(0);
  const [who, setWho] = useState("");
  const [category, setCategory] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);

  const reset = () => { setStep(0); setWho(""); setCategory(""); setRequirements([]); };

  const handleFinish = () => {
    const prefix = who || "Looking for";
    const query = `${prefix} ${category} services in Alberta`;
    const filters: Record<string, unknown> = {
      is24_7: requirements.includes("24_7") || undefined,
      genderRestriction: requirements.includes("women_only") ? "women_only" : undefined,
      isFaithBased: requirements.includes("faith_based") || undefined,
    };
    Object.keys(filters).forEach(k => filters[k] === undefined && delete filters[k]);
    onSearch(query, filters);
    reset();
    onOpenChange(false);
  };

  const toggleReq = (key: string) =>
    setRequirements(prev => prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Let us help you find the right service</DialogTitle>
          {/* Step indicator */}
          <div className="flex gap-2 pt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="font-medium mb-4">Who needs help?</p>
              <div className="grid gap-2">
                {WHO_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setWho(opt.value); setStep(1); }}
                    className="text-left p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="font-medium mb-4">What's most urgent?</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.label}
                    onClick={() => { setCategory(cat.label); setStep(2); }}
                    className={`p-3 rounded-xl border border-border hover:border-primary
                      bg-gradient-to-br ${cat.gradient} text-sm font-medium flex items-center gap-2 transition-all`}
                  >
                    <span>{cat.icon}</span>{cat.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="font-medium mb-4">Any specific requirements? <span className="text-muted-foreground font-normal">(optional)</span></p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {REQUIREMENT_OPTIONS.map(req => (
                  <button
                    key={req.key}
                    onClick={() => toggleReq(req.key)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all text-left
                      ${requirements.includes(req.key)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'}`}
                  >
                    {req.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={handleFinish} className="flex-1">Find services</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add wizard trigger to `Hero.tsx`**

Add a prop `onWizardOpen: () => void` to `HeroProps`.

Below the search input, add:
```tsx
<button
  type="button"
  onClick={onWizardOpen}
  className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors mt-1"
>
  Not sure what to search for? Let us guide you →
</button>
```

**Step 3: Wire it up in `Home.tsx`**

```tsx
const [wizardOpen, setWizardOpen] = useState(false);

const handleWizardSearch = useCallback((query: string, filters: Record<string, unknown>) => {
  // Apply filters to SearchContext then run search
  setFilters(filters as SearchFilters);
  handleSearch(query, searchState.locations, filters as SearchFilters);
}, [setFilters, handleSearch, searchState.locations]);
```

Add `<IntakeWizard open={wizardOpen} onOpenChange={setWizardOpen} onSearch={handleWizardSearch} />` near the end of the JSX.

Pass `onWizardOpen={() => setWizardOpen(true)}` to `<Hero>`.

**Step 4: Check TypeScript and verify flow**

```bash
npm run check
npm run dev
```

Complete the wizard. Verify the assembled query and any filter chips appear in results.

**Step 5: Commit**

```bash
git add client/src/components/IntakeWizard.tsx client/src/components/Hero.tsx client/src/pages/Home.tsx
git commit -m "feat(ui): add guided intake wizard with 3-step flow"
```

---

## Task 10: Collapsible Refine filter panel

**Files:**
- Create: `client/src/components/RefinePanel.tsx`
- Modify: `client/src/pages/Home.tsx`

**Step 1: Create `RefinePanel.tsx`**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X } from "lucide-react";
import { type SearchFilters } from "@/contexts/SearchContext";

const GENDER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Women-only", value: "women_only" },
  { label: "Men-only", value: "men_only" },
] as const;

const AGE_OPTIONS = [
  { label: "All ages", value: "all_ages" },
  { label: "Youth", value: "youth" },
  { label: "Adult", value: "adult" },
  { label: "Senior", value: "senior" },
] as const;

const LANGUAGE_OPTIONS = ["English", "French", "Spanish", "Punjabi", "Tagalog", "Arabic", "Cree", "Ukrainian"];

interface RefinePanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClear: () => void;
  activeFilterCount: number;
}

export function RefinePanel({ filters, onFiltersChange, onClear, activeFilterCount }: RefinePanelProps) {
  const update = (patch: Partial<SearchFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <SlidersHorizontal className="w-4 h-4" />
          Refine
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Refine results
            {activeFilterCount > 0 && (
              <button onClick={onClear} className="text-xs text-muted-foreground hover:text-primary">
                Clear all
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Gender restriction */}
          <div>
            <p className="text-sm font-medium mb-2">Gender restriction</p>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update({ genderRestriction: opt.value as SearchFilters['genderRestriction'] })}
                  className={`px-3 py-1 rounded-full text-sm border transition-all
                    ${(filters.genderRestriction ?? 'all') === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age group */}
          <div>
            <p className="text-sm font-medium mb-2">Age group</p>
            <div className="flex flex-wrap gap-2">
              {AGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update({ ageGroup: opt.value as SearchFilters['ageGroup'] })}
                  className={`px-3 py-1 rounded-full text-sm border transition-all
                    ${(filters.ageGroup ?? 'all_ages') === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div>
            <p className="text-sm font-medium mb-2">Service type</p>
            <div className="space-y-2">
              {[
                { key: 'is24_7' as const, label: '24/7 availability' },
                { key: 'isFaithBased' as const, label: 'Faith-based services' },
                { key: 'is12Step' as const, label: '12-step programs' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!filters[key]}
                    onChange={e => update({ [key]: e.target.checked || undefined })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <p className="text-sm font-medium mb-2">Language</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(lang => {
                const selected = (filters.languagesSupported ?? []).includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => {
                      const current = filters.languagesSupported ?? [];
                      update({ languagesSupported: selected ? current.filter(l => l !== lang) : [...current, lang] });
                    }}
                    className={`px-3 py-1 rounded-full text-sm border transition-all
                      ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Add active filter chips display**

In `Home.tsx`, add a filter chips bar between the hero and results:

```tsx
import { X } from "lucide-react";
import { RefinePanel } from "@/components/RefinePanel";
import { useSearchContext, updateSearchUrl, type SearchFilters } from "@/contexts/SearchContext";

// In the results section, above the grid:
{searchState.hasSearched && (
  <div className="flex items-center gap-2 flex-wrap mb-4">
    <RefinePanel
      filters={searchState.filters}
      onFiltersChange={(filters) => {
        setFilters(filters);
        // Re-run search with new filters
        handleSearch(searchState.query, searchState.locations, filters);
      }}
      onClear={() => {
        clearFilters();
        handleSearch(searchState.query, searchState.locations, {});
      }}
      activeFilterCount={activeFilterCount}
    />

    {/* Active filter chips */}
    {searchState.filters.genderRestriction && searchState.filters.genderRestriction !== 'all' && (
      <Badge variant="secondary" className="gap-1">
        {searchState.filters.genderRestriction === 'women_only' ? 'Women-only' : 'Men-only'}
        <button onClick={() => { ... }}><X className="w-3 h-3" /></button>
      </Badge>
    )}
    {searchState.filters.is24_7 && (
      <Badge variant="secondary" className="gap-1">
        24/7
        <button onClick={() => { ... }}><X className="w-3 h-3" /></button>
      </Badge>
    )}
    {/* Add chips for other active filters similarly */}
  </div>
)}
```

For each chip's `onClick`, call `setFilters({ ...searchState.filters, [field]: undefined })` then re-run search.

**Step 3: Pass filters through to the search hook**

Ensure `handleSearch` in `Home.tsx` accepts optional filters and passes them to `searchMutation.mutate(...)`:

```typescript
const handleSearch = useCallback((query: string, locations: string[], filters?: SearchFilters) => {
  const location = locations[0] ?? undefined;
  searchMutation.mutate({
    query,
    location,
    ...filters,
  });
  updateSearchUrl(query, location, filters ?? searchState.filters);
}, [searchMutation, searchState.filters]);
```

**Step 4: Check TypeScript**

```bash
npm run check
```

**Step 5: Verify**

Test: run a search → click Refine → toggle "24/7" → confirm results shrink → badge count shows "1" → chip appears → click X on chip → filter clears.

**Step 6: Commit**

```bash
git add client/src/components/RefinePanel.tsx client/src/pages/Home.tsx
git commit -m "feat(ui): add collapsible Refine filter panel with active filter chips"
```

---

## Task 11: Thumbs micro-feedback on ServiceCard

**Files:**
- Modify: `client/src/components/ServiceCard.tsx`

**Step 1: Add thumbs buttons to `ServiceCard.tsx`**

Import `ThumbsUp`, `ThumbsDown` from `lucide-react`.

Add a `queryContext` prop and a vote tracking helper using `localStorage`:

```typescript
interface ServiceCardProps {
  service: ServiceSummary;
  onClick: () => void;
  index: number;
  queryContext?: string;
}

function getVoteKey(serviceId: string) {
  return `roc_vote_${serviceId}`;
}

export function ServiceCard({ service, onClick, index, queryContext }: ServiceCardProps) {
  const [vote, setVote] = useState<'up' | 'down' | null>(() => {
    try {
      return (localStorage.getItem(getVoteKey(service.id)) as 'up' | 'down' | null);
    } catch { return null; }
  });

  const handleVote = useCallback(async (v: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation(); // Don't open the modal
    if (vote === v) return; // Already voted this way
    setVote(v);
    try { localStorage.setItem(getVoteKey(service.id), v); } catch { /* ignore */ }
    try {
      await fetch('/api/service-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: service.id, vote: v, queryContext }),
      });
    } catch { /* silent fail — feedback is non-critical */ }
  }, [vote, service.id, queryContext]);
```

**Step 2: Add the thumbs UI at the bottom of the card**

Before the "View Details" footer, add:

```tsx
{/* Micro-feedback */}
<div className="absolute bottom-3 right-3 flex gap-1" onClick={e => e.stopPropagation()}>
  <button
    onClick={(e) => handleVote('up', e)}
    aria-label="Helpful"
    className={`p-1 rounded transition-colors ${vote === 'up' ? 'text-green-600' : 'text-muted-foreground/40 hover:text-green-600'}`}
  >
    <ThumbsUp className="w-3.5 h-3.5" />
  </button>
  <button
    onClick={(e) => handleVote('down', e)}
    aria-label="Not helpful"
    className={`p-1 rounded transition-colors ${vote === 'down' ? 'text-red-500' : 'text-muted-foreground/40 hover:text-red-500'}`}
  >
    <ThumbsDown className="w-3.5 h-3.5" />
  </button>
</div>
```

**Step 3: Pass `queryContext` from `Home.tsx`**

In the results grid in `Home.tsx`:
```tsx
<ServiceCard
  key={service.id}
  service={service}
  onClick={() => setSelectedServiceId(service.id)}
  index={i}
  queryContext={searchState.query}
/>
```

**Step 4: Verify**

Click thumbs up on a card — it turns green. Check network tab: `POST /api/service-vote` fires. Click same card's thumb again — no second request (localStorage guard). Card click still opens modal (propagation stopped).

**Step 5: Commit**

```bash
git add client/src/components/ServiceCard.tsx client/src/pages/Home.tsx
git commit -m "feat(ui): add thumbs up/down micro-feedback to service cards"
```

---

## Task 12: Favorites + PDF export + My Shortlist

**Files:**
- Create: `client/src/components/MyShortlist.tsx`
- Modify: `client/src/components/ServiceCard.tsx`
- Modify: `client/src/components/ServiceModal.tsx`
- Modify: `client/src/pages/Home.tsx`

**Step 1: Note on `useFavorites` hook**

The hook at `client/src/hooks/use-favorites.ts` already accepts `ServiceDetail` in `addFavorite`. For cards (which have `ServiceSummary`), we need to accept the common fields. Update `use-favorites.ts` to accept either by changing the parameter type:

```typescript
// Change addFavorite signature to accept a subset:
interface AddFavoriteInput {
  id: string;
  name: string;
  category: string;
  location: string;
}

const addFavorite = useCallback((service: AddFavoriteInput) => {
  // ... rest of implementation unchanged
}, []);

const toggleFavorite = useCallback((service: AddFavoriteInput) => {
  // ... same
}, [isFavorite, addFavorite, removeFavorite]);
```

Update `FavoriteService` export and existing callers accordingly. `ServiceSummary` and `ServiceDetail` are both structurally compatible with `AddFavoriteInput`.

**Step 2: Add heart icon to `ServiceCard.tsx`**

In `ServiceCard`, accept a new optional prop:

```typescript
interface ServiceCardProps {
  // ... existing
  isFavorited?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}
```

Add a heart button in the top-right area of the card (alongside the existing badge):

```tsx
{onToggleFavorite && (
  <button
    onClick={onToggleFavorite}
    aria-label={isFavorited ? "Remove from shortlist" : "Save to shortlist"}
    className="ml-auto p-1 text-muted-foreground hover:text-red-500 transition-colors"
  >
    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
  </button>
)}
```

Import `Heart` from `lucide-react`.

**Step 3: Wire favorites in `Home.tsx`**

```typescript
import { useFavorites } from "@/hooks/use-favorites";
const { favorites, favoriteCount, isFavorite, toggleFavorite } = useFavorites();

// In results grid:
<ServiceCard
  ...
  isFavorited={isFavorite(service.id)}
  onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(service); }}
/>
```

**Step 4: Add heart to `ServiceModal.tsx`**

In `ServiceModal`, add a heart button in the modal header area. Pass `isFavorited` and `onToggleFavorite` as props.

**Step 5: Create `MyShortlist.tsx`**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Heart, Printer, Share2, Trash2 } from "lucide-react";
import { type FavoriteService } from "@/hooks/use-favorites";

interface MyShortlistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favorites: FavoriteService[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function MyShortlist({ open, onOpenChange, favorites, onRemove, onClear }: MyShortlistProps) {
  const handlePrint = () => window.print();

  const handleShareShortlist = async () => {
    const ids = favorites.map(f => f.id).join(',');
    const url = `${window.location.origin}${window.location.pathname}?shortlist=${ids}`;
    try {
      await navigator.clipboard.writeText(url);
      // Show toast: "Shortlist link copied!"
    } catch { /* fallback: prompt with url */ }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            My Shortlist ({favorites.length})
          </SheetTitle>
        </SheetHeader>

        {favorites.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm p-4">
            <p>Save services by clicking the heart icon on any card.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {favorites.map(fav => (
                <div key={fav.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{fav.name}</p>
                    <p className="text-xs text-muted-foreground">{fav.category} · {fav.location}</p>
                  </div>
                  <button onClick={() => onRemove(fav.id)} className="text-muted-foreground hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <Button onClick={handlePrint} variant="outline" className="w-full gap-2">
                <Printer className="w-4 h-4" /> Export PDF
              </Button>
              <Button onClick={handleShareShortlist} variant="outline" className="w-full gap-2">
                <Share2 className="w-4 h-4" /> Share shortlist
              </Button>
              <Button onClick={onClear} variant="ghost" className="w-full text-muted-foreground text-xs">
                Clear all
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

**Step 6: Add print CSS**

In `client/src/index.css` (or a new `print.css` imported in `main.tsx`), add:

```css
@media print {
  /* Hide everything except the shortlist */
  body > * { display: none !important; }
  .print-shortlist { display: block !important; }

  .print-shortlist {
    font-family: Arial, sans-serif;
    font-size: 12pt;
    padding: 20pt;
  }

  .print-shortlist h1 {
    font-size: 16pt;
    margin-bottom: 16pt;
  }

  .print-service-item {
    border-bottom: 1pt solid #ccc;
    padding: 10pt 0;
    break-inside: avoid;
  }
}
```

Add a hidden `<div className="print-shortlist">` to `Home.tsx` containing formatted favorite service data.

**Step 7: Wire `MyShortlist` in `Home.tsx`**

```tsx
const [shortlistOpen, setShortlistOpen] = useState(false);

// In results header:
<button onClick={() => setShortlistOpen(true)} className="...">
  <Heart className="w-4 h-4" /> Shortlist {favoriteCount > 0 && `(${favoriteCount})`}
</button>

<MyShortlist
  open={shortlistOpen}
  onOpenChange={setShortlistOpen}
  favorites={favorites}
  onRemove={removeFavorite}
  onClear={clearFavorites}
/>
```

**Step 8: Verify**

- Click heart on card → Shortlist badge count goes to 1
- Open Shortlist drawer → service appears
- Click "Export PDF" → browser print dialog opens
- Click "Share shortlist" → clipboard gets URL with `?shortlist=...`

**Step 9: Commit**

```bash
git add client/src/components/MyShortlist.tsx client/src/components/ServiceCard.tsx client/src/components/ServiceModal.tsx client/src/pages/Home.tsx client/src/hooks/use-favorites.ts client/src/index.css
git commit -m "feat(ui): activate favorites, shortlist drawer, PDF export, and shortlist sharing"
```

---

## Task 13: Share results button

**Files:**
- Modify: `client/src/pages/Home.tsx`

**Step 1: Add share button to the results header**

In the results section of `Home.tsx`, add a "Share" button next to the refine panel and shortlist button:

```tsx
import { Share2, Check } from "lucide-react";

const [copied, setCopied] = useState(false);

const handleShare = useCallback(async () => {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback: show a prompt
    window.prompt("Copy this link to share your search:", url);
  }
}, []);

// In JSX:
<Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
  {copied ? "Copied!" : "Share"}
</Button>
```

**Step 2: Restore state from URL on page load**

In `Home.tsx`, add a `useEffect` that runs once on mount and checks for `?q=...` params, triggering a search if found:

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  const loc = params.get('loc');
  if (q && !searchState.hasSearched) {
    const locations = loc ? [loc] : searchState.locations;
    handleSearch(q, locations);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // intentionally runs only on mount
```

**Step 3: Verify**

1. Run a search (e.g., "housing Edmonton")
2. Click "Share" → URL updates to `?q=housing+Edmonton&loc=edmonton` → "Copied!" shows briefly
3. Paste URL in a new incognito tab → page loads → search auto-runs → same results appear

**Step 4: Final TypeScript check**

```bash
npm run check
```

Expected: Clean. Zero type errors.

**Step 5: Commit**

```bash
git add client/src/pages/Home.tsx
git commit -m "feat(ui): add Share results button with URL state encoding and restore-on-load"
```

---

## End-to-End Verification Checklist

Run `npm run dev` and manually verify each feature:

- [ ] **Category tiles** — visible on landing, hidden after search, clicking triggers search
- [ ] **Emergency button** — red, always visible in Hero, click returns crisis services
- [ ] **Voice search** — mic icon in input, click prompts permission, speech fills input
- [ ] **Intake wizard** — "Not sure?" link opens dialog, 3-step flow assembles query
- [ ] **Refine panel** — "Refine" button opens Sheet, toggling filter re-runs search
- [ ] **Active chips** — filter chips appear below search bar, clicking X removes filter
- [ ] **Thumbs feedback** — thumbs on card submit silently, localStorage prevents re-votes
- [ ] **Heart/favorites** — heart on card saves to shortlist, badge count updates
- [ ] **Shortlist drawer** — opens, shows saved services, "Export PDF" opens print
- [ ] **Share shortlist** — URL with `?shortlist=...` copied to clipboard
- [ ] **Share results** — URL with `?q=...` copied, restores search on new tab load

Final build check:

```bash
npm run build
```

Expected: No errors. Build succeeds.
