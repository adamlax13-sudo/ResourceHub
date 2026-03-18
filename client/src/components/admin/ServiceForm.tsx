import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, X, Plus } from "lucide-react";
import { CATEGORY_GROUPS } from "@/lib/category-groups";

export interface ServiceFormData {
  name: string;
  category: string;
  description?: string;
  location?: string;
  contact?: string;
  eligibility?: string;
  phone?: string;
  email?: string;
  address?: string;
  hoursOfOperation?: string;
  websiteUrl?: string;
  tags?: string[];
  genderRestriction?: string;
  ageGroup?: string;
  isFaithBased?: boolean;
  is12Step?: boolean;
  is24_7?: boolean;
  processSteps?: Array<{ step: number; action: string; details?: string | null }>;
  requiredDocs?: string[];
  waitTimes?: string;
  serviceFormat?: string;
  languagesSupported?: string[];
}

interface ServiceFormProps {
  initialData?: Partial<ServiceFormData>;
  onSubmit: (data: ServiceFormData) => void;
  isPending?: boolean;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onNameChange?: (name: string) => void;
  /** Called with current form data whenever any field changes */
  onChange?: (data: ServiceFormData) => void;
  /** Field keys to highlight as needing attention (e.g. missing data) — amber ring */
  highlightFields?: string[];
  /** Field keys to highlight as changed/updated — emerald ring */
  changedFields?: string[];
}

/** Normalize requiredDocs — DB may store string[] or {name: string}[] */
function normalizeRequiredDocs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "name" in item) return String((item as { name: unknown }).name);
    return String(item);
  });
}

/** Normalize processSteps — DB may store string[], object[], or mixed */
function normalizeProcessSteps(raw: unknown): Array<{ step: number; action: string; details?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    if (typeof item === "string") return { step: i + 1, action: item, details: null };
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      return {
        step: typeof obj.step === "number" ? obj.step : i + 1,
        action: String(obj.action || obj.name || obj.title || ""),
        details: obj.details != null ? String(obj.details) : null,
      };
    }
    return { step: i + 1, action: String(item), details: null };
  });
}

export function ServiceForm({ initialData, onSubmit, isPending, submitLabel = "Save", onDirtyChange, onNameChange, onChange, highlightFields, changedFields }: ServiceFormProps) {
  const highlightSet = new Set(highlightFields ?? []);
  const changedSet = new Set(changedFields ?? []);
  const hl = (field: string) =>
    changedSet.has(field) ? "ring-2 ring-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20" :
    highlightSet.has(field) ? "ring-2 ring-amber-300 bg-amber-50/50" : "";
  const [form, setForm] = useState<ServiceFormData>({
    name: "",
    category: "",
    description: "",
    location: "",
    contact: "",
    eligibility: "",
    phone: "",
    email: "",
    address: "",
    hoursOfOperation: "",
    websiteUrl: "",
    tags: [],
    genderRestriction: "",
    ageGroup: "",
    isFaithBased: false,
    is12Step: false,
    is24_7: false,
    waitTimes: "",
    serviceFormat: "",
    ...initialData,
  });

  const initialDataRef = useRef(initialData);
  const hasMounted = useRef(false);

  // Sync if initialData changes (e.g., detail load)
  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
      initialDataRef.current = initialData;
      hasMounted.current = false; // reset dirty tracking on new data
      onDirtyChange?.(false);
    }
  }, [initialData]);

  // --- Tags ---
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);

  useEffect(() => {
    if (initialData?.tags !== undefined) {
      setTags(initialData.tags ?? []);
    }
  }, [initialData]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      onDirtyChange?.(true);
    }
  };

  const removeTag = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
    onDirtyChange?.(true);
  };

  // --- Process Steps ---
  const [processSteps, setProcessSteps] = useState<Array<{ step: number; action: string; details?: string | null }>>(
    normalizeProcessSteps(initialData?.processSteps)
  );

  useEffect(() => {
    if (initialData?.processSteps !== undefined) {
      setProcessSteps(normalizeProcessSteps(initialData.processSteps));
    }
  }, [initialData]);

  const addProcessStep = () => {
    setProcessSteps((prev) => [...prev, { step: prev.length + 1, action: "", details: "" }]);
    onDirtyChange?.(true);
  };

  const updateProcessStep = (index: number, field: "action" | "details", value: string) => {
    setProcessSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
    onDirtyChange?.(true);
  };

  const removeProcessStep = (index: number) => {
    setProcessSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step: i + 1 }))
    );
    onDirtyChange?.(true);
  };

  // --- Required Docs ---
  const [requiredDocs, setRequiredDocs] = useState<string[]>(
    normalizeRequiredDocs(initialData?.requiredDocs)
  );

  useEffect(() => {
    if (initialData?.requiredDocs !== undefined) {
      setRequiredDocs(normalizeRequiredDocs(initialData.requiredDocs));
    }
  }, [initialData]);

  const addDoc = (doc: string) => {
    const trimmed = doc.trim();
    if (trimmed && !requiredDocs.includes(trimmed)) {
      setRequiredDocs((prev) => [...prev, trimmed]);
      onDirtyChange?.(true);
    }
  };

  const removeDoc = (index: number) => {
    setRequiredDocs((prev) => prev.filter((_, i) => i !== index));
    onDirtyChange?.(true);
  };

  // --- Languages Supported ---
  const [languagesSupported, setLanguagesSupported] = useState<string[]>(
    initialData?.languagesSupported ?? []
  );

  useEffect(() => {
    if (initialData?.languagesSupported !== undefined) {
      setLanguagesSupported(initialData.languagesSupported ?? []);
    }
  }, [initialData]);

  const addLanguage = (lang: string) => {
    const trimmed = lang.trim();
    if (trimmed && !languagesSupported.includes(trimmed)) {
      setLanguagesSupported((prev) => [...prev, trimmed]);
      onDirtyChange?.(true);
    }
  };

  const removeLanguage = (index: number) => {
    setLanguagesSupported((prev) => prev.filter((_, i) => i !== index));
    onDirtyChange?.(true);
  };

  // Report form data changes to parent for draft persistence
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    onChange?.({ ...form, tags, processSteps, requiredDocs, languagesSupported });
  }, [form, tags, processSteps, requiredDocs, languagesSupported]);

  // --- General field change ---
  const handleChange = (field: keyof ServiceFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    onDirtyChange?.(true);
    if (field === 'name' && typeof value === 'string') {
      onNameChange?.(value);
    }
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      setValidationError("Name is required.");
      return;
    }
    if (!form.category?.trim()) {
      setValidationError("Category is required.");
      return;
    }
    setValidationError(null);
    onSubmit({ ...form, tags, processSteps, requiredDocs, languagesSupported });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label className="text-foreground">Name <span className="text-red-400">*</span></Label>
          <Input
            required
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className={cn("mt-1 bg-card border-border text-foreground", hl("name"))}
          />
        </div>

        <div>
          <Label className="text-foreground">Category <span className="text-red-400">*</span></Label>
          <select
            required
            value={form.category}
            onChange={(e) => handleChange("category", e.target.value)}
            className={cn("mt-1 w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground", hl("category"))}
          >
            <option value="">Select...</option>
            {CATEGORY_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-foreground">Location</Label>
          <Input
            value={form.location ?? ""}
            onChange={(e) => handleChange("location", e.target.value)}
            className={cn("mt-1 bg-card border-border text-foreground", hl("location"))}
            placeholder="City or region"
          />
        </div>
      </div>

      <div>
        <Label className="text-foreground">Description</Label>
        <Textarea
          value={form.description ?? ""}
          onChange={(e) => handleChange("description", e.target.value)}
          className={cn("mt-1 bg-card border-border text-foreground min-h-[100px]", hl("description"))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-foreground">Phone</Label>
          <Input
            value={form.phone ?? ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            className={cn("mt-1 bg-card border-border text-foreground", hl("phone"))}
          />
        </div>
        <div>
          <Label className="text-foreground">Email</Label>
          <Input
            value={form.email ?? ""}
            onChange={(e) => handleChange("email", e.target.value)}
            className={cn("mt-1 bg-card border-border text-foreground", hl("email"))}
          />
        </div>
      </div>

      <div>
        <Label className="text-foreground">Address</Label>
        <Input
          value={form.address ?? ""}
          onChange={(e) => handleChange("address", e.target.value)}
          className={cn("mt-1 bg-card border-border text-foreground", hl("address"))}
        />
      </div>

      <div>
        <Label className="text-foreground">Website URL</Label>
        <Input
          value={form.websiteUrl ?? ""}
          onChange={(e) => handleChange("websiteUrl", e.target.value)}
          className={cn("mt-1 bg-card border-border text-foreground", hl("websiteUrl"))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-foreground">Hours of Operation</Label>
          <Input
            value={form.hoursOfOperation ?? ""}
            onChange={(e) => handleChange("hoursOfOperation", e.target.value)}
            className={cn("mt-1 bg-card border-border text-foreground", hl("hoursOfOperation"))}
          />
        </div>
        <div>
          <Label className="text-foreground">Eligibility</Label>
          <Input
            value={form.eligibility ?? ""}
            onChange={(e) => handleChange("eligibility", e.target.value)}
            className={cn("mt-1 bg-card border-border text-foreground", hl("eligibility"))}
          />
        </div>
      </div>

      {/* Wait Times + Service Format */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-foreground">Wait Times</Label>
          <Input
            value={form.waitTimes ?? ""}
            onChange={(e) => handleChange("waitTimes", e.target.value)}
            className="mt-1 bg-card border-border text-foreground"
            placeholder="e.g., Walk-in, 2-4 weeks"
          />
        </div>
        <div>
          <Label className="text-foreground">Service Format</Label>
          <select
            value={form.serviceFormat ?? ""}
            onChange={(e) => handleChange("serviceFormat", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">Not specified</option>
            <option value="in-person">In-person</option>
            <option value="virtual">Virtual/Online</option>
            <option value="phone">Phone</option>
            <option value="walk_in">Walk-in</option>
            <option value="online">Online</option>
          </select>
        </div>
      </div>

      {/* Process Steps */}
      <div className={cn("space-y-1 rounded-lg p-2 -mx-2", hl("processSteps"))}>
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Process Steps</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addProcessStep} className="h-7 text-primary hover:text-primary">
            <Plus className="h-3 w-3 mr-1" /> Add Step
          </Button>
        </div>
        {processSteps.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">No steps yet — click Add Step to describe how to access this service.</p>
        )}
        {processSteps.map((step, i) => (
          <div key={i} className="flex gap-2 items-start mt-2 p-3 border border-border rounded-lg bg-muted">
            <span className="text-sm font-bold text-primary mt-2 w-5 shrink-0">{i + 1}</span>
            <div className="flex-1 space-y-1.5">
              <Input
                value={step.action}
                onChange={(e) => updateProcessStep(i, "action", e.target.value)}
                placeholder="What to do"
                className="text-sm bg-card border-border text-foreground"
              />
              <Input
                value={step.details ?? ""}
                onChange={(e) => updateProcessStep(i, "details", e.target.value)}
                placeholder="Additional details (optional)"
                className="text-sm bg-card border-border text-muted-foreground"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeProcessStep(i)}
              className="h-7 w-7 p-0 mt-1 text-muted-foreground hover:text-red-500"
              aria-label="Remove step"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Required Documents */}
      <div className="space-y-1">
        <Label className="text-foreground">Required Documents</Label>
        <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-border rounded-lg bg-card mt-1">
          {requiredDocs.map((doc, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200"
            >
              {doc}
              <button
                type="button"
                onClick={() => removeDoc(i)}
                className="text-amber-400 hover:text-red-500 transition-colors"
                aria-label="Remove document"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={requiredDocs.length === 0 ? "Add document..." : "Add more..."}
            className="flex-1 min-w-[100px] text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                e.preventDefault();
                addDoc(e.currentTarget.value.trim());
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Press Enter to add a document</p>
      </div>

      {/* Languages Supported */}
      <div className="space-y-1">
        <Label className="text-foreground">Languages Supported</Label>
        <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-border rounded-lg bg-card mt-1">
          {languagesSupported.map((lang, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border"
            >
              {lang}
              <button
                type="button"
                onClick={() => removeLanguage(i)}
                className="text-muted-foreground hover:text-red-500 transition-colors"
                aria-label="Remove language"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            list="languages-list"
            placeholder={languagesSupported.length === 0 ? "Add language..." : "Add more..."}
            className="flex-1 min-w-[100px] text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                e.preventDefault();
                addLanguage(e.currentTarget.value.trim());
                e.currentTarget.value = "";
              }
            }}
          />
          <datalist id="languages-list">
            <option value="English" />
            <option value="French" />
            <option value="Arabic" />
            <option value="Punjabi" />
            <option value="Tagalog" />
            <option value="Spanish" />
            <option value="Mandarin" />
            <option value="Cantonese" />
            <option value="Urdu" />
            <option value="Hindi" />
            <option value="Ukrainian" />
            <option value="Vietnamese" />
            <option value="Korean" />
            <option value="Somali" />
            <option value="Amharic" />
            <option value="Cree" />
            <option value="Blackfoot" />
            <option value="Dene" />
          </datalist>
        </div>
        <p className="text-xs text-muted-foreground">Press Enter to add a language</p>
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <Label className="text-foreground">Tags</Label>
        <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-border rounded-lg bg-card mt-1">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-foreground border border-border"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="text-muted-foreground hover:text-red-500 transition-colors"
                aria-label="Remove tag"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={tags.length === 0 ? "Add tag..." : "Add more..."}
            className="flex-1 min-w-[80px] text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                e.preventDefault();
                addTag(e.currentTarget.value.trim());
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Press Enter to add a tag</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-foreground">Gender Restriction</Label>
          <select
            value={form.genderRestriction ?? ""}
            onChange={(e) => handleChange("genderRestriction", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">None (all genders)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <Label className="text-foreground">Age Group</Label>
          <select
            value={form.ageGroup ?? ""}
            onChange={(e) => handleChange("ageGroup", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">All ages</option>
            <option value="youth">Youth</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>

      <div className="flex gap-6 pt-2">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.isFaithBased ?? false}
            onChange={(e) => handleChange("isFaithBased", e.target.checked)}
            className="rounded"
          />
          Faith-based
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.is12Step ?? false}
            onChange={(e) => handleChange("is12Step", e.target.checked)}
            className="rounded"
          />
          12-Step
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.is24_7 ?? false}
            onChange={(e) => handleChange("is24_7", e.target.checked)}
            className="rounded"
          />
          24/7
        </label>
      </div>

      {validationError && (
        <p className="text-sm text-red-500 text-right">{validationError}</p>
      )}
      <div className="pt-2 flex justify-end">
        <Button type="submit" disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm">
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
