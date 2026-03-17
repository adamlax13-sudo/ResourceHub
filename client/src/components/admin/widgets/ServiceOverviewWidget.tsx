import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/admin/StatCard";
import { InfoTip } from "@/components/admin/InfoTip";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ClipboardCheck, Search, BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
  success: boolean;
  activeServices: number;
  pendingReviews: number;
  searchesToday: number;
  qualityScore: number;
}

export function ServiceOverviewWidget() {
  const { data: stats, isPending } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/stats");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      {/* Teal gradient banner */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-100 text-sm font-medium">Active Services</p>
            <p className="text-4xl font-bold mt-1">
              {isPending ? "..." : (stats?.activeServices ?? 0).toLocaleString()}
            </p>
            <p className="text-teal-200 text-sm mt-2">Alberta social services directory</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/services">
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/10 bg-transparent"
              >
                View All
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards row */}
      {isPending ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={i}
              className="bg-white border-gray-100 shadow-sm rounded-xl animate-pulse h-[100px]"
            >
              <CardContent className="p-5" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Pending Reviews" value={stats?.pendingReviews ?? 0} icon={ClipboardCheck} />
          <StatCard title="Searches Today" value={stats?.searchesToday ?? 0} icon={Search} />
          <StatCard
            title="Quality Score"
            value={stats?.qualityScore != null ? `${stats.qualityScore}%` : "N/A"}
            icon={BarChart3}
            titleExtra={<InfoTip text="Percentage of services that have at least a phone number, email, or website." />}
          />
        </div>
      )}
    </div>
  );
}
