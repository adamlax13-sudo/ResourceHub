import { useState } from "react";
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
import { Loader2, CheckCircle, XCircle, Edit2, AlertTriangle, RefreshCw } from "lucide-react";
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
  reviewNotes?: string;
}

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

  const request = detailData?.request;

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
      <div className="p-3 border-b border-slate-700 space-y-2">
        <div className="flex gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-white"
          >
            <option value="">All Sources</option>
            <option value="scraper">Scraper</option>
            <option value="import">Import</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-white"
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
            className="w-full"
          >
            {bulkApproveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Approve Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* List */}
      {listLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : !listData?.changeRequests?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <CheckCircle className="h-8 w-8 mb-2 text-emerald-400/50" />
          <p className="text-sm">All caught up! No pending reviews.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {listData.changeRequests.map((cr) => (
            <div
              key={cr.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/50 cursor-pointer transition-colors",
                selectedId === cr.id ? "bg-slate-700/50" : "hover:bg-slate-800/50"
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
                  <p className="text-sm text-white truncate">
                    {cr.serviceName || (cr.proposedChanges as any)?.name || `#${cr.serviceId || cr.id}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
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
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : request ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ChangeTypeBadge type={request.changeType} />
                <h3 className="text-lg font-semibold text-white">
                  {request.serviceName || (request.proposedChanges as any)?.name || `Change Request #${request.id}`}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {request.source} -- {new Date(request.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Duplicate Warning */}
          {detailData?.duplicateWarning && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-900/20 border border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                Possible duplicate: {detailData.duplicateWarning.serviceName}
                (ID: {detailData.duplicateWarning.serviceId}, matched by {detailData.duplicateWarning.matchType})
              </p>
            </div>
          )}

          {/* Content based on type */}
          {editMode ? (
            <ServiceForm
              initialData={request.proposedChanges as any}
              onSubmit={(data) =>
                editApproveMutation.mutate({ id: request.id, data })
              }
              isPending={editApproveMutation.isPending}
              submitLabel="Save & Approve"
            />
          ) : request.changeType === "update" && Object.keys(diffChanges).length > 0 ? (
            <DiffView changes={diffChanges} />
          ) : request.changeType === "create" && request.proposedChanges ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Proposed Service</h4>
              <div className="space-y-1">
                {Object.entries(request.proposedChanges).map(([key, val]) => (
                  <div key={key} className="flex gap-2 py-1">
                    <span className="text-xs text-slate-500 w-32 flex-shrink-0">{key}</span>
                    <span className="text-sm text-slate-300 break-words">
                      {val == null ? "(empty)" : typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : request.changeType === "deactivate" ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Deactivation Request</h4>
              {request.reason && (
                <p className="text-sm text-slate-400">Reason: {request.reason}</p>
              )}
              {request.currentData && (
                <div className="space-y-1 mt-3">
                  <h5 className="text-xs text-slate-500">Current service data:</h5>
                  {Object.entries(request.currentData).map(([key, val]) => (
                    <div key={key} className="flex gap-2 py-0.5">
                      <span className="text-xs text-slate-500 w-32 flex-shrink-0">{key}</span>
                      <span className="text-sm text-slate-400 break-words">
                        {val == null ? "(empty)" : typeof val === "object" ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No details available.</p>
          )}

          {/* Action Buttons */}
          {!editMode && (
            <div className="flex gap-2 pt-4 border-t border-slate-700">
              <Button
                onClick={() => approveMutation.mutate(request.id)}
                disabled={approveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                className="border-slate-600"
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Edit & Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(true)}
                className="border-red-700 text-red-400 hover:bg-red-900/20"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {/* Post-approval toast prompt */}
          {approveMutation.isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-indigo-900/20 border border-indigo-800">
              <RefreshCw className="h-4 w-4 text-indigo-400 flex-shrink-0" />
              <p className="text-sm text-indigo-300">
                Consider refreshing the search view (System page) for changes to appear in search results.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">Change request not found</p>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Change Request</DialogTitle>
            <DialogDescription className="text-slate-400">
              Provide a reason for rejecting this change.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="bg-slate-900 border-slate-600 text-white"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="border-slate-600">
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
    return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-700 text-xs">NEW</Badge>;
  }
  if (type === "update") {
    return <Badge className="bg-amber-600/20 text-amber-400 border-amber-700 text-xs">UPDATE</Badge>;
  }
  if (type === "deactivate") {
    return <Badge className="bg-red-600/20 text-red-400 border-red-700 text-xs">REMOVE</Badge>;
  }
  return <Badge className="bg-slate-600/20 text-slate-400 border-slate-600 text-xs">{type}</Badge>;
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
