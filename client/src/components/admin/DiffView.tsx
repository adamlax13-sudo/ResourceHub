import { cn } from "@/lib/utils";

interface DiffViewProps {
  /** Object mapping field names to { old, new } values */
  changes: Record<string, { old: unknown; new: unknown }>;
  className?: string;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "(empty)";
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
  const fields = Object.keys(changes);

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes detected.</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {fields.map((field) => {
        const { old: oldVal, new: newVal } = changes[field];
        return (
          <div key={field} className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted px-3 py-1.5 text-xs font-medium text-foreground border-b border-border">
              {field}
            </div>
            <div className="divide-y divide-border">
              <div className="px-3 py-2 bg-red-50/30 max-h-40 overflow-auto">
                <span className="text-xs text-red-500 mr-2 font-mono">-</span>
                <span className="text-sm text-red-700/80 whitespace-pre-wrap break-words">
                  {formatValue(oldVal)}
                </span>
              </div>
              <div className="px-3 py-2 bg-emerald-50/30 max-h-40 overflow-auto">
                <span className="text-xs text-emerald-500 mr-2 font-mono">+</span>
                <span className="text-sm text-emerald-700/80 whitespace-pre-wrap break-words">
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
