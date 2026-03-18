import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, Database, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemStatus {
  success: boolean;
  database: { connected: boolean; pingMs: number };
  services: {
    totalServices: number;
    activeServices: number;
    inactiveServices: number;
    servicesWithEmbedding: number;
    servicesWithGeocoding: number;
  };
  cache: { cachedQueries: number };
  lastScraperRun: {
    run_id?: number;
    started_at: string;
    completed_at?: string;
    status: string;
  } | null;
}

type ConfirmAction = "refresh" | "persist" | "purge" | null;

const CONFIRM_CONFIG: Record<string, { title: string; description: string; variant: "default" | "destructive" }> = {
  refresh: {
    title: "Refresh Search View?",
    description: "This will refresh the materialized search view and clear the search cache. Active user searches may briefly return stale results.",
    variant: "default",
  },
  persist: {
    title: "Persist Enrichments?",
    description: "This will copy AI-generated descriptions, eligibility, and process steps into service records where those fields are currently empty. Existing data will NOT be overwritten.",
    variant: "default",
  },
  purge: {
    title: "Purge Analytics Data?",
    description: "This will permanently delete search analytics records. This action cannot be undone.",
    variant: "destructive",
  },
};

export default function System() {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const { data: status, isPending: statusLoading, refetch: refetchStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/system/status");
      return res.json();
    },
    staleTime: 30_000,
  });

  const refreshSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/refresh-search", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Search view refreshed", description: data.message });
      setConfirmAction(null);
      refetchStatus();
    },
    onError: (err) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const persistEnrichmentsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/persist-enrichments", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Enrichments persisted", description: data.message });
      setConfirmAction(null);
    },
    onError: (err) => {
      toast({ title: "Persist failed", description: err.message, variant: "destructive" });
      setConfirmAction(null);
    },
  });


  const [purgeDays, setPurgeDays] = useState(180);
  const purgeAnalyticsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/system/purge-analytics", {
        olderThanDays: purgeDays,
        dryRun: false,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Analytics purged", description: `Deleted ${data.deleted} records` });
      setConfirmAction(null);
    },
    onError: (err) => {
      toast({ title: "Purge failed", description: err.message, variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const purgePreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/system/purge-analytics", {
        olderThanDays: purgeDays,
        dryRun: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Purge preview",
        description: `Would delete ${data.rowsToDelete} records older than ${data.cutoffDate ? new Date(data.cutoffDate).toLocaleDateString() : "unknown"}`,
      });
    },
    onError: (err) => {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    },
  });

  const handleConfirm = () => {
    switch (confirmAction) {
      case "refresh": refreshSearchMutation.mutate(); break;
      case "persist": persistEnrichmentsMutation.mutate(); break;
      case "purge": purgeAnalyticsMutation.mutate(); break;
    }
  };

  const isConfirmPending =
    refreshSearchMutation.isPending ||
    persistEnrichmentsMutation.isPending ||
    purgeAnalyticsMutation.isPending;

  const config = confirmAction ? CONFIRM_CONFIG[confirmAction] : null;

  const db = status?.database;
  const svcs = status?.services;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-foreground">System</h2>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open && !isConfirmPending) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{config?.title}</DialogTitle>
            <DialogDescription>{config?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isConfirmPending}
            >
              Cancel
            </Button>
            <Button
              variant={config?.variant === "destructive" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={isConfirmPending}
              className={config?.variant !== "destructive" ? "bg-emerald-700 hover:bg-emerald-800 text-white" : ""}
            >
              {isConfirmPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {isConfirmPending ? "Running..." : "Yes, proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* System Status */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base">System Status</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchStatus()}
              className="text-muted-foreground hover:text-foreground h-7"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Database</p>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    db?.connected ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <span className="text-sm text-foreground">
                    {db?.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                {db?.pingMs != null && (
                  <p className="text-xs text-muted-foreground">{db.pingMs}ms ping</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Services</p>
                <p className="text-sm text-foreground">{svcs?.activeServices ?? 0} active</p>
                <p className="text-xs text-muted-foreground">{svcs?.inactiveServices ?? 0} inactive</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Embeddings</p>
                <p className="text-sm text-foreground">{svcs?.servicesWithEmbedding ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  of {svcs?.totalServices ?? 0} total
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cache</p>
                <p className="text-sm text-foreground">{status?.cache?.cachedQueries ?? 0} queries</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Jobs */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base">Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <JobRow
            icon={RefreshCw}
            title="Refresh Search View"
            description="Refresh materialized view and clear search cache. Run after deactivating services or bulk changes."
            action={
              <Button
                size="sm"
                onClick={() => setConfirmAction("refresh")}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Refresh
              </Button>
            }
          />
          <JobRow
            icon={Database}
            title="Persist Enrichments"
            description="Copy AI enrichments to service records for empty fields. Reduces future API calls."
            action={
              <Button
                size="sm"
                onClick={() => setConfirmAction("persist")}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Persist
              </Button>
            }
          />
          {/* Purge Analytics — special layout with days selector */}
          <div className="flex items-start justify-between gap-4 py-3 border-t border-border">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-50 p-2 mt-0.5">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Purge Analytics</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently delete old search analytics data.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={purgeDays}
                onChange={(e) => setPurgeDays(Number(e.target.value))}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>365 days</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => purgePreviewMutation.mutate()}
                disabled={purgePreviewMutation.isPending}
                className="border-border text-xs"
              >
                {purgePreviewMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Preview
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmAction("purge")}
              >
                Purge
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function JobRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof RefreshCw;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-t border-border first:border-0 first:pt-0">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
