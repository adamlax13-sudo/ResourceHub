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
  waitTimes: "Wait Times",
  serviceFormat: "Service Format",
  processSteps: "Process Steps",
  requiredDocs: "Required Docs",
  languagesSupported: "Languages",
  latitude: "Geocoding",
  tags: "Tags",
  embedding: "Embedding",
  embeddingFresh: "Embeddings Fresh",
  geocodingFresh: "Geocoding Fresh",
};

/** Capitalize an unknown camelCase key as a fallback label */
function toLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

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
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-base">Quality Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.summary ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No quality data available</p>
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
    return <p className="text-sm text-muted-foreground py-4 text-center">All fields fully covered</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.map(([field, pct]) => (
        <div key={field}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">{toLabel(field)}</span>
            <span className="text-sm font-medium text-foreground">{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: pct >= 80 ? "hsl(var(--chart-1))" : pct >= 50 ? "hsl(var(--chart-3))" : "hsl(var(--destructive, 0 84% 60%))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
