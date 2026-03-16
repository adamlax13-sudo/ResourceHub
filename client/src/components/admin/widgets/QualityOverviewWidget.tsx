import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/** Human-readable labels for the quality summary fields */
const FIELD_LABELS: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  websiteUrl: "Website",
  address: "Address",
  description: "Description",
  hoursOfOperation: "Hours",
  eligibility: "Eligibility",
  latitude: "Geocoded",
  tags: "Tags",
  embedding: "Embedding",
};

export function QualityOverviewWidget() {
  const { data, isPending } = useQuery<{ success: boolean; summary: Record<string, number> }>({
    queryKey: ["/api/admin/quality/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/quality/summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 text-base">Quality Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !data?.summary ? (
          <p className="text-sm text-gray-400 py-4 text-center">No quality data available</p>
        ) : (
          <LowestFields summary={data.summary} />
        )}
      </CardContent>
    </Card>
  );
}

/** Show the 5 fields with lowest coverage as horizontal bars */
function LowestFields({ summary }: { summary: Record<string, number> }) {
  const sorted = Object.entries(summary)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 5);

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">All fields fully covered</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.map(([field, pct]) => (
        <div key={field}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">{FIELD_LABELS[field] ?? field}</span>
            <span className="text-sm font-medium text-gray-900">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
