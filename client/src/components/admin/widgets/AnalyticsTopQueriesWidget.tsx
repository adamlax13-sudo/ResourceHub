import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/admin/InfoTip";

interface SearchEntry {
  query: string;
  searchCount: number;
  clickCount: number;
  lastSearched: string;
}

export function AnalyticsTopQueriesWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    searches: SearchEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/searches", "days=7", "limit=10"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/searches?days=7&limit=10");
      return res.json();
    },
    staleTime: 60_000,
  });

  const searches = data?.searches ?? [];
  const displaySearches = compact ? searches.slice(0, 5) : searches;

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Top Search Queries
          <InfoTip text="Most popular search queries with click-through rates." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : searches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No search data available.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className={cn(compact ? "" : "max-h-[240px] overflow-y-auto")}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted">
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Query
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">
                      Searches
                    </th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">
                      Clicks
                    </th>
                    {!compact && (
                      <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-16">
                        CTR
                        <InfoTip text="Click-Through Rate -- percentage of searches that resulted in a click." />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displaySearches.map((s, i) => {
                    const ctr =
                      s.searchCount > 0
                        ? ((s.clickCount / s.searchCount) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr
                        key={i}
                        className="border-t border-border hover:bg-muted/50"
                      >
                        <td className="px-3 py-2 text-foreground truncate max-w-[220px]">
                          {s.query || "(empty)"}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                          {s.searchCount}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                          {s.clickCount}
                        </td>
                        {!compact && (
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                            {ctr}%
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
