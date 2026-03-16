import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Database, ClipboardCheck, Search, BarChart3, Loader2 } from "lucide-react";

interface DashboardStats {
  success: boolean;
  activeServices: number;
  pendingReviews: number;
  searchesToday: number;
  qualityScore: number;
}

interface ActivityEntry {
  id: number;
  serviceName: string;
  changeType: string;
  changedAt: string;
  source?: string;
}

export default function Dashboard() {
  const { data: stats, isPending: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/stats");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: activityData, isPending: activityLoading } = useQuery<{ success: boolean; activity: ActivityEntry[] }>({
    queryKey: ["/api/admin/activity"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/activity?limit=20");
      return res.json();
    },
    staleTime: 30_000,
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-white">Dashboard</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse h-[100px]">
              <CardContent className="p-5" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Active Services"
              value={stats?.activeServices ?? 0}
              icon={Database}
            />
            <StatCard
              title="Pending Reviews"
              value={stats?.pendingReviews ?? 0}
              icon={ClipboardCheck}
            />
            <StatCard
              title="Searches Today"
              value={stats?.searchesToday ?? 0}
              icon={Search}
            />
            <StatCard
              title="Quality Score"
              value={stats?.qualityScore != null ? `${stats.qualityScore}%` : "N/A"}
              icon={BarChart3}
            />
          </>
        )}
      </div>

      {/* Activity Feed */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !activityData?.activity?.length ? (
            <p className="text-sm text-slate-500 py-4 text-center">No recent activity</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {activityData.activity.map((entry, i) => (
                  <div
                    key={entry.id || i}
                    className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChangeTypeBadge type={entry.changeType} />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">
                          {entry.serviceName || "Unknown service"}
                        </p>
                        {entry.source && (
                          <p className="text-xs text-slate-500">{entry.source}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-3">
                      {formatRelativeTime(entry.changedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChangeTypeBadge({ type }: { type: string }) {
  const lower = type?.toLowerCase();
  if (lower === "create" || lower === "created") {
    return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-700 text-xs">NEW</Badge>;
  }
  if (lower === "update" || lower === "updated") {
    return <Badge className="bg-amber-600/20 text-amber-400 border-amber-700 text-xs">UPD</Badge>;
  }
  if (lower === "deactivate" || lower === "deactivated" || lower === "delete") {
    return <Badge className="bg-red-600/20 text-red-400 border-red-700 text-xs">DEL</Badge>;
  }
  return <Badge className="bg-slate-600/20 text-slate-400 border-slate-600 text-xs">{type || "?"}</Badge>;
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
