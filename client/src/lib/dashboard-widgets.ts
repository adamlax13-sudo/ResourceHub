/**
 * Dashboard widget registry and layout persistence.
 *
 * Each widget is a self-contained card rendered on the admin dashboard.
 * Users can show/hide and reorder widgets via the Customize panel;
 * the layout is persisted in localStorage.
 */

export interface DashboardWidget {
  id: string;
  label: string;
  description: string;
  defaultVisible: boolean;
  /** HeroStats is not removable */
  removable: boolean;
  defaultOrder: number;
  /** Half-width widgets sit side by side, full-width take the whole row */
  size: "full" | "half";
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: "hero-stats",
    label: "Service Overview",
    description: "Active services count with quick actions",
    defaultVisible: true,
    removable: false,
    defaultOrder: 0,
    size: "full",
  },
  {
    id: "stat-cards",
    label: "Key Metrics",
    description: "Pending reviews, searches today, quality score",
    defaultVisible: true,
    removable: true,
    defaultOrder: 1,
    size: "full",
  },
  {
    id: "recent-activity",
    label: "Recent Activity",
    description: "Latest changes across all services",
    defaultVisible: true,
    removable: true,
    defaultOrder: 2,
    size: "half",
  },
  {
    id: "quality-overview",
    label: "Quality Overview",
    description: "Fields with lowest data coverage",
    defaultVisible: true,
    removable: true,
    defaultOrder: 3,
    size: "half",
  },
  {
    id: "top-searches",
    label: "Top Searches",
    description: "Most popular search queries",
    defaultVisible: true,
    removable: true,
    defaultOrder: 4,
    size: "half",
  },
  {
    id: "scraper-status",
    label: "Scraper Status",
    description: "Last scraper run summary",
    defaultVisible: true,
    removable: true,
    defaultOrder: 5,
    size: "half",
  },
];

// ---- Layout persistence ----

export interface DashboardLayout {
  widgets: { id: string; visible: boolean }[];
}

const STORAGE_KEY = "admin-dashboard-layout";

export function loadDashboardLayout(): DashboardLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as DashboardLayout;
      // Merge with registry so newly-added widgets show up
      const knownIds = new Set(parsed.widgets.map((w) => w.id));
      for (const widget of DASHBOARD_WIDGETS) {
        if (!knownIds.has(widget.id)) {
          parsed.widgets.push({ id: widget.id, visible: widget.defaultVisible });
        }
      }
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return getDefaultLayout();
}

export function saveDashboardLayout(layout: DashboardLayout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function getDefaultLayout(): DashboardLayout {
  return {
    widgets: DASHBOARD_WIDGETS.map((w) => ({
      id: w.id,
      visible: w.defaultVisible,
    })),
  };
}

/** Look up the registry entry for a widget id */
export function getWidgetDef(id: string): DashboardWidget | undefined {
  return DASHBOARD_WIDGETS.find((w) => w.id === id);
}
