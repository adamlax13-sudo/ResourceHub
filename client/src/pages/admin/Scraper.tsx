import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScraperRun {
  id: number;
  runId?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  phasesCompleted?: string[];
  servicesCreated?: number;
  servicesUpdated?: number;
  servicesDeactivated?: number;
  errors?: string[];
  errorCount?: number;
  duration?: string;
}

export default function Scraper() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hideFailed, setHideFailed] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const { data, isPending } = useQuery<{
    success: boolean;
    runs: ScraperRun[];
    total: number;
  }>({
    queryKey: ["/api/admin/scraper/runs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/scraper/runs?limit=100");
      return res.json();
    },
    staleTime: 30_000,
  });

  const latestRun = data?.runs?.[0];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Scraper</h2>

      {/* Last Run Summary */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base">Last Run</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !latestRun ? (
            <p className="text-sm text-muted-foreground">No scraper runs found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={latestRun.status} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="text-sm text-foreground">
                  {new Date(latestRun.startedAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm text-foreground">
                  {formatDuration(latestRun.duration, latestRun.startedAt, latestRun.completedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Results</p>
                <div className="flex gap-3 text-sm">
                  {latestRun.servicesCreated != null && (
                    <span className="text-emerald-500">+{latestRun.servicesCreated}</span>
                  )}
                  {latestRun.servicesUpdated != null && (
                    <span className="text-amber-500">~{latestRun.servicesUpdated}</span>
                  )}
                  {latestRun.servicesDeactivated != null && (
                    <span className="text-red-500">-{latestRun.servicesDeactivated}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run History */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base">Run History</CardTitle>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideFailed}
                onChange={(e) => setHideFailed(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground">Hide failed (0ms)</span>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.runs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No runs recorded.</p>
          ) : (() => {
            // Filter stale zero-duration failed runs when toggle is on
            const filtered = hideFailed
              ? data.runs.filter((run) => {
                  const isFailed = run.status?.toLowerCase() === "failed" || run.status?.toLowerCase() === "error";
                  const isZeroDuration = !run.duration || run.duration === "0ms" || run.duration === "0s";
                  return !(isFailed && isZeroDuration);
                })
              : data.runs;
            const displayed = showAll ? filtered : filtered.slice(0, 10);
            const hasMore = filtered.length > 10;

            return (
              <>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="w-8" />
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Started</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Duration</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Created</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Updated</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((run) => {
                        const isExpanded = expandedId === run.id;
                        const hasErrors = (run.errorCount ?? 0) > 0 || (run.errors?.length ?? 0) > 0;
                        return (
                          <Fragment key={run.id}>
                            <tr
                              className={cn(
                                "border-t border-border cursor-pointer hover:bg-muted",
                                isExpanded && "bg-muted"
                              )}
                              onClick={() => setExpandedId(isExpanded ? null : run.id)}
                            >
                              <td className="px-2 py-2">
                                {hasErrors ? (
                                  isExpanded ?
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> :
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : <span className="w-3.5" />}
                              </td>
                              <td className="px-3 py-2"><StatusBadge status={run.status} /></td>
                              <td className="px-3 py-2 text-foreground">
                                {new Date(run.startedAt).toLocaleDateString()}{" "}
                                <span className="text-muted-foreground">
                                  {new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {formatDuration(run.duration, run.startedAt, run.completedAt)}
                              </td>
                              <td className="px-3 py-2 text-right text-emerald-500">
                                {run.servicesCreated ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-right text-amber-500">
                                {run.servicesUpdated ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-right text-red-500">
                                {run.errorCount ?? run.errors?.length ?? 0}
                              </td>
                            </tr>
                            {isExpanded && hasErrors && (
                              <tr>
                                <td colSpan={7} className="px-6 py-3 bg-muted">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Errors:</p>
                                  <div className="space-y-1 max-h-48 overflow-auto">
                                    {(run.errors ?? []).map((err, i) => (
                                      <p key={i} className="text-xs text-red-500 font-mono">{err}</p>
                                    ))}
                                    {!run.errors?.length && (
                                      <p className="text-xs text-muted-foreground">
                                        {run.errorCount} error(s) occurred. See server logs for details.
                                      </p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {hasMore && (
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Showing {displayed.length} of {filtered.length} runs</span>
                    <button
                      type="button"
                      onClick={() => setShowAll((v) => !v)}
                      className="text-primary hover:text-primary/80 font-medium"
                    >
                      {showAll ? "Show less" : `Show all ${filtered.length}`}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

// Need React import for Fragment
import React from "react";

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === "completed" || s === "success") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        Completed
      </Badge>
    );
  }
  if (s === "running" || s === "in_progress") {
    return (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        <Clock className="h-3 w-3 mr-1 animate-pulse" />
        Running
      </Badge>
    );
  }
  if (s === "failed" || s === "error") {
    return (
      <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  }
  if (s === "partial") {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Partial
      </Badge>
    );
  }
  return <Badge className="bg-muted text-muted-foreground border-border text-xs">{status}</Badge>;
}

function formatMs(ms: number): string {
  if (ms <= 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m ${remSec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

function formatDuration(duration: string | undefined, startedAt: string, completedAt?: string): string {
  // If we have a raw duration string from the API, parse and format it
  if (duration) {
    const match = duration.match(/^(-?\d+)ms$/);
    if (match) {
      const ms = Math.abs(parseInt(match[1], 10));
      return formatMs(ms);
    }
    // Already formatted (e.g. "1m 19s"), return as-is
    return duration;
  }
  // Fall back to computing from timestamps
  if (!completedAt) return "In progress";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return formatMs(Math.abs(ms));
}
