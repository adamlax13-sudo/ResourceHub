import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";

interface ReviewEntry {
  id: number;
  serviceId: number;
  serviceName: string;
  changeType: string;
  status: string;
  source: string;
  createdAt: string;
}

export function PendingReviewsWidget() {
  const { data, isPending } = useQuery<{ success: boolean; reviews: ReviewEntry[]; total: number }>({
    queryKey: ["/api/admin/review"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/review");
      return res.json();
    },
    staleTime: 60_000,
  });

  const pendingReviews = data?.reviews?.filter((r) => r.status === "pending") ?? [];
  const displayItems = pendingReviews.slice(0, 5);

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-foreground">Pending Reviews</CardTitle>
          {pendingReviews.length > 0 && (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              {pendingReviews.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending reviews</p>
        ) : (
          <div className="space-y-1">
            {displayItems.map((review) => (
              <Link key={review.id} href="/admin/review">
                <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3 min-w-0">
                    <ChangeTypeBadge type={review.changeType} />
                    <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {review.serviceName || "Unknown service"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(review.createdAt)}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
  if (lower === "deactivate" || lower === "deactivated" || lower === "delete") {
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
