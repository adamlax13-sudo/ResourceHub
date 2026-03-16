import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Loader2, LayoutDashboard, Database, ClipboardCheck, BarChart3, Activity, Bot, Search, Settings, LogOut, Plus, Upload } from "lucide-react";
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

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  /** If true, matches only exact path */
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Services", path: "/admin/services", icon: Database },
  { label: "Review", path: "/admin/review", icon: ClipboardCheck },
  { label: "Quality", path: "/admin/quality", icon: BarChart3 },
  { label: "Analytics", path: "/admin/analytics", icon: Activity },
  { label: "Scraper", path: "/admin/scraper", icon: Bot },
  { label: "Search Test", path: "/admin/search-test", icon: Search },
  { label: "System", path: "/admin/system", icon: Settings },
];

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [location] = useLocation();

  const isActive = (item: NavItem) => {
    if (item.exact) return location === item.path;
    return location.startsWith(item.path);
  };

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col min-h-screen fixed left-0 top-0 z-40">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-slate-800">
        <h1 className="text-lg font-bold text-white">ResourceHub</h1>
        <p className="text-xs text-slate-500">Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors",
                  active
                    ? "bg-slate-800 text-white border-l-2 border-indigo-400 -ml-[1px]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Quick Actions */}
      <div className="px-2 py-2 border-t border-slate-800 space-y-1">
        <Link href="/admin/services/new">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 cursor-pointer">
            <Plus className="h-3 w-3" />
            New Service
          </div>
        </Link>
        <Link href="/admin/services/import">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 cursor-pointer">
            <Upload className="h-3 w-3" />
            Import
          </div>
        </Link>
      </div>

      {/* Logout */}
      <div className="p-2 border-t border-slate-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
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
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar onLogout={handleLogout} />
      <main className="ml-56">
        <Suspense fallback={<AdminPageLoader />}>
          <Switch>
            <Route path="/admin" component={Dashboard} />
            <Route path="/admin/services/new" component={ServiceCreate} />
            <Route path="/admin/services/import" component={ServiceImport} />
            <Route path="/admin/services" component={Services} />
            <Route path="/admin/review" component={Review} />
            <Route path="/admin/quality" component={Quality} />
            <Route path="/admin/analytics" component={Analytics} />
            <Route path="/admin/scraper" component={Scraper} />
            <Route path="/admin/search-test" component={SearchTest} />
            <Route path="/admin/system" component={System} />
            <Route>
              <div className="flex items-center justify-center h-64 text-slate-500">
                Page not found
              </div>
            </Route>
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}
