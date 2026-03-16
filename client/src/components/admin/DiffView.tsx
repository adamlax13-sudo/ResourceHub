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
    return <p className="text-sm text-gray-400">No changes detected.</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {fields.map((field) => {
        const { old: oldVal, new: newVal } = changes[field];
        return (
          <div key={field} className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 border-b border-gray-200">
              {field}
            </div>
            <div className="divide-y divide-gray-200">
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
