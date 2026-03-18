import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/admin/InfoTip";

interface NoClickEntry {
  query: string;
  resultCount: number;
  searchCount: number;
}

export function AnalyticsUnmetNeedsWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    noClicks: NoClickEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/no-clicks", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/no-clicks?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const noClicks = data?.noClicks ?? [];
  const displayNoClicks = compact ? noClicks.slice(0, 5) : noClicks.slice(0, 10);

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Unmet Search Needs
          <InfoTip text="Searches where users found results but did not click -- signals content gaps or poor ranking." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : noClicks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No unmet-need data available.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className={cn(compact ? "" : "max-h-[300px] overflow-y-auto")}>
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
                      Results
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayNoClicks.map((entry, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/50">
                      <td className="px-3 py-2 text-foreground truncate max-w-[220px]">
                        {entry.query || "(empty)"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                        {entry.searchCount}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                        {entry.resultCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
