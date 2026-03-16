import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Trash2, Activity, CheckCircle } from "lucide-react";
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

export default function System() {
  const { toast } = useToast();

  const { data: status, isPending: statusLoading, refetch: refetchStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/system/status");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Refresh search view
  const refreshSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/refresh-search");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Search view refreshed", description: data.message });
      refetchStatus();
    },
    onError: (err) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  // Persist enrichments
  const persistEnrichmentsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/persist-enrichments");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Enrichments persisted", description: data.message });
    },
    onError: (err) => {
      toast({ title: "Persist failed", description: err.message, variant: "destructive" });
    },
  });

  // Recompute affinities
  const recomputeAffinitiesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/system/recompute-affinities");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Affinities recomputation", description: data.message });
    },
    onError: (err) => {
      toast({ title: "Recomputation failed", description: err.message, variant: "destructive" });
    },
  });

  // Purge analytics
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
      toast({ title: "Analytics purged", description: `Deleted ${data.deleted} rows` });
    },
    onError: (err) => {
      toast({ title: "Purge failed", description: err.message, variant: "destructive" });
    },
  });

  // Dry-run purge count
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
        description: `Would delete ${data.rowsToDelete} rows older than ${data.cutoffDate?.split("T")[0]}`,
      });
    },
    onError: (err) => {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    },
  });

  const db = status?.database;
  const svcs = status?.services;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">System</h2>

      {/* System Status */}
      <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 text-base">System Status</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchStatus()}
              className="text-gray-400 hover:text-gray-900 h-7"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* DB Health */}
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Database</p>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    db?.connected ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <span className="text-sm text-gray-900">
                    {db?.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                {db?.pingMs != null && (
                  <p className="text-xs text-gray-400">{db.pingMs}ms ping</p>
                )}
              </div>

              {/* Service Counts */}
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Services</p>
                <p className="text-sm text-gray-900">{svcs?.activeServices ?? 0} active</p>
                <p className="text-xs text-gray-400">{svcs?.inactiveServices ?? 0} inactive</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-400">Embeddings</p>
                <p className="text-sm text-gray-900">{svcs?.servicesWithEmbedding ?? 0}</p>
                <p className="text-xs text-gray-400">
                  of {svcs?.totalServices ?? 0} total
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-400">Cache</p>
                <p className="text-sm text-gray-900">{status?.cache?.cachedQueries ?? 0} queries</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Jobs */}
      <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-gray-900 text-base">Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Refresh Search View */}
          <JobRow
            icon={RefreshCw}
            title="Refresh Search View"
            description="Refresh materialized view and clear search cache. Run after deactivating services or bulk changes."
            action={
              <Button
                size="sm"
                onClick={() => refreshSearchMutation.mutate()}
                disabled={refreshSearchMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {refreshSearchMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Refresh
              </Button>
            }
          />

          {/* Persist Enrichments */}
          <JobRow
            icon={Database}
            title="Persist Enrichments"
            description="Copy AI enrichments to service records for empty fields. Reduces future API calls."
            action={
              <Button
                size="sm"
                onClick={() => persistEnrichmentsMutation.mutate()}
                disabled={persistEnrichmentsMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {persistEnrichmentsMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Persist
              </Button>
            }
          />

          {/* Recompute Affinities */}
          <JobRow
            icon={Activity}
            title="Recompute Affinities"
            description="Recompute query-service click affinity scores from search analytics."
            action={
              <Button
                size="sm"
                onClick={() => recomputeAffinitiesMutation.mutate()}
                disabled={recomputeAffinitiesMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {recomputeAffinitiesMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Recompute
              </Button>
            }
          />

          {/* Purge Analytics */}
          <div className="flex items-start justify-between gap-4 py-3 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-50 p-2 mt-0.5">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Purge Analytics</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Delete old search analytics data.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={purgeDays}
                onChange={(e) => setPurgeDays(Number(e.target.value))}
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900"
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
                className="border-gray-300 text-xs"
              >
                Preview
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => purgeAnalyticsMutation.mutate()}
                disabled={purgeAnalyticsMutation.isPending}
              >
                {purgeAnalyticsMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
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
    <div className="flex items-start justify-between gap-4 py-3 border-t border-gray-200 first:border-0 first:pt-0">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-teal-50 p-2 mt-0.5">
          <Icon className="h-4 w-4 text-teal-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
