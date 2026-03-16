import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  websiteUrl: "Website",
  address: "Address",
  description: "Description",
  hoursOfOperation: "Hours",
  eligibility: "Eligibility",
  latitude: "Geocoding",
  tags: "Tags",
  embedding: "Embedding",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600/20 text-red-400 border-red-800",
  high: "bg-orange-600/20 text-orange-400 border-orange-800",
  medium: "bg-amber-600/20 text-amber-400 border-amber-800",
  low: "bg-slate-600/20 text-slate-400 border-slate-600",
};

export default function Quality() {
  const { data: summaryData, isPending: summaryLoading } = useQuery<{
    success: boolean;
    summary: Record<string, number>;
  }>({
    queryKey: ["/api/admin/quality/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/quality/summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: issuesData, isPending: issuesLoading } = useQuery<{
    success: boolean;
    issues: Array<{
      service: { id: number; name: string; category: string; confidenceScore: number | null };
      severity: string;
      missingFields: string[];
    }>;
    total: number;
  }>({
    queryKey: ["/api/admin/quality/issues"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/quality/issues?limit=50");
      return res.json();
    },
    staleTime: 60_000,
  });

  const summary = summaryData?.summary;

  const fieldBars = summary
    ? Object.entries(summary)
        .filter(([key]) => FIELD_LABELS[key])
        .map(([key, pct]) => ({ label: FIELD_LABELS[key], pct: Math.round(pct as number) }))
        .sort((a, b) => a.pct - b.pct)
    : [];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-white">Data Quality</h2>

      {/* Scorecard */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Field Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {fieldBars.map((bar) => (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{bar.label}</span>
                    <span className="text-slate-300">{bar.pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        bar.pct >= 80 ? "bg-emerald-500" :
                        bar.pct >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${bar.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Issue Queue */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">
            Issues {issuesData?.total ? `(${issuesData.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {issuesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !issuesData?.issues?.length ? (
            <p className="text-sm text-slate-500 text-center py-4">No quality issues found.</p>
          ) : (
            <div className="border border-slate-700 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50">
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Service</th>
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Severity</th>
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Missing Fields</th>
                    <th className="text-left px-3 py-2 text-slate-300 font-medium w-20">Score</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {issuesData.issues.map((issue) => (
                    <tr key={issue.service.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                      <td className="px-3 py-2 text-white max-w-[200px] truncate">{issue.service.name}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn("text-[10px]", SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low)}>
                          {issue.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {issue.missingFields.map((field, i) => (
                            <Badge key={i} className="bg-red-600/10 text-red-400 border-red-800 text-[10px]">
                              {FIELD_LABELS[field] || field}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "text-xs font-mono",
                          (issue.service.confidenceScore ?? 0) >= 70 ? "text-emerald-400" :
                          (issue.service.confidenceScore ?? 0) >= 40 ? "text-amber-400" : "text-red-400"
                        )}>
                          {issue.service.confidenceScore ?? "N/A"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/services?selected=${issue.service.id}`}>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-500 hover:text-white cursor-pointer" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
