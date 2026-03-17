import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { InfoTip } from "@/components/admin/InfoTip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PositionEntry {
  position: number;
  clicks: number;
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "#111827", fontWeight: 500 },
  itemStyle: { color: "#6b7280" },
};

export function AnalyticsClickPositionsWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    positions: PositionEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/positions", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/positions?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const positions = data?.positions ?? [];
  const chartHeight = compact ? 180 : 260;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Click Position Distribution
          <InfoTip text="Shows which result position users click on most. Position 1 means the first result shown." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : positions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No click position data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={positions.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="position"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                label={{
                  value: "Result Position",
                  position: "insideBottom",
                  offset: -5,
                  fill: "#9ca3af",
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="clicks" fill="#0d9488" radius={[3, 3, 0, 0]} name="Clicks" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
