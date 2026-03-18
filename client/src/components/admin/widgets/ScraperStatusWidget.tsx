import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot } from "lucide-react";

interface ScraperRun {
  id: number;
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: string | null;
  servicesChecked: number;
  servicesUpdated: number;
  servicesCreated: number;
  servicesDeactivated: number;
  errorsCount: number;
  durationSeconds: number | null;
}

export function ScraperStatusWidget() {
  const { data, isPending } = useQuery<{ success: boolean; runs: ScraperRun[]; total: number }>({
    queryKey: ["/api/admin/scraper/runs", "limit=1"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/scraper/runs?limit=1");
      return res.json();
    },
    staleTime: 60_000,
  });

  const run = data?.runs?.[0];

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-base">Scraper Status</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !run ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <Bot className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No scraper runs recorded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Status + date */}
            <div className="flex items-center justify-between">
              <StatusBadge status={run.status} />
              <span className="text-xs text-muted-foreground">
                {run.startedAt ? formatDate(run.startedAt) : "Unknown date"}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Checked" value={run.servicesChecked ?? 0} />
              <MiniStat label="Created" value={run.servicesCreated ?? 0} />
              <MiniStat label="Updated" value={run.servicesUpdated ?? 0} />
              <MiniStat label="Errors" value={run.errorsCount ?? 0} warn={run.errorsCount > 0} />
            </div>

            {/* Duration */}
            {run.durationSeconds != null && (
              <p className="text-xs text-muted-foreground text-right">
                Duration: {formatDuration(run.durationSeconds)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status?.toLowerCase() ?? "unknown";
  if (s === "completed" || s === "success") {
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Completed</Badge>;
  }
  if (s === "running" || s === "in_progress") {
    return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Running</Badge>;
  }
  if (s === "failed" || s === "error") {
    return <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">Failed</Badge>;
  }
  return <Badge className="bg-muted text-muted-foreground border-border text-xs">{status ?? "Unknown"}</Badge>;
}

function MiniStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="text-center py-2 rounded-lg bg-muted">
      <p className={`text-lg font-semibold ${warn ? "text-red-600" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}
