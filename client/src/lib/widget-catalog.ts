export type WidgetSize = 'small' | 'medium' | 'large';

export type WidgetCategory = 'Overview' | 'Analytics' | 'Quality' | 'Services' | 'Scraper' | 'Feedback' | 'System';

export interface CatalogWidget {
  id: string;
  label: string;
  description: string;
  category: WidgetCategory;
  sizes: WidgetSize[];        // which sizes this widget supports
  defaultSize: WidgetSize;
  /** If true, size cannot be changed by user */
  sizeLocked?: boolean;
  /** If true, cannot be removed from dashboard */
  pinned?: boolean;
}

export const WIDGET_CATALOG: CatalogWidget[] = [
  // -- Overview --
  {
    id: 'service-overview',
    label: 'Service Overview',
    description: 'Active service count with key metrics (pending reviews, searches today, quality score)',
    category: 'Overview',
    sizes: ['large'],
    defaultSize: 'large',
    sizeLocked: true,
    pinned: true,
  },

  // -- Analytics --
  {
    id: 'analytics-daily-trend',
    label: 'Daily Trend',
    description: 'Click and query volume over time',
    category: 'Analytics',
    sizes: ['medium', 'large'],
    defaultSize: 'large',
  },
  {
    id: 'analytics-categories',
    label: 'Category Distribution',
    description: 'Which service categories get clicked most',
    category: 'Analytics',
    sizes: ['small', 'medium'],
    defaultSize: 'medium',
  },
  {
    id: 'analytics-peak-hours',
    label: 'Peak Hours',
    description: 'When users search by hour of day',
    category: 'Analytics',
    sizes: ['small', 'medium'],
    defaultSize: 'medium',
  },
  {
    id: 'analytics-top-queries',
    label: 'Top Search Queries',
    description: 'Most popular search queries with click rates',
    category: 'Analytics',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
  },
  {
    id: 'analytics-click-positions',
    label: 'Click Positions',
    description: 'Which result position users click on most',
    category: 'Analytics',
    sizes: ['small', 'medium'],
    defaultSize: 'medium',
  },
  {
    id: 'analytics-most-clicked',
    label: 'Most Clicked Services',
    description: 'Services that get the most clicks',
    category: 'Analytics',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
  },
  {
    id: 'analytics-least-clicked',
    label: 'Least Clicked Services',
    description: 'Active services that rarely get clicked',
    category: 'Analytics',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
  },
  {
    id: 'analytics-devices',
    label: 'Device Breakdown',
    description: 'Mobile vs desktop vs tablet usage',
    category: 'Analytics',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },
  {
    id: 'analytics-unmet-needs',
    label: 'Unmet Search Needs',
    description: 'Searches where users found results but did not click',
    category: 'Analytics',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },
  {
    id: 'analytics-sessions',
    label: 'Session Depth',
    description: 'How many searches users do per session',
    category: 'Analytics',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },

  // -- Quality --
  {
    id: 'quality-overview',
    label: 'Quality Score',
    description: 'Fields with lowest data coverage',
    category: 'Quality',
    sizes: ['small', 'medium'],
    defaultSize: 'medium',
  },
  {
    id: 'quality-field-coverage',
    label: 'Field Coverage',
    description: 'How many fields have above 80% coverage',
    category: 'Quality',
    sizes: ['small'],
    defaultSize: 'small',
  },

  // -- Services --
  {
    id: 'recent-activity',
    label: 'Recent Activity',
    description: 'Latest changes across all services',
    category: 'Services',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
  },
  {
    id: 'pending-reviews',
    label: 'Pending Reviews',
    description: 'Services awaiting review approval',
    category: 'Services',
    sizes: ['small', 'medium'],
    defaultSize: 'small',
  },

  // -- Scraper --
  {
    id: 'scraper-status',
    label: 'Scraper Status',
    description: 'Last scraper run summary',
    category: 'Scraper',
    sizes: ['small', 'medium'],
    defaultSize: 'medium',
  },

  // -- Feedback --
  {
    id: 'recent-feedback',
    label: 'Recent Feedback',
    description: 'Latest user feedback messages',
    category: 'Feedback',
    sizes: ['small', 'medium'],
    defaultSize: 'medium',
  },
  {
    id: 'vote-summary',
    label: 'Vote Summary',
    description: 'Most upvoted and downvoted services',
    category: 'Feedback',
    sizes: ['small', 'medium'],
    defaultSize: 'medium',
  },

  // -- System --
  {
    id: 'embedding-coverage',
    label: 'Embedding Coverage',
    description: 'Percentage of services with search embeddings',
    category: 'System',
    sizes: ['small'],
    defaultSize: 'small',
  },
];

/** Look up a catalog widget by id */
export function getCatalogWidget(id: string): CatalogWidget | undefined {
  return WIDGET_CATALOG.find(w => w.id === id);
}

/** Get all widgets in a category */
export function getWidgetsByCategory(category: WidgetCategory): CatalogWidget[] {
  return WIDGET_CATALOG.filter(w => w.category === category);
}

/** Get all unique categories in display order */
export const WIDGET_CATEGORIES: WidgetCategory[] = ['Overview', 'Analytics', 'Quality', 'Services', 'Scraper', 'Feedback', 'System'];

// -- Dashboard layout persistence --

export interface DashboardLayoutEntry {
  id: string;
  visible: boolean;
  size: WidgetSize;
}

export interface DashboardLayout {
  widgets: DashboardLayoutEntry[];
}

const STORAGE_KEY = 'admin-dashboard-layout-v2';

/** Default dashboard: service overview + recent activity + quality + top searches + scraper */
export function getDefaultDashboardLayout(): DashboardLayout {
  return {
    widgets: [
      { id: 'service-overview', visible: true, size: 'large' },
      { id: 'recent-activity', visible: true, size: 'medium' },
      { id: 'quality-overview', visible: true, size: 'medium' },
      { id: 'analytics-top-queries', visible: true, size: 'medium' },
      { id: 'scraper-status', visible: true, size: 'medium' },
    ],
  };
}

export function loadDashboardLayout(): DashboardLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as DashboardLayout;
      // Validate: remove widgets no longer in catalog, enforce size locks
      parsed.widgets = parsed.widgets
        .filter(w => getCatalogWidget(w.id))
        .map(w => {
          const def = getCatalogWidget(w.id)!;
          if (def.sizeLocked) return { ...w, size: def.defaultSize };
          if (!def.sizes.includes(w.size)) return { ...w, size: def.defaultSize };
          return w;
        });
      // Ensure pinned widgets are always present
      for (const cat of WIDGET_CATALOG) {
        if (cat.pinned && !parsed.widgets.find(w => w.id === cat.id)) {
          parsed.widgets.unshift({ id: cat.id, visible: true, size: cat.defaultSize });
        }
      }
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
