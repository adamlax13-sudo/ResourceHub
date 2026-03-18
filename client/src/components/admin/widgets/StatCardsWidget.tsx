import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardCheck, Search, BarChart3 } from "lucide-react";
import { InfoTip } from "@/components/admin/InfoTip";

interface DashboardStats {
  success: boolean;
  activeServices: number;
  pendingReviews: number;
  searchesToday: number;
  qualityScore: number;
}

export function StatCardsWidget() {
  const { data: stats, isPending } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/stats");
      return res.json();
    },
    staleTime: 30_000,
  });

  if (isPending) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card
            key={i}
            className="bg-card border-border shadow-sm rounded-xl animate-pulse h-[100px]"
          >
            <CardContent className="p-5" />
          </Card>
        ))}
      </div>
    );
  }

  return (
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
  );
}
