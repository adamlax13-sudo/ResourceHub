import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { InfoTip } from "@/components/admin/InfoTip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TrendEntry {
  date: string;
  clicks: number;
  uniqueQueries: number;
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

export function AnalyticsDailyTrendWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    trends: TrendEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/trends", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/trends?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const trends = data?.trends ?? [];
  const trendChart = trends.map((t) => ({
    ...t,
    label: new Date(t.date + "T00:00:00").toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    }),
  }));

  const chartHeight = compact ? 180 : 260;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Daily Click Trend
          <InfoTip text="Click and query volume over the last 7 days." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : trendChart.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No trend data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={trendChart}>
              <defs>
                <linearGradient id="tealGradientWidget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone"
                dataKey="clicks"
                stroke="#14b8a6"
                strokeWidth={2}
                fill="url(#tealGradientWidget)"
                name="Clicks"
              />
              <Area
                type="monotone"
                dataKey="uniqueQueries"
                stroke="#94a3b8"
                strokeWidth={1.5}
                fill="none"
                strokeDasharray="4 4"
                name="Unique Queries"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
