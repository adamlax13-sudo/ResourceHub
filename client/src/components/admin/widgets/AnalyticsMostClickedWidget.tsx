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
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Most Clicked Services
          <InfoTip text="Services that get the most clicks from search results." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : services.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No service click data available.</p>
        ) : (
          <div className="border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
            <div className={cn(compact ? "" : "max-h-[300px] overflow-y-auto")}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">
                      Service
                    </th>
                    {!compact && (
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-32">
                        Category
                      </th>
                    )}
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                      Clicks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayServices.map((s, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 hover:bg-gray-50/50"
                    >
                      <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]">
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
                            <span className="text-xs text-gray-300">--</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
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
