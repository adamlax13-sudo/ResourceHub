import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ActivityEntry {
  id: number;
  name: string;
  serviceId: string;
  changeType: string;
  recordedAt: string;
  category?: string;
  changedFields?: any;
}

export function RecentActivityWidget() {
  const { data, isPending } = useQuery<{ success: boolean; activity: ActivityEntry[] }>({
    queryKey: ["/api/admin/activity"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/activity?limit=20");
      return res.json();
    },
    staleTime: 30_000,
  });

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !data?.activity?.length ? (
          <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {data.activity.map((entry, i) => (
                <div
                  key={entry.id || i}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChangeTypeBadge type={entry.changeType} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {entry.name || "Unknown service"}
                      </p>
                      {entry.category && (
                        <p className="text-xs text-gray-400">{entry.category}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                    {formatRelativeTime(entry.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeTypeBadge({ type }: { type: string }) {
  const lower = type?.toLowerCase();
  if (lower === "create" || lower === "created" || lower === "bulk_insert" || lower === "bulk insert") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">ADDED</Badge>
    );
  }
  if (lower === "update" || lower === "updated" || lower === "enriched" || lower === "restored") {
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">UPD</Badge>;
  }
  if (
    lower === "deactivate" ||
    lower === "deactivated" ||
    lower === "delete"
  ) {
    return <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">DEL</Badge>;
  }
  return (
    <Badge className="bg-gray-50 text-gray-500 border-gray-200 text-xs">{type || "?"}</Badge>
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
