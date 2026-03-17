import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MousePointerClick, Search, Building2, ArrowDown, RotateCcw, Download, GripVertical, EyeOff, Eye, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";
import { InfoTip } from "@/components/admin/InfoTip";
import {
  AnalyticsLayout,
  loadAnalyticsLayout,
  saveAnalyticsLayout,
  getDefaultAnalyticsLayout,
  getAnalyticsWidgetDef,
} from "@/lib/analytics-widgets";
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
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface DeviceEntry {
  device_type: string;
  clicks: number;
}

interface NoClickEntry {
  query: string;
  resultCount: number;
  searchCount: number;
}

interface SessionEntry {
  sessionDepth: number;
  sessionCount: number;
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

// Shared recharts tooltip style
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

// ---------- Widget Section Components ----------

function OverviewWidget({ overview, loading }: { overview?: OverviewData; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <AnalyticsStatCard
        icon={<MousePointerClick className="h-4 w-4" />}
        label="Total Clicks"
        value={overview ? formatNumber(overview.totalClicks) : "--"}
        loading={loading}
      />
      <AnalyticsStatCard
        icon={<Search className="h-4 w-4" />}
        label="Unique Queries"
        value={overview ? formatNumber(overview.uniqueQueries) : "--"}
        loading={loading}
      />
      <AnalyticsStatCard
        icon={<Building2 className="h-4 w-4" />}
        label="Services Clicked"
        value={overview ? formatNumber(overview.uniqueServicesClicked) : "--"}
        loading={loading}
      />
      <AnalyticsStatCard
        icon={<ArrowDown className="h-4 w-4" />}
        label={<>Avg Click Position <InfoTip text="The average position in search results where users click. Lower = users find what they need near the top." /></>}
        value={overview?.avgClickPosition != null ? overview.avgClickPosition.toFixed(1) : "--"}
        loading={loading}
      />
    </div>
  );
}

function DailyTrendWidget({ trends, loading, compact }: { trends: TrendEntry[]; loading: boolean; compact?: boolean }) {
  const trendChart = trends.map((t) => ({
    ...t,
    label: new Date(t.date + "T00:00:00").toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    }),
  }));

  const chartHeight = compact ? 200 : 280;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Daily Click Trend
          <InfoTip text="Click and query volume over the selected time period." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner />
        ) : trendChart.length === 0 ? (
          <EmptyState message="No trend data for this period." />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
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
  );
}

function CategoriesWidget({ categories, loading, compact }: { categories: CategoryEntry[]; loading: boolean; compact?: boolean }) {
  const displayCategories = compact ? categories.slice(0, 5) : categories;
  const maxCategoryClicks = displayCategories.length > 0 ? displayCategories[0].clicks : 1;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Category Distribution
          <InfoTip text="Which service categories users click on most in search results." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner />
        ) : categories.length === 0 ? (
          <EmptyState message="No category data for this period." />
        ) : (
          <div className={cn("space-y-2 pr-1", compact ? "" : "max-h-[360px] overflow-y-auto")}>
            {displayCategories.map((cat) => {
              const pct = Math.round((cat.clicks / maxCategoryClicks) * 100);
              const colorClasses = getCategoryColor(cat.category);
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
  );
}

function PeakHoursWidget({ hoursData, loading, compact }: { hoursData: HourEntry[]; loading: boolean; compact?: boolean }) {
  const hoursMap = new Map(hoursData.map((h) => [h.hour, h.clicks]));
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, "0")}:00`,
    clicks: hoursMap.get(i) ?? 0,
  }));

  const chartHeight = compact ? 200 : 360;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Peak Hours
          <InfoTip text="Hour of day (24h format) when users are most active searching." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner />
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

function TopQueriesWidget({ searches, loading, compact }: { searches: SearchEntry[]; loading: boolean; compact?: boolean }) {
  const displaySearches = compact ? searches.slice(0, 5) : searches;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Top Search Queries
          <InfoTip text="Most popular search queries with click rates." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner />
        ) : searches.length === 0 ? (
          <EmptyState message="No search data for this period." />
        ) : (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <div className={cn(compact ? "" : "max-h-[360px] overflow-y-auto")}>
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
                      <InfoTip text="Click-Through Rate -- percentage of searches for this query that resulted in a click." />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displaySearches.map((s, i) => {
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
  );
}

function ClickPositionsWidget({ positions, loading, compact }: { positions: PositionEntry[]; loading: boolean; compact?: boolean }) {
  const chartHeight = compact ? 200 : 360;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Click Position Distribution
          <InfoTip text="Shows which result position users click on most. Position 1 means the first result shown." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner />
        ) : positions.length === 0 ? (
          <EmptyState message="No click position data for this period." />
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

function MostClickedWidget({ services, loading, compact }: { services: ServiceEntry[]; loading: boolean; compact?: boolean }) {
  const displayServices = compact ? services.slice(0, 5) : services.slice(0, 25);

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Most Clicked Services
          <InfoTip text="Services that get the most clicks from search results." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner />
        ) : services.length === 0 ? (
          <EmptyState message="No service click data for this period." />
        ) : (
          <ServiceTable services={displayServices} compact={compact} />
        )}
      </CardContent>
    </Card>
  );
}

function LeastClickedWidget({ services, loading, compact }: { services: ServiceEntry[]; loading: boolean; compact?: boolean }) {
  const displayServices = compact
    ? [...services].reverse().slice(0, 5)
    : [...services].reverse().slice(0, 25);

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Least Clicked Services
          <InfoTip text="Active services that rarely get clicked -- may need better categorization." />
        </CardTitle>
        <p className="text-xs text-gray-400 mt-0.5">
          Active services with fewest clicks
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner />
        ) : services.length === 0 ? (
          <EmptyState message="No service data for this period." />
        ) : (
          <ServiceTable services={displayServices} compact={compact} />
        )}
      </CardContent>
    </Card>
  );
}

function DevicesWidget({ days, compact }: { days: number; compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    devices: DeviceEntry[];
  }>({
    queryKey: ["/api/admin/analytics/devices", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/devices?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const devices = data?.devices ?? [];
  const total = devices.reduce((sum, d) => sum + d.clicks, 0) || 1;

  const DEVICE_COLORS: Record<string, string> = {
    Desktop: "bg-teal-500",
    Mobile: "bg-violet-500",
    Tablet: "bg-amber-500",
  };

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
          <Spinner />
        ) : devices.length === 0 ? (
          <EmptyState message="No device data for this period." />
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

function NoClicksWidget({ days, compact }: { days: number; compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    noClicks: NoClickEntry[];
  }>({
    queryKey: ["/api/admin/analytics/no-clicks", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/no-clicks?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const noClicks = data?.noClicks ?? [];
  const displayNoClicks = compact ? noClicks.slice(0, 5) : noClicks;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Unmet Search Needs
          <InfoTip text="Searches where users found results but did not click -- signals content gaps or poor ranking." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Spinner />
        ) : noClicks.length === 0 ? (
          <EmptyState message="No unmet-need data for this period." />
        ) : (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <div className={cn(compact ? "" : "max-h-[360px] overflow-y-auto")}>
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
                      Results
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayNoClicks.map((entry, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-900 truncate max-w-[220px]">
                        {entry.query || "(empty)"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                        {entry.searchCount}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400 tabular-nums">
                        {entry.resultCount}
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
  );
}

function SessionsWidget({ days, compact }: { days: number; compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    sessions: SessionEntry[];
  }>({
    queryKey: ["/api/admin/analytics/sessions", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/sessions?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const sessions = data?.sessions ?? [];
  const chartHeight = compact ? 180 : 280;

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-900">
          Session Depth
          <InfoTip text="How many searches users do per session. More 1-search sessions means users find answers quickly." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <EmptyState message="No session data for this period." />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={sessions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="sessionDepth"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                label={{
                  value: "Searches per session",
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
                width={40}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="sessionCount" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Shared sub-components ----------

function ServiceTable({ services, compact }: { services: ServiceEntry[]; compact?: boolean }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
      <div className={cn(compact ? "" : "max-h-[360px] overflow-y-auto")}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">
                Service
              </th>
              {!compact && (
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-32">
                  Category
                </th>
              )}
              <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                Clicks
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((s, i) => (
              <tr
                key={i}
                className="border-t border-gray-100 hover:bg-gray-50/50"
              >
                <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]">
                  {s.serviceName || `Service ${s.serviceId}`}
                </td>
                {!compact && (
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
                )}
                <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                  {s.clickCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsStatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
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

// ---------- Sortable Widget Wrapper ----------

function SortableWidget({ id, children, isEditing, size, onResize, onHide, sizeLocked }: {
  id: string;
  children: React.ReactNode;
  isEditing: boolean;
  size: 'small' | 'medium' | 'large';
  onResize: (size: 'small' | 'medium' | 'large') => void;
  onHide: () => void;
  sizeLocked?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const colSpan = size === 'large' ? 'col-span-6'
    : size === 'medium' ? 'col-span-6 lg:col-span-3'
    : 'col-span-6 sm:col-span-3 lg:col-span-2';

  return (
    <div ref={setNodeRef} style={style} className={colSpan}>
      <div className="relative">
        {isEditing && (
          <>
            {/* Edit overlay border */}
            <div className="absolute inset-0 z-10 border-2 border-dashed border-teal-300 rounded-xl pointer-events-none" />

            {/* Top bar with controls */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-1.5 bg-white/90 backdrop-blur-sm rounded-t-xl border-b border-teal-200">
              {/* Drag handle */}
              <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
                <GripVertical className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Size buttons */}
                {!sizeLocked && (
                  <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                    {(['small', 'medium', 'large'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => onResize(s)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors",
                          size === s
                            ? "bg-teal-500 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        )}
                      >
                        {s === 'small' ? 'S' : s === 'medium' ? 'M' : 'L'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Hide button */}
                {!sizeLocked && (
                  <button onClick={onHide} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <div className={isEditing ? "pt-8" : ""}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Widget Grid with DnD ----------

function AnalyticsWidgetGrid({
  layout,
  editMode,
  days,
  overviewData,
  overviewLoading,
  trendsData,
  trendsLoading,
  categoriesData,
  categoriesLoading,
  hoursData,
  hoursLoading,
  positionsData,
  positionsLoading,
  searchData,
  searchLoading,
  serviceData,
  serviceLoading,
  onResize,
  onHide,
  onRestore,
  onDragEnd,
}: {
  layout: AnalyticsLayout;
  editMode: boolean;
  days: number;
  overviewData?: OverviewData;
  overviewLoading: boolean;
  trendsData: TrendEntry[];
  trendsLoading: boolean;
  categoriesData: CategoryEntry[];
  categoriesLoading: boolean;
  hoursData: HourEntry[];
  hoursLoading: boolean;
  positionsData: PositionEntry[];
  positionsLoading: boolean;
  searchData: SearchEntry[];
  searchLoading: boolean;
  serviceData: ServiceEntry[];
  serviceLoading: boolean;
  onResize: (id: string, size: 'small' | 'medium' | 'large') => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const visibleWidgets = layout.widgets.filter((w) => w.visible);
  const hiddenWidgets = layout.widgets.filter((w) => !w.visible);

  const renderWidget = (id: string, compact: boolean) => {
    switch (id) {
      case 'overview':
        return <OverviewWidget overview={overviewData} loading={overviewLoading} />;
      case 'daily-trend':
        return <DailyTrendWidget trends={trendsData} loading={trendsLoading} compact={compact} />;
      case 'categories':
        return <CategoriesWidget categories={categoriesData} loading={categoriesLoading} compact={compact} />;
      case 'peak-hours':
        return <PeakHoursWidget hoursData={hoursData} loading={hoursLoading} compact={compact} />;
      case 'top-queries':
        return <TopQueriesWidget searches={searchData} loading={searchLoading} compact={compact} />;
      case 'click-positions':
        return <ClickPositionsWidget positions={positionsData} loading={positionsLoading} compact={compact} />;
      case 'most-clicked':
        return <MostClickedWidget services={serviceData} loading={serviceLoading} compact={compact} />;
      case 'least-clicked':
        return <LeastClickedWidget services={serviceData} loading={serviceLoading} compact={compact} />;
      case 'devices':
        return <DevicesWidget days={days} compact={compact} />;
      case 'no-clicks':
        return <NoClicksWidget days={days} compact={compact} />;
      case 'sessions':
        return <SessionsWidget days={days} compact={compact} />;
      default:
        return null;
    }
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visibleWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-6 gap-4">
            {visibleWidgets.map((w) => {
              const def = getAnalyticsWidgetDef(w.id);
              const isCompact = w.size === 'small';
              return (
                <SortableWidget
                  key={w.id}
                  id={w.id}
                  isEditing={editMode}
                  size={w.size}
                  sizeLocked={def?.sizeLocked}
                  onResize={(s) => onResize(w.id, s)}
                  onHide={() => onHide(w.id)}
                >
                  {renderWidget(w.id, isCompact)}
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Hidden widgets bar (edit mode only) */}
      {editMode && hiddenWidgets.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-xs font-medium text-gray-500 mb-2">Hidden Widgets</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map(w => (
              <button
                key={w.id}
                onClick={() => onRestore(w.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
              >
                <Eye className="h-3 w-3" />
                {getAnalyticsWidgetDef(w.id)?.label || w.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Main Component ----------

export default function Analytics() {
  const [days, setDays] = useState<TimeRange>(30);
  const [layout, setLayout] = useState<AnalyticsLayout>(loadAnalyticsLayout);
  const [editMode, setEditMode] = useState(false);

  const handleLayoutChange = useCallback((next: AnalyticsLayout) => {
    setLayout(next);
    saveAnalyticsLayout(next);
  }, []);

  const handleResize = useCallback((id: string, size: 'small' | 'medium' | 'large') => {
    const def = getAnalyticsWidgetDef(id);
    if (def?.sizeLocked) return;
    const next: AnalyticsLayout = {
      widgets: layout.widgets.map((w) =>
        w.id === id ? { ...w, size } : w,
      ),
    };
    handleLayoutChange(next);
  }, [layout, handleLayoutChange]);

  const handleHide = useCallback((id: string) => {
    const next: AnalyticsLayout = {
      widgets: layout.widgets.map((w) =>
        w.id === id ? { ...w, visible: false } : w,
      ),
    };
    handleLayoutChange(next);
  }, [layout, handleLayoutChange]);

  const handleRestore = useCallback((id: string) => {
    const next: AnalyticsLayout = {
      widgets: layout.widgets.map((w) =>
        w.id === id ? { ...w, visible: true } : w,
      ),
    };
    handleLayoutChange(next);
  }, [layout, handleLayoutChange]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.widgets.findIndex(w => w.id === active.id);
      const newIndex = layout.widgets.findIndex(w => w.id === over.id);
      const newWidgets = arrayMove(layout.widgets, oldIndex, newIndex);
      handleLayoutChange({ widgets: newWidgets });
    }
  }, [layout, handleLayoutChange]);

  const handleResetLayout = useCallback(() => {
    handleLayoutChange(getDefaultAnalyticsLayout());
  }, [handleLayoutChange]);

  // Fetch all core data independently
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

  const exportCSV = useCallback(() => {
    const dateStr = new Date().toISOString().split("T")[0];

    // Top queries sheet
    const queryHeaders = ["Query", "Searches", "Clicks", "CTR"];
    const queryRows = (searchData?.searches ?? []).map((s) => [
      `"${s.query.replace(/"/g, '""')}"`,
      s.searchCount,
      s.clickCount,
      s.searchCount > 0 ? ((s.clickCount / s.searchCount) * 100).toFixed(1) + "%" : "0%",
    ]);

    // Most clicked services sheet (append below with blank separator)
    const serviceHeaders = ["Service", "Category", "Clicks"];
    const serviceRows = (serviceData?.services ?? []).slice(0, 25).map((s) => [
      `"${(s.serviceName || `Service ${s.serviceId}`).replace(/"/g, '""')}"`,
      `"${(s.category || "").replace(/"/g, '""')}"`,
      s.clickCount,
    ]);

    const csv = [
      `Analytics Export — Last ${days} Days (${dateStr})`,
      "",
      "TOP SEARCH QUERIES",
      queryHeaders.join(","),
      ...queryRows.map((r) => r.join(",")),
      "",
      "MOST CLICKED SERVICES",
      serviceHeaders.join(","),
      ...serviceRows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${days}d-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [days, searchData, serviceData]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header + Time Range + Edit Layout */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
        <div className="flex items-center gap-3">
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
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
            onClick={exportCSV}
            title="Export CSV"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          {editMode ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
                onClick={handleResetLayout}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
              <Button onClick={() => setEditMode(false)} className="bg-teal-600 hover:bg-teal-700 text-white" size="sm">
                <Check className="h-4 w-4 mr-1.5" />
                Done
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setEditMode(true)} className="text-gray-500 hover:text-gray-700" size="sm">
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit Layout
            </Button>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <Pencil className="h-4 w-4 text-teal-600 flex-shrink-0" />
          <span className="text-sm text-teal-700">
            Drag widgets to reorder &bull; Resize with S/M/L &bull; Click <EyeOff className="h-3 w-3 inline" /> to hide
          </span>
        </div>
      )}

      {/* Render widgets via grid */}
      <AnalyticsWidgetGrid
        layout={layout}
        editMode={editMode}
        days={days}
        overviewData={overviewData?.overview}
        overviewLoading={overviewLoading}
        trendsData={trendsData?.trends ?? []}
        trendsLoading={trendsLoading}
        categoriesData={categoriesData?.categories ?? []}
        categoriesLoading={categoriesLoading}
        hoursData={hoursData?.hours ?? []}
        hoursLoading={hoursLoading}
        positionsData={positionsData?.positions ?? []}
        positionsLoading={positionsLoading}
        searchData={searchData?.searches ?? []}
        searchLoading={searchLoading}
        serviceData={serviceData?.services ?? []}
        serviceLoading={serviceLoading}
        onResize={handleResize}
        onHide={handleHide}
        onRestore={handleRestore}
        onDragEnd={handleDragEnd}
      />
    </div>
  );
}
