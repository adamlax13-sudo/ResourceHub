import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
  success: boolean;
  activeServices: number;
  pendingReviews: number;
  searchesToday: number;
  qualityScore: number;
}

export function HeroStatsWidget() {
  const { data: stats, isPending } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/stats");
      return res.json();
    },
    staleTime: 30_000,
  });

  return (
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
  );
}
