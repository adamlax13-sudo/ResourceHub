import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Shield,
  BarChart3,
  Flag,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";
import { InfoTip } from "@/components/admin/InfoTip";
import { useToast } from "@/hooks/use-toast";

// ---------- Constants ----------

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
  low: "bg-muted text-muted-foreground border-border",
};

const SEVERITY_BAR_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
};

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


// ---------- Types ----------

interface IssueEntry {
  service: { id: number; name: string; category: string; confidenceScore: number | null };
  severity: string;
  missingFields: string[];
}

// ---------- Helpers ----------

function barColor(pct: number): string {
  if (pct >= 95) return "bg-primary";
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function barTextColor(pct: number): string {
  if (pct >= 95) return "text-primary";
  if (pct >= 80) return "text-emerald-700";
  if (pct >= 50) return "text-amber-700";
  return "text-red-700";
}

// ---------- Stat Card ----------

function StatCard({
  icon,
  label,
  value,
  subtitle,
  loading,
  color = "teal",
  titleExtra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  loading: boolean;
  color?: "teal" | "red" | "amber" | "emerald";
  titleExtra?: React.ReactNode;
}) {
  const iconColors: Record<string, string> = {
    teal: "text-primary",
    red: "text-red-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  };
  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={iconColors[color]}>{icon}</div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}{titleExtra}
          </span>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
        ) : (
          <>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Main Component ----------

export default function Quality() {
  const [fieldFilter, setFieldFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [hideComplete, setHideComplete] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [issuePage, setIssuePage] = useState(1);
  const [issuesPerPage, setIssuesPerPage] = useState(50);
  const [flaggingId, setFlaggingId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch IDs already flagged for review so flags persist across navigations
  const { data: flaggedData } = useQuery<{
    success: boolean;
    changeRequests: { serviceId?: number }[];
  }>({
    queryKey: ["/api/admin/review", "flagged-ids"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/review?changeType=review&status=pending&limit=200");
      return res.json();
    },
    staleTime: 30_000,
  });
  const flaggedIds = new Set(
    (flaggedData?.changeRequests ?? [])
      .map((r) => r.serviceId)
      .filter((id): id is number => id != null)
  );

  const handleFlag = useCallback(async (serviceId: number, serviceName: string, missingFields: string[]) => {
    setFlaggingId(serviceId);
    try {
      const res = await apiRequest("POST", "/api/admin/review/flag", {
        serviceId,
        reason: `Quality issues: missing ${missingFields.map(f => FIELD_LABELS[f] || f).join(", ")}`,
        missingFields,
      });
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/review", "flagged-ids"] });
        toast({ title: "Flagged for review", description: serviceName });
      }
    } catch {
      toast({ title: "Failed to flag", description: "Try again", variant: "destructive" });
    } finally {
      setFlaggingId(null);
    }
  }, [toast]);

  // ---------- Queries ----------

  const { data: summaryData, isPending: summaryLoading, dataUpdatedAt } = useQuery<{
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
    issues: IssueEntry[];
    total: number;
  }>({
    queryKey: ["/api/admin/quality/issues", issuePage, issuesPerPage],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/quality/issues?page=${issuePage}&limit=${issuesPerPage}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  // ---------- Derived data ----------

  const summary = summaryData?.summary;
  const allIssues = issuesData?.issues ?? [];

  // Field coverage bars
  const fieldBars = summary
    ? Object.entries(summary)
        .filter(([key]) => FIELD_LABELS[key])
        .map(([key, pct]) => ({ key, label: FIELD_LABELS[key], pct: Math.round(pct as number) }))
        .sort((a, b) => a.pct - b.pct)
    : [];

  const displayBars = hideComplete
    ? fieldBars.filter((b) => b.pct < 100)
    : fieldBars;

  // Overall score (weighted average of field coverages)
  const overallScore = fieldBars.length > 0
    ? Math.round(fieldBars.reduce((sum, b) => sum + b.pct, 0) / fieldBars.length)
    : 0;

  // Fields below 90%
  const fieldsBelowThreshold = fieldBars.filter((b) => b.pct < 90).length;

  // Severity counts
  const severityCounts = { critical: 0, high: 0, medium: 0 };
  for (const issue of allIssues) {
    if (issue.severity in severityCounts) {
      severityCounts[issue.severity as keyof typeof severityCounts]++;
    }
  }
  const totalSeverity = severityCounts.critical + severityCounts.high + severityCounts.medium;

  // Field issue counts (how many services are missing each field)
  const fieldIssueCounts: Record<string, number> = {};
  for (const issue of allIssues) {
    for (const field of issue.missingFields) {
      fieldIssueCounts[field] = (fieldIssueCounts[field] ?? 0) + 1;
    }
  }

  // Category quality breakdown
  const categoryIssues: Record<string, number> = {};
  for (const issue of allIssues) {
    const cat = issue.service.category;
    categoryIssues[cat] = (categoryIssues[cat] ?? 0) + 1;
  }
  const categoryBreakdown = Object.entries(categoryIssues)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);
  const maxCategoryIssues = categoryBreakdown.length > 0 ? categoryBreakdown[0][1] : 1;

  // Filtered + searched issues
  const filteredIssues = allIssues.filter((issue) => {
    if (fieldFilter && !issue.missingFields.includes(fieldFilter)) return false;
    if (severityFilter && issue.severity !== severityFilter) return false;
    return true;
  });

  const searchedIssues = filteredIssues.filter((issue) =>
    !issueSearch || issue.service.name.toLowerCase().includes(issueSearch.toLowerCase())
  );


  // ---------- Handlers ----------

  const handleFieldClick = (fieldKey: string) => {
    setFieldFilter(fieldFilter === fieldKey ? "" : fieldKey);
    setTimeout(() => {
      document.getElementById("issues-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSeverityClick = (severity: string) => {
    setSeverityFilter(severityFilter === severity ? "" : severity);
    setTimeout(() => {
      document.getElementById("issues-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // ---------- Render ----------

  const loading = summaryLoading || issuesLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Data Quality</h2>
        {dataUpdatedAt > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* 1. Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          label="Overall Score"
          value={loading ? "--" : `${overallScore}%`}
          subtitle={loading ? undefined : overallScore >= 90 ? "Good" : overallScore >= 70 ? "Needs attention" : "Poor"}
          loading={loading}
          color={overallScore >= 90 ? "emerald" : overallScore >= 70 ? "amber" : "red"}
          titleExtra={<InfoTip text="Average coverage across all 17 tracked fields. The Dashboard score only checks 8 core contact fields, so it may differ." />}
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Critical Issues"
          value={loading ? "--" : String(severityCounts.critical)}
          subtitle={loading ? undefined : severityCounts.critical === 0 ? "None" : "Needs fixing"}
          loading={loading}
          color={severityCounts.critical > 0 ? "red" : "emerald"}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Services with Issues"
          value={loading ? "--" : String(issuesData?.total ?? allIssues.length)}
          loading={loading}
          color="amber"
          titleExtra={<InfoTip text="Services missing critical data like phone, email, website, or description. These may appear incomplete to users." />}
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Fields Below 90%"
          value={loading ? "--" : String(fieldsBelowThreshold)}
          subtitle={loading ? undefined : `of ${fieldBars.length} tracked`}
          loading={loading}
          color={fieldsBelowThreshold > 3 ? "red" : fieldsBelowThreshold > 0 ? "amber" : "emerald"}
        />
      </div>

      {/* 2. Field Coverage */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base">Field Coverage</CardTitle>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideComplete}
                onChange={(e) => setHideComplete(e.target.checked)}
                className="rounded border-border"
              />
              Hide complete fields
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayBars.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {hideComplete ? "All fields at 100% coverage." : "No field data available."}
            </p>
          ) : (
            <div className="space-y-3">
              {displayBars.map((bar) => {
                const issueCount = fieldIssueCounts[bar.key] ?? 0;
                return (
                  <div
                    key={bar.key}
                    className={cn(
                      "space-y-1 cursor-pointer rounded px-2 py-1.5 -mx-2 transition-colors",
                      fieldFilter === bar.key ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted"
                    )}
                    onClick={() => handleFieldClick(bar.key)}
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">
                        {bar.label}
                        {bar.key === "embeddingFresh" && (
                          <InfoTip text="Percentage of embedded services whose embedding is up-to-date (generated after last data update)." />
                        )}
                        {bar.key === "geocodingFresh" && (
                          <InfoTip text="Percentage of geocoded services whose coordinates were set after the last data update." />
                        )}
                        {issueCount > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            {issueCount} {issueCount === 1 ? "service" : "services"}
                          </span>
                        )}
                      </span>
                      <span className={cn("font-semibold tabular-nums", barTextColor(bar.pct))}>
                        {bar.pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", barColor(bar.pct))}
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Severity Breakdown */}
      {totalSeverity > 0 && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">Severity Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Severity labels */}
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              {(["critical", "high", "medium"] as const).map((severity) => {
                const count = severityCounts[severity];
                if (count === 0) return null;
                return (
                  <button
                    key={severity}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer",
                      severityFilter === severity
                        ? SEVERITY_COLORS[severity] + " ring-1 ring-offset-1"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => handleSeverityClick(severity)}
                  >
                    <span
                      className={cn("w-2.5 h-2.5 rounded-sm", SEVERITY_BAR_COLORS[severity])}
                    />
                    <span className="capitalize">{severity}</span>
                    <span className="text-muted-foreground">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Stacked bar */}
            <div className="h-4 bg-muted rounded-full overflow-hidden flex">
              {(["critical", "high", "medium"] as const).map((severity) => {
                const count = severityCounts[severity];
                if (count === 0) return null;
                const pct = (count / totalSeverity) * 100;
                return (
                  <div
                    key={severity}
                    className={cn(
                      "h-full transition-all cursor-pointer hover:opacity-80",
                      SEVERITY_BAR_COLORS[severity],
                      severityFilter === severity && "ring-2 ring-offset-1 ring-muted-foreground"
                    )}
                    style={{ width: `${pct}%` }}
                    onClick={() => handleSeverityClick(severity)}
                    title={`${severity}: ${count} issues (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Issues Table */}
      <Card id="issues-section" className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-foreground text-base">
              Issues{" "}
              {searchedIssues.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({searchedIssues.length}
                  {(fieldFilter || severityFilter || issueSearch) ? ` of ${issuesData?.total ?? allIssues.length}` : ""})
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  className="h-7 pl-7 pr-2 w-44 text-xs border-border"
                />
              </div>

              {/* Field filter */}
              <select
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
                className="h-7 rounded border border-border bg-card px-1.5 text-[11px] text-foreground"
              >
                {FIELD_FILTER_OPTIONS.map((opt) => {
                  const count = opt.value ? fieldIssueCounts[opt.value] ?? 0 : 0;
                  return (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}{opt.value && count > 0 ? ` (${count})` : ""}
                    </option>
                  );
                })}
              </select>

              {/* Severity filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="h-7 rounded border border-border bg-card px-1.5 text-[11px] text-foreground"
              >
                <option value="">All Severity</option>
                <option value="critical">Critical ({severityCounts.critical})</option>
                <option value="high">High ({severityCounts.high})</option>
                <option value="medium">Medium ({severityCounts.medium})</option>
              </select>

              {/* Clear filters */}
              {(fieldFilter || severityFilter || issueSearch) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setFieldFilter("");
                    setSeverityFilter("");
                    setIssueSearch("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {issuesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !searchedIssues.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {fieldFilter || severityFilter || issueSearch
                ? "No issues match the selected filters."
                : "No quality issues found."}
            </p>
          ) : (
            <>
              <div className="border border-border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Service
                      </th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Category
                      </th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Severity
                      </th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Missing Fields
                      </th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">
                        Confidence
                        <InfoTip text="Source confidence score -- how reliable the data source is, not how complete the data is." />
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {searchedIssues.map((issue) => (
                      <tr
                        key={issue.service.id}
                        className="border-t border-border hover:bg-muted"
                      >
                        <td className="px-3 py-2 text-foreground max-w-[180px] truncate" title={issue.service.name}>
                          {issue.service.name}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={cn(
                              "text-[10px] whitespace-nowrap",
                              getCategoryColor(issue.service.category)
                            )}
                          >
                            {issue.service.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={cn(
                              "text-[10px]",
                              SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low
                            )}
                          >
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
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-red-50 text-red-600 border-red-200"
                                )}
                                onClick={() => handleFieldClick(field)}
                              >
                                {FIELD_LABELS[field] || field}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "text-xs font-mono",
                              (issue.service.confidenceScore ?? 0) >= 70
                                ? "text-emerald-500"
                                : (issue.service.confidenceScore ?? 0) >= 40
                                  ? "text-amber-500"
                                  : "text-red-500"
                            )}
                          >
                            {issue.service.confidenceScore ?? "N/A"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleFlag(issue.service.id, issue.service.name, issue.missingFields)}
                              disabled={flaggedIds.has(issue.service.id) || flaggingId === issue.service.id}
                              title={flaggedIds.has(issue.service.id) ? "Already flagged" : "Flag for review"}
                              className={cn(
                                "transition-colors",
                                flaggedIds.has(issue.service.id)
                                  ? "text-primary cursor-default"
                                  : "text-muted-foreground hover:text-amber-500 cursor-pointer"
                              )}
                            >
                              {flaggingId === issue.service.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Flag className={cn("h-3.5 w-3.5", flaggedIds.has(issue.service.id) && "fill-primary")} />
                              )}
                            </button>
                            <Link href={`/admin/services?selected=${issue.service.id}`}>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {issuesData && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      {Math.min((issuePage - 1) * issuesPerPage + 1, issuesData.total)}–{Math.min(issuePage * issuesPerPage, issuesData.total)} of {issuesData.total} services
                    </p>
                    <select
                      value={issuesPerPage}
                      onChange={(e) => { setIssuesPerPage(Number(e.target.value)); setIssuePage(1); }}
                      className="text-xs border border-border rounded px-1.5 py-1 text-muted-foreground bg-card"
                    >
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                      <option value={200}>200 per page</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={issuePage <= 1}
                      onClick={() => setIssuePage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2 tabular-nums">
                      {issuePage} / {Math.ceil(issuesData.total / issuesPerPage)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={issuePage >= Math.ceil(issuesData.total / issuesPerPage)}
                      onClick={() => setIssuePage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 5. Category Quality Breakdown */}
      {categoryBreakdown.length > 0 && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">
              Quality by Category
              <InfoTip text="Categories sorted by number of data quality issues. Categories with more issues may need enrichment or manual review." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {categoryBreakdown.map(([category, count]) => {
                const barWidth = Math.round((count / maxCategoryIssues) * 100);
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          className={cn(
                            "text-[10px] whitespace-nowrap shrink-0",
                            getCategoryColor(category)
                          )}
                        >
                          {category}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                        {count} {count === 1 ? "issue" : "issues"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          count <= 2 ? "bg-emerald-400" : count <= 5 ? "bg-amber-400" : "bg-red-400"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
