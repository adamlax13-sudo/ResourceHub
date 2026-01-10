import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import MyResources from "@/pages/MyResources";
import Profile from "@/pages/Profile";
import Recommended from "@/pages/Recommended";
import './lib/i18n';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/my-resources" component={MyResources} />
      <Route path="/profile" component={Profile} />
      <Route path="/recommended" component={Recommended} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
