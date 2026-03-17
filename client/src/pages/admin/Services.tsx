import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
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
  MapPin,
  Flag,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";

interface ServiceListItem {
  id: number;
  name: string;
  category: string;
  location?: string;
  confidenceScore?: number;
  isActive?: boolean;
  enrichmentSource?: string;
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
  enrichmentSource?: string;
  enrichmentDate?: string;
}

interface AiEnrichmentRecord {
  id: number;
  serviceId: string;
  serviceName: string;
  aiDescription?: string;
  aiCategory?: string;
  aiProcessSteps?: unknown;
  aiEligibility?: string;
  aiWaitTimes?: string;
  aiRequiredDocs?: unknown;
  aiLocation?: string;
  aiContact?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EnrichmentData {
  success: boolean;
  enrichment: AiEnrichmentRecord | null;
  enrichmentSource?: string;
  enrichmentDate?: string;
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
  const searchString = useSearch();
  const [, navigate] = useLocation();

  // Parse ?selected=ID from URL (linked from Quality page)
  const urlParams = new URLSearchParams(searchString);
  const urlSelectedId = urlParams.get("selected");

  // List state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [enrichmentSourceFilter, setEnrichmentSourceFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("lastUpdated-desc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(
    urlSelectedId ? Number(urlSelectedId) : null
  );
  const [showHistory, setShowHistory] = useState(false);
  const [flagReason, setFlagReason] = useState<string>("");
  const [showFlagDialog, setShowFlagDialog] = useState(false);

  // Sync URL ?selected= param to state
  useEffect(() => {
    if (urlSelectedId) {
      const id = Number(urlSelectedId);
      if (id && id !== selectedId) {
        setSelectedId(id);
        setShowHistory(false);
      }
    }
  }, [urlSelectedId]);

  // Parse sortBy into sort and order params
  const [sortCol, sortDir] = sortBy.split("-") as [string, string];

  // Build query string
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("q", searchQuery);
  if (statusFilter) queryParams.set("status", statusFilter);
  if (categoryFilter) queryParams.set("category", categoryFilter);
  if (enrichmentSourceFilter) queryParams.set("enrichmentSource", enrichmentSourceFilter);
  queryParams.set("sort", sortCol);
  queryParams.set("order", sortDir);
  queryParams.set("page", String(page));
  queryParams.set("limit", String(pageSize));

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

  // Fetch AI enrichment data for selected service
  const { data: enrichmentData } = useQuery<EnrichmentData>({
    queryKey: ["/api/admin/services", selectedId, "enrichment"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${selectedId}/enrichment`);
      return res.json();
    },
    enabled: !!selectedId,
    staleTime: 60_000,
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
      toast({ title: "Embedding regenerated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", selectedId] });
    },
    onError: (err) => {
      toast({ title: "Embedding regen failed", description: err.message, variant: "destructive" });
    },
  });

  // Geocode mutation
  const geocodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${selectedId}/geocode`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Geocoded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", selectedId] });
    },
    onError: (err) => {
      toast({ title: "Geocoding failed", description: err.message, variant: "destructive" });
    },
  });

  // Flag for review mutation
  const flagReviewMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/admin/services/${selectedId}/flag-review`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service flagged for review" });
      setShowFlagDialog(false);
      setFlagReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
    },
    onError: (err) => {
      toast({ title: "Flag failed", description: err.message, variant: "destructive" });
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

  const listHeader = (
      <div className="p-3 border-b border-gray-200 space-y-1.5">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-8 bg-white border-gray-300 text-gray-900 text-sm h-8"
            />
          </div>
        </form>
        <div className="grid grid-cols-3 gap-1.5">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-7 rounded border border-gray-300 bg-white px-1.5 text-[11px] text-gray-900"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="h-7 rounded border border-gray-300 bg-white px-1.5 text-[11px] text-gray-900"
          >
            <option value="">All Categories</option>
            <option value="Addiction Services">Addiction</option>
            <option value="Mental Health">Mental Health</option>
            <option value="Housing & Shelter">Housing</option>
            <option value="Food & Basic Needs">Basic Needs</option>
            <option value="Crisis Services">Crisis</option>
            <option value="Healthcare Access">Healthcare</option>
            <option value="Hospital & Emergency">Hospital/ER</option>
          </select>
          <select
            value={enrichmentSourceFilter}
            onChange={(e) => { setEnrichmentSourceFilter(e.target.value); setPage(1); }}
            className="h-7 rounded border border-gray-300 bg-white px-1.5 text-[11px] text-gray-900"
          >
            <option value="">All Sources</option>
            <option value="ai_enriched">AI Enriched</option>
            <option value="web_research_2026_03">Web Research</option>
            <option value="audit">Audit</option>
            <option value="found">Scraper</option>
            <option value="manual">Manual</option>
            <option value="none">No Source</option>
          </select>
        </div>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-700 w-full"
        >
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="confidence-asc">Quality Score ↑</option>
          <option value="confidence-desc">Quality Score ↓</option>
          <option value="lastUpdated-desc">Recently Updated</option>
          <option value="lastUpdated-asc">Oldest Updated</option>
          <option value="category-asc">Category (A-Z)</option>
          <option value="clickCount-desc">Most Clicked</option>
          <option value="location-asc">Location (A-Z)</option>
          <option value="enrichmentSource-desc">AI Enriched First</option>
        </select>
      </div>
  );

  const list = (
    <div className="flex flex-col h-full">
      {listLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            {listData?.services?.map((svc) => (
              <div
                key={svc.id}
                onClick={() => { setSelectedId(svc.id); setShowHistory(false); }}
                className={cn(
                  "px-3 py-2.5 border-b border-gray-100 cursor-pointer transition-colors",
                  selectedId === svc.id
                    ? "bg-teal-50"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-gray-900 truncate">{svc.name}</p>
                      {svc.enrichmentSource && (
                        <span title={`Enrichment: ${svc.enrichmentSource}`}>
                          <Sparkles className="h-3 w-3 flex-shrink-0 text-violet-400" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn(getCategoryColor(svc.category), "text-[10px] px-1.5")}>
                        {svc.category}
                      </Badge>
                      {svc.location && (
                        <span className="text-[10px] text-gray-400 truncate">{svc.location}</span>
                      )}
                    </div>
                  </div>
                  {svc.confidenceScore != null && (
                    <span className={cn(
                      "text-xs font-mono flex-shrink-0",
                      svc.confidenceScore >= 70 ? "text-emerald-500" :
                      svc.confidenceScore >= 40 ? "text-amber-500" : "text-red-500"
                    )}>
                      {svc.confidenceScore}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {listData?.services?.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No services found</p>
            )}
          </div>

          {/* Pagination */}
          {listData && (
            <div className="border-t border-gray-200 px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {listData.total > 0
                    ? `Page ${listData.page} of ${listData.totalPages} (${listData.total} total)`
                    : "No results"}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-7 px-2 text-gray-500"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= (listData.totalPages || 1)}
                    className="h-7 px-2 text-gray-500"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white text-gray-700"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span>per page</span>
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
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : service ? (
        <div className="space-y-4">
          {/* Header with action buttons */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
              <p className="text-sm text-gray-500">ID: {service.id} {service.serviceId ? `/ ${service.serviceId}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-gray-500 hover:text-gray-900"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
              {service.isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deactivateMutation.mutate()}
                  disabled={deactivateMutation.isPending}
                  className="text-red-500 hover:text-red-700"
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
                  className="text-emerald-500 hover:text-emerald-700"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restore
                </Button>
              )}
            </div>
          </div>

          {/* Stale embedding warning */}
          {hasStaleEmbedding && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Embedding is stale. Service was updated after the last embedding generation.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Actions</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => geocodeMutation.mutate()}
                disabled={geocodeMutation.isPending || !service.address}
                className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
                title={!service.address ? "Service has no address" : undefined}
              >
                {geocodeMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-teal-600" />
                  : <MapPin className="h-4 w-4 mr-1.5 text-teal-600" />
                }
                Geocode
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenEmbeddingMutation.mutate()}
                disabled={regenEmbeddingMutation.isPending}
                className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {regenEmbeddingMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-teal-600" />
                  : <RefreshCw className="h-4 w-4 mr-1.5 text-teal-600" />
                }
                Regenerate Embedding
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFlagDialog(!showFlagDialog)}
                disabled={flagReviewMutation.isPending}
                className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                {flagReviewMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  : <Flag className="h-4 w-4 mr-1.5" />
                }
                Flag for Review
              </Button>
            </div>
            {showFlagDialog && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-2">
                <p className="text-xs font-medium text-amber-700">Reason for flagging (optional)</p>
                <input
                  type="text"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="e.g. Phone number may be outdated"
                  className="w-full text-sm border border-amber-200 rounded px-2 py-1.5 bg-white text-gray-900 placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") flagReviewMutation.mutate(flagReason);
                    if (e.key === "Escape") { setShowFlagDialog(false); setFlagReason(""); }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => flagReviewMutation.mutate(flagReason)}
                    disabled={flagReviewMutation.isPending}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Confirm Flag
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowFlagDialog(false); setFlagReason(""); }}
                    className="flex-1 text-gray-500"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* History or Edit Form */}
          {showHistory ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Change History</h4>
              {historyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : !historyData?.history?.length ? (
                <p className="text-sm text-gray-400">No history found</p>
              ) : (
                <div className="space-y-2">
                  {historyData.history.map((entry) => (
                    <div key={entry.id} className="p-3 rounded-lg bg-white border border-gray-200">
                      <div className="flex items-center justify-between">
                        <Badge className={cn(
                          "text-[10px]",
                          entry.changeType === "created" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          entry.changeType === "deactivated" ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {entry.changeType}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.changedAt).toLocaleString()}
                        </span>
                      </div>
                      {entry.source && <p className="text-xs text-gray-400 mt-1">Source: {entry.source}</p>}
                      {entry.changedFields && (
                        <pre className="mt-2 text-xs text-gray-500 overflow-auto max-h-32">
                          {JSON.stringify(entry.changedFields, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <ServiceForm
                initialData={service}
                onSubmit={(data) => updateMutation.mutate(data)}
                isPending={updateMutation.isPending}
                submitLabel="Save Changes"
              />
              {/* AI-Inferred Data section */}
              {enrichmentData?.enrichment && (
                <Card className="bg-violet-50/50 border-violet-200 shadow-sm rounded-xl mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-violet-700 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI-Inferred Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {enrichmentData.enrichment.aiDescription && (
                      <div>
                        <p className="text-xs font-medium text-violet-600 mb-1">AI Description</p>
                        <p className="text-gray-700 bg-white rounded p-2 border border-violet-100">
                          {enrichmentData.enrichment.aiDescription}
                        </p>
                      </div>
                    )}
                    {enrichmentData.enrichment.aiEligibility && (
                      <div>
                        <p className="text-xs font-medium text-violet-600 mb-1">AI Eligibility</p>
                        <p className="text-gray-700 bg-white rounded p-2 border border-violet-100">
                          {enrichmentData.enrichment.aiEligibility}
                        </p>
                      </div>
                    )}
                    {enrichmentData.enrichment.aiProcessSteps != null && (
                      <div>
                        <p className="text-xs font-medium text-violet-600 mb-1">AI Process Steps</p>
                        <pre className="text-gray-700 bg-white rounded p-2 border border-violet-100 text-xs whitespace-pre-wrap overflow-auto max-h-48">
                          {JSON.stringify(enrichmentData.enrichment.aiProcessSteps, null, 2)}
                        </pre>
                      </div>
                    )}
                    <p className="text-xs text-violet-400">
                      Source: {enrichmentData.enrichmentSource || 'AI enrichment'}
                      {enrichmentData.enrichmentDate && ` \u2022 ${new Date(enrichmentData.enrichmentDate).toLocaleDateString()}`}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8">Service not found</p>
      )}
    </div>
  ) : null;

  return (
    <MasterDetailLayout
      listHeader={listHeader}
      list={list}
      detail={detail}
      placeholder="Select a service to view and edit"
    />
  );
}
