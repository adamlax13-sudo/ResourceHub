import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface SystemStatus {
  success: boolean;
  status: {
    activeServices: number;
    embeddingCoverage: number;
    [key: string]: unknown;
  };
}

export function EmbeddingCoverageWidget() {
  const { data, isPending } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/system/status");
      return res.json();
    },
    staleTime: 60_000,
  });

  const coverage = data?.status?.embeddingCoverage ?? 0;
  const pct = Math.round(coverage);

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-foreground">Embedding Coverage</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.status ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No status data available</p>
        ) : (
          <div className="flex flex-col items-center py-2">
            {/* Ring visualization */}
            <div className="relative w-24 h-24 mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={pct >= 90 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3"
                  strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{pct}%</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">services with embeddings</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
