/**
 * Dashboard widget registry and layout persistence.
 *
 * Each widget is a self-contained card rendered on the admin dashboard.
 * Users can show/hide, reorder, and resize widgets via inline edit mode;
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
  size: 'small' | 'medium' | 'large';
  /** If true, size is locked and cannot be changed by the user */
  sizeLocked?: boolean;
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: "hero-stats",
    label: "Service Overview",
    description: "Active services count with quick actions",
    defaultVisible: true,
    removable: false,
    defaultOrder: 0,
    size: "large",
    sizeLocked: true,
  },
  {
    id: "stat-cards",
    label: "Key Metrics",
    description: "Pending reviews, searches today, quality score",
    defaultVisible: true,
    removable: true,
    defaultOrder: 1,
    size: "large",
    sizeLocked: true,
  },
  {
    id: "recent-activity",
    label: "Recent Activity",
    description: "Latest changes across all services",
    defaultVisible: true,
    removable: true,
    defaultOrder: 2,
    size: "medium",
  },
  {
    id: "quality-overview",
    label: "Quality Overview",
    description: "Fields with lowest data coverage",
    defaultVisible: true,
    removable: true,
    defaultOrder: 3,
    size: "medium",
  },
  {
    id: "top-searches",
    label: "Top Searches",
    description: "Most popular search queries",
    defaultVisible: true,
    removable: true,
    defaultOrder: 4,
    size: "medium",
  },
  {
    id: "scraper-status",
    label: "Scraper Status",
    description: "Last scraper run summary",
    defaultVisible: true,
    removable: true,
    defaultOrder: 5,
    size: "medium",
  },
];

// ---- Layout persistence ----

export interface DashboardLayout {
  widgets: { id: string; visible: boolean; size: 'small' | 'medium' | 'large' }[];
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
          parsed.widgets.push({ id: widget.id, visible: widget.defaultVisible, size: widget.size });
        }
      }
      // Backfill size for older saved layouts that didn't have it
      parsed.widgets = parsed.widgets.map((w) => {
        if (!w.size) {
          const def = DASHBOARD_WIDGETS.find((d) => d.id === w.id);
          return { ...w, size: def?.size ?? 'medium' };
        }
        // Enforce sizeLocked widgets always use their default size
        const def = DASHBOARD_WIDGETS.find((d) => d.id === w.id);
        if (def?.sizeLocked) {
          return { ...w, size: def.size };
        }
        return w;
      });
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return getDefaultDashboardLayout();
}

export function saveDashboardLayout(layout: DashboardLayout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function getDefaultDashboardLayout(): DashboardLayout {
  return {
    widgets: DASHBOARD_WIDGETS.map((w) => ({
      id: w.id,
      visible: w.defaultVisible,
      size: w.size,
    })),
  };
}

/** Look up the registry entry for a widget id */
export function getWidgetDef(id: string): DashboardWidget | undefined {
  return DASHBOARD_WIDGETS.find((w) => w.id === id);
}
