import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/admin/InfoTip";

interface DeviceEntry {
  device_type: string;
  clicks: number;
}

const DEVICE_COLORS: Record<string, string> = {
  Desktop: "bg-teal-500",
  Mobile: "bg-violet-500",
  Tablet: "bg-amber-500",
};

export function AnalyticsDevicesWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    devices: DeviceEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/devices", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/devices?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const devices = data?.devices ?? [];
  const total = devices.reduce((sum, d) => sum + d.clicks, 0) || 1;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Device Breakdown
          <InfoTip text="Mobile vs desktop vs tablet usage based on user-agent strings." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No device data available.</p>
        ) : (
          <div className="space-y-4">
            {/* Stacked bar */}
            <div className="h-6 rounded-full overflow-hidden flex">
              {devices.map((d) => (
                <div
                  key={d.device_type}
                  className={cn("h-full transition-all", DEVICE_COLORS[d.device_type] ?? "bg-gray-400")}
                  style={{ width: `${Math.max((d.clicks / total) * 100, 1)}%` }}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="space-y-2">
              {devices.map((d) => {
                const pct = ((d.clicks / total) * 100).toFixed(1);
                return (
                  <div key={d.device_type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-sm", DEVICE_COLORS[d.device_type] ?? "bg-gray-400")} />
                      <span className="text-sm text-gray-700">{d.device_type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {!compact && <span className="text-sm text-gray-500 tabular-nums">{d.clicks}</span>}
                      <span className="text-sm font-medium text-gray-700 tabular-nums w-14 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
