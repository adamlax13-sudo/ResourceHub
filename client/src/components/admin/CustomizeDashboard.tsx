import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, RotateCcw, Lock } from "lucide-react";
import {
  DashboardLayout,
  DASHBOARD_WIDGETS,
  getDefaultLayout,
  getWidgetDef,
} from "@/lib/dashboard-widgets";

interface CustomizeDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: DashboardLayout;
  onLayoutChange: (layout: DashboardLayout) => void;
}

export function CustomizeDashboard({
  open,
  onOpenChange,
  layout,
  onLayoutChange,
}: CustomizeDashboardProps) {
  const toggleWidget = useCallback(
    (id: string) => {
      const def = getWidgetDef(id);
      if (!def?.removable) return;

      const next: DashboardLayout = {
        widgets: layout.widgets.map((w) =>
          w.id === id ? { ...w, visible: !w.visible } : w,
        ),
      };
      onLayoutChange(next);
    },
    [layout, onLayoutChange],
  );

  const moveWidget = useCallback(
    (id: string, direction: "up" | "down") => {
      const idx = layout.widgets.findIndex((w) => w.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= layout.widgets.length) return;

      // Don't allow swapping past the non-removable hero-stats at index 0
      const swapDef = getWidgetDef(layout.widgets[swapIdx].id);
      const curDef = getWidgetDef(layout.widgets[idx].id);
      if (!swapDef?.removable && direction === "up") return;
      if (!curDef?.removable) return;

      const next = [...layout.widgets];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      onLayoutChange({ widgets: next });
    },
    [layout, onLayoutChange],
  );

  const resetToDefault = useCallback(() => {
    onLayoutChange(getDefaultLayout());
  }, [onLayoutChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Toggle widgets on or off, and reorder them with the arrow buttons.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 mt-2">
          {layout.widgets.map((item, index) => {
            const def = getWidgetDef(item.id);
            if (!def) return null;

            const isFirst = index === 0;
            const isLast = index === layout.widgets.length - 1;
            const canMoveUp = !isFirst && def.removable && (index > 1 || getWidgetDef(layout.widgets[0].id)?.removable);
            const canMoveDown = !isLast && def.removable;

            return (
              <div
                key={item.id}
                className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 w-6">
                  {def.removable ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 text-gray-400 hover:text-gray-700"
                        onClick={() => moveWidget(item.id, "up")}
                        disabled={!canMoveUp}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 text-gray-400 hover:text-gray-700"
                        onClick={() => moveWidget(item.id, "down")}
                        disabled={!canMoveDown}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-gray-300 mx-auto" />
                  )}
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{def.label}</p>
                  <p className="text-xs text-gray-400 truncate">{def.description}</p>
                </div>

                {/* Toggle */}
                {def.removable ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.visible}
                    onClick={() => toggleWidget(item.id)}
                    className={`
                      relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1
                      ${item.visible ? "bg-teal-600" : "bg-gray-200"}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out mt-0.5
                        ${item.visible ? "translate-x-4 ml-0.5" : "translate-x-0 ml-0.5"}
                      `}
                    />
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 flex-shrink-0">Always on</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Reset button */}
        <div className="pt-3 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
            onClick={resetToDefault}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to Default
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
