import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";
import { InfoTip } from "@/components/admin/InfoTip";

interface ServiceEntry {
  serviceId: string;
  serviceName: string;
  category: string;
  clickCount: number;
  lastClicked: string;
}

export function AnalyticsMostClickedWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    services: ServiceEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/services", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/services?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const services = data?.services ?? [];
  const displayServices = compact ? services.slice(0, 5) : services.slice(0, 10);

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Most Clicked Services
          <InfoTip text="Services that get the most clicks from search results." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No service click data available.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
            <div className={cn(compact ? "" : "max-h-[300px] overflow-y-auto")}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted">
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Service
                    </th>
                    {!compact && (
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-32">
                        Category
                      </th>
                    )}
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">
                      Clicks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayServices.map((s, i) => (
                    <tr
                      key={i}
                      className="border-t border-border hover:bg-muted/50"
                    >
                      <td className="px-3 py-2 text-foreground truncate max-w-[200px]">
                        {s.serviceName || `Service ${s.serviceId}`}
                      </td>
                      {!compact && (
                        <td className="px-3 py-2">
                          {s.category ? (
                            <span
                              className={cn(
                                "inline-block px-2 py-0.5 text-[10px] font-medium rounded-full border truncate max-w-[120px]",
                                getCategoryColor(s.category)
                              )}
                            >
                              {s.category}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">--</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                        {s.clickCount}
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
