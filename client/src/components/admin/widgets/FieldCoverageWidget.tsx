import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function FieldCoverageWidget() {
  const { data, isPending } = useQuery<{ success: boolean; summary: Record<string, number> }>({
    queryKey: ["/api/admin/quality/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/quality/summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  const totalFields = data?.summary ? Object.keys(data.summary).length : 0;
  const fieldsAbove80 = data?.summary
    ? Object.values(data.summary).filter((pct) => pct >= 80).length
    : 0;
  const percentage = totalFields > 0 ? Math.round((fieldsAbove80 / totalFields) * 100) : 0;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-gray-900">Field Coverage</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !data?.summary ? (
          <p className="text-sm text-gray-400 py-4 text-center">No coverage data available</p>
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
                  stroke={percentage >= 70 ? "#10b981" : percentage >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3"
                  strokeDasharray={`${(percentage / 100) * 97.4} 97.4`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">
                  {fieldsAbove80}
                  <span className="text-sm font-normal text-gray-400"> / {totalFields}</span>
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-500 text-center">fields above 80%</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
