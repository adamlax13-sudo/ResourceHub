import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, LayoutDashboard, Database, ClipboardCheck, BarChart3, Activity, Bot, Search, Settings, LogOut, Plus, Upload, HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/hooks/useTheme";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

// Lazy-load all admin pages
const Dashboard = lazy(() => import("./Dashboard"));
const Services = lazy(() => import("./Services"));
const ServiceCreate = lazy(() => import("./ServiceCreate"));
const ServiceImport = lazy(() => import("./ServiceImport"));
const Review = lazy(() => import("./Review"));
const Quality = lazy(() => import("./Quality"));
const Analytics = lazy(() => import("./Analytics"));
const Scraper = lazy(() => import("./Scraper"));
const SearchTest = lazy(() => import("./SearchTest"));
const System = lazy(() => import("./System"));
const Feedback = lazy(() => import("./Feedback"));

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  /** If true, matches only exact path */
  exact?: boolean;
  /** Section group label */
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, exact: true, section: "GENERAL" },
  { label: "Services", path: "/admin/services", icon: Database, section: "GENERAL" },
  { label: "Review", path: "/admin/review", icon: ClipboardCheck, section: "GENERAL" },
  { label: "Feedback", path: "/admin/feedback", icon: MessageSquare, section: "GENERAL" },
  { label: "Quality", path: "/admin/quality", icon: BarChart3, section: "DATA" },
  { label: "Analytics", path: "/admin/analytics", icon: Activity, section: "DATA" },
  { label: "Scraper", path: "/admin/scraper", icon: Bot, section: "DATA" },
  { label: "Search Test", path: "/admin/search-test", icon: Search, section: "TOOLS" },
  { label: "System", path: "/admin/system", icon: Settings, section: "TOOLS" },
];

const isDev = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function Sidebar({ onLogout, pendingReviews, newFeedback }: { onLogout: () => void; pendingReviews?: number; newFeedback?: number }) {
  const [location] = useLocation();

  const isActive = (item: NavItem) => {
    if (item.exact) return location === item.path;
    return location.startsWith(item.path);
  };

  // Group nav items by section
  const sections: Record<string, NavItem[]> = {};
  for (const item of NAV_ITEMS) {
    const sec = item.section || "OTHER";
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(item);
  }

  return (
    <aside className={cn("w-56 bg-sidebar border-r border-sidebar-border flex flex-col min-h-screen fixed left-0 top-0 z-40", isDev && "top-6")}>
      {/* Brand */}
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-lg font-bold text-primary">ResourceHub</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 mt-4 mb-2">
              {sectionName}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item);
                return (
                  <Link key={item.path} href={item.path}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
                      )}
                      <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      {item.label}
                      {item.label === "Review" && !!pendingReviews && pendingReviews > 0 && (
                        <span className="ml-auto text-[10px] bg-primary text-white dark:text-gray-950 font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {pendingReviews}
                        </span>
                      )}
                      {item.label === "Feedback" && !!newFeedback && newFeedback > 0 && (
                        <span className="ml-auto text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {newFeedback}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick Actions */}
      <div className="px-2 py-2 border-t border-border space-y-0.5">
        <Link href="/admin/services/new">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted rounded-md cursor-pointer transition-colors">
            <Plus className="h-3 w-3" />
            New Service
          </div>
        </Link>
        <Link href="/admin/services/import">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted rounded-md cursor-pointer transition-colors">
            <Upload className="h-3 w-3" />
            Import
          </div>
        </Link>
      </div>

      {/* Theme Toggle */}
      <div className="px-2 py-2 border-t border-border">
        <ThemeToggle />
      </div>

      {/* Bottom section */}
      <div className="p-2 border-t border-border space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <HelpCircle className="h-3 w-3" />
          Help
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}

function AdminPageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function AdminLayout() {
  const { isAuthenticated, isLoading, logout } = useAdminAuth();
  const [, navigate] = useLocation();

  // Fetch dashboard stats for pending review count
  const { data: statsData } = useQuery<{ success: boolean; pendingReviews?: number }>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/stats");
      return res.json();
    },
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
  const pendingReviews = statsData?.pendingReviews ?? 0;

  // Fetch new feedback count for sidebar badge
  const { data: feedbackCountData } = useQuery<{ success: boolean; count: number }>({
    queryKey: ["/api/admin/feedback/count"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/feedback/count");
      return res.json();
    },
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
  const newFeedback = feedbackCountData?.count ?? 0;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/admin/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-background">
      {isDev && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 dark:bg-amber-700 dark:text-amber-100 text-[11px] font-medium text-center py-0.5">
          Development Environment
        </div>
      )}
      <Sidebar onLogout={handleLogout} pendingReviews={pendingReviews} newFeedback={newFeedback} />
      <main className={cn("ml-56", isDev && "mt-6")}>
        <Suspense fallback={<AdminPageLoader />}>
          <Switch>
            <Route path="/admin" component={Dashboard} />
            <Route path="/admin/services/new" component={ServiceCreate} />
            <Route path="/admin/services/import" component={ServiceImport} />
            <Route path="/admin/services" component={Services} />
            <Route path="/admin/review" component={Review} />
            <Route path="/admin/feedback" component={Feedback} />
            <Route path="/admin/quality" component={Quality} />
            <Route path="/admin/analytics" component={Analytics} />
            <Route path="/admin/scraper" component={Scraper} />
            <Route path="/admin/search-test" component={SearchTest} />
            <Route path="/admin/system" component={System} />
            <Route>
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Page not found
              </div>
            </Route>
          </Switch>
        </Suspense>
      </main>
    </div>
    </ThemeProvider>
  );
}
