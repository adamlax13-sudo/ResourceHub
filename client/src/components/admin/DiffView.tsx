import { cn } from "@/lib/utils";

interface DiffViewProps {
  /** Object mapping field names to { old, new } values */
  changes: Record<string, { old: unknown; new: unknown }>;
  className?: string;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "(empty)";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
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
              <div className="px-3 py-2 bg-red-50/50">
                <span className="text-xs text-red-500 mr-2 font-mono">-</span>
                <span className="text-sm text-red-700 whitespace-pre-wrap break-words">
                  {formatValue(oldVal)}
                </span>
              </div>
              <div className="px-3 py-2 bg-emerald-50/50">
                <span className="text-xs text-emerald-500 mr-2 font-mono">+</span>
                <span className="text-sm text-emerald-700 whitespace-pre-wrap break-words">
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
