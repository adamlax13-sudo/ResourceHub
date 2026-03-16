import { useState, useCallback } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DashboardLayout,
  loadDashboardLayout,
  saveDashboardLayout,
  getWidgetDef,
} from "@/lib/dashboard-widgets";
import { CustomizeDashboard } from "@/components/admin/CustomizeDashboard";

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

export default function Dashboard() {
  const [layout, setLayout] = useState<DashboardLayout>(loadDashboardLayout);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const handleLayoutChange = useCallback((next: DashboardLayout) => {
    setLayout(next);
    saveDashboardLayout(next);
  }, []);

  // Separate visible widgets into full-width and half-width for layout
  const visibleWidgets = layout.widgets.filter((w) => w.visible);

  return (
    <div className="p-6 space-y-6">
      {/* Page header with customize button */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-gray-700"
          onClick={() => setCustomizeOpen(true)}
        >
          <Settings className="h-4 w-4 mr-1.5" />
          Customize
        </Button>
      </div>

      {/* Render widgets */}
      <WidgetGrid widgets={visibleWidgets} />

      {/* Customize dialog */}
      <CustomizeDashboard
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        layout={layout}
        onLayoutChange={handleLayoutChange}
      />
    </div>
  );
}

/**
 * Renders visible widgets in order.
 * Full-width widgets take the whole row.
 * Half-width widgets are paired into a 2-column grid row.
 */
function WidgetGrid({ widgets }: { widgets: { id: string; visible: boolean }[] }) {
  const elements: React.ReactNode[] = [];
  let halfBuffer: { id: string }[] = [];

  const flushHalves = () => {
    if (halfBuffer.length === 0) return;
    elements.push(
      <div key={`half-row-${halfBuffer.map((h) => h.id).join("-")}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {halfBuffer.map((h) => {
          const Comp = WIDGET_COMPONENTS[h.id];
          return Comp ? <Comp key={h.id} /> : null;
        })}
      </div>,
    );
    halfBuffer = [];
  };

  for (const item of widgets) {
    const def = getWidgetDef(item.id);
    if (!def) continue;

    const Comp = WIDGET_COMPONENTS[item.id];
    if (!Comp) continue;

    if (def.size === "full") {
      flushHalves();
      elements.push(<Comp key={item.id} />);
    } else {
      halfBuffer.push(item);
      if (halfBuffer.length === 2) {
        flushHalves();
      }
    }
  }

  // Flush any remaining single half-width widget
  flushHalves();

  return <>{elements}</>;
}
