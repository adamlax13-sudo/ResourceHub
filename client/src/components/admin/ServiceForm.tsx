import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { CATEGORY_GROUPS } from "@/components/RefinePanel";

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
}

interface ServiceFormProps {
  initialData?: Partial<ServiceFormData>;
  onSubmit: (data: ServiceFormData) => void;
  isPending?: boolean;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ServiceForm({ initialData, onSubmit, isPending, submitLabel = "Save", onDirtyChange }: ServiceFormProps) {
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

  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);

  // Sync tags when initialData changes
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

  const handleChange = (field: keyof ServiceFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    onDirtyChange?.(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, tags });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label className="text-gray-700">Name *</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="mt-1 bg-white border-gray-300 text-gray-900"
          />
        </div>

        <div>
          <Label className="text-gray-700">Category *</Label>
          <select
            required
            value={form.category}
            onChange={(e) => handleChange("category", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
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
          <Label className="text-gray-700">Location</Label>
          <Input
            value={form.location ?? ""}
            onChange={(e) => handleChange("location", e.target.value)}
            className="mt-1 bg-white border-gray-300 text-gray-900"
            placeholder="City or region"
          />
        </div>
      </div>

      <div>
        <Label className="text-gray-700">Description</Label>
        <Textarea
          value={form.description ?? ""}
          onChange={(e) => handleChange("description", e.target.value)}
          className="mt-1 bg-white border-gray-300 text-gray-900 min-h-[100px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-700">Phone</Label>
          <Input
            value={form.phone ?? ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="mt-1 bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div>
          <Label className="text-gray-700">Email</Label>
          <Input
            value={form.email ?? ""}
            onChange={(e) => handleChange("email", e.target.value)}
            className="mt-1 bg-white border-gray-300 text-gray-900"
          />
        </div>
      </div>

      <div>
        <Label className="text-gray-700">Address</Label>
        <Input
          value={form.address ?? ""}
          onChange={(e) => handleChange("address", e.target.value)}
          className="mt-1 bg-white border-gray-300 text-gray-900"
        />
      </div>

      <div>
        <Label className="text-gray-700">Website URL</Label>
        <Input
          value={form.websiteUrl ?? ""}
          onChange={(e) => handleChange("websiteUrl", e.target.value)}
          className="mt-1 bg-white border-gray-300 text-gray-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-700">Hours of Operation</Label>
          <Input
            value={form.hoursOfOperation ?? ""}
            onChange={(e) => handleChange("hoursOfOperation", e.target.value)}
            className="mt-1 bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div>
          <Label className="text-gray-700">Eligibility</Label>
          <Input
            value={form.eligibility ?? ""}
            onChange={(e) => handleChange("eligibility", e.target.value)}
            className="mt-1 bg-white border-gray-300 text-gray-900"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-gray-700">Tags</Label>
        <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-gray-200 rounded-lg bg-white mt-1">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={tags.length === 0 ? "Add tag..." : "Add more..."}
            className="flex-1 min-w-[80px] text-sm outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                e.preventDefault();
                addTag(e.currentTarget.value.trim());
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
        <p className="text-xs text-gray-400">Press Enter to add a tag</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-gray-700">Gender Restriction</Label>
          <select
            value={form.genderRestriction ?? ""}
            onChange={(e) => handleChange("genderRestriction", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
          >
            <option value="">None (all genders)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <Label className="text-gray-700">Age Group</Label>
          <select
            value={form.ageGroup ?? ""}
            onChange={(e) => handleChange("ageGroup", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
          >
            <option value="">All ages</option>
            <option value="youth">Youth</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>

      <div className="flex gap-6 pt-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isFaithBased ?? false}
            onChange={(e) => handleChange("isFaithBased", e.target.checked)}
            className="rounded"
          />
          Faith-based
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is12Step ?? false}
            onChange={(e) => handleChange("is12Step", e.target.checked)}
            className="rounded"
          />
          12-Step
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is24_7 ?? false}
            onChange={(e) => handleChange("is24_7", e.target.checked)}
            className="rounded"
          />
          24/7
        </label>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
