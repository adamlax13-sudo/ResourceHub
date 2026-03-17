import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare } from "lucide-react";

interface FeedbackEntry {
  id: number;
  message: string;
  category: string | null;
  createdAt: string;
  email?: string;
}

export function RecentFeedbackWidget() {
  const { data, isPending } = useQuery<{ success: boolean; feedback: FeedbackEntry[]; total: number }>({
    queryKey: ["/api/admin/feedback"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/feedback");
      return res.json();
    },
    staleTime: 60_000,
  });

  const items = data?.feedback?.slice(0, 5) ?? [];

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-gray-900">Recent Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-gray-400">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No feedback yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                <p className="text-sm text-gray-900 line-clamp-2">{item.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {item.category && (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      {item.category}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
