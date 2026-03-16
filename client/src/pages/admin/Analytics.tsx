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
        <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>

        {/* Time Range */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {([7, 30, 90] as TimeRange[]).map((d) => (
            <Button
              key={d}
              variant="ghost"
              size="sm"
              onClick={() => setDays(d)}
              className={cn(
                "h-7 px-3 text-xs",
                days === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              )}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTab("search")}
          className={cn(
            "h-8 px-4 text-sm",
            tab === "search" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
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
            tab === "services" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          )}
        >
          Services
        </Button>
      </div>

      {/* Search Tab */}
      {tab === "search" && (
        <>
          {/* Chart */}
          <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-900 text-base">Search Volume (Top Queries)</CardTitle>
            </CardHeader>
            <CardContent>
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : searchChartData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No search data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={searchChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                      labelStyle={{ color: "#111827" }}
                      itemStyle={{ color: "#6b7280" }}
                    />
                    <Line type="monotone" dataKey="searches" stroke="#0d9488" strokeWidth={2} dot={{ fill: "#0d9488" }} />
                    <Line type="monotone" dataKey="clicks" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-900 text-base">Top Queries</CardTitle>
            </CardHeader>
            <CardContent>
              {searchLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Query</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-24">Searches</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-24">Clicks</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-24">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchData?.searches?.map((s, i) => {
                        const ctr = s.searchCount > 0
                          ? ((s.clickCount / s.searchCount) * 100).toFixed(1)
                          : "0.0";
                        return (
                          <tr key={i} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-900 truncate max-w-[300px]">{s.query || "(empty)"}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{s.searchCount}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{s.clickCount}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{ctr}%</td>
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
          <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-900 text-base">Most Clicked Services</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : serviceChartData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No service click data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={serviceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                      labelStyle={{ color: "#111827" }}
                      itemStyle={{ color: "#6b7280" }}
                    />
                    <Line type="monotone" dataKey="clicks" stroke="#0d9488" strokeWidth={2} dot={{ fill: "#0d9488" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-900 text-base">Most Clicked Services</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Service</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-24">Clicks</th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-36">Last Clicked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceData?.services?.map((s, i) => (
                        <tr key={i} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900 truncate max-w-[300px]">
                            {s.serviceName || `Service ${s.serviceId}`}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{s.clickCount}</td>
                          <td className="px-3 py-2 text-right text-gray-500 text-xs">
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
