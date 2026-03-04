# PDF Shortlist Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the PDF shortlist export with UCalgary branding, rich service details (contact, process steps, required docs), and user-selectable optional sections.

**Architecture:** Single-file change to `MyShortlist.tsx`. At export time, fetch full service details from the API for each favorite, then build a richly-styled print page using safe DOM methods (no innerHTML). Export options (checkboxes) control which optional sections appear.

**Tech Stack:** React, TypeScript, browser print API, fetch

---

### Task 1: Rewrite `buildPrintPage()` with UCalgary-branded styling and rich content

**Files:**
- Modify: `client/src/components/MyShortlist.tsx:1-103` (imports + replace entire `buildPrintPage` function)

**Step 1: Add import and types**

Add at top of file:
```typescript
import type { ServiceDetail } from "@shared/routes";
```

Add above `buildPrintPage`:
```typescript
interface PrintOptions {
  includeProcessSteps: boolean;
  includeRequiredDocs: boolean;
}
```

**Step 2: Replace the `buildPrintPage` function signature**

```typescript
function buildPrintPage(
  doc: Document,
  services: ServiceDetail[],
  options: PrintOptions,
): void {
```

**Step 3: Write the new CSS styles block**

Replace the existing `style.textContent` with UCalgary-branded styles. Key design tokens:
- UCalgary Red: `#D6001C`
- UCalgary Gold: `#FFCD00`
- System sans-serif font stack
- Left red accent border on cards
- Gold category badges
- Numbered process steps, bulleted required docs

Full CSS:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px 40px;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.header-bar { background: #D6001C; height: 6px; margin: 0 -24px 24px; }
.header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 2px; }
.header .subtitle { font-size: 13px; color: #555; margin-bottom: 4px; }
.header .meta { font-size: 12px; color: #888; margin-bottom: 28px; }
.service {
  border: 1px solid #e2e2e2;
  border-left: 5px solid #D6001C;
  border-radius: 6px;
  padding: 16px 18px;
  margin-bottom: 16px;
  page-break-inside: avoid;
}
.service-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
.badge {
  display: inline-block;
  background: #FFF8E1;
  color: #8B6914;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #FFCD00;
  margin-bottom: 8px;
}
.contact-row { font-size: 12px; color: #444; line-height: 1.8; }
.contact-row span { margin-right: 16px; }
.section-divider {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #D6001C;
  margin: 12px 0 6px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}
.steps { padding-left: 20px; margin: 0; }
.steps li { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 2px; }
.docs { padding-left: 18px; margin: 0; list-style: disc; }
.docs li { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 2px; }
.footer {
  margin-top: 32px;
  padding-top: 12px;
  border-top: 3px solid #FFCD00;
  font-size: 11px;
  color: #888;
  display: flex;
  justify-content: space-between;
}
```

**Step 4: Write the new DOM-building logic using safe DOM methods (no innerHTML)**

All dynamic content uses `textContent` to prevent XSS. Only static structural markup uses `innerHTML` on elements with no user data.

```typescript
// Title
const titleEl = doc.createElement("title");
titleEl.textContent = "My Shortlist — Recovery on Campus Alberta";
doc.head.appendChild(titleEl);

// Header
const header = doc.createElement("div");
header.className = "header";

const bar = doc.createElement("div");
bar.className = "header-bar";
header.appendChild(bar);

const h1 = doc.createElement("h1");
h1.textContent = "My Service Shortlist";
header.appendChild(h1);

const subtitle = doc.createElement("div");
subtitle.className = "subtitle";
subtitle.textContent = "Recovery on Campus Alberta";
header.appendChild(subtitle);

const meta = doc.createElement("div");
meta.className = "meta";
const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
meta.textContent = `${dateStr} · ${services.length} service${services.length !== 1 ? "s" : ""}`;
header.appendChild(meta);

doc.body.appendChild(header);

// Helper to create a text span with optional prefix emoji
function contactSpan(text: string): HTMLSpanElement {
  const span = doc.createElement("span");
  span.textContent = text;
  return span;
}

// Service cards
for (const svc of services) {
  const card = doc.createElement("div");
  card.className = "service";

  const nameEl = doc.createElement("div");
  nameEl.className = "service-name";
  nameEl.textContent = svc.name;
  card.appendChild(nameEl);

  const badge = doc.createElement("span");
  badge.className = "badge";
  badge.textContent = svc.category;
  card.appendChild(badge);

  // Contact row
  const contactRow = doc.createElement("div");
  contactRow.className = "contact-row";
  if (svc.address) contactRow.appendChild(contactSpan(`📍 ${svc.address}`));
  else if (svc.location) contactRow.appendChild(contactSpan(`📍 ${svc.location}`));
  if (svc.phone) contactRow.appendChild(contactSpan(`📞 ${svc.phone}`));
  if (svc.email) contactRow.appendChild(contactSpan(`✉ ${svc.email}`));
  if (svc.websiteUrl) contactRow.appendChild(contactSpan(`🌐 ${svc.websiteUrl}`));
  if (contactRow.childNodes.length > 0) card.appendChild(contactRow);

  // Process steps (optional)
  if (options.includeProcessSteps && svc.process.length > 0) {
    const divider = doc.createElement("div");
    divider.className = "section-divider";
    divider.textContent = "How to Access";
    card.appendChild(divider);

    const ol = doc.createElement("ol");
    ol.className = "steps";
    for (const step of svc.process) {
      const li = doc.createElement("li");
      li.textContent = step;
      ol.appendChild(li);
    }
    card.appendChild(ol);
  }

  // Required docs (optional)
  if (options.includeRequiredDocs && svc.requiredDocs.length > 0) {
    const divider = doc.createElement("div");
    divider.className = "section-divider";
    divider.textContent = "What You'll Need";
    card.appendChild(divider);

    const ul = doc.createElement("ul");
    ul.className = "docs";
    for (const d of svc.requiredDocs) {
      const li = doc.createElement("li");
      li.textContent = d;
      ul.appendChild(li);
    }
    card.appendChild(ul);
  }

  doc.body.appendChild(card);
}

// Footer
const footer = doc.createElement("div");
footer.className = "footer";
const footerLeft = doc.createElement("span");
footerLeft.textContent = "Recovery on Campus Alberta · ucalgary.ca/recovery-campus";
const footerRight = doc.createElement("span");
footerRight.textContent = `${services.length} service${services.length !== 1 ? "s" : ""}`;
footer.appendChild(footerLeft);
footer.appendChild(footerRight);
doc.body.appendChild(footer);
```

**Step 5: Verify TypeScript compiles**

Run: `npm run check`
Expected: No errors in `MyShortlist.tsx`

**Step 6: Commit**

```bash
git add client/src/components/MyShortlist.tsx
git commit -m "feat(pdf): rewrite shortlist print page with UCalgary branding and rich content"
```

---

### Task 2: Add export options UI and async fetch logic

**Files:**
- Modify: `client/src/components/MyShortlist.tsx` (component body)

**Step 1: Add state for export options and loading**

Inside the `MyShortlist` component, add:
```typescript
const [includeSteps, setIncludeSteps] = useState(true);
const [includeDocs, setIncludeDocs] = useState(true);
const [isExporting, setIsExporting] = useState(false);
```

**Step 2: Rewrite `handleExportPDF` to fetch full details**

Replace the existing `handleExportPDF` callback:
```typescript
const handleExportPDF = useCallback(async () => {
  if (isExporting) return;
  setIsExporting(true);

  try {
    // Fetch full details for all favorites in parallel
    const details = await Promise.all(
      favorites.map(async (fav) => {
        const res = await fetch(`/api/services/${encodeURIComponent(fav.id)}`);
        if (!res.ok) return null;
        return res.json() as Promise<ServiceDetail>;
      }),
    );

    const services: ServiceDetail[] = details.filter(
      (d): d is ServiceDetail => d !== null,
    );

    if (services.length === 0) {
      toast({
        title: "Export failed",
        description: "Could not load service details. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Popup blocked",
        description: "Please allow popups for this site to export your shortlist.",
        variant: "destructive",
      });
      return;
    }

    buildPrintPage(printWindow.document, services, {
      includeProcessSteps: includeSteps,
      includeRequiredDocs: includeDocs,
    });
    setTimeout(() => printWindow.print(), 250);
  } catch {
    toast({
      title: "Export failed",
      description: "Something went wrong. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsExporting(false);
  }
}, [favorites, includeSteps, includeDocs, isExporting, toast]);
```

**Step 3: Add export options checkboxes in the footer UI**

In the footer actions section (inside `{favoriteCount > 0 && (...)}`), above the Export PDF button, add:
```tsx
<div className="space-y-1.5 mb-3">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    PDF Options
  </p>
  <label className="flex items-center gap-2 cursor-pointer group">
    <input
      type="checkbox"
      checked={includeSteps}
      onChange={(e) => setIncludeSteps(e.target.checked)}
      className="rounded border-border text-primary focus:ring-primary/30 w-3.5 h-3.5"
    />
    <span className="text-sm text-foreground group-hover:text-primary transition-colors">
      Include access steps
    </span>
  </label>
  <label className="flex items-center gap-2 cursor-pointer group">
    <input
      type="checkbox"
      checked={includeDocs}
      onChange={(e) => setIncludeDocs(e.target.checked)}
      className="rounded border-border text-primary focus:ring-primary/30 w-3.5 h-3.5"
    />
    <span className="text-sm text-foreground group-hover:text-primary transition-colors">
      Include required documents
    </span>
  </label>
</div>
```

**Step 4: Update Export PDF button to show loading state**

```tsx
<button
  type="button"
  onClick={handleExportPDF}
  disabled={isExporting}
  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
>
  {isExporting ? (
    <>
      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
      </svg>
      Preparing PDF…
    </>
  ) : (
    <>
      <FileText className="w-4 h-4" aria-hidden="true" />
      Export PDF
    </>
  )}
</button>
```

**Step 5: Verify TypeScript compiles**

Run: `npm run check`
Expected: No errors

**Step 6: Manual test**

1. Add 2-3 services to shortlist
2. Toggle checkboxes on/off
3. Click Export PDF — verify loading spinner shows
4. Verify print page opens with UCalgary branding, contact details, and optional sections

**Step 7: Commit**

```bash
git add client/src/components/MyShortlist.tsx
git commit -m "feat(pdf): add export options UI with async service detail fetching"
```
