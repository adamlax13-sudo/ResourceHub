import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MousePointerClick, Search, Building2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TimeRange = 7 | 30 | 90;

// ---------- API response types ----------

interface OverviewData {
  totalClicks: number;
  uniqueQueries: number;
  uniqueServicesClicked: number;
  avgClickPosition: number | null;
  avgResultCount: number | null;
}

interface TrendEntry {
  date: string;
  clicks: number;
  uniqueQueries: number;
}

interface CategoryEntry {
  category: string;
  clicks: number;
}

interface HourEntry {
  hour: number;
  clicks: number;
}

interface PositionEntry {
  position: number;
  clicks: number;
}

interface SearchEntry {
  query: string;
  searchCount: number;
  clickCount: number;
  lastSearched: string;
}

interface ServiceEntry {
  serviceId: string;
  serviceName: string;
  category: string;
  clickCount: number;
  lastClicked: string;
}

// ---------- Helpers ----------

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-400 text-center py-8">{message}</p>;
}

// Shared tooltip style
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

// ---------- Component ----------

export default function Analytics() {
  const [days, setDays] = useState<TimeRange>(30);

  // Fetch all data independently
  const { data: overviewData, isPending: overviewLoading } = useQuery<{
    success: boolean;
    overview: OverviewData;
  }>({
    queryKey: ["/api/admin/analytics/overview", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/overview?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: trendsData, isPending: trendsLoading } = useQuery<{
    success: boolean;
    trends: TrendEntry[];
  }>({
    queryKey: ["/api/admin/analytics/trends", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/trends?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: categoriesData, isPending: categoriesLoading } = useQuery<{
    success: boolean;
    categories: CategoryEntry[];
  }>({
    queryKey: ["/api/admin/analytics/categories", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/categories?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: hoursData, isPending: hoursLoading } = useQuery<{
    success: boolean;
    hours: HourEntry[];
  }>({
    queryKey: ["/api/admin/analytics/hours", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/hours?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: positionsData, isPending: positionsLoading } = useQuery<{
    success: boolean;
    positions: PositionEntry[];
  }>({
    queryKey: ["/api/admin/analytics/positions", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/positions?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: searchData, isPending: searchLoading } = useQuery<{
    success: boolean;
    searches: SearchEntry[];
  }>({
    queryKey: ["/api/admin/analytics/searches", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/searches?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: serviceData, isPending: serviceLoading } = useQuery<{
    success: boolean;
    services: ServiceEntry[];
  }>({
    queryKey: ["/api/admin/analytics/services", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/services?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  // Derived data
  const overview = overviewData?.overview;
  const trends = trendsData?.trends ?? [];
  const categories = categoriesData?.categories ?? [];
  const maxCategoryClicks = categories.length > 0 ? categories[0].clicks : 1;

  // Fill missing hours (0-23) with 0 clicks
  const hoursRaw = hoursData?.hours ?? [];
  const hoursMap = new Map(hoursRaw.map((h) => [h.hour, h.clicks]));
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, "0")}:00`,
    clicks: hoursMap.get(i) ?? 0,
  }));

  const positions = positionsData?.positions ?? [];
  const searches = searchData?.searches ?? [];
  const services = serviceData?.services ?? [];

  // Format trend dates for display
  const trendChart = trends.map((t) => ({
    ...t,
    label: new Date(t.date + "T00:00:00").toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header + Time Range */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {([7, 30, 90] as TimeRange[]).map((d) => (
            <Button
              key={d}
              variant="ghost"
              size="sm"
              onClick={() => setDays(d)}
              className={cn(
                "h-7 px-3 text-xs font-medium",
                days === d
                  ? "bg-teal-500 text-white shadow-sm hover:bg-teal-600 hover:text-white"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Total Clicks"
          value={overview ? formatNumber(overview.totalClicks) : "--"}
          loading={overviewLoading}
        />
        <StatCard
          icon={<Search className="h-4 w-4" />}
          label="Unique Queries"
          value={overview ? formatNumber(overview.uniqueQueries) : "--"}
          loading={overviewLoading}
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Services Clicked"
          value={overview ? formatNumber(overview.uniqueServicesClicked) : "--"}
          loading={overviewLoading}
        />
        <StatCard
          icon={<ArrowDown className="h-4 w-4" />}
          label="Avg Click Position"
          value={overview?.avgClickPosition != null ? overview.avgClickPosition.toFixed(1) : "--"}
          loading={overviewLoading}
        />
      </div>

      {/* Daily Trend */}
      <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-gray-900">
            Daily Click Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <Spinner />
          ) : trendChart.length === 0 ? (
            <EmptyState message="No trend data for this period." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendChart}>
                <defs>
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#tealGradient)"
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

      {/* Two-column row: Category Distribution + Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <Spinner />
            ) : categories.length === 0 ? (
              <EmptyState message="No category data for this period." />
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {categories.map((cat) => {
                  const pct = Math.round((cat.clicks / maxCategoryClicks) * 100);
                  const colorClasses = getCategoryColor(cat.category);
                  // Extract text color for the bar
                  const textColor = colorClasses.split(" ").find((c) => c.startsWith("text-")) ?? "text-gray-600";
                  const bgColor = colorClasses.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-gray-100";
                  return (
                    <div key={cat.category} className="group">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={cn("text-xs font-medium truncate max-w-[200px]", textColor)}>
                          {cat.category}
                        </span>
                        <span className="text-xs text-gray-400 ml-2 tabular-nums">
                          {cat.clicks}
                        </span>
                      </div>
                      <div className="w-full bg-gray-50 rounded-full h-2">
                        <div
                          className={cn("h-2 rounded-full transition-all", bgColor)}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Peak Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hoursLoading ? (
              <Spinner />
            ) : (
              <ResponsiveContainer width="100%" height={360}>
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
      </div>

      {/* Two-column row: Top Queries + Click Position */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Search Queries */}
        <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Top Search Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchLoading ? (
              <Spinner />
            ) : searches.length === 0 ? (
              <EmptyState message="No search data for this period." />
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">
                          Query
                        </th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                          Searches
                        </th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                          Clicks
                        </th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-16">
                          CTR
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {searches.map((s, i) => {
                        const ctr =
                          s.searchCount > 0
                            ? ((s.clickCount / s.searchCount) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <tr
                            key={i}
                            className="border-t border-gray-100 hover:bg-gray-50/50"
                          >
                            <td className="px-3 py-2 text-gray-900 truncate max-w-[220px]">
                              {s.query || "(empty)"}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                              {s.searchCount}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                              {s.clickCount}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-400 tabular-nums">
                              {ctr}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Click Position Distribution */}
        <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Click Position Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {positionsLoading ? (
              <Spinner />
            ) : positions.length === 0 ? (
              <EmptyState message="No click position data for this period." />
            ) : (
              <ResponsiveContainer width="100%" height={360}>
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
      </div>

      {/* Two-column row: Most Clicked Services + Least Clicked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Clicked Services */}
        <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Most Clicked Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            {serviceLoading ? (
              <Spinner />
            ) : services.length === 0 ? (
              <EmptyState message="No service click data for this period." />
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">
                          Service
                        </th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-32">
                          Category
                        </th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                          Clicks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.slice(0, 25).map((s, i) => (
                        <tr
                          key={i}
                          className="border-t border-gray-100 hover:bg-gray-50/50"
                        >
                          <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]">
                            {s.serviceName || `Service ${s.serviceId}`}
                          </td>
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

        {/* Least Clicked Services (bottom of the list, 1-2 clicks) */}
        <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Least Clicked Services
            </CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">
              Active services with fewest clicks — may need better categorization
            </p>
          </CardHeader>
          <CardContent>
            {serviceLoading ? (
              <Spinner />
            ) : services.length === 0 ? (
              <EmptyState message="No service data for this period." />
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">
                          Service
                        </th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-32">
                          Category
                        </th>
                        <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                          Clicks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...services]
                        .reverse()
                        .slice(0, 25)
                        .map((s, i) => (
                          <tr
                            key={i}
                            className="border-t border-gray-100 hover:bg-gray-50/50"
                          >
                            <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]">
                              {s.serviceName || `Service ${s.serviceId}`}
                            </td>
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
      </div>
    </div>
  );
}

// ---------- Stat Card sub-component ----------

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-teal-500">{icon}</div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {label}
          </span>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
        ) : (
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
