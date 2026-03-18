import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";

interface ActivityEntry {
  id: number;
  name: string;
  serviceId: string;
  numericServiceId?: number;
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
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.activity?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
        ) : (
          <ScrollArea className="h-[220px]">
            <div className="space-y-1">
              {data.activity.map((entry, i) => {
                const href = entry.numericServiceId
                  ? `/admin/services?selected=${entry.numericServiceId}`
                  : null;

                const content = (
                  <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3 min-w-0">
                      <ChangeTypeBadge type={entry.changeType} />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {entry.name || "Unknown service"}
                        </p>
                        {entry.category && (
                          <p className="text-xs text-muted-foreground">{entry.category}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(entry.recordedAt)}
                      </span>
                      {href && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      )}
                    </div>
                  </div>
                );

                const key = `activity-${entry.id ?? i}`;
                return href ? (
                  <Link key={key} href={href}>
                    {content}
                  </Link>
                ) : (
                  <div key={key}>{content}</div>
                );
              })}
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
    <Badge className="bg-muted text-muted-foreground border-border text-xs">{type || "?"}</Badge>
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
