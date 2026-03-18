import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { InfoTip } from "@/components/admin/InfoTip";
import { getChartColors } from "@/lib/chart-theme";
import { useTheme } from "@/hooks/useTheme";
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

export function AnalyticsDailyTrendWidget({ compact }: { compact?: boolean }) {
  const { effectiveTheme } = useTheme();
  const chartColors = getChartColors();

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: chartColors.tooltip.bg,
      border: `1px solid ${chartColors.tooltip.border}`,
      borderRadius: "8px",
      fontSize: "12px",
    },
    labelStyle: { color: chartColors.tooltip.text, fontWeight: 500 },
    itemStyle: { color: chartColors.tooltip.muted },
  };

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
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Daily Click Trend
          <InfoTip text="Click and query volume over the last 7 days." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : trendChart.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No trend data available.</p>
        ) : (
          <ResponsiveContainer key={effectiveTheme} width="100%" height={chartHeight}>
            <AreaChart data={trendChart}>
              <defs>
                <linearGradient id="tealGradientWidget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="label"
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: chartColors.grid }}
              />
              <YAxis
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone"
                dataKey="clicks"
                stroke={chartColors.primary}
                strokeWidth={2}
                fill="url(#tealGradientWidget)"
                name="Clicks"
              />
              <Area
                type="monotone"
                dataKey="uniqueQueries"
                stroke={chartColors.secondary}
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
