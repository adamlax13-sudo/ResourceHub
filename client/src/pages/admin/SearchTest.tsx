import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: number;
  name: string;
  category: string;
  rrfScore?: number;
  boostDetails?: Record<string, unknown>;
  description?: string;
}

interface QueryAnalysis {
  intent?: string;
  secondaryIntent?: string;
  subIntents?: string[];
  correctedQuery?: string;
  attributes?: Record<string, unknown>;
  isCrisis?: boolean;
  semanticQuery?: string;
}

interface TestResult {
  success: boolean;
  analysis?: QueryAnalysis;
  results?: SearchResult[];
  totalResults?: number;
  timings?: Record<string, number>;
  cacheStatus?: string;
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

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Search Test</h2>

      {/* Search Input */}
      <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter a search query to diagnose..."
                className="pl-9 bg-white border-gray-300 text-gray-900"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!query.trim() || testMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
              {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Test
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Query Analysis */}
          <CollapsibleSection
            title="Query Analysis"
            id="analysis"
            expanded={expandedSections.has("analysis")}
            onToggle={() => toggleSection("analysis")}
          >
            {result.analysis ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Intent" value={result.analysis.intent} />
                  <Field label="Secondary Intent" value={result.analysis.secondaryIntent} />
                  <Field label="Corrected Query" value={result.analysis.correctedQuery} />
                  <Field label="Semantic Query" value={result.analysis.semanticQuery} />
                  <Field label="Crisis" value={result.analysis.isCrisis ? "Yes" : "No"} />
                  <Field label="Cache Status" value={result.cacheStatus} />
                </div>
                {result.analysis.subIntents && result.analysis.subIntents.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-400">Sub-intents:</span>
                    <div className="flex gap-1 mt-1">
                      {result.analysis.subIntents.map((si) => (
                        <Badge key={si} className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                          {si}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {result.analysis.attributes && Object.keys(result.analysis.attributes).length > 0 && (
                  <div>
                    <span className="text-xs text-gray-400">Attributes:</span>
                    <pre className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg overflow-auto">
                      {JSON.stringify(result.analysis.attributes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No analysis data.</p>
            )}
          </CollapsibleSection>

          {/* Timings */}
          {result.timings && (
            <CollapsibleSection
              title="Timings"
              id="timings"
              expanded={expandedSections.has("timings")}
              onToggle={() => toggleSection("timings")}
            >
              <div className="flex gap-4 flex-wrap">
                {Object.entries(result.timings).map(([key, val]) => (
                  <div key={key}>
                    <span className="text-xs text-gray-400">{key}</span>
                    <p className="text-sm text-gray-900 font-mono">{val}ms</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Search Results */}
          <CollapsibleSection
            title={`Search Results (${result.totalResults ?? result.results?.length ?? 0})`}
            id="results"
            expanded={expandedSections.has("results")}
            onToggle={() => toggleSection("results")}
          >
            {!result.results?.length ? (
              <p className="text-sm text-gray-400">No results returned.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-10">#</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Service</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-28">Category</th>
                      <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={r.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          <p className="text-gray-900 truncate max-w-[350px]">{r.name}</p>
                          {r.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[350px] mt-0.5">
                              {r.description}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">
                            {r.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">
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

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-xs text-gray-400">{label}</span>
      <p className="text-sm text-gray-900">{value || "--"}</p>
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
    <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
      <CardHeader
        className="pb-0 cursor-pointer"
        onClick={onToggle}
      >
        <CardTitle className="text-gray-900 text-base flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      {expanded && <CardContent className="pt-3">{children}</CardContent>}
    </Card>
  );
}
