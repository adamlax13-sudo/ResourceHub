import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Database, ClipboardCheck, Search, BarChart3, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

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
      {/* Hero Card */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-100 text-sm font-medium">Active Services</p>
            <p className="text-4xl font-bold mt-1">
              {statsLoading ? "..." : (stats?.activeServices ?? 0).toLocaleString()}
            </p>
            <p className="text-teal-200 text-sm mt-2">Alberta social services directory</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/services">
              <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent">
                View All
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-white border-gray-100 shadow-sm rounded-xl animate-pulse h-[100px]">
              <CardContent className="p-5" />
            </Card>
          ))
        ) : (
          <>
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
      <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-gray-900 text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : !activityData?.activity?.length ? (
            <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {activityData.activity.map((entry, i) => (
                  <div
                    key={entry.id || i}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChangeTypeBadge type={entry.changeType} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {entry.serviceName || "Unknown service"}
                        </p>
                        {entry.source && (
                          <p className="text-xs text-gray-400">{entry.source}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
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
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">NEW</Badge>;
  }
  if (lower === "update" || lower === "updated") {
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">UPD</Badge>;
  }
  if (lower === "deactivate" || lower === "deactivated" || lower === "delete") {
    return <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">DEL</Badge>;
  }
  return <Badge className="bg-gray-50 text-gray-500 border-gray-200 text-xs">{type || "?"}</Badge>;
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
