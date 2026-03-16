import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Tab = "search" | "services";
type TimeRange = 7 | 30 | 90;

interface SearchEntry {
  query: string;
  searchCount: number;
  clickCount: number;
  lastSearched: string;
}

interface ServiceEntry {
  serviceId: string;
  serviceName: string;
  clickCount: number;
  lastClicked: string;
}

export default function Analytics() {
  const [tab, setTab] = useState<Tab>("search");
  const [days, setDays] = useState<TimeRange>(30);

  const { data: searchData, isPending: searchLoading } = useQuery<{
    success: boolean;
    searches: SearchEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/searches", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/searches?days=${days}`);
      return res.json();
    },
    enabled: tab === "search",
    staleTime: 60_000,
  });

  const { data: serviceData, isPending: serviceLoading } = useQuery<{
    success: boolean;
    services: ServiceEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/services", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/services?days=${days}`);
      return res.json();
    },
    enabled: tab === "services",
    staleTime: 60_000,
  });

  // Prepare chart data from search entries (aggregate by date)
  const searchChartData = searchData?.searches
    ?.slice(0, 20)
    .map((s, i) => ({
      name: s.query?.substring(0, 20) || `#${i}`,
      searches: s.searchCount,
      clicks: s.clickCount,
    })) ?? [];

  const serviceChartData = serviceData?.services
    ?.slice(0, 15)
    .map((s) => ({
      name: s.serviceName?.substring(0, 25) || `ID ${s.serviceId}`,
      clicks: s.clickCount,
    })) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Analytics</h2>

        {/* Time Range */}
        <div className="flex gap-1 bg-slate-800 rounded-md p-0.5">
          {([7, 30, 90] as TimeRange[]).map((d) => (
            <Button
              key={d}
              variant="ghost"
              size="sm"
              onClick={() => setDays(d)}
              className={cn(
                "h-7 px-3 text-xs",
                days === d ? "bg-slate-700 text-white" : "text-slate-400"
              )}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-md p-0.5 w-fit">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTab("search")}
          className={cn(
            "h-8 px-4 text-sm",
            tab === "search" ? "bg-slate-700 text-white" : "text-slate-400"
          )}
        >
          Search
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTab("services")}
          className={cn(
            "h-8 px-4 text-sm",
            tab === "services" ? "bg-slate-700 text-white" : "text-slate-400"
          )}
        >
          Services
        </Button>
      </div>

      {/* Search Tab */}
      {tab === "search" && (
        <>
          {/* Chart */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Search Volume (Top Queries)</CardTitle>
            </CardHeader>
            <CardContent>
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : searchChartData.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No search data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={searchChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                      labelStyle={{ color: "#fff" }}
                      itemStyle={{ color: "#94a3b8" }}
                    />
                    <Line type="monotone" dataKey="searches" stroke="#818cf8" strokeWidth={2} dot={{ fill: "#818cf8" }} />
                    <Line type="monotone" dataKey="clicks" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Top Queries</CardTitle>
            </CardHeader>
            <CardContent>
              {searchLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
              ) : (
                <div className="border border-slate-700 rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700/50">
                        <th className="text-left px-3 py-2 text-slate-300 font-medium">Query</th>
                        <th className="text-right px-3 py-2 text-slate-300 font-medium w-24">Searches</th>
                        <th className="text-right px-3 py-2 text-slate-300 font-medium w-24">Clicks</th>
                        <th className="text-right px-3 py-2 text-slate-300 font-medium w-24">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchData?.searches?.map((s, i) => {
                        const ctr = s.searchCount > 0
                          ? ((s.clickCount / s.searchCount) * 100).toFixed(1)
                          : "0.0";
                        return (
                          <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30">
                            <td className="px-3 py-2 text-white truncate max-w-[300px]">{s.query || "(empty)"}</td>
                            <td className="px-3 py-2 text-right text-slate-300">{s.searchCount}</td>
                            <td className="px-3 py-2 text-right text-slate-300">{s.clickCount}</td>
                            <td className="px-3 py-2 text-right text-slate-400">{ctr}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Services Tab */}
      {tab === "services" && (
        <>
          {/* Chart */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Most Clicked Services</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : serviceChartData.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No service click data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={serviceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                      labelStyle={{ color: "#fff" }}
                      itemStyle={{ color: "#94a3b8" }}
                    />
                    <Line type="monotone" dataKey="clicks" stroke="#818cf8" strokeWidth={2} dot={{ fill: "#818cf8" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Most Clicked Services</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
              ) : (
                <div className="border border-slate-700 rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700/50">
                        <th className="text-left px-3 py-2 text-slate-300 font-medium">Service</th>
                        <th className="text-right px-3 py-2 text-slate-300 font-medium w-24">Clicks</th>
                        <th className="text-right px-3 py-2 text-slate-300 font-medium w-36">Last Clicked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceData?.services?.map((s, i) => (
                        <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30">
                          <td className="px-3 py-2 text-white truncate max-w-[300px]">
                            {s.serviceName || `Service ${s.serviceId}`}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300">{s.clickCount}</td>
                          <td className="px-3 py-2 text-right text-slate-400 text-xs">
                            {s.lastClicked ? new Date(s.lastClicked).toLocaleDateString() : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
