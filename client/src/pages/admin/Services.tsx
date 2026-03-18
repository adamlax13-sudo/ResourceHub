import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { MasterDetailLayout } from "@/components/admin/MasterDetailLayout";
import { ServiceDetailPanel } from "@/components/admin/ServiceDetailPanel";
import { CATEGORY_GROUPS } from "@/lib/category-groups";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
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
  lastUpdated?: string;
}

export default function Services() {
  const searchString = useSearch();

  // Parse ?selected=ID from URL (linked from Quality page)
  const urlParams = new URLSearchParams(searchString);
  const urlSelectedId = urlParams.get("selected");

  // Persist filters in sessionStorage so they survive tab switches
  const STORAGE_KEY = "admin-services-filters";
  const savedFilters = (() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })();

  // List state — initialize from sessionStorage if available
  const [searchQuery, setSearchQuery] = useState(savedFilters?.searchQuery ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(savedFilters?.statusFilter ?? "active");
  const [categoryFilter, setCategoryFilter] = useState<string>(savedFilters?.categoryFilter ?? "");
  const [enrichmentSourceFilter, setEnrichmentSourceFilter] = useState<string>(savedFilters?.enrichmentSourceFilter ?? "");
  const [sortBy, setSortBy] = useState<string>(savedFilters?.sortBy ?? "lastUpdated-desc");
  const [pageSize, setPageSize] = useState<number>(savedFilters?.pageSize ?? 25);
  const [page, setPage] = useState(savedFilters?.page ?? 1);
  const [selectedId, setSelectedId] = useState<number | null>(
    urlSelectedId ? Number(urlSelectedId) : (savedFilters?.selectedId ?? null)
  );
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);

  // Keep ref in sync for beforeunload handler
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Warn on browser tab close if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      searchQuery, statusFilter, categoryFilter, enrichmentSourceFilter,
      sortBy, pageSize, page, selectedId,
    }));
  }, [searchQuery, statusFilter, categoryFilter, enrichmentSourceFilter, sortBy, pageSize, page, selectedId]);

  // Sync URL ?selected= param to state
  useEffect(() => {
    if (urlSelectedId) {
      const id = Number(urlSelectedId);
      if (id && id !== selectedId) {
        setSelectedId(id);
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
  }>({
    queryKey: ["/api/admin/services", queryParams.toString()],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services?${queryParams}`);
      return res.json();
    },
    staleTime: 15_000,
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  }, []);

  const totalPages = listData?.total ? Math.ceil(listData.total / pageSize) : 1;

  const listHeader = (
      <div className="p-3 border-b border-border space-y-1.5">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-8 bg-card border-border text-foreground text-sm h-8"
            />
          </div>
        </form>
        <div className="grid grid-cols-3 gap-1.5">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-7 rounded border border-border bg-card px-1.5 text-[11px] text-foreground"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="h-7 rounded border border-border bg-card px-1.5 text-[11px] text-foreground"
          >
            <option value="">All Categories</option>
            {CATEGORY_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            value={enrichmentSourceFilter}
            onChange={(e) => { setEnrichmentSourceFilter(e.target.value); setPage(1); }}
            className="h-7 rounded border border-border bg-card px-1.5 text-[11px] text-foreground"
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
          className="h-7 rounded border border-border bg-card px-1.5 text-[11px] text-foreground w-full"
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
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            {listData?.services?.map((svc) => (
              <div
                key={svc.id}
                onClick={() => {
                  if (svc.id === selectedId) return;
                  if (isDirty && !window.confirm("You have unsaved changes. Discard?")) return;
                  setIsDirty(false);
                  setSelectedId(svc.id);
                }}
                className={cn(
                  "px-3 py-2.5 border-b border-border cursor-pointer transition-colors",
                  selectedId === svc.id
                    ? "bg-primary/10"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-foreground truncate">{svc.name}</p>
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
                        <span className="text-[10px] text-muted-foreground truncate">{svc.location}</span>
                      )}
                      {svc.lastUpdated && (
                        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                          Edited {formatRelativeTime(svc.lastUpdated)}
                        </span>
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
              <p className="text-sm text-muted-foreground text-center py-8">No services found</p>
            )}
          </div>

          {/* Pagination */}
          {listData && (
            <div className="border-t border-border px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {listData.total > 0
                    ? `Page ${page} of ${totalPages} (${listData.total} total)`
                    : "No results"}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-7 px-2 text-muted-foreground"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p: number) => p + 1)}
                    disabled={page >= totalPages}
                    className="h-7 px-2 text-muted-foreground"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="border border-border rounded px-1.5 py-0.5 text-xs bg-card text-foreground"
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
    <ServiceDetailPanel
      serviceId={selectedId}
      onDirtyChange={(dirty) => {
        setIsDirty(dirty);
        isDirtyRef.current = dirty;
      }}
    />
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

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
