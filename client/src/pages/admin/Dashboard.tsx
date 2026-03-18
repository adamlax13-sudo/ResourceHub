import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GripVertical, X, Pencil, Check, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DashboardLayout,
  loadDashboardLayout,
  saveDashboardLayout,
  getDefaultDashboardLayout,
  getCatalogWidget,
  type WidgetSize,
} from "@/lib/widget-catalog";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AddWidgetModal } from "@/components/admin/AddWidgetModal";

// Widget components — full catalog registry
import { ServiceOverviewWidget } from "@/components/admin/widgets/ServiceOverviewWidget";
import { RecentActivityWidget } from "@/components/admin/widgets/RecentActivityWidget";
import { QualityOverviewWidget } from "@/components/admin/widgets/QualityOverviewWidget";
import { TopSearchesWidget } from "@/components/admin/widgets/TopSearchesWidget";
import { ScraperStatusWidget } from "@/components/admin/widgets/ScraperStatusWidget";
import { FieldCoverageWidget } from "@/components/admin/widgets/FieldCoverageWidget";
import { PendingReviewsWidget } from "@/components/admin/widgets/PendingReviewsWidget";
import { RecentFeedbackWidget } from "@/components/admin/widgets/RecentFeedbackWidget";
import { VoteSummaryWidget } from "@/components/admin/widgets/VoteSummaryWidget";
import { EmbeddingCoverageWidget } from "@/components/admin/widgets/EmbeddingCoverageWidget";
import { AnalyticsDailyTrendWidget } from "@/components/admin/widgets/AnalyticsDailyTrendWidget";
import { AnalyticsCategoriesWidget } from "@/components/admin/widgets/AnalyticsCategoriesWidget";
import { AnalyticsPeakHoursWidget } from "@/components/admin/widgets/AnalyticsPeakHoursWidget";
import { AnalyticsTopQueriesWidget } from "@/components/admin/widgets/AnalyticsTopQueriesWidget";
import { AnalyticsClickPositionsWidget } from "@/components/admin/widgets/AnalyticsClickPositionsWidget";
import { AnalyticsMostClickedWidget } from "@/components/admin/widgets/AnalyticsMostClickedWidget";
import { AnalyticsLeastClickedWidget } from "@/components/admin/widgets/AnalyticsLeastClickedWidget";
import { AnalyticsDevicesWidget } from "@/components/admin/widgets/AnalyticsDevicesWidget";
import { AnalyticsUnmetNeedsWidget } from "@/components/admin/widgets/AnalyticsUnmetNeedsWidget";
import { AnalyticsSessionsWidget } from "@/components/admin/widgets/AnalyticsSessionsWidget";

/** Maps widget catalog id → React component */
const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ compact?: boolean }>> = {
  "service-overview": ServiceOverviewWidget as React.ComponentType<{ compact?: boolean }>,
  "recent-activity": RecentActivityWidget as React.ComponentType<{ compact?: boolean }>,
  "quality-overview": QualityOverviewWidget as React.ComponentType<{ compact?: boolean }>,
  "top-searches": TopSearchesWidget as React.ComponentType<{ compact?: boolean }>,
  "scraper-status": ScraperStatusWidget as React.ComponentType<{ compact?: boolean }>,
  "quality-field-coverage": FieldCoverageWidget as React.ComponentType<{ compact?: boolean }>,
  "pending-reviews": PendingReviewsWidget as React.ComponentType<{ compact?: boolean }>,
  "recent-feedback": RecentFeedbackWidget as React.ComponentType<{ compact?: boolean }>,
  "vote-summary": VoteSummaryWidget as React.ComponentType<{ compact?: boolean }>,
  "embedding-coverage": EmbeddingCoverageWidget as React.ComponentType<{ compact?: boolean }>,
  "analytics-daily-trend": AnalyticsDailyTrendWidget,
  "analytics-categories": AnalyticsCategoriesWidget,
  "analytics-peak-hours": AnalyticsPeakHoursWidget,
  "analytics-top-queries": AnalyticsTopQueriesWidget,
  "analytics-click-positions": AnalyticsClickPositionsWidget,
  "analytics-most-clicked": AnalyticsMostClickedWidget,
  "analytics-least-clicked": AnalyticsLeastClickedWidget,
  "analytics-devices": AnalyticsDevicesWidget,
  "analytics-unmet-needs": AnalyticsUnmetNeedsWidget,
  "analytics-sessions": AnalyticsSessionsWidget,
};

// ---------- Sortable Widget Wrapper ----------

function SortableWidget({
  id,
  children,
  isEditing,
  size,
  sizes,
  onResize,
  onRemove,
  sizeLocked,
  pinned,
}: {
  id: string;
  children: React.ReactNode;
  isEditing: boolean;
  size: WidgetSize;
  sizes: WidgetSize[];
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  sizeLocked?: boolean;
  pinned?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const colSpan =
    size === "large"
      ? "col-span-1 md:col-span-2 lg:col-span-4"
      : size === "medium"
        ? "col-span-1 md:col-span-2"
        : "col-span-1";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!isEditing) {
    return (
      <div ref={setNodeRef} style={style} className={colSpan}>
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={cn(colSpan, isDragging && "opacity-30 scale-[0.98]")}>
      <div className={cn(
        "relative rounded-xl transition-all",
        "ring-2 ring-teal-200 ring-offset-2",
        "hover:ring-teal-400"
      )}>
        {/* Floating control bar */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-card rounded-full shadow-md border border-border px-1.5 py-0.5">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {!sizeLocked && (
            <>
              <div className="w-px h-4 bg-border" />
              {(["small", "medium", "large"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onResize(s)}
                  disabled={!sizes.includes(s)}
                  className={cn(
                    "w-6 h-6 rounded-full text-[10px] font-bold transition-all",
                    size === s
                      ? "bg-primary text-white shadow-sm"
                      : sizes.includes(s)
                        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                        : "text-muted-foreground/40 cursor-not-allowed",
                  )}
                >
                  {s[0].toUpperCase()}
                </button>
              ))}
            </>
          )}

          {!pinned && (
            <>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={onRemove}
                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

// ---------- Widget Grid with DnD ----------

function DashboardWidgetGrid({
  layout,
  editMode,
  onResize,
  onRemove,
  onDragStart,
  onDragEnd,
  onAddWidget,
  activeId,
}: {
  layout: DashboardLayout;
  editMode: boolean;
  onResize: (id: string, size: WidgetSize) => void;
  onRemove: (id: string) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onAddWidget: () => void;
  activeId: string | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const visibleWidgets = layout.widgets.filter((w) => w.visible);

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <SortableContext
          items={visibleWidgets.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={cn(
              "widget-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
              editMode ? "gap-6 pt-2" : "gap-4"
            )}>
            {visibleWidgets.map((w) => {
              const def = getCatalogWidget(w.id);
              const Comp = WIDGET_COMPONENTS[w.id];
              if (!Comp || !def) return null;
              const isCompact = w.size === "small";
              return (
                <SortableWidget
                  key={w.id}
                  id={w.id}
                  isEditing={editMode}
                  size={w.size}
                  sizes={def.sizes}
                  sizeLocked={def.sizeLocked}
                  pinned={def.pinned}
                  onResize={(s) => onResize(w.id, s)}
                  onRemove={() => onRemove(w.id)}
                >
                  <Comp compact={isCompact} />
                </SortableWidget>
              );
            })}

            {/* Add Widget button (edit mode only) */}
            {editMode && (
              <div className="col-span-1">
                <button
                  onClick={onAddWidget}
                  className="w-full h-full min-h-[140px] rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary cursor-pointer"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-sm font-medium">Add Widget</span>
                </button>
              </div>
            )}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="bg-card border-2 border-primary rounded-xl shadow-2xl px-4 py-3 w-56 pointer-events-none">
              <p className="text-sm font-medium text-foreground truncate">
                {getCatalogWidget(activeId)?.label || activeId}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Drop to place here</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

    </>
  );
}

// ---------- Main Component ----------

export default function Dashboard() {
  const [layout, setLayout] = useState<DashboardLayout>(loadDashboardLayout);
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { dataUpdatedAt } = useQuery<unknown>({
    queryKey: ["/api/admin/quality/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/quality/summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleLayoutChange = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      saveDashboardLayout(next);
    },
    [],
  );

  const handleResize = useCallback(
    (id: string, size: WidgetSize) => {
      const def = getCatalogWidget(id);
      if (def?.sizeLocked) return;
      if (def && !def.sizes.includes(size)) return;
      const next: DashboardLayout = {
        widgets: layout.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
      };
      handleLayoutChange(next);
    },
    [layout, handleLayoutChange],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const def = getCatalogWidget(id);
      if (def?.pinned) return;
      const next: DashboardLayout = {
        widgets: layout.widgets.filter((w) => w.id !== id),
      };
      handleLayoutChange(next);
    },
    [layout, handleLayoutChange],
  );

  const handleAddWidget = useCallback(
    (widgetId: string) => {
      if (layout.widgets.find((w) => w.id === widgetId)) {
        // Already in layout — just make it visible
        const next: DashboardLayout = {
          widgets: layout.widgets.map((w) =>
            w.id === widgetId ? { ...w, visible: true } : w,
          ),
        };
        handleLayoutChange(next);
      } else {
        // Add new widget to the end
        const def = getCatalogWidget(widgetId);
        if (!def) return;
        const next: DashboardLayout = {
          widgets: [...layout.widgets, { id: widgetId, visible: true, size: def.defaultSize }],
        };
        handleLayoutChange(next);
      }
    },
    [layout, handleLayoutChange],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = layout.widgets.findIndex((w) => w.id === active.id);
        const newIndex = layout.widgets.findIndex((w) => w.id === over.id);
        const newWidgets = arrayMove(layout.widgets, oldIndex, newIndex);
        handleLayoutChange({ widgets: newWidgets });
      }
    },
    [layout, handleLayoutChange],
  );

  const handleReset = useCallback(() => {
    handleLayoutChange(getDefaultDashboardLayout());
  }, [handleLayoutChange]);

  const addedWidgetIds = layout.widgets.map((w) => w.id);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-muted-foreground">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          )}
          {editMode ? (
            <Button
              size="sm"
              onClick={() => setEditMode(false)}
              className="bg-primary hover:bg-primary/80 text-white"
            >
              <Check className="h-4 w-4 mr-1.5" /> Done
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditMode(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4 mr-1.5" /> Edit Layout
            </Button>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-primary">
          <Pencil className="h-4 w-4 text-primary flex-shrink-0" />
          Drag to reorder — Resize with S/M/L — Remove with X — Add widgets with +
        </div>
      )}

      {/* Render widgets */}
      <DashboardWidgetGrid
        layout={layout}
        editMode={editMode}
        onResize={handleResize}
        onRemove={handleRemove}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onAddWidget={() => setAddModalOpen(true)}
        activeId={activeId}
      />

      {/* Add Widget Modal */}
      <AddWidgetModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        addedWidgetIds={addedWidgetIds}
        onAdd={handleAddWidget}
      />
    </div>
  );
}
