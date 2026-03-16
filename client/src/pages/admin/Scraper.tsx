import { useState } from "react";
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

  const { data, isPending } = useQuery<{
    success: boolean;
    runs: ScraperRun[];
    total: number;
  }>({
    queryKey: ["/api/admin/scraper/runs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/scraper/runs?limit=20");
      return res.json();
    },
    staleTime: 30_000,
  });

  const latestRun = data?.runs?.[0];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-white">Scraper</h2>

      {/* Last Run Summary */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Last Run</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !latestRun ? (
            <p className="text-sm text-slate-500">No scraper runs found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <StatusBadge status={latestRun.status} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Started</p>
                <p className="text-sm text-white">
                  {new Date(latestRun.startedAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Duration</p>
                <p className="text-sm text-white">
                  {latestRun.duration || computeDuration(latestRun.startedAt, latestRun.completedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Results</p>
                <div className="flex gap-3 text-sm">
                  {latestRun.servicesCreated != null && (
                    <span className="text-emerald-400">+{latestRun.servicesCreated}</span>
                  )}
                  {latestRun.servicesUpdated != null && (
                    <span className="text-amber-400">~{latestRun.servicesUpdated}</span>
                  )}
                  {latestRun.servicesDeactivated != null && (
                    <span className="text-red-400">-{latestRun.servicesDeactivated}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run History */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !data?.runs?.length ? (
            <p className="text-sm text-slate-500 text-center py-4">No runs recorded.</p>
          ) : (
            <div className="border border-slate-700 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50">
                    <th className="w-8" />
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Status</th>
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Started</th>
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Duration</th>
                    <th className="text-right px-3 py-2 text-slate-300 font-medium">Created</th>
                    <th className="text-right px-3 py-2 text-slate-300 font-medium">Updated</th>
                    <th className="text-right px-3 py-2 text-slate-300 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((run) => {
                    const isExpanded = expandedId === run.id;
                    const hasErrors = (run.errorCount ?? 0) > 0 || (run.errors?.length ?? 0) > 0;
                    return (
                      <React.Fragment key={run.id}>
                        <tr
                          className={cn(
                            "border-t border-slate-700 cursor-pointer hover:bg-slate-700/30",
                            isExpanded && "bg-slate-700/20"
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : run.id)}
                        >
                          <td className="px-2 py-2">
                            {hasErrors ? (
                              isExpanded ?
                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> :
                                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                            ) : <span className="w-3.5" />}
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={run.status} /></td>
                          <td className="px-3 py-2 text-slate-300">
                            {new Date(run.startedAt).toLocaleDateString()}{" "}
                            <span className="text-slate-500">
                              {new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {run.duration || computeDuration(run.startedAt, run.completedAt)}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-400">
                            {run.servicesCreated ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-400">
                            {run.servicesUpdated ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-red-400">
                            {run.errorCount ?? run.errors?.length ?? 0}
                          </td>
                        </tr>
                        {isExpanded && hasErrors && (
                          <tr>
                            <td colSpan={7} className="px-6 py-3 bg-slate-900/50">
                              <p className="text-xs font-medium text-slate-400 mb-2">Errors:</p>
                              <div className="space-y-1 max-h-48 overflow-auto">
                                {(run.errors ?? []).map((err, i) => (
                                  <p key={i} className="text-xs text-red-400 font-mono">{err}</p>
                                ))}
                                {!run.errors?.length && (
                                  <p className="text-xs text-slate-500">
                                    {run.errorCount} error(s) occurred. See server logs for details.
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-700 text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        Completed
      </Badge>
    );
  }
  if (s === "running" || s === "in_progress") {
    return (
      <Badge className="bg-blue-600/20 text-blue-400 border-blue-700 text-xs">
        <Clock className="h-3 w-3 mr-1 animate-pulse" />
        Running
      </Badge>
    );
  }
  if (s === "failed" || s === "error") {
    return (
      <Badge className="bg-red-600/20 text-red-400 border-red-700 text-xs">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  }
  if (s === "partial") {
    return (
      <Badge className="bg-amber-600/20 text-amber-400 border-amber-700 text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Partial
      </Badge>
    );
  }
  return <Badge className="bg-slate-600/20 text-slate-400 border-slate-600 text-xs">{status}</Badge>;
}

function computeDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return "In progress";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
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
