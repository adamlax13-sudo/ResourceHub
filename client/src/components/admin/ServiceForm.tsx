import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
}

const CATEGORY_OPTIONS = [
  "Addiction Services", "Mental Health", "Housing & Shelter", "Food & Basic Needs",
  "Financial Assistance", "Legal Services", "Employment Services", "Family Services",
  "Youth Services", "Senior Services", "Indigenous Services", "Newcomer Services",
  "Disability Support", "Healthcare Access", "Crisis Services", "Gambling Support",
  "Grief & Loss", "Domestic Violence", "Sexual Assault", "LGBTQ+ Services",
  "Transportation", "Hospital & Emergency", "Criminal Justice Reintegration",
  "Parenting & Child Development", "Social & Community", "Education & Training",
];

export function ServiceForm({ initialData, onSubmit, isPending, submitLabel = "Save" }: ServiceFormProps) {
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

  // Sync if initialData changes (e.g., detail load)
  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const [tagsInput, setTagsInput] = useState((initialData?.tags ?? []).join(", "));

  const handleChange = (field: keyof ServiceFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({ ...form, tags });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label className="text-slate-300">Name *</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="mt-1 bg-slate-800 border-slate-600 text-white"
          />
        </div>

        <div>
          <Label className="text-slate-300">Category *</Label>
          <select
            required
            value={form.category}
            onChange={(e) => handleChange("category", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-white"
          >
            <option value="">Select...</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-slate-300">Location</Label>
          <Input
            value={form.location ?? ""}
            onChange={(e) => handleChange("location", e.target.value)}
            className="mt-1 bg-slate-800 border-slate-600 text-white"
            placeholder="City or region"
          />
        </div>
      </div>

      <div>
        <Label className="text-slate-300">Description</Label>
        <Textarea
          value={form.description ?? ""}
          onChange={(e) => handleChange("description", e.target.value)}
          className="mt-1 bg-slate-800 border-slate-600 text-white min-h-[100px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-300">Phone</Label>
          <Input
            value={form.phone ?? ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="mt-1 bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div>
          <Label className="text-slate-300">Email</Label>
          <Input
            value={form.email ?? ""}
            onChange={(e) => handleChange("email", e.target.value)}
            className="mt-1 bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>

      <div>
        <Label className="text-slate-300">Address</Label>
        <Input
          value={form.address ?? ""}
          onChange={(e) => handleChange("address", e.target.value)}
          className="mt-1 bg-slate-800 border-slate-600 text-white"
        />
      </div>

      <div>
        <Label className="text-slate-300">Website URL</Label>
        <Input
          value={form.websiteUrl ?? ""}
          onChange={(e) => handleChange("websiteUrl", e.target.value)}
          className="mt-1 bg-slate-800 border-slate-600 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-300">Hours of Operation</Label>
          <Input
            value={form.hoursOfOperation ?? ""}
            onChange={(e) => handleChange("hoursOfOperation", e.target.value)}
            className="mt-1 bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div>
          <Label className="text-slate-300">Eligibility</Label>
          <Input
            value={form.eligibility ?? ""}
            onChange={(e) => handleChange("eligibility", e.target.value)}
            className="mt-1 bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>

      <div>
        <Label className="text-slate-300">Tags (comma-separated)</Label>
        <Input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="mt-1 bg-slate-800 border-slate-600 text-white"
          placeholder="e.g. free, walk-in, virtual"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-slate-300">Gender Restriction</Label>
          <select
            value={form.genderRestriction ?? ""}
            onChange={(e) => handleChange("genderRestriction", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-white"
          >
            <option value="">None (all genders)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <Label className="text-slate-300">Age Group</Label>
          <select
            value={form.ageGroup ?? ""}
            onChange={(e) => handleChange("ageGroup", e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-white"
          >
            <option value="">All ages</option>
            <option value="youth">Youth</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>

      <div className="flex gap-6 pt-2">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isFaithBased ?? false}
            onChange={(e) => handleChange("isFaithBased", e.target.checked)}
            className="rounded"
          />
          Faith-based
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is12Step ?? false}
            onChange={(e) => handleChange("is12Step", e.target.checked)}
            className="rounded"
          />
          12-Step
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
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
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
