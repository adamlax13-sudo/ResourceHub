import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MasterDetailLayout } from "@/components/admin/MasterDetailLayout";
import { ServiceForm, type ServiceFormData } from "@/components/admin/ServiceForm";
import { ServiceDetailPanel } from "@/components/admin/ServiceDetailPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, ClipboardCheck, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";

interface ChangeRequest {
  id: number;
  serviceId?: number;
  serviceName?: string;
  category?: string | null;
  location?: string | null;
  confidenceScore?: number | null;
  changeType: string;
  source?: string;
  status: string;
  proposedChanges?: Record<string, unknown>;
  currentData?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

interface ChangeRequestDetail extends ChangeRequest {
  reviewNotes?: string;
}

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone", email: "Email", websiteUrl: "Website", address: "Address",
  description: "Description", hoursOfOperation: "Hours", eligibility: "Eligibility",
  waitTimes: "Wait Times", serviceFormat: "Service Format", processSteps: "Process Steps",
  requiredDocs: "Required Docs", languagesSupported: "Languages", latitude: "Geocoding",
  tags: "Tags", embedding: "Embedding", embeddingFresh: "Stale Embedding",
  geocodingFresh: "Stale Geocoding", staleEmbedding: "Stale Embedding", staleGeocoding: "Stale Geocoding",
};

export default function Review() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");


  // Build query params
  const queryParams = new URLSearchParams({ status: "pending" });
  if (sourceFilter) queryParams.set("source", sourceFilter);
  if (typeFilter) queryParams.set("changeType", typeFilter);

  // Fetch list
  const { data: listData, isPending: listLoading } = useQuery<{
    success: boolean;
    changeRequests: ChangeRequest[];
    total: number;
  }>({
    queryKey: ["/api/admin/review", queryParams.toString()],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/review?${queryParams}`);
      return res.json();
    },
    staleTime: 15_000,
  });

  // Fetch detail
  const { data: detailData, isPending: detailLoading } = useQuery<{
    success: boolean;
    request: ChangeRequestDetail;
    duplicateWarning?: { serviceId: number; serviceName: string; matchType: string };
  }>({
    queryKey: ["/api/admin/review", selectedId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/review/${selectedId}`);
      return res.json();
    },
    enabled: !!selectedId,
    staleTime: 10_000,
  });

  const request = detailData?.request;
  const isReviewFlag = request?.changeType === "review";
  const missingFields = isReviewFlag ? ((request?.proposedChanges as any)?.missingFields as string[] ?? []) : [];

  // Approve
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/review/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Approved",
        description: "Remember to refresh the search view if needed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/review"] });
      setSelectedId(null);
    },
    onError: (err) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  // Reject
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/review/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/review"] });
      setSelectedId(null);
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (err) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  // Bulk approve
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/admin/review/bulk-approve", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `${data.approved} items approved` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/review"] });
      setSelectedIds(new Set());
    },
    onError: (err) => {
      toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" });
    },
  });

  // Edit & Approve
  const editApproveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ServiceFormData }) => {
      // Update the proposed changes, then approve
      await apiRequest("PATCH", `/api/admin/review/${id}`, { proposedChanges: data });
      const res = await apiRequest("POST", `/api/admin/review/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Edited and approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/review"] });
      setSelectedId(null);
    },
    onError: (err) => {
      toast({ title: "Edit & approve failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build diff for updates
  const diffChanges: Record<string, { old: unknown; new: unknown }> = {};
  if (request?.changeType === "update" && request.proposedChanges && request.currentData) {
    for (const [key, newVal] of Object.entries(request.proposedChanges)) {
      const oldVal = request.currentData[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffChanges[key] = { old: oldVal, new: newVal };
      }
    }
  }

  const list = (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
          >
            <option value="">All Sources</option>
            <option value="scraper">Scraper</option>
            <option value="enrichment-audit">Enrichment Audit</option>
            <option value="import">Import</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
          >
            <option value="">All Types</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="deactivate">Deactivate</option>
            <option value="review">Review</option>
          </select>
        </div>
        {selectedIds.size > 0 && (
          <Button
            size="sm"
            onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
            disabled={bulkApproveMutation.isPending}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
          >
            {bulkApproveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Approve Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* List */}
      {listLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !listData?.changeRequests?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Pending Reviews</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            When the scraper runs or services are imported, proposed changes will appear here for review before going live.
            You can also flag services for review from the Services page.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {listData.changeRequests.map((cr) => (
            <div
              key={cr.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 border-b border-border cursor-pointer transition-colors",
                selectedId === cr.id ? "bg-primary/10" : "hover:bg-muted"
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(cr.id)}
                onChange={() => toggleSelect(cr.id)}
                className="rounded flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="min-w-0 flex-1" onClick={() => setSelectedId(cr.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <ChangeTypeBadge type={cr.changeType} />
                      <p className="text-sm text-foreground truncate">
                        {cr.serviceName || (typeof (cr.proposedChanges as any)?.name === "string" ? (cr.proposedChanges as any).name : null) || `Change #${cr.id}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {cr.category && (
                        <Badge className={cn(getCategoryColor(cr.category), "text-[10px] px-1.5")}>
                          {cr.category}
                        </Badge>
                      )}
                      {cr.location && (
                        <span className="text-[10px] text-muted-foreground truncate">{cr.location}</span>
                      )}
                    </div>
                  </div>
                  {cr.confidenceScore != null && (
                    <span className={cn(
                      "text-xs font-mono flex-shrink-0",
                      cr.confidenceScore >= 70 ? "text-emerald-500" :
                      cr.confidenceScore >= 40 ? "text-amber-500" : "text-red-500"
                    )}>
                      {cr.confidenceScore}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  {cr.source && <span>{cr.source}</span>}
                  <span>{formatRelativeTime(cr.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const detail = selectedId ? (
    <div className="p-4">
      {detailLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : request ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ChangeTypeBadge type={request.changeType} />
                <h3 className="text-lg font-semibold text-foreground">
                  {request.serviceName || (request.proposedChanges as any)?.name || `Change Request #${request.id}`}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {request.source} -- {new Date(request.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Duplicate Warning */}
          {detailData?.duplicateWarning && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Possible duplicate: {detailData.duplicateWarning.serviceName}
                (ID: {detailData.duplicateWarning.serviceId}, matched by {detailData.duplicateWarning.matchType})
              </p>
            </div>
          )}

          {/* Content based on type */}
          {isReviewFlag && request.serviceId ? (
            <>
              <ServiceDetailPanel
                serviceId={request.serviceId}
                highlightFields={missingFields}
                onSaveSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/review"] })}
                banner={
                  missingFields.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span className="text-sm text-amber-700 font-medium">Missing fields:</span>
                      {missingFields.map((f) => (
                        <Badge key={f} className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                          {FIELD_LABELS[f] || f}
                        </Badge>
                      ))}
                    </div>
                  ) : undefined
                }
              />
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button
                  onClick={() => approveMutation.mutate(request.id)}
                  disabled={approveMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                >
                  {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Resolved
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  className="border-red-300/60 text-red-400 hover:bg-red-50/50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
              </div>
            </>
          ) : request.changeType === "update" ? (
            <>
              {/* Legend + editable form with changed fields highlighted */}
              {Object.keys(diffChanges).length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border">
                  <span className="inline-block w-3 h-3 rounded ring-2 ring-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Highlighted fields have been updated ({Object.keys(diffChanges).filter(k => k !== "id" && k !== "isActive").length} changes)
                  </span>
                </div>
              )}
              <ServiceForm
                initialData={request.proposedChanges as any}
                onSubmit={(data) => editApproveMutation.mutate({ id: request.id, data })}
                isPending={editApproveMutation.isPending}
                submitLabel="Save & Activate"
                changedFields={Object.keys(diffChanges).filter(k => k !== "id" && k !== "isActive")}
              />
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                <Button
                  onClick={() => approveMutation.mutate(request.id)}
                  disabled={approveMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                >
                  {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve & Activate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  className="border-red-300/60 text-red-400 hover:bg-red-50/50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                {request.serviceId && (
                  <div className="flex gap-1.5 ml-auto">
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        try {
                          await apiRequest("POST", `/api/admin/services/${request.serviceId}/geocode`, {});
                          toast({ title: "Geocoded successfully" });
                        } catch { toast({ title: "Geocode failed", variant: "destructive" }); }
                      }}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      <MapPin className="h-3.5 w-3.5 mr-1" />
                      Geocode
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        try {
                          await apiRequest("POST", `/api/admin/services/${request.serviceId}/regenerate-embedding`, {});
                          toast({ title: "Embedding regenerated" });
                        } catch { toast({ title: "Embedding regen failed", variant: "destructive" }); }
                      }}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Re-embed
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : request.changeType === "create" && request.proposedChanges ? (
            <>
              {/* Editable form for new services too */}
              <ServiceForm
                initialData={request.proposedChanges as any}
                onSubmit={(data) => editApproveMutation.mutate({ id: request.id, data })}
                isPending={editApproveMutation.isPending}
                submitLabel="Save & Activate"
              />
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button
                  onClick={() => approveMutation.mutate(request.id)}
                  disabled={approveMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                >
                  {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve & Activate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  className="border-red-300/60 text-red-400 hover:bg-red-50/50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </>
          ) : request.changeType === "deactivate" ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Deactivation Request</h4>
              {request.reason && (
                <p className="text-sm text-muted-foreground">Reason: {request.reason}</p>
              )}
              {request.currentData && (
                <div className="space-y-1 mt-3">
                  <h5 className="text-xs text-muted-foreground">Current service data:</h5>
                  {Object.entries(request.currentData).map(([key, val]) => (
                    <div key={key} className="flex gap-2 py-0.5">
                      <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{key}</span>
                      <span className="text-sm text-muted-foreground break-words">
                        {val == null || val === "" ? <span className="italic text-muted-foreground/50">(empty)</span> : typeof val === "object" ? JSON.stringify(val).slice(0, 200) : String(val).slice(0, 200)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button
                  onClick={() => approveMutation.mutate(request.id)}
                  disabled={approveMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                >
                  {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  className="border-red-300/60 text-red-400 hover:bg-red-50/50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No details available.</p>
          )}

          {/* Post-approval toast prompt */}
          {approveMutation.isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <RefreshCw className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-sm text-primary">
                Consider refreshing the search view (System page) for changes to appear in search results.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Change request not found</p>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject Change Request</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Provide a reason for rejecting this change.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="bg-card border-border text-foreground"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedId && rejectMutation.mutate({ id: selectedId, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ) : null;

  return (
    <MasterDetailLayout
      list={list}
      detail={detail}
      placeholder="Select a change request to review"
    />
  );
}

function ChangeTypeBadge({ type }: { type: string }) {
  if (type === "create") {
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">NEW</Badge>;
  }
  if (type === "update") {
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">UPDATE</Badge>;
  }
  if (type === "deactivate") {
    return <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">REMOVE</Badge>;
  }
  if (type === "review") {
    return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">REVIEW</Badge>;
  }
  return <Badge className="bg-muted text-muted-foreground border-border text-xs">{type}</Badge>;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
