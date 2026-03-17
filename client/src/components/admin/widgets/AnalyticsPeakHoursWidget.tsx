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

interface HourEntry {
  hour: number;
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

export function AnalyticsPeakHoursWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    hours: HourEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/hours", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/hours?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const hoursData = data?.hours ?? [];
  const hoursMap = new Map(hoursData.map((h) => [h.hour, h.clicks]));
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, "0")}:00`,
    clicks: hoursMap.get(i) ?? 0,
  }));

  const chartHeight = compact ? 180 : 260;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Peak Hours
          <InfoTip text="Hour of day (24h format) when users are most active searching." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={hours}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                interval={2}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="clicks" fill="#14b8a6" radius={[3, 3, 0, 0]} name="Clicks" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
