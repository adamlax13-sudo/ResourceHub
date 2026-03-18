import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { InfoTip } from "@/components/admin/InfoTip";
import { getChartColors } from "@/lib/chart-theme";
import { useTheme } from "@/hooks/useTheme";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SessionEntry {
  sessionDepth: number;
  sessionCount: number;
}

export function AnalyticsSessionsWidget({ compact }: { compact?: boolean }) {
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
    sessions: SessionEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/sessions", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/sessions?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const sessions = data?.sessions ?? [];
  const chartHeight = compact ? 180 : 260;

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Session Depth
          <InfoTip text="How many searches users do per session. More 1-search sessions means users find answers quickly." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No session data available.</p>
        ) : (
          <ResponsiveContainer key={effectiveTheme} width="100%" height={chartHeight}>
            <BarChart data={sessions}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="sessionDepth"
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: chartColors.grid }}
                label={{
                  value: "Searches per session",
                  position: "insideBottom",
                  offset: -5,
                  fill: chartColors.axis,
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="sessionCount" fill={chartColors.series[1]} radius={[3, 3, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
