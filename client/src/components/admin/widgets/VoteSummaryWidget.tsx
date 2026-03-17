import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";

interface VoteEntry {
  serviceId: number;
  serviceName: string;
  category: string;
  thumbsUp: number;
  thumbsDown: number;
  total: number;
}

export function VoteSummaryWidget() {
  const { data, isPending } = useQuery<{ success: boolean; votes: VoteEntry[] }>({
    queryKey: ["/api/admin/feedback/votes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/feedback/votes");
      return res.json();
    },
    staleTime: 60_000,
  });

  const votes = data?.votes ?? [];
  const topRated = [...votes].sort((a, b) => b.thumbsUp - a.thumbsUp).slice(0, 3);
  const needsAttention = [...votes].sort((a, b) => b.thumbsDown - a.thumbsDown).slice(0, 3);

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-gray-900">Vote Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : votes.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No vote data available</p>
        ) : (
          <div className="space-y-4">
            {/* Top Rated */}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Top Rated</p>
              <div className="space-y-1.5">
                {topRated.map((item) => (
                  <div
                    key={`up-${item.serviceId}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm text-gray-900 truncate mr-3">{item.serviceName}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">{item.thumbsUp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Needs Attention */}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Needs Attention</p>
              <div className="space-y-1.5">
                {needsAttention.map((item) => (
                  <div
                    key={`down-${item.serviceId}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm text-gray-900 truncate mr-3">{item.serviceName}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-sm font-medium text-red-600">{item.thumbsDown}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
