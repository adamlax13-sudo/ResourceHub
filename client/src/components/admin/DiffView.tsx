import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  name: "Name", category: "Category", description: "Description",
  location: "Location", address: "Address", phone: "Phone", email: "Email",
  websiteUrl: "Website", eligibility: "Eligibility", processSteps: "Process Steps",
  hoursOfOperation: "Hours", requiredDocs: "Required Docs", waitTimes: "Wait Times",
  serviceFormat: "Service Format", languagesSupported: "Languages",
  tags: "Tags", isActive: "Active",
};

interface DiffViewProps {
  /** Object mapping field names to { old, new } values */
  changes: Record<string, { old: unknown; new: unknown }>;
  className?: string;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "(empty)";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) {
    if (val.length === 0) return "(empty)";
    return val.map((v, i) => typeof v === "string" ? `${i + 1}. ${v}` : JSON.stringify(v)).join("\n");
  }
  if (typeof val === "object") {
    const str = JSON.stringify(val, null, 2);
    return str.length > 500 ? str.slice(0, 500) + "…" : str;
  }
  const str = String(val);
  return str.length > 500 ? str.slice(0, 500) + "…" : str;
}

export function DiffView({ changes, className }: DiffViewProps) {
  // Filter out id, isActive, and fields that didn't actually change
  const fields = Object.keys(changes).filter(
    (k) => k !== "id" && k !== "isActive" && JSON.stringify(changes[k].old) !== JSON.stringify(changes[k].new)
  );

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes detected.</p>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {fields.map((field) => {
        const { old: oldVal, new: newVal } = changes[field];
        const label = FIELD_LABELS[field] || field;
        const oldEmpty = oldVal === null || oldVal === undefined || oldVal === "" || (Array.isArray(oldVal) && oldVal.length === 0);

        // If old value was empty, show as "added" (green only, no red)
        if (oldEmpty) {
          return (
            <div key={field} className="rounded-lg border border-emerald-200 overflow-hidden">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 border-b border-emerald-200 flex items-center gap-1.5">
                <span className="text-emerald-500 font-mono text-[10px]">+</span>
                {label}
              </div>
              <div className="px-3 py-2 max-h-40 overflow-auto">
                <span className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {formatValue(newVal)}
                </span>
              </div>
            </div>
          );
        }

        // Both old and new have values — show side-by-side diff
        return (
          <div key={field} className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-foreground border-b border-border">
              {label}
            </div>
            <div className="divide-y divide-border">
              <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 max-h-32 overflow-auto">
                <span className="text-xs text-red-500 mr-2 font-mono font-bold">−</span>
                <span className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap break-words">
                  {formatValue(oldVal)}
                </span>
              </div>
              <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 max-h-32 overflow-auto">
                <span className="text-xs text-emerald-500 mr-2 font-mono font-bold">+</span>
                <span className="text-sm text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap break-words">
                  {formatValue(newVal)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
