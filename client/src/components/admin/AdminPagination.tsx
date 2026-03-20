import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number | ((prev: number) => number)) => void;
  onPageSizeChange: (size: number) => void;
  /** "compact" uses ghost buttons + "Page X of Y" text; "full" uses outline buttons + range text */
  variant?: "compact" | "full";
}

export function AdminPagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  variant = "compact",
}: AdminPaginationProps) {
  if (variant === "full") {
    return (
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} services
          </p>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-xs border border-border rounded px-1.5 py-1 text-muted-foreground bg-card"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt} per page</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page <= 1}
            onClick={() => onPageChange((p: number) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange((p: number) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // compact variant (default) — used by Services list panel
  return (
    <div className="border-t border-border px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total > 0
            ? `Page ${page} of ${totalPages} (${total} total)`
            : "No results"}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange((p: number) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-7 px-2 text-muted-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange((p: number) => p + 1)}
            disabled={page >= totalPages}
            className="h-7 px-2 text-muted-foreground"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Show</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border border-border rounded px-1.5 py-0.5 text-xs bg-card text-foreground"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <span>per page</span>
      </div>
    </div>
  );
}
