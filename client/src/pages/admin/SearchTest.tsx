import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { getCategoryColor } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

interface SearchService {
  id: number;
  name: string;
  category: string;
  description?: string;
  rrfScore?: number;
  location?: string;
}

interface TestResult {
  success: boolean;
  analysis: {
    raw: string;
    corrected: string;
    normalized: string;
    keywords: string[];
    intent: string;
    intents?: { intent: string; confidence: number }[];
    location?: string;
    isCrisis: boolean;
    subIntents?: string[];
    negativeTerms?: string[];
    searcher?: string;
    targetPerson?: Record<string, unknown>;
    detections?: Record<string, unknown>;
  };
  response: {
    services: SearchService[];
    summary?: string;
    pagination?: { total: number; page: number; pageSize: number };
    searchTimeMs?: number;
    cached?: boolean;
  };
  searchTimeMs: number;
}

export default function SearchTest() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["analysis", "results"])
  );

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/search-test", { query });
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (err) => {
      toast({ title: "Search test failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) testMutation.mutate();
  };

  const analysis = result?.analysis;
  const response = result?.response;
  const services = response?.services ?? [];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Search Test</h2>

      {/* Search Input */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter a search query to diagnose..."
                className="pl-9 bg-card border-border text-foreground"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!query.trim() || testMutation.isPending} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Test
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Performance Summary */}
          <div className="flex gap-3 flex-wrap">
            <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Search Time</span>
              <p className="text-sm font-mono text-foreground">{result.searchTimeMs}ms</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Results</span>
              <p className="text-sm font-mono text-foreground">{services.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Cached</span>
              <p className="text-sm text-foreground">{response?.cached ? "Yes" : "No"}</p>
            </div>
            {analysis?.isCrisis && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 shadow-sm">
                <span className="text-xs text-red-400">Crisis Detected</span>
                <p className="text-sm font-bold text-red-700">Yes</p>
              </div>
            )}
          </div>

          {/* Query Analysis */}
          <CollapsibleSection
            title="Query Analysis"
            id="analysis"
            expanded={expandedSections.has("analysis")}
            onToggle={() => toggleSection("analysis")}
          >
            {analysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Raw Query" value={analysis.raw} />
                  <Field label="Corrected" value={analysis.corrected !== analysis.raw ? analysis.corrected : undefined} />
                  <Field label="Normalized" value={analysis.normalized} />
                  <Field label="Intent" value={analysis.intent} highlight />
                  <Field label="Location" value={analysis.location} />
                  <Field label="Searcher" value={analysis.searcher} />
                </div>

                {analysis.keywords?.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Keywords</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {analysis.keywords.map((kw) => (
                        <Badge key={kw} className="bg-muted text-muted-foreground border-border text-xs">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.subIntents && analysis.subIntents.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Sub-intents</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {analysis.subIntents.map((si) => (
                        <Badge key={si} className="bg-primary/10 text-primary border-primary/20 text-xs">{si}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.intents && analysis.intents.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">All Intents (with confidence)</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {analysis.intents.map((i) => (
                        <Badge key={i.intent} className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                          {i.intent} ({(i.confidence * 100).toFixed(0)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.negativeTerms && analysis.negativeTerms.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Negative Terms</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {analysis.negativeTerms.map((t) => (
                        <Badge key={t} className="bg-red-50 text-red-600 border-red-200 text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.detections && Object.keys(analysis.detections).length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Detections</span>
                    <pre className="mt-1 text-xs text-muted-foreground bg-muted p-2 rounded-lg overflow-auto max-h-32">
                      {JSON.stringify(analysis.detections, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No analysis data.</p>
            )}
          </CollapsibleSection>

          {/* Summary */}
          {response?.summary && (
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-base">AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed">{response.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Search Results */}
          <CollapsibleSection
            title={`Search Results (${services.length})`}
            id="results"
            expanded={expandedSections.has("results")}
            onToggle={() => toggleSection("results")}
          >
            {!services.length ? (
              <p className="text-sm text-muted-foreground">No results returned.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-10">#</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Service</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-32">Category</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-24">Location</th>
                      <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((r, i) => (
                      <tr key={r.id} className="border-t border-border hover:bg-muted">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2">
                          <p className="text-foreground truncate max-w-[300px]">{r.name}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">
                              {r.description.slice(0, 100)}...
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={cn(getCategoryColor(r.category), "text-[10px]")}>
                            {r.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[100px]">
                          {r.location || "--"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-foreground">
                          {r.rrfScore?.toFixed(3) ?? "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={cn("text-sm", highlight ? "text-primary font-medium" : "text-foreground")}>
        {value || "--"}
      </p>
    </div>
  );
}

function CollapsibleSection({
  title,
  id,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  id: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader
        className="pb-0 cursor-pointer"
        onClick={onToggle}
      >
        <CardTitle className="text-foreground text-base flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      {expanded && <CardContent className="pt-3">{children}</CardContent>}
    </Card>
  );
}
