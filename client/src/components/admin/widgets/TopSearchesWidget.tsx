import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";

interface SearchEntry {
  query: string;
  searchCount: number;
  clickCount: number;
  lastSearched: string;
}

export function TopSearchesWidget() {
  const { data, isPending } = useQuery<{ success: boolean; searches: SearchEntry[]; days: number }>({
    queryKey: ["/api/admin/analytics/searches", "days=7", "limit=5"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/searches?days=7&limit=5");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-base">Top Searches</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.searches?.length ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <Search className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No search data yet</p>
            <p className="text-xs mt-1">Queries will appear after users search</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.searches.slice(0, 5).map((entry, i) => (
              <div
                key={entry.query}
                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted transition-colors"
              >
                <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{entry.query}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-medium text-foreground">
                    {entry.searchCount}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">searches</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
