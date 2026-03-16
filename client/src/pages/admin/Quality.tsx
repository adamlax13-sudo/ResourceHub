import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface QualitySummary {
  totalActive: number;
  withPhone: number;
  withEmail: number;
  withAddress: number;
  withDescription: number;
  withWebsite: number;
  withEmbedding: number;
  withGeocoding: number;
  averageConfidence: number;
}

interface QualityIssue {
  id: number;
  name: string;
  category: string;
  issues: string[];
  confidenceScore?: number;
}

export default function Quality() {
  const { data: summaryData, isPending: summaryLoading } = useQuery<{
    success: boolean;
    summary: QualitySummary;
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
    issues: QualityIssue[];
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

  // Build field bars
  const fieldBars = summary
    ? [
        { label: "Phone", value: summary.withPhone, total: summary.totalActive },
        { label: "Email", value: summary.withEmail, total: summary.totalActive },
        { label: "Address", value: summary.withAddress, total: summary.totalActive },
        { label: "Description", value: summary.withDescription, total: summary.totalActive },
        { label: "Website", value: summary.withWebsite, total: summary.totalActive },
        { label: "Embedding", value: summary.withEmbedding, total: summary.totalActive },
        { label: "Geocoding", value: summary.withGeocoding, total: summary.totalActive },
      ]
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
              {summary && (
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <p className="text-sm text-slate-400">Active Services</p>
                    <p className="text-xl font-bold text-white">{summary.totalActive}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Average Confidence</p>
                    <p className={cn(
                      "text-xl font-bold",
                      summary.averageConfidence >= 70 ? "text-emerald-400" :
                      summary.averageConfidence >= 40 ? "text-amber-400" : "text-red-400"
                    )}>
                      {summary.averageConfidence?.toFixed(0) ?? "N/A"}%
                    </p>
                  </div>
                </div>
              )}
              {fieldBars.map((bar) => {
                const pct = bar.total > 0 ? Math.round((bar.value / bar.total) * 100) : 0;
                return (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{bar.label}</span>
                      <span className="text-slate-300">
                        {bar.value} / {bar.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct >= 80 ? "bg-emerald-500" :
                          pct >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
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
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Category</th>
                    <th className="text-left px-3 py-2 text-slate-300 font-medium">Issues</th>
                    <th className="text-left px-3 py-2 text-slate-300 font-medium w-20">Score</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {issuesData.issues.map((issue) => (
                    <tr key={issue.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                      <td className="px-3 py-2 text-white max-w-[200px] truncate">{issue.name}</td>
                      <td className="px-3 py-2">
                        <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-700 text-[10px]">
                          {issue.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {issue.issues.map((iss, i) => (
                            <Badge key={i} className="bg-red-600/10 text-red-400 border-red-800 text-[10px]">
                              {iss}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "text-xs font-mono",
                          (issue.confidenceScore ?? 0) >= 70 ? "text-emerald-400" :
                          (issue.confidenceScore ?? 0) >= 40 ? "text-amber-400" : "text-red-400"
                        )}>
                          {issue.confidenceScore ?? "N/A"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/services?selected=${issue.id}`}>
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
