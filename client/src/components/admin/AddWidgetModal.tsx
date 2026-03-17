import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WIDGET_CATALOG, WIDGET_CATEGORIES, type WidgetCategory } from "@/lib/widget-catalog";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import { useState } from "react";

interface AddWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addedWidgetIds: string[];
  onAdd: (widgetId: string) => void;
}

const SIZE_LABELS: Record<string, string> = {
  small: "S",
  medium: "M",
  large: "L",
};

export function AddWidgetModal({ open, onOpenChange, addedWidgetIds, onAdd }: AddWidgetModalProps) {
  const addedSet = new Set(addedWidgetIds);

  // Default to first category that has at least one widget not yet added
  const defaultCategory = WIDGET_CATEGORIES.find((cat) =>
    WIDGET_CATALOG.some((w) => w.category === cat && !addedSet.has(w.id))
  ) ?? "Overview";

  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory>(defaultCategory);

  const widgetsInCategory = WIDGET_CATALOG.filter((w) => w.category === selectedCategory);

  function handleAdd(widgetId: string) {
    onAdd(widgetId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row min-h-0 overflow-hidden h-[500px]">
          {/* Category sidebar */}
          <nav className="flex sm:flex-col gap-1 px-3 py-3 sm:py-4 sm:w-44 sm:border-r border-b sm:border-b-0 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto shrink-0">
            {WIDGET_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors text-left",
                  selectedCategory === cat
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {cat}
              </button>
            ))}
          </nav>

          {/* Widget grid — fixed height, scrolls internally */}
          <div className="flex-1 overflow-y-auto p-4">
            {widgetsInCategory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No widgets in this category.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {widgetsInCategory.map((widget) => {
                  const isAdded = addedSet.has(widget.id);

                  return (
                    <button
                      key={widget.id}
                      disabled={isAdded}
                      onClick={() => handleAdd(widget.id)}
                      className={cn(
                        "group relative flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-all",
                        isAdded
                          ? "opacity-50 cursor-default border-gray-200 bg-gray-50"
                          : "border-gray-200 hover:border-teal-300 hover:shadow-sm hover:bg-teal-50/30 cursor-pointer"
                      )}
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {widget.label}
                        </span>
                        {isAdded ? (
                          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-600">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-gray-400 group-hover:text-teal-600 group-hover:bg-teal-100 transition-colors">
                            <Plus className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 leading-relaxed">
                        {widget.description}
                      </p>

                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider mt-1",
                          isAdded
                            ? "bg-gray-200 text-gray-500"
                            : "bg-teal-100 text-teal-700"
                        )}
                      >
                        {SIZE_LABELS[widget.defaultSize]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
