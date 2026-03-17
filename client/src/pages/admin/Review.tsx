import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MasterDetailLayout } from "@/components/admin/MasterDetailLayout";
import { DiffView } from "@/components/admin/DiffView";
import { ServiceForm, type ServiceFormData } from "@/components/admin/ServiceForm";
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
import { Loader2, CheckCircle, XCircle, Edit2, AlertTriangle, RefreshCw, ClipboardCheck, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ChangeRequest {
  id: number;
  serviceId?: number;
  serviceName?: string;
  changeType: string;
  source?: string;
  status: string;
  proposedChanges?: Record<string, unknown>;
  currentData?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

interface ChangeRequestDetail extends ChangeRequest {
  currentServiceData?: Record<string, unknown>;
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
  const [editMode, setEditMode] = useState(false);

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

  // Auto-open edit mode for review-flagged items
  const request = detailData?.request;
  const isReviewFlag = request?.changeType === "review";
  const missingFields = isReviewFlag ? ((request?.proposedChanges as any)?.missingFields as string[] ?? []) : [];

  useEffect(() => {
    if (isReviewFlag && request) {
      setEditMode(true);
    }
  }, [isReviewFlag, request?.id]);

  // Approve
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/review/${id}/approve`);
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
      const res = await apiRequest("POST", `/api/admin/review/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Edited and approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/review"] });
      setSelectedId(null);
      setEditMode(false);
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
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900"
          >
            <option value="">All Sources</option>
            <option value="scraper">Scraper</option>
            <option value="import">Import</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900"
          >
            <option value="">All Types</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="deactivate">Deactivate</option>
          </select>
        </div>
        {selectedIds.size > 0 && (
          <Button
            size="sm"
            onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
            disabled={bulkApproveMutation.isPending}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white"
          >
            {bulkApproveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Approve Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* List */}
      {listLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : !listData?.changeRequests?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <ClipboardCheck className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Reviews</h3>
          <p className="text-sm text-gray-500 max-w-md">
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
                "flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 cursor-pointer transition-colors",
                selectedId === cr.id ? "bg-teal-50" : "hover:bg-gray-50"
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(cr.id)}
                onChange={() => toggleSelect(cr.id)}
                className="rounded flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="min-w-0 flex-1" onClick={() => { setSelectedId(cr.id); setEditMode(false); }}>
                <div className="flex items-center gap-2">
                  <ChangeTypeBadge type={cr.changeType} />
                  <p className="text-sm text-gray-900 truncate">
                    {cr.serviceName || (cr.proposedChanges as any)?.name || `#${cr.serviceId || cr.id}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
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
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : request ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ChangeTypeBadge type={request.changeType} />
                <h3 className="text-lg font-semibold text-gray-900">
                  {request.serviceName || (request.proposedChanges as any)?.name || `Change Request #${request.id}`}
                </h3>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {request.source} -- {new Date(request.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Duplicate Warning */}
          {detailData?.duplicateWarning && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Possible duplicate: {detailData.duplicateWarning.serviceName}
                (ID: {detailData.duplicateWarning.serviceId}, matched by {detailData.duplicateWarning.matchType})
              </p>
            </div>
          )}

          {/* Missing fields banner + full editor link for review-flagged items */}
          {isReviewFlag && (
            <div className="space-y-2">
              {missingFields.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-amber-700 font-medium">Missing fields:</span>
                  {missingFields.map((f) => (
                    <Badge key={f} className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                      {FIELD_LABELS[f] || f}
                    </Badge>
                  ))}
                </div>
              )}
              {request.serviceId && (
                <Link href={`/admin/services?selected=${request.serviceId}`}>
                  <Button variant="outline" size="sm" className="w-full border-teal-200 text-teal-700 hover:bg-teal-50">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Open Full Editor — Geocode, Regenerate Embedding, Check Duplicates
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Content based on type */}
          {editMode ? (
            <ServiceForm
              initialData={isReviewFlag ? (request.currentServiceData as any) : (request.proposedChanges as any)}
              onSubmit={(data) =>
                editApproveMutation.mutate({ id: request.id, data })
              }
              isPending={editApproveMutation.isPending}
              submitLabel="Save & Approve"
              highlightFields={missingFields}
            />
          ) : request.changeType === "update" && Object.keys(diffChanges).length > 0 ? (
            <DiffView changes={diffChanges} />
          ) : request.changeType === "create" && request.proposedChanges ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Proposed Service</h4>
              <div className="space-y-1">
                {Object.entries(request.proposedChanges).map(([key, val]) => (
                  <div key={key} className="flex gap-2 py-1">
                    <span className="text-xs text-gray-400 w-32 flex-shrink-0">{key}</span>
                    <span className="text-sm text-gray-700 break-words">
                      {val == null ? "(empty)" : typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : request.changeType === "deactivate" ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Deactivation Request</h4>
              {request.reason && (
                <p className="text-sm text-gray-500">Reason: {request.reason}</p>
              )}
              {request.currentData && (
                <div className="space-y-1 mt-3">
                  <h5 className="text-xs text-gray-400">Current service data:</h5>
                  {Object.entries(request.currentData).map(([key, val]) => (
                    <div key={key} className="flex gap-2 py-0.5">
                      <span className="text-xs text-gray-400 w-32 flex-shrink-0">{key}</span>
                      <span className="text-sm text-gray-500 break-words">
                        {val == null ? "(empty)" : typeof val === "object" ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No details available.</p>
          )}

          {/* Action Buttons */}
          {!editMode && (
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                onClick={() => approveMutation.mutate(request.id)}
                disabled={approveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                className="border-gray-300"
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Edit & Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(true)}
                className="border-red-300 text-red-500 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {/* Post-approval toast prompt */}
          {approveMutation.isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-teal-50 border border-teal-200">
              <RefreshCw className="h-4 w-4 text-teal-600 flex-shrink-0" />
              <p className="text-sm text-teal-700">
                Consider refreshing the search view (System page) for changes to appear in search results.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8">Change request not found</p>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Reject Change Request</DialogTitle>
            <DialogDescription className="text-gray-500">
              Provide a reason for rejecting this change.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="bg-white border-gray-300 text-gray-900"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="border-gray-300">
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
  return <Badge className="bg-gray-50 text-gray-500 border-gray-200 text-xs">{type}</Badge>;
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
