import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";
import { InfoTip } from "@/components/admin/InfoTip";

interface CategoryEntry {
  category: string;
  clicks: number;
}

export function AnalyticsCategoriesWidget({ compact }: { compact?: boolean }) {
  const { data, isPending } = useQuery<{
    success: boolean;
    categories: CategoryEntry[];
    days: number;
  }>({
    queryKey: ["/api/admin/analytics/categories", "days=7"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/categories?days=7");
      return res.json();
    },
    staleTime: 60_000,
  });

  const categories = data?.categories ?? [];
  const displayCategories = compact ? categories.slice(0, 5) : categories.slice(0, 10);
  const maxClicks = displayCategories.length > 0 ? displayCategories[0].clicks : 1;

  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Category Distribution
          <InfoTip text="Which service categories users click on most in search results." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No category data available.</p>
        ) : (
          <div className={cn("space-y-2 pr-1", compact ? "" : "max-h-[300px] overflow-y-auto")}>
            {displayCategories.map((cat) => {
              const pct = Math.round((cat.clicks / maxClicks) * 100);
              const colorClasses = getCategoryColor(cat.category);
              const textColor = colorClasses.split(" ").find((c) => c.startsWith("text-")) ?? "text-muted-foreground";
              const bgColor = colorClasses.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-muted";
              return (
                <div key={cat.category} className="group">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium truncate max-w-[200px] text-foreground">
                      {cat.category}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                      {cat.clicks}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
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
