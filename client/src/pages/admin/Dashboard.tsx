import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GripVertical, EyeOff, Eye, Pencil, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DashboardLayout,
  loadDashboardLayout,
  saveDashboardLayout,
  getDefaultDashboardLayout,
  getWidgetDef,
} from "@/lib/dashboard-widgets";
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

// Widget components
import { HeroStatsWidget } from "@/components/admin/widgets/HeroStatsWidget";
import { StatCardsWidget } from "@/components/admin/widgets/StatCardsWidget";
import { RecentActivityWidget } from "@/components/admin/widgets/RecentActivityWidget";
import { QualityOverviewWidget } from "@/components/admin/widgets/QualityOverviewWidget";
import { TopSearchesWidget } from "@/components/admin/widgets/TopSearchesWidget";
import { ScraperStatusWidget } from "@/components/admin/widgets/ScraperStatusWidget";

/** Maps widget id to its React component */
const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  "hero-stats": HeroStatsWidget,
  "stat-cards": StatCardsWidget,
  "recent-activity": RecentActivityWidget,
  "quality-overview": QualityOverviewWidget,
  "top-searches": TopSearchesWidget,
  "scraper-status": ScraperStatusWidget,
};

// ---------- Sortable Widget Wrapper ----------

function SortableWidget({
  id,
  children,
  isEditing,
  size,
  onResize,
  onHide,
  sizeLocked,
}: {
  id: string;
  children: React.ReactNode;
  isEditing: boolean;
  size: "small" | "medium" | "large";
  onResize: (size: "small" | "medium" | "large") => void;
  onHide: () => void;
  sizeLocked?: boolean;
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
        {/* Floating control bar — positioned above the widget */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white rounded-full shadow-md border border-gray-200 px-1.5 py-0.5">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {/* Size buttons */}
          {!sizeLocked && (
            <>
              <div className="w-px h-4 bg-gray-200" />
              {(["small", "medium", "large"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onResize(s)}
                  className={cn(
                    "w-6 h-6 rounded-full text-[10px] font-bold transition-all",
                    size === s
                      ? "bg-teal-500 text-white shadow-sm"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-700",
                  )}
                >
                  {s[0].toUpperCase()}
                </button>
              ))}
              <div className="w-px h-4 bg-gray-200" />
              <button
                onClick={onHide}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Widget content */}
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
  onHide,
  onRestore,
  onDragStart,
  onDragEnd,
  activeId,
}: {
  layout: DashboardLayout;
  editMode: boolean;
  onResize: (id: string, size: "small" | "medium" | "large") => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  activeId: string | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const visibleWidgets = layout.widgets.filter((w) => w.visible);
  const hiddenWidgets = layout.widgets.filter((w) => !w.visible);

  const getWidgetLabel = (id: string): string => {
    return getWidgetDef(id)?.label || id;
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <SortableContext
          items={visibleWidgets.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={cn(
              "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
              editMode ? "gap-6 pt-2" : "gap-4"
            )}>
            {visibleWidgets.map((w) => {
              const def = getWidgetDef(w.id);
              const Comp = WIDGET_COMPONENTS[w.id];
              if (!Comp) return null;
              return (
                <SortableWidget
                  key={w.id}
                  id={w.id}
                  isEditing={editMode}
                  size={w.size}
                  sizeLocked={def?.sizeLocked}
                  onResize={(s) => onResize(w.id, s)}
                  onHide={() => onHide(w.id)}
                >
                  <Comp />
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="bg-white border-2 border-teal-400 rounded-xl shadow-2xl px-4 py-3 w-56 pointer-events-none">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getWidgetLabel(activeId)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Drop to place here</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Hidden widgets bar (edit mode only) */}
      {editMode && hiddenWidgets.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-xs font-medium text-gray-500 mb-2">Hidden Widgets</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map((w) => (
              <button
                key={w.id}
                onClick={() => onRestore(w.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
              >
                <Eye className="h-3 w-3" />
                {getWidgetDef(w.id)?.label || w.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Main Component ----------

export default function Dashboard() {
  const [layout, setLayout] = useState<DashboardLayout>(loadDashboardLayout);
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Lightweight ping to get a shared dataUpdatedAt timestamp for the "Last updated" display
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
    (id: string, size: "small" | "medium" | "large") => {
      const def = getWidgetDef(id);
      if (def?.sizeLocked) return;
      const next: DashboardLayout = {
        widgets: layout.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
      };
      handleLayoutChange(next);
    },
    [layout, handleLayoutChange],
  );

  const handleHide = useCallback(
    (id: string) => {
      const next: DashboardLayout = {
        widgets: layout.widgets.map((w) =>
          w.id === id ? { ...w, visible: false } : w,
        ),
      };
      handleLayoutChange(next);
    },
    [layout, handleLayoutChange],
  );

  const handleRestore = useCallback(
    (id: string) => {
      const next: DashboardLayout = {
        widgets: layout.widgets.map((w) =>
          w.id === id ? { ...w, visible: true } : w,
        ),
      };
      handleLayoutChange(next);
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

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-gray-400">
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
              className="text-gray-400 hover:text-gray-600"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          )}
          {editMode ? (
            <Button
              size="sm"
              onClick={() => setEditMode(false)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Check className="h-4 w-4 mr-1.5" /> Done
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditMode(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Pencil className="h-4 w-4 mr-1.5" /> Edit Layout
            </Button>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-teal-700">
          <Pencil className="h-4 w-4 text-teal-600 flex-shrink-0" />
          Drag widgets to reorder — Resize with S/M/L — Click eye icon to hide
        </div>
      )}

      {/* Render widgets */}
      <DashboardWidgetGrid
        layout={layout}
        editMode={editMode}
        onResize={handleResize}
        onHide={handleHide}
        onRestore={handleRestore}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        activeId={activeId}
      />
    </div>
  );
}
