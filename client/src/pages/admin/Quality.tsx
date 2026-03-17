import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/admin/InfoTip";

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
  lowConfidence: "Low Confidence",
  staleEmbedding: "Stale Embedding",
  staleGeocoding: "Stale Geocoding",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-50 text-gray-500 border-gray-200",
};

// All filterable field options for the issues table
const FIELD_FILTER_OPTIONS = [
  { value: "", label: "All Fields" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "websiteUrl", label: "Website" },
  { value: "address", label: "Address" },
  { value: "description", label: "Description" },
  { value: "hoursOfOperation", label: "Hours" },
  { value: "eligibility", label: "Eligibility" },
  { value: "waitTimes", label: "Wait Times" },
  { value: "serviceFormat", label: "Service Format" },
  { value: "processSteps", label: "Process Steps" },
  { value: "requiredDocs", label: "Required Docs" },
  { value: "languagesSupported", label: "Languages" },
  { value: "latitude", label: "Geocoding" },
  { value: "tags", label: "Tags" },
  { value: "embedding", label: "Embedding" },
  { value: "lowConfidence", label: "Low Confidence" },
  { value: "staleEmbedding", label: "Stale Embedding" },
  { value: "staleGeocoding", label: "Stale Geocoding" },
];

export default function Quality() {
  const [fieldFilter, setFieldFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

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
      const res = await apiRequest("GET", "/api/admin/quality/issues?limit=200");
      return res.json();
    },
    staleTime: 60_000,
  });

  const summary = summaryData?.summary;

  const fieldBars = summary
    ? Object.entries(summary)
        .filter(([key]) => FIELD_LABELS[key])
        .map(([key, pct]) => ({ key, label: FIELD_LABELS[key], pct: Math.round(pct as number) }))
        .sort((a, b) => a.pct - b.pct)
    : [];

  // Apply client-side filters to issues
  const filteredIssues = (issuesData?.issues ?? []).filter((issue) => {
    if (fieldFilter && !issue.missingFields.includes(fieldFilter)) return false;
    if (severityFilter && issue.severity !== severityFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Data Quality</h2>

      {/* Scorecard */}
      <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-gray-900 text-base">Field Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {fieldBars.map((bar) => (
                <div
                  key={bar.key}
                  className={cn(
                    "space-y-1 cursor-pointer rounded px-2 py-1 -mx-2 transition-colors",
                    fieldFilter === bar.key ? "bg-teal-50" : "hover:bg-gray-50"
                  )}
                  onClick={() => setFieldFilter(fieldFilter === bar.key ? "" : bar.key)}
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {bar.label}
                      {bar.key === "embeddingFresh" && (
                        <InfoTip text="Percentage of embedded services whose embedding is up-to-date (generated after last data update)." />
                      )}
                      {bar.key === "geocodingFresh" && (
                        <InfoTip text="Percentage of geocoded services whose coordinates were set after the last data update." />
                      )}
                    </span>
                    <span className="text-gray-700">{bar.pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
      <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 text-base">
              Issues {filteredIssues.length > 0 ? `(${filteredIssues.length}${fieldFilter || severityFilter ? ` of ${issuesData?.total ?? 0}` : ""})` : ""}
            </CardTitle>
            <div className="flex gap-2">
              <select
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
                className="h-7 rounded border border-gray-300 bg-white px-1.5 text-[11px] text-gray-700"
              >
                {FIELD_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="h-7 rounded border border-gray-300 bg-white px-1.5 text-[11px] text-gray-700"
              >
                <option value="">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {issuesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : !filteredIssues.length ? (
            <p className="text-sm text-gray-400 text-center py-4">
              {fieldFilter || severityFilter ? "No issues match the selected filters." : "No quality issues found."}
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Service</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Severity</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Missing Fields</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                      Confidence
                      <InfoTip text="Source confidence score — how reliable the data source is, not how complete the data is." />
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue) => (
                    <tr key={issue.service.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate">{issue.service.name}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn("text-[10px]", SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low)}>
                          {issue.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {issue.missingFields.map((field, i) => (
                            <Badge
                              key={i}
                              className={cn(
                                "text-[10px] cursor-pointer",
                                fieldFilter === field
                                  ? "bg-teal-50 text-teal-700 border-teal-200"
                                  : "bg-red-50 text-red-600 border-red-200"
                              )}
                              onClick={() => setFieldFilter(fieldFilter === field ? "" : field)}
                            >
                              {FIELD_LABELS[field] || field}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "text-xs font-mono",
                          (issue.service.confidenceScore ?? 0) >= 70 ? "text-emerald-500" :
                          (issue.service.confidenceScore ?? 0) >= 40 ? "text-amber-500" : "text-red-500"
                        )}>
                          {issue.service.confidenceScore ?? "N/A"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/services?selected=${issue.service.id}`}>
                          <ExternalLink className="h-3.5 w-3.5 text-gray-400 hover:text-gray-900 cursor-pointer" />
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
