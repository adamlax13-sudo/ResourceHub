import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ServiceForm, type ServiceFormData } from "@/components/admin/ServiceForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  History,
  Trash2,
  RotateCcw,
  RefreshCw,
  MapPin,
  Flag,
  Sparkles,
  GitCompare,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";

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
  duplicateOf?: number | null;
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
  recordedAt: string;
}

export interface ServiceDetailPanelProps {
  serviceId: number;
  /** Optional fields to highlight as needing attention (amber ring) */
  highlightFields?: string[];
  /** Optional banner content to show at the top (e.g., missing fields warning from Review) */
  banner?: React.ReactNode;
  /** Called when the edit form's dirty state changes (unsaved edits) */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after a successful service update — lets parent invalidate its own queries */
  onSaveSuccess?: () => void;
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

export function ServiceDetailPanel({ serviceId, highlightFields, banner, onDirtyChange, onSaveSuccess }: ServiceDetailPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showHistory, setShowHistory] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);

  // --- Draft persistence via sessionStorage ---
  const draftKey = `service-draft-${serviceId}`;

  const getSavedDraft = (): Partial<ServiceFormData> | null => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const saveDraft = (data: ServiceFormData) => {
    try { sessionStorage.setItem(draftKey, JSON.stringify(data)); } catch {}
  };

  const clearDraft = () => {
    try { sessionStorage.removeItem(draftKey); } catch {}
  };

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

  // Reset duplicates when serviceId changes
  useEffect(() => {
    setShowDuplicates(false);
    setDuplicates([]);
    setShowHistory(false);
    setShowFlagDialog(false);
    setFlagReason("");
    setIsDirty(false);
  }, [serviceId]);

  // Fetch service detail
  const { data: detailData, isPending: detailLoading } = useQuery<{
    success: boolean;
    service: ServiceDetail;
  }>({
    queryKey: ["/api/admin/services", serviceId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${serviceId}`);
      return res.json();
    },
    enabled: !!serviceId,
    staleTime: 10_000,
  });

  // Fetch history
  const { data: historyData, isPending: historyLoading } = useQuery<{
    success: boolean;
    history: HistoryEntry[];
  }>({
    queryKey: ["/api/admin/services", serviceId, "history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${serviceId}/history`);
      return res.json();
    },
    enabled: !!serviceId && showHistory,
    staleTime: 30_000,
  });

  // Fetch AI enrichment data
  const { data: enrichmentData } = useQuery<EnrichmentData>({
    queryKey: ["/api/admin/services", serviceId, "enrichment"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${serviceId}/enrichment`);
      return res.json();
    },
    enabled: !!serviceId,
    staleTime: 60_000,
  });

  const service = detailData?.service;

  // Load draft once when serviceId or service data changes (not every render)
  const [draft, setDraft] = useState<Partial<ServiceFormData> | null>(null);
  useEffect(() => {
    setDraft(getSavedDraft());
  }, [serviceId, service]);

  // Merge saved draft over server data so edits persist across navigation
  const formInitialData = useMemo(() => {
    if (!service) return undefined;
    if (!draft) return service;
    return { ...service, ...draft };
  }, [service, draft]);

  // Fetch duplicate-of service name when needed
  const { data: duplicateOfData } = useQuery<{
    success: boolean;
    service: { id: number; name: string };
  }>({
    queryKey: ["/api/admin/services", service?.duplicateOf],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${service!.duplicateOf}`);
      return res.json();
    },
    enabled: !!service?.duplicateOf,
    staleTime: 60_000,
  });

  // Check stale embedding
  const hasStaleEmbedding = service?.embeddingUpdatedAt && service?.lastUpdated &&
    new Date(service.embeddingUpdatedAt) < new Date(service.lastUpdated);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      // Strip null values (DB nulls fail Zod validation which expects undefined)
      // and remove fields not in the update schema
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
          cleaned[key] = value;
        }
      }
      const res = await apiRequest("PATCH", `/api/admin/services/${serviceId}`, cleaned);
      return res.json();
    },
    onSuccess: () => {
      clearDraft();
      setDraft(null);
      toast({ title: "Service updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      // Re-fetch after async embedding regen completes so stale-embedding warning clears
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
      }, 5000);
      onSaveSuccess?.();
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/admin/services/${serviceId}/deactivate`, {
        reason: reason || "Deactivated via admin panel",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service deactivated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
      setDeactivateReason("");
    },
    onError: (err) => {
      toast({ title: "Deactivation failed", description: err.message, variant: "destructive" });
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${serviceId}/restore`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service restored" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
    },
    onError: (err) => {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
    },
  });

  // Regen embedding mutation
  const regenEmbeddingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${serviceId}/regenerate-embedding`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Embedding regenerated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
    },
    onError: (err) => {
      toast({ title: "Embedding regen failed", description: err.message, variant: "destructive" });
    },
  });

  // Geocode mutation
  const geocodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${serviceId}/geocode`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Geocoded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
    },
    onError: (err) => {
      toast({ title: "Geocoding failed", description: err.message, variant: "destructive" });
    },
  });

  // Flag for review mutation
  const flagReviewMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/admin/services/${serviceId}/flag-review`, { reason });
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

  // Check duplicates mutation
  const checkDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/admin/services/${serviceId}/duplicates`);
      return res.json();
    },
    onSuccess: (data) => {
      setDuplicates(data.duplicates || []);
      setShowDuplicates(true);
    },
    onError: (err) => {
      toast({ title: "Duplicate check failed", description: err.message, variant: "destructive" });
    },
  });

  // Mark as duplicate mutation
  const markDuplicateMutation = useMutation({
    mutationFn: async (duplicateOfId: number) => {
      const res = await apiRequest("POST", `/api/admin/services/${serviceId}/mark-duplicate`, {
        duplicateOf: duplicateOfId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marked as duplicate" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
    },
    onError: (err) => {
      toast({ title: "Mark duplicate failed", description: err.message, variant: "destructive" });
    },
  });

  // Clear duplicate mutation
  const clearDuplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/services/${serviceId}/clear-duplicate`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Duplicate flag cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
    },
    onError: (err) => {
      toast({ title: "Clear duplicate failed", description: err.message, variant: "destructive" });
    },
  });

  // Loading state
  if (detailLoading) {
    return (
      <div className="p-4">
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Not found
  if (!service) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground text-center py-8">Service not found</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="space-y-4">
        {/* Optional banner from parent (e.g. Review page missing fields warning) */}
        {banner}

        {/* Header with action buttons */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{service.name}</h3>
            <p className="text-sm text-muted-foreground">
              ID: {service.id} {service.serviceId ? `/ ${service.serviceId}` : ""}
              {service.lastUpdated && (
                <span className="ml-2 text-muted-foreground">
                  · Edited {formatRelativeTime(service.lastUpdated)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-muted-foreground hover:text-foreground"
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
            {service.isActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeactivateConfirm(true)}
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

        {/* Duplicate banner */}
        {service.duplicateOf && (
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-700">
                This service is marked as a duplicate of{" "}
                <span className="font-medium">
                  {duplicateOfData?.service?.name ?? `#${service.duplicateOf}`}
                </span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearDuplicateMutation.mutate()}
              disabled={clearDuplicateMutation.isPending}
              className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 flex-shrink-0"
            >
              {clearDuplicateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clear"}
            </Button>
          </div>
        )}

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
          <p className="text-sm font-medium text-foreground">Actions</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => geocodeMutation.mutate()}
              disabled={geocodeMutation.isPending || !service.address}
              className="flex-1 border-border text-foreground hover:bg-muted"
              title={!service.address ? "Service has no address" : undefined}
            >
              {geocodeMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-primary" />
                : <MapPin className="h-4 w-4 mr-1.5 text-primary" />
              }
              Geocode
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenEmbeddingMutation.mutate()}
              disabled={regenEmbeddingMutation.isPending}
              className="flex-1 border-border text-foreground hover:bg-muted"
            >
              {regenEmbeddingMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-primary" />
                : <RefreshCw className="h-4 w-4 mr-1.5 text-primary" />
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkDuplicatesMutation.mutate()}
              disabled={checkDuplicatesMutation.isPending}
              className="flex-1 border-border text-foreground hover:bg-muted"
            >
              {checkDuplicatesMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-primary" />
                : <GitCompare className="h-4 w-4 mr-1.5 text-primary" />
              }
              Check Duplicates
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
                className="w-full text-sm border border-amber-200 rounded px-2 py-1.5 bg-card text-foreground placeholder-muted-foreground"
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
                  className="flex-1 text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {/* Duplicate check results */}
          {showDuplicates && (
            <Card className="bg-amber-50/40 border-amber-200/60 shadow-sm rounded-xl mt-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                  <GitCompare className="h-4 w-4" />
                  Potential Duplicates ({duplicates.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {duplicates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No duplicates found.</p>
                ) : (
                  duplicates.map((dup: any) => (
                    <div key={dup.id} className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{dup.name}</p>
                        <div className="flex gap-2 mt-0.5">
                          <Badge className={cn(getCategoryColor(dup.category), "text-[10px]")}>{dup.category}</Badge>
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">Match: {dup.match_type}</Badge>
                          {!dup.is_active && <Badge className="bg-muted text-muted-foreground text-[10px]">Inactive</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-6 px-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                          onClick={() => markDuplicateMutation.mutate(dup.id)}
                          disabled={markDuplicateMutation.isPending}
                        >
                          Mark as Duplicate
                        </Button>
                        <Link href={`/admin/services?selected=${dup.id}`}>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* History or Edit Form */}
        {showHistory ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Change History</h4>
            {historyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : !historyData?.history?.length ? (
              <p className="text-sm text-muted-foreground">No history found</p>
            ) : (
              <div className="space-y-2">
                {historyData.history.map((entry) => (
                  <div key={entry.id} className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between">
                      <Badge className={cn(
                        "text-[10px]",
                        entry.changeType === "created" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        entry.changeType === "deactivated" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {entry.changeType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.recordedAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.changedFields && (entry.changedFields as any).source && <p className="text-xs text-muted-foreground mt-1">Source: {(entry.changedFields as any).source}</p>}
                    {entry.changedFields && (
                      <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-32">
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
            {draft && (
              <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-xs text-amber-700">Unsaved draft restored</span>
                <button
                  type="button"
                  onClick={() => { clearDraft(); setDraft(null); queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] }); }}
                  className="text-xs text-amber-500 hover:text-amber-700 underline"
                >
                  Discard draft
                </button>
              </div>
            )}
            <ServiceForm
              initialData={formInitialData}
              onSubmit={(data) => {
                setIsDirty(false);
                updateMutation.mutate(data);
              }}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
              onDirtyChange={(dirty) => { setIsDirty(dirty); onDirtyChange?.(dirty); }}
              onChange={saveDraft}
              highlightFields={highlightFields}
            />
            {/* AI-Inferred Data section */}
            {enrichmentData?.enrichment && (
              <Card className="bg-muted/40 border-border shadow-sm rounded-xl mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI-Inferred Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {enrichmentData.enrichment.aiDescription && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Description</p>
                      <p className="text-foreground bg-card rounded p-2 border border-border text-sm">
                        {enrichmentData.enrichment.aiDescription}
                      </p>
                    </div>
                  )}
                  {enrichmentData.enrichment.aiEligibility && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Eligibility</p>
                      <p className="text-foreground bg-card rounded p-2 border border-border text-sm">
                        {enrichmentData.enrichment.aiEligibility}
                      </p>
                    </div>
                  )}
                  {enrichmentData.enrichment.aiProcessSteps != null && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Process Steps</p>
                      <pre className="text-foreground bg-card rounded p-2 border border-border text-xs whitespace-pre-wrap overflow-auto max-h-48">
                        {JSON.stringify(enrichmentData.enrichment.aiProcessSteps, null, 2)}
                      </pre>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    Source: {enrichmentData.enrichmentSource || 'AI enrichment'}
                    {enrichmentData.enrichmentDate && ` \u2022 ${new Date(enrichmentData.enrichmentDate).toLocaleDateString()}`}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Deactivate confirmation dialog */}
      <Dialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate Service?</DialogTitle>
            <DialogDescription>
              This will remove <strong>{service?.name}</strong> from search results. The service data is preserved and can be restored later.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={deactivateReason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeactivateReason(e.target.value)}
            placeholder="Why is this service being deactivated? (optional)"
            className="mt-2 min-h-[60px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowDeactivateConfirm(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                deactivateMutation.mutate(deactivateReason);
                setShowDeactivateConfirm(false);
              }}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
