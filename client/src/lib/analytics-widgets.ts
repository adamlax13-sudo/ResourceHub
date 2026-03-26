/**
 * Analytics widget registry and layout persistence.
 *
 * Each widget is a self-contained section rendered on the Analytics page.
 * Users can show/hide, reorder, and resize widgets via the Customize panel;
 * the layout is persisted in localStorage.
 */

export interface AnalyticsWidget {
  id: string;
  label: string;
  description: string;
  defaultVisible: boolean;
  size: 'small' | 'medium' | 'large';
  defaultOrder: number;
  /** If true, size is locked and cannot be changed by the user */
  sizeLocked?: boolean;
}

export const ANALYTICS_WIDGETS: AnalyticsWidget[] = [
  { id: 'overview', label: 'Summary Stats', description: 'Total clicks, queries, and engagement metrics', defaultVisible: true, size: 'large', sizeLocked: true, defaultOrder: 0 },
  { id: 'daily-trend', label: 'Daily Trend', description: 'Click and query volume over time', defaultVisible: true, size: 'large', defaultOrder: 1 },
  { id: 'unique-visitors', label: 'Unique Visitors', description: 'Daily unique visitors and search volume', defaultVisible: true, size: 'large', defaultOrder: 2 },
  { id: 'categories', label: 'Category Distribution', description: 'Which service categories get clicked most', defaultVisible: true, size: 'medium', defaultOrder: 2 },
  { id: 'peak-hours', label: 'Peak Hours', description: 'When users search by hour of day', defaultVisible: true, size: 'medium', defaultOrder: 3 },
  { id: 'top-queries', label: 'Top Search Queries', description: 'Most popular search queries with click rates', defaultVisible: true, size: 'medium', defaultOrder: 4 },
  { id: 'click-positions', label: 'Click Positions', description: 'Which result position users click on most', defaultVisible: true, size: 'medium', defaultOrder: 5 },
  { id: 'most-clicked', label: 'Most Clicked Services', description: 'Services that get the most clicks', defaultVisible: true, size: 'medium', defaultOrder: 6 },
  { id: 'least-clicked', label: 'Least Clicked Services', description: 'Active services that rarely get clicked', defaultVisible: true, size: 'medium', defaultOrder: 7 },
  { id: 'devices', label: 'Device Breakdown', description: 'Mobile vs desktop vs tablet usage', defaultVisible: true, size: 'small', defaultOrder: 8 },
  { id: 'no-clicks', label: 'Unmet Search Needs', description: 'Searches where users found results but did not click', defaultVisible: true, size: 'small', defaultOrder: 9 },
  { id: 'sessions', label: 'Session Depth', description: 'How many searches users do per session', defaultVisible: false, size: 'small', defaultOrder: 10 },
];

// ---- Layout persistence ----

export interface AnalyticsLayout {
  widgets: { id: string; visible: boolean; size: 'small' | 'medium' | 'large' }[];
}

const STORAGE_KEY = "admin-analytics-layout";

export function loadAnalyticsLayout(): AnalyticsLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as AnalyticsLayout;
      // Merge with registry so newly-added widgets show up, and backfill size if missing
      const knownIds = new Set(parsed.widgets.map((w) => w.id));
      for (const widget of ANALYTICS_WIDGETS) {
        if (!knownIds.has(widget.id)) {
          parsed.widgets.push({ id: widget.id, visible: widget.defaultVisible, size: widget.size });
        }
      }
      // Backfill size for older saved layouts that didn't have it
      parsed.widgets = parsed.widgets.map((w) => {
        if (!w.size) {
          const def = ANALYTICS_WIDGETS.find((d) => d.id === w.id);
          return { ...w, size: def?.size ?? 'medium' };
        }
        // Enforce sizeLocked widgets always use their default size
        const def = ANALYTICS_WIDGETS.find((d) => d.id === w.id);
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
  return getDefaultAnalyticsLayout();
}

export function saveAnalyticsLayout(layout: AnalyticsLayout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function getDefaultAnalyticsLayout(): AnalyticsLayout {
  return {
    widgets: ANALYTICS_WIDGETS.map((w) => ({
      id: w.id,
      visible: w.defaultVisible,
      size: w.size,
    })),
  };
}

/** Look up the registry entry for a widget id */
export function getAnalyticsWidgetDef(id: string): AnalyticsWidget | undefined {
  return ANALYTICS_WIDGETS.find((w) => w.id === id);
}
