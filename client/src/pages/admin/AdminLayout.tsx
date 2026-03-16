import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Loader2, LayoutDashboard, Database, ClipboardCheck, BarChart3, Activity, Bot, Search, Settings, LogOut, Plus, Upload, HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function Sidebar({ onLogout }: { onLogout: () => void }) {
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
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col min-h-screen fixed left-0 top-0 z-40">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-teal-600">ResourceHub</h1>
        <p className="text-xs text-gray-400 mt-0.5">Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName}>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium px-3 mt-4 mb-2">
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
                          ? "bg-teal-50 text-teal-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 w-1 h-6 bg-teal-500 rounded-r-full" />
                      )}
                      <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-teal-600" : "text-gray-400")} />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick Actions */}
      <div className="px-2 py-2 border-t border-gray-100 space-y-0.5">
        <Link href="/admin/services/new">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-teal-700 hover:bg-gray-50 rounded-md cursor-pointer transition-colors">
            <Plus className="h-3 w-3" />
            New Service
          </div>
        </Link>
        <Link href="/admin/services/import">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-teal-700 hover:bg-gray-50 rounded-md cursor-pointer transition-colors">
            <Upload className="h-3 w-3" />
            Import
          </div>
        </Link>
      </div>

      {/* Bottom section */}
      <div className="p-2 border-t border-gray-100 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400">
          <HelpCircle className="h-3 w-3" />
          Help
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start text-gray-400 hover:text-gray-700 hover:bg-gray-50"
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
      <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
    </div>
  );
}

export default function AdminLayout() {
  const { isAuthenticated, isLoading, logout } = useAdminAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/admin/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar onLogout={handleLogout} />
      <main className="ml-56">
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
              <div className="flex items-center justify-center h-64 text-gray-400">
                Page not found
              </div>
            </Route>
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}
