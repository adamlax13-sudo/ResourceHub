import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { SearchProvider } from "@/contexts/SearchContext";
import { FavoritesProvider } from "@/hooks/use-favorites";
import { ErrorBoundary, RouteErrorBoundary } from "@/components/ErrorBoundary";
import './lib/i18n';

const Home = lazy(() => import("@/pages/Home"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminLogin = lazy(() => import("@/pages/admin/Login"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin/:rest*">{() => <AdminLayout />}</Route>
          <Route path="/admin">{() => <AdminLayout />}</Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </RouteErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SearchProvider>
            <FavoritesProvider>
              <Toaster />
              <Router />
            </FavoritesProvider>
          </SearchProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
