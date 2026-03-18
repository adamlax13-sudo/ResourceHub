import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReactNode } from "react";

interface MasterDetailLayoutProps {
  /** Left panel content — list view (inside scroll area) */
  list: ReactNode;
  /** Left panel header — filters/search (above scroll area, not clipped) */
  listHeader?: ReactNode;
  /** Right panel content — detail view, or null for placeholder */
  detail: ReactNode | null;
  /** Placeholder shown when no item is selected */
  placeholder?: string;
  /** Custom class names */
  className?: string;
}

export function MasterDetailLayout({
  list,
  listHeader,
  detail,
  placeholder = "Select an item to view details",
  className,
}: MasterDetailLayoutProps) {
  return (
    <div className={cn("flex h-[calc(100vh-4rem)] gap-0", className)}>
      {/* Left panel — 45% */}
      <div className="w-[45%] min-w-[320px] border-r border-border flex flex-col">
        {listHeader && (
          <div className="flex-shrink-0 overflow-visible relative z-10">
            {listHeader}
          </div>
        )}
        <ScrollArea className="flex-1">{list}</ScrollArea>
      </div>

      {/* Right panel — 55% */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {detail ? (
          <ScrollArea className="flex-1">{detail}</ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
