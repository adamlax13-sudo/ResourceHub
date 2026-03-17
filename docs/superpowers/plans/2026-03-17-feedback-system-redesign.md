# Feedback System Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the feedback system with typed feedback categories, a header button, and a service-level "Report an issue" link, replacing the buried footer button.

**Architecture:** Single `FeedbackModal` component rendered at Home.tsx level, triggered from two entry points (header button in Hero.tsx, "Report an issue" link in ServiceModal.tsx). Backend adds `type`, `status`, `service_id`, `service_name`, `search_query` columns to the existing `feedback` table. All validation via Zod, all DB access via Drizzle ORM.

**Tech Stack:** React 18, Shadcn/ui Dialog + RadioGroup + Checkbox, Tailwind CSS, Express, Drizzle ORM, PostgreSQL, Zod, react-i18next, Vitest

**Spec:** `docs/superpowers/specs/2026-03-17-feedback-system-redesign-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `shared/schema.ts` | Modify (lines 10-16) | Add 5 columns to feedback table |
| `server/routes/feedback.ts` | Modify (lines 12-44) | Update Zod schema + insert logic |
| `server/storage.ts` | Modify (lines 242-249) | Update `createFeedback` params |
| `client/src/components/FeedbackModal.tsx` | Rewrite (157 lines) | Typed feedback modal with contextual fields |
| `client/src/components/Hero.tsx` | Modify (lines 414-422) | Add header feedback button |
| `client/src/components/ServiceModal.tsx` | Modify (lines 419-444) | Add "Report an issue" link + new prop |
| `client/src/pages/Home.tsx` | Modify (lines 100, 524-530, 552-559, 563) | Lift feedback state, wire props, remove footer button |
| `client/src/locales/en.json` | Modify (lines 158-178) | Add new feedback translation keys |
| `client/src/locales/*.json` | Modify (9 files) | Add feedback keys to all locales |

---

### Task 1: Database Schema — Add Columns to Feedback Table

**Files:**
- Modify: `shared/schema.ts:10-16`

- [ ] **Step 1: Update the Drizzle schema**

In `shared/schema.ts`, replace the feedback table definition (lines 10-16) with:

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

- [ ] **Step 2: Push schema to database**

Run: `npm run db:push`
Expected: Drizzle pushes new columns with defaults. Existing rows get `type='general'`, `status='new'`, nulls for the rest.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check`
Expected: No type errors. The `Feedback` type at line 199 (`typeof feedback.$inferSelect`) auto-updates.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(feedback): add type, status, serviceId, serviceName, searchQuery columns to feedback table"
```

---

### Task 2: Backend API — Update Feedback Route and Storage

**Files:**
- Modify: `server/routes/feedback.ts:12-44`
- Modify: `server/storage.ts:242-249` (only if createFeedback needs explicit param changes — Drizzle `InsertFeedback` type auto-updates from schema, so storage.ts likely needs no changes)

- [ ] **Step 1: Update the Zod schema and route handler**

In `server/routes/feedback.ts`, replace the existing POST `/api/feedback` handler (lines 12-44). The file uses the `registerFeedbackRoutes(app: Express)` pattern with `app.post("/api/feedback", ...)`. Replace the handler body:

```typescript
  app.post("/api/feedback", feedbackLimiter, async (req: Request, res: Response) => {
    try {
      const feedbackSchema = z.object({
        name: z.string().max(255).optional(),
        email: z.string().email().max(255).optional().or(z.literal('')),
        message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
        type: z.enum(["incorrect_info", "service_closed", "missing_service", "bad_search", "general"]).default("general"),
        serviceId: z.string().max(255).optional(),
        serviceName: z.string().max(255).optional(),
        searchQuery: z.string().max(500).optional(),
        hp: z.string().optional(),
      });

      const validatedData = feedbackSchema.parse(req.body);

      // Honeypot — silent fake success so bots can't distinguish rejection
      if (validatedData.hp) {
        return res.json({ success: true, id: 0 });
      }

      const newFeedback = await storage.createFeedback({
        name: validatedData.name?.trim() || null,
        email: validatedData.email?.trim() || null,
        message: validatedData.message.trim(),
        type: validatedData.type,
        serviceId: validatedData.serviceId || null,
        serviceName: validatedData.serviceName?.trim() || null,
        searchQuery: validatedData.searchQuery?.trim() || null,
      });

      res.json({ success: true, id: newFeedback.id });
    } catch (err) {
      console.error("Feedback error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json(createErrorResponse("Invalid feedback data", undefined, err.errors));
      } else {
        res.status(500).json(createErrorResponse("Failed to submit feedback"));
      }
    }
  });
```

- [ ] **Step 2: Verify storage.ts auto-updates**

The `createFeedback` method in `server/storage.ts:242-249` uses `InsertFeedback` type which is inferred from the schema. Since we updated the schema in Task 1, the type auto-updates. No storage.ts changes needed.

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 3: Test the endpoint manually**

Run: `npm run dev` (in a separate terminal)

Then test with curl:
```bash
curl -X POST http://localhost:5000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"message":"Test typed feedback","type":"bad_search","searchQuery":"dental services"}'
```
Expected: `{"success":true,"id":...}`

- [ ] **Step 4: Commit**

```bash
git add server/routes/feedback.ts
git commit -m "feat(feedback): update API to accept typed feedback with service and search context"
```

---

### Task 3: i18n — Add Translation Keys

**Files:**
- Modify: `client/src/locales/en.json:158-178`
- Modify: `client/src/locales/es.json`, `fr.json`, `zh.json`, `ar.json`, `hi.json`, `pt.json`, `de.json`, `ja.json`, `ko.json`

- [ ] **Step 1: Update English locale**

In `client/src/locales/en.json`, replace the `"feedback"` block (lines 158-178) with:

```json
"feedback": {
  "link": "Feedback & Suggestions",
  "title": "Feedback",
  "reportTitle": "Report an Issue",
  "description": "Help us improve! Your feedback helps make this resource better for everyone.",
  "typeLabel": "What type of feedback?",
  "typeIncorrectInfo": "Incorrect service information",
  "typeServiceClosed": "Service no longer exists",
  "typeMissingService": "Missing service",
  "typeBadSearch": "Bad search results",
  "typeGeneral": "General feedback",
  "headerHint": "To report incorrect service details, open the service and use 'Report an issue'.",
  "serviceName": "Service",
  "searchQuery": "Search query",
  "fieldsWrongLabel": "Which fields are wrong?",
  "fieldPhone": "Phone",
  "fieldAddress": "Address",
  "fieldHours": "Hours",
  "fieldDescription": "Description",
  "fieldWebsite": "Website",
  "fieldOther": "Other",
  "missingServiceName": "Service name",
  "missingServiceNamePlaceholder": "Name of the service",
  "missingServiceUrl": "Website URL (optional)",
  "missingServiceUrlPlaceholder": "https://...",
  "placeholderIncorrectInfo": "Tell us what's wrong with this listing...",
  "placeholderServiceClosed": "Any additional details? (optional)",
  "placeholderMissingService": "Tell us about this service...",
  "placeholderBadSearch": "What were you looking for?",
  "placeholderGeneral": "How can we improve?",
  "name": "Name (optional)",
  "namePlaceholder": "Your name",
  "email": "Email (optional)",
  "emailPlaceholder": "your@email.com",
  "message": "Details",
  "optional": "Optional",
  "cancel": "Cancel",
  "submit": "Submit Feedback",
  "sending": "Sending...",
  "successTitle": "Feedback Sent",
  "successMessage": "Thank you for your feedback! We appreciate you taking the time to help us improve.",
  "errorTitle": "Error",
  "errorMessage": "Failed to submit feedback. Please try again.",
  "thankYou": "Thank You!",
  "thankYouMessage": "Your feedback has been received and will help us improve the platform.",
  "close": "Close",
  "reportIssue": "Report an issue",
  "headerButton": "Feedback"
}
```

- [ ] **Step 2: Update other locale files**

For each of the 9 non-English locale files (`es.json`, `fr.json`, `zh.json`, `ar.json`, `hi.json`, `pt.json`, `de.json`, `ja.json`, `ko.json`), add the same new keys with English fallback values. The existing keys (`link`, `title`, `name`, etc.) already have translations — preserve those. Only add the new keys with English text (they'll be translated properly later).

New keys to add to each locale (append to their existing `"feedback"` block):
```json
"reportTitle": "Report an Issue",
"typeLabel": "What type of feedback?",
"typeIncorrectInfo": "Incorrect service information",
"typeServiceClosed": "Service no longer exists",
"typeMissingService": "Missing service",
"typeBadSearch": "Bad search results",
"typeGeneral": "General feedback",
"headerHint": "To report incorrect service details, open the service and use 'Report an issue'.",
"serviceName": "Service",
"searchQuery": "Search query",
"fieldsWrongLabel": "Which fields are wrong?",
"fieldPhone": "Phone",
"fieldAddress": "Address",
"fieldHours": "Hours",
"fieldDescription": "Description",
"fieldWebsite": "Website",
"fieldOther": "Other",
"missingServiceName": "Service name",
"missingServiceNamePlaceholder": "Name of the service",
"missingServiceUrl": "Website URL (optional)",
"missingServiceUrlPlaceholder": "https://...",
"placeholderIncorrectInfo": "Tell us what's wrong with this listing...",
"placeholderServiceClosed": "Any additional details? (optional)",
"placeholderMissingService": "Tell us about this service...",
"placeholderBadSearch": "What were you looking for?",
"placeholderGeneral": "How can we improve?",
"optional": "Optional",
"message": "Details",
"reportIssue": "Report an issue",
"headerButton": "Feedback"
```

- [ ] **Step 3: Verify no JSON parse errors**

Run: `npm run dev`
Expected: No i18n loading errors in the console.

- [ ] **Step 4: Commit**

```bash
git add client/src/locales/
git commit -m "feat(feedback): add i18n keys for typed feedback modal"
```

---

### Task 4: FeedbackModal — Full Rewrite with Typed Feedback

**Files:**
- Rewrite: `client/src/components/FeedbackModal.tsx`

- [ ] **Step 1: Install required Shadcn UI components**

RadioGroup and Checkbox are not yet in the project. Install them:

```bash
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add checkbox
```

Verify files created at `client/src/components/ui/radio-group.tsx` and `client/src/components/ui/checkbox.tsx`.

- [ ] **Step 2: Rewrite FeedbackModal.tsx**

Replace the entire file with the new implementation. The modal receives context props and renders type-specific fields.

```typescript
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

type FeedbackType = "incorrect_info" | "service_closed" | "missing_service" | "bad_search" | "general";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  serviceId?: string;
  serviceName?: string;
  searchQuery?: string;
}

const FIELD_OPTIONS = ["Phone", "Address", "Hours", "Description", "Website", "Other"] as const;

export function FeedbackModal({ open, onClose, serviceId, serviceName, searchQuery }: FeedbackModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const isServiceContext = !!serviceId;

  // Determine available types based on context
  const availableTypes: FeedbackType[] = isServiceContext
    ? ["incorrect_info", "service_closed"]
    : searchQuery
      ? ["missing_service", "bad_search", "general"]
      : ["missing_service", "general"];

  const defaultType = isServiceContext ? "incorrect_info" : "general";

  // Form state
  const [selectedType, setSelectedType] = useState<FeedbackType>(defaultType);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Incorrect info: field checkboxes
  const [wrongFields, setWrongFields] = useState<Set<string>>(new Set());

  // Missing service: structured fields
  const [missingServiceName, setMissingServiceName] = useState("");
  const [missingServiceUrl, setMissingServiceUrl] = useState("");

  // Reset form when modal opens/closes or context changes
  useEffect(() => {
    if (open) {
      setSelectedType(defaultType);
      setMessage("");
      setName("");
      setEmail("");
      setHp("");
      setSubmitted(false);
      setWrongFields(new Set());
      setMissingServiceName("");
      setMissingServiceUrl("");
    }
  }, [open, defaultType]);

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: t("feedback.successTitle"), description: t("feedback.successMessage") });
    },
    onError: () => {
      toast({ title: t("feedback.errorTitle"), description: t("feedback.errorMessage"), variant: "destructive" });
    },
  });

  function buildMessage(): string {
    let parts: string[] = [];

    if (selectedType === "incorrect_info" && wrongFields.size > 0) {
      parts.push(`Fields reported: ${Array.from(wrongFields).join(", ")}`);
    }

    if (selectedType === "missing_service") {
      parts.push(`Service: ${missingServiceName.trim()}`);
      parts.push(`Website: ${missingServiceUrl.trim() || "Not provided"}`);
    }

    if (selectedType === "service_closed" && !message.trim()) {
      parts.push("Flagged as no longer operating");
    }

    if (message.trim()) {
      if (parts.length > 0) parts.push("");
      parts.push(message.trim());
    }

    return parts.join("\n") || "Flagged as no longer operating";
  }

  function handleSubmit() {
    const builtMessage = buildMessage();
    if (!builtMessage.trim()) return;

    if (selectedType === "missing_service" && !missingServiceName.trim()) return;

    mutation.mutate({
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      message: builtMessage,
      type: selectedType,
      serviceId: isServiceContext ? serviceId : undefined,
      serviceName: isServiceContext ? serviceName : undefined,
      searchQuery: selectedType === "bad_search" ? searchQuery : undefined,
      hp,
    });
  }

  const typeLabels: Record<FeedbackType, string> = {
    incorrect_info: t("feedback.typeIncorrectInfo"),
    service_closed: t("feedback.typeServiceClosed"),
    missing_service: t("feedback.typeMissingService"),
    bad_search: t("feedback.typeBadSearch"),
    general: t("feedback.typeGeneral"),
  };

  const placeholders: Record<FeedbackType, string> = {
    incorrect_info: t("feedback.placeholderIncorrectInfo"),
    service_closed: t("feedback.placeholderServiceClosed"),
    missing_service: t("feedback.placeholderMissingService"),
    bad_search: t("feedback.placeholderBadSearch"),
    general: t("feedback.placeholderGeneral"),
  };

  const fieldKeys: Record<string, string> = {
    Phone: t("feedback.fieldPhone"),
    Address: t("feedback.fieldAddress"),
    Hours: t("feedback.fieldHours"),
    Description: t("feedback.fieldDescription"),
    Website: t("feedback.fieldWebsite"),
    Other: t("feedback.fieldOther"),
  };

  const title = isServiceContext ? t("feedback.reportTitle") : t("feedback.title");
  const isMessageRequired = selectedType !== "service_closed" && selectedType !== "incorrect_info";
  const canSubmit = selectedType === "service_closed"
    || (selectedType === "incorrect_info" && (message.trim().length > 0 || wrongFields.size > 0))
    || (selectedType === "missing_service" && missingServiceName.trim().length > 0 && message.trim().length > 0)
    || (selectedType !== "service_closed" && selectedType !== "incorrect_info" && selectedType !== "missing_service" && message.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col" data-testid="feedback-modal">
        <DialogHeader>
          <DialogTitle>{submitted ? t("feedback.thankYou") : title}</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="text-center text-muted-foreground">{t("feedback.thankYouMessage")}</p>
            <Button variant="outline" onClick={onClose}>{t("feedback.close")}</Button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
              <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </div>

            {/* Type selector */}
            <div>
              <Label className="text-sm font-medium">{t("feedback.typeLabel")}</Label>
              <RadioGroup
                value={selectedType}
                onValueChange={(v) => setSelectedType(v as FeedbackType)}
                className="mt-2 space-y-2"
                aria-label={t("feedback.typeLabel")}
                data-testid="feedback-type-selector"
              >
                {availableTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={`feedback-type-${type}`} />
                    <Label htmlFor={`feedback-type-${type}`} className="font-normal cursor-pointer">
                      {typeLabels[type]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Header context hint */}
            {!isServiceContext && (
              <p className="text-xs text-muted-foreground" data-testid="feedback-header-hint">
                {t("feedback.headerHint")}
              </p>
            )}

            {/* Service name (read-only, for service context) */}
            {isServiceContext && serviceName && (
              <div>
                <Label htmlFor="feedback-service-name" className="text-sm">{t("feedback.serviceName")}</Label>
                <Input id="feedback-service-name" value={serviceName} disabled className="mt-1 bg-muted" />
              </div>
            )}

            {/* Search query (read-only, for bad_search) */}
            {selectedType === "bad_search" && searchQuery && (
              <div>
                <Label htmlFor="feedback-search-query" className="text-sm">{t("feedback.searchQuery")}</Label>
                <Input id="feedback-search-query" value={searchQuery} disabled className="mt-1 bg-muted" />
              </div>
            )}

            {/* Field checkboxes for incorrect_info */}
            {selectedType === "incorrect_info" && (
              <div>
                <Label className="text-sm">{t("feedback.fieldsWrongLabel")}</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {FIELD_OPTIONS.map((field) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={`field-${field}`}
                        checked={wrongFields.has(field)}
                        onCheckedChange={(checked) => {
                          const next = new Set(wrongFields);
                          checked ? next.add(field) : next.delete(field);
                          setWrongFields(next);
                        }}
                      />
                      <Label htmlFor={`field-${field}`} className="font-normal text-sm cursor-pointer">
                        {fieldKeys[field]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing service structured fields */}
            {selectedType === "missing_service" && (
              <>
                <div>
                  <Label htmlFor="missing-service-name" className="text-sm">
                    {t("feedback.missingServiceName")} *
                  </Label>
                  <Input
                    id="missing-service-name"
                    value={missingServiceName}
                    onChange={(e) => setMissingServiceName(e.target.value)}
                    placeholder={t("feedback.missingServiceNamePlaceholder")}
                    className="mt-1"
                    maxLength={255}
                    data-testid="input-missing-service-name"
                  />
                </div>
                <div>
                  <Label htmlFor="missing-service-url" className="text-sm">
                    {t("feedback.missingServiceUrl")}
                  </Label>
                  <Input
                    id="missing-service-url"
                    type="url"
                    value={missingServiceUrl}
                    onChange={(e) => setMissingServiceUrl(e.target.value)}
                    placeholder={t("feedback.missingServiceUrlPlaceholder")}
                    className="mt-1"
                    maxLength={500}
                  />
                </div>
              </>
            )}

            {/* Message textarea */}
            <div>
              <Label htmlFor="feedback-message" className="text-sm">
                {t("feedback.message")} {isMessageRequired ? "*" : ""}
              </Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={placeholders[selectedType]}
                className="mt-1 min-h-[80px]"
                maxLength={2000}
                data-testid="input-feedback-message"
              />
            </div>

            {/* Optional name/email */}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-3">{t("feedback.optional")}</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="feedback-name" className="text-sm">{t("feedback.name")}</Label>
                  <Input
                    id="feedback-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("feedback.namePlaceholder")}
                    className="mt-1"
                    maxLength={255}
                  />
                </div>
                <div>
                  <Label htmlFor="feedback-email" className="text-sm">{t("feedback.email")}</Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("feedback.emailPlaceholder")}
                    className="mt-1"
                    maxLength={255}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                {t("feedback.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || mutation.isPending}
                className="flex-1"
                data-testid="button-submit-feedback"
              >
                {mutation.isPending ? t("feedback.sending") : t("feedback.submit")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/FeedbackModal.tsx client/src/components/ui/radio-group.tsx client/src/components/ui/checkbox.tsx
git commit -m "feat(feedback): rewrite FeedbackModal with typed feedback and contextual fields"
```

---

### Task 5: Hero.tsx — Add Header Feedback Button

**Files:**
- Modify: `client/src/components/Hero.tsx:394-424`

- [ ] **Step 1: Add openFeedback prop to Hero**

Find the Hero component's props interface and add `openFeedback?: () => void`. The interface is near the top of the file.

- [ ] **Step 2: Add the feedback button to the header**

In `client/src/components/Hero.tsx`, find the header button group (around line 414-422):

```typescript
<div className="flex items-center gap-2">
  <QuickExitButton className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all" />
  <LanguageSwitcher variant="ghost" className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all" />
</div>
```

Replace with:

```typescript
<div className="flex items-center gap-2">
  {openFeedback && (
    <button
      onClick={openFeedback}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
      aria-label={t('feedback.headerButton')}
      data-testid="button-header-feedback"
    >
      <MessageSquarePlus className="w-4 h-4" />
      <span className="hidden sm:inline">{t('feedback.headerButton')}</span>
    </button>
  )}
  <QuickExitButton className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all" />
  <LanguageSwitcher variant="ghost" className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all" />
</div>
```

Add `MessageSquarePlus` to the lucide-react import at the top of the file.

- [ ] **Step 3: Verify it compiles**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Hero.tsx
git commit -m "feat(feedback): add header feedback button next to language switcher"
```

---

### Task 6: ServiceModal.tsx — Add "Report an Issue" Link

**Files:**
- Modify: `client/src/components/ServiceModal.tsx:419-444`

- [ ] **Step 1: Add openFeedback prop to ServiceModal**

Find the `ServiceModalProps` interface (near top of file) and add:

```typescript
openFeedback?: (serviceId: string, serviceName: string) => void;
```

Destructure it in the component function params.

- [ ] **Step 2: Add the "Report an issue" link below the CTA**

In the CTA section (around lines 419-444), find the closing `</div>` of the CTA block (after the external link disclaimer `<p>` tag). Add the report link just before that closing `</div>`:

After the `{serviceUrl && (<p className="text-center text-xs...">...external link...</p>)}` block, add:

```typescript
{openFeedback && service && (
  <button
    onClick={() => openFeedback(service.id, service.name)}
    className="flex items-center justify-center gap-1.5 w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
    data-testid="button-report-issue"
  >
    <Flag className="w-3.5 h-3.5" />
    {t('feedback.reportIssue')}
  </button>
)}
```

Add `Flag` to the lucide-react import at the top of the file.

- [ ] **Step 3: Verify it compiles**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ServiceModal.tsx
git commit -m "feat(feedback): add 'Report an issue' link in service detail sidebar"
```

---

### Task 7: Home.tsx — Wire Everything Together

**Files:**
- Modify: `client/src/pages/Home.tsx:100, 524-530, 552-559, 563`

- [ ] **Step 1: Replace feedback state with feedbackContext**

In `client/src/pages/Home.tsx`, find line 100:

```typescript
const [feedbackOpen, setFeedbackOpen] = useState(false);
```

Replace with:

```typescript
const [feedbackContext, setFeedbackContext] = useState<{
  serviceId?: string;
  serviceName?: string;
} | null>(null);
```

- [ ] **Step 2: Pass openFeedback to Hero**

Find where `<Hero` is rendered and add the prop:

```typescript
openFeedback={() => setFeedbackContext({})}
```

- [ ] **Step 3: Pass openFeedback to ServiceModal**

Find the ServiceModal rendering (around lines 524-530) and add the prop:

```typescript
openFeedback={(id, name) => setFeedbackContext({ serviceId: id, serviceName: name })}
```

- [ ] **Step 4: Remove the footer feedback button**

Find the footer feedback button (lines 552-559):

```typescript
<button
  onClick={() => setFeedbackOpen(true)}
  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
  data-testid="button-open-feedback"
>
  <MessageSquare className="w-4 h-4" />
  {t('feedback.link')}
</button>
```

Delete this entire block. Also remove the `MessageSquare` import from lucide-react if it's no longer used elsewhere in the file.

- [ ] **Step 5: Update FeedbackModal rendering**

Find the FeedbackModal rendering (line 563):

```typescript
<FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
```

Replace with:

```typescript
<FeedbackModal
  open={!!feedbackContext}
  onClose={() => setFeedbackContext(null)}
  serviceId={feedbackContext?.serviceId}
  serviceName={feedbackContext?.serviceName}
  searchQuery={searchState.query}
/>
```

`searchState.query` is already available in Home.tsx via the search context/state. This is the current search query text (empty string if no search performed).

- [ ] **Step 6: Verify it compiles and renders**

Run: `npm run check`
Expected: No type errors.

Run: `npm run dev`
Expected: Header shows feedback button. Clicking it opens the typed feedback modal. Footer no longer has the old feedback button.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Home.tsx
git commit -m "feat(feedback): wire feedback context through Home.tsx, remove footer button"
```

---

### Task 8: Manual End-to-End Testing

- [ ] **Step 1: Test header feedback (no search)**

1. Load the page fresh (no search performed)
2. Click the header "Feedback" button
3. Verify modal opens with title "Feedback"
4. Verify only 2 types shown: Missing service, General feedback
5. Verify "General feedback" is pre-selected
6. Verify header hint text appears: "To report incorrect service details..."
7. Submit a general feedback message
8. Verify success screen appears

- [ ] **Step 2: Test header feedback (with search)**

1. Search for "dental services"
2. Click the header "Feedback" button
3. Verify 3 types shown: Missing service, Bad search results, General feedback
4. Select "Bad search results"
5. Verify search query "dental services" appears as read-only field
6. Submit and verify success

- [ ] **Step 3: Test service-level feedback**

1. Search for something, click a service to open ServiceModal
2. Scroll to the sidebar CTA — verify "Report an issue" link appears below it
3. Click "Report an issue"
4. Verify modal opens with title "Report an Issue"
5. Verify only 2 types: Incorrect service information, Service no longer exists
6. Verify service name appears as read-only field
7. Select "Incorrect service information", check some field boxes, write a message
8. Submit and verify success

- [ ] **Step 4: Test service closed (low-friction)**

1. Open a service, click "Report an issue"
2. Select "Service no longer exists"
3. Click Submit without typing anything
4. Verify it submits successfully (auto-filled message)

- [ ] **Step 5: Test modal survives service modal close**

1. Open a service, click "Report an issue"
2. Close the service modal (click outside or press Escape on it)
3. Verify the feedback modal remains open
4. Complete and submit — verify service context is preserved

- [ ] **Step 6: Test mobile responsiveness**

1. Open browser dev tools, set viewport to 375x667
2. Verify header shows only the feedback icon (no text)
3. Open feedback modal — verify it scrolls properly
4. Verify submit button is reachable

- [ ] **Step 7: Verify footer button is gone**

1. Scroll to the bottom of the page
2. Verify the old "Feedback & Suggestions" link is no longer there

- [ ] **Step 8: Verify database records**

Check the database for the new feedback entries:
```sql
SELECT id, type, status, service_id, service_name, search_query, message FROM feedback ORDER BY id DESC LIMIT 5;
```
Verify `type`, `service_id`, `service_name`, and `search_query` are populated correctly for each test submission.

- [ ] **Step 9: Commit any fixes from testing**

If any bugs were found during testing, fix them and commit:
```bash
git add -A
git commit -m "fix(feedback): address issues found during manual testing"
```

---

### Task 9: Final Cleanup and Push

- [ ] **Step 1: Run full type check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 2: Run existing tests**

Run: `npm test`
Expected: All 168 existing tests pass. No regressions.

- [ ] **Step 3: Test production build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

Verify Render auto-deploys successfully.

- [ ] **Step 5: Post-push index check**

```bash
git reset HEAD
git status
```
Expected: "nothing to commit, working tree clean" (prevents worktree merge index corruption).
