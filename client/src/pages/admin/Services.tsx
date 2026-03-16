import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MasterDetailLayout } from "@/components/admin/MasterDetailLayout";
import { ServiceForm, type ServiceFormData } from "@/components/admin/ServiceForm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  History,
  Trash2,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceListItem {
  id: number;
  name: string;
  category: string;
  location?: string;
  confidenceScore?: number;
  isActive?: boolean;
}

interface ServiceDetail {
  id: number;
  serviceId?: string;
  name: string;
  category: string;
  description?: string;
  location?: string;
  contact?: string;
  eligibility?: string;
  phone?: string;
  email?: string;
  address?: string;
  hoursOfOperation?: string;
  websiteUrl?: string;
  tags?: string[];
  genderRestriction?: string;
  ageGroup?: string;
  isFaithBased?: boolean;
  is12Step?: boolean;
  is24_7?: boolean;
  isActive?: boolean;
  confidenceScore?: number;
  embeddingUpdatedAt?: string;
  lastUpdated?: string;
}

interface HistoryEntry {
  id: number;
  changeType: string;
  changedFields?: Record<string, unknown>;
  changedAt: string;
  source?: string;
}

export default function Services() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // List state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Build query string
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("q", searchQuery);
  if (statusFilter) queryParams.set("status", statusFilter);
  if (categoryFilter) queryParams.set("category", categoryFilter);
  queryParams.set("page", String(page));
  queryParams.set("limit", "25");

  // Fetch service list
  const { data: listData, isPending: listLoading } = useQuery<{
    success: boolean;
    services: ServiceListItem[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ["/api/admin/services", queryParams.toString()],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services?${queryParams}`);
      return res.json();
    },
    staleTime: 15_000,
  });

  // Fetch service detail
  const { data: detailData, isPending: detailLoading } = useQuery<{
    success: boolean;
    service: ServiceDetail;
  }>({
    queryKey: ["/api/admin/services", selectedId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${selectedId}`);
      return res.json();
    },
    enabled: !!selectedId,
    staleTime: 10_000,
  });

  // Fetch history
  const { data: historyData, isPending: historyLoading } = useQuery<{
    success: boolean;
    history: HistoryEntry[];
  }>({
    queryKey: ["/api/admin/services", selectedId, "history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${selectedId}/history`);
      return res.json();
    },
    enabled: !!selectedId && showHistory,
    staleTime: 30_000,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const res = await apiRequest("PATCH", `/api/admin/services/${selectedId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${selectedId}/deactivate`, {
        reason: "Deactivated via admin panel",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service deactivated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
    },
    onError: (err) => {
      toast({ title: "Deactivation failed", description: err.message, variant: "destructive" });
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${selectedId}/restore`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service restored" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
    },
    onError: (err) => {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
    },
  });

  // Regen embedding mutation
  const regenEmbeddingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${selectedId}/regenerate-embedding`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Embedding regeneration started" });
    },
    onError: (err) => {
      toast({ title: "Embedding regen failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  }, []);

  const service = detailData?.service;

  // Check stale embedding
  const hasStaleEmbedding = service?.embeddingUpdatedAt && service?.lastUpdated &&
    new Date(service.embeddingUpdatedAt) < new Date(service.lastUpdated);

  const list = (
    <div className="flex flex-col h-full">
      {/* Search + Filters */}
      <div className="p-3 border-b border-slate-700 space-y-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-8 bg-slate-800 border-slate-600 text-white text-sm h-9"
            />
          </div>
        </form>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-8 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="h-8 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-white flex-1"
          >
            <option value="">All Categories</option>
            <option value="Addiction Services">Addiction Services</option>
            <option value="Mental Health">Mental Health</option>
            <option value="Housing & Shelter">Housing & Shelter</option>
            <option value="Food & Basic Needs">Food & Basic Needs</option>
            <option value="Crisis Services">Crisis Services</option>
            <option value="Healthcare Access">Healthcare Access</option>
            <option value="Hospital & Emergency">Hospital & Emergency</option>
          </select>
        </div>
      </div>

      {/* List */}
      {listLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            {listData?.services?.map((svc) => (
              <div
                key={svc.id}
                onClick={() => { setSelectedId(svc.id); setShowHistory(false); }}
                className={cn(
                  "px-3 py-2.5 border-b border-slate-700/50 cursor-pointer transition-colors",
                  selectedId === svc.id
                    ? "bg-slate-700/50"
                    : "hover:bg-slate-800/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{svc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-700 text-[10px] px-1.5">
                        {svc.category}
                      </Badge>
                      {svc.location && (
                        <span className="text-[10px] text-slate-500 truncate">{svc.location}</span>
                      )}
                    </div>
                  </div>
                  {svc.confidenceScore != null && (
                    <span className={cn(
                      "text-xs font-mono flex-shrink-0",
                      svc.confidenceScore >= 70 ? "text-emerald-400" :
                      svc.confidenceScore >= 40 ? "text-amber-400" : "text-red-400"
                    )}>
                      {svc.confidenceScore}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {listData?.services?.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No services found</p>
            )}
          </div>

          {/* Pagination */}
          {listData && listData.totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 text-xs text-slate-500">
              <span>
                Page {listData.page} of {listData.totalPages} ({listData.total} total)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 px-2 text-slate-400"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= (listData.totalPages || 1)}
                  className="h-7 px-2 text-slate-400"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const detail = selectedId ? (
    <div className="p-4">
      {detailLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : service ? (
        <div className="space-y-4">
          {/* Header with action buttons */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{service.name}</h3>
              <p className="text-sm text-slate-400">ID: {service.id} {service.serviceId ? `/ ${service.serviceId}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-slate-400 hover:text-white"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regenEmbeddingMutation.mutate()}
                disabled={regenEmbeddingMutation.isPending}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", regenEmbeddingMutation.isPending && "animate-spin")} />
                Regen
              </Button>
              {service.isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deactivateMutation.mutate()}
                  disabled={deactivateMutation.isPending}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restoreMutation.mutate()}
                  disabled={restoreMutation.isPending}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restore
                </Button>
              )}
            </div>
          </div>

          {/* Stale embedding warning */}
          {hasStaleEmbedding && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-900/20 border border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                Embedding is stale. Service was updated after the last embedding generation.
              </p>
            </div>
          )}

          {/* History or Edit Form */}
          {showHistory ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Change History</h4>
              {historyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : !historyData?.history?.length ? (
                <p className="text-sm text-slate-500">No history found</p>
              ) : (
                <div className="space-y-2">
                  {historyData.history.map((entry) => (
                    <div key={entry.id} className="p-3 rounded-md bg-slate-800 border border-slate-700">
                      <div className="flex items-center justify-between">
                        <Badge className={cn(
                          "text-[10px]",
                          entry.changeType === "created" ? "bg-emerald-600/20 text-emerald-400 border-emerald-700" :
                          entry.changeType === "deactivated" ? "bg-red-600/20 text-red-400 border-red-700" :
                          "bg-amber-600/20 text-amber-400 border-amber-700"
                        )}>
                          {entry.changeType}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {new Date(entry.changedAt).toLocaleString()}
                        </span>
                      </div>
                      {entry.source && <p className="text-xs text-slate-500 mt-1">Source: {entry.source}</p>}
                      {entry.changedFields && (
                        <pre className="mt-2 text-xs text-slate-400 overflow-auto max-h-32">
                          {JSON.stringify(entry.changedFields, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <ServiceForm
              initialData={service}
              onSubmit={(data) => updateMutation.mutate(data)}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">Service not found</p>
      )}
    </div>
  ) : null;

  return (
    <MasterDetailLayout
      list={list}
      detail={detail}
      placeholder="Select a service to view and edit"
    />
  );
}
