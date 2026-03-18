import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/category-colors";

interface FeedbackMessage {
  id: number;
  name: string | null;
  email: string | null;
  message: string;
  type: string;
  status: string;
  serviceId: string | null;
  serviceName: string | null;
  searchQuery: string | null;
  createdAt: string;
}

interface ServiceVoteAggregate {
  service_id: string;
  service_name: string;
  category: string;
  thumbs_up: number;
  thumbs_down: number;
  total_votes: number;
}

const FEEDBACK_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "incorrect_info", label: "Incorrect Info" },
  { value: "service_closed", label: "Service Closed" },
  { value: "missing_service", label: "Missing Service" },
  { value: "bad_search", label: "Bad Search" },
  { value: "general", label: "General" },
];

const FEEDBACK_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
];

const TYPE_BADGE_COLORS: Record<string, string> = {
  incorrect_info: "bg-red-100 text-red-700 border-red-200",
  service_closed: "bg-orange-100 text-orange-700 border-orange-200",
  missing_service: "bg-purple-100 text-purple-700 border-purple-200",
  bad_search: "bg-yellow-100 text-yellow-700 border-yellow-200",
  general: "bg-muted text-muted-foreground border-border",
};

const TYPE_LABELS: Record<string, string> = {
  incorrect_info: "Incorrect Info",
  service_closed: "Service Closed",
  missing_service: "Missing Service",
  bad_search: "Bad Search",
  general: "General",
};

const STATUS_COLORS: Record<string, string> = {
  new: "text-sky-700 bg-sky-50/60 border-sky-200/60",
  reviewed: "text-amber-700 bg-amber-50/60 border-amber-200/60",
  resolved: "text-emerald-700 bg-emerald-50/60 border-emerald-200/60",
};

export default function Feedback() {
  const [activeTab, setActiveTab] = useState<"messages" | "votes">("messages");
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", "25");
  if (typeFilter) queryParams.set("type", typeFilter);
  if (statusFilter) queryParams.set("status", statusFilter);

  const { data: messagesData, isPending: messagesLoading } = useQuery<{
    success: boolean;
    messages: FeedbackMessage[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ["/api/admin/feedback", page, typeFilter, statusFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/feedback?${queryParams.toString()}`);
      return res.json();
    },
    enabled: activeTab === "messages",
    staleTime: 30_000,
  });

  const { data: votesData, isPending: votesLoading } = useQuery<{
    success: boolean;
    votes: ServiceVoteAggregate[];
  }>({
    queryKey: ["/api/admin/feedback/votes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/feedback/votes");
      return res.json();
    },
    enabled: activeTab === "votes",
    staleTime: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/feedback/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback/count"] });
    },
  });

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Feedback</h2>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => { setActiveTab("messages"); setPage(1); }}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "messages"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <MessageSquare className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          User Messages
        </button>
        <button
          onClick={() => { setActiveTab("votes"); setPage(1); }}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "votes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <ThumbsUp className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          Service Votes
        </button>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-base">
                User Messages {messagesData ? `(${messagesData.total ?? 0})` : ""}
              </CardTitle>
              {/* Filter Bar */}
              <div className="flex gap-2">
                <select
                  value={typeFilter}
                  onChange={handleFilterChange(setTypeFilter)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 text-muted-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {FEEDBACK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={handleFilterChange(setStatusFilter)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 text-muted-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {FEEDBACK_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {messagesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !messagesData?.messages?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No feedback messages found.</p>
            ) : (
              <>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-28">Type</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-44">Service</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Message</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-28">Status</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-36">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messagesData.messages.map((msg) => (
                        <tr key={msg.id} className="border-t border-border hover:bg-muted">
                          <td className="px-3 py-2.5">
                            <Badge className={cn("text-[10px] px-1.5 border", TYPE_BADGE_COLORS[msg.type] || TYPE_BADGE_COLORS.general)}>
                              {TYPE_LABELS[msg.type] || msg.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-foreground truncate max-w-[180px]">
                            {msg.serviceName ? (
                              msg.serviceId ? (
                                <a
                                  href={`/services/${msg.serviceId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {msg.serviceName}
                                </a>
                              ) : (
                                msg.serviceName
                              )
                            ) : (
                              <span className="text-muted-foreground/40">&mdash;</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-foreground">
                            <p className="line-clamp-2" title={msg.message?.length > 100 ? msg.message : undefined}>{msg.message}</p>
                            {msg.searchQuery && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Search: "{msg.searchQuery}"</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={msg.status}
                              onChange={(e) => statusMutation.mutate({ id: msg.id, status: e.target.value })}
                              className={cn(
                                "text-[11px] font-medium border rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary",
                                STATUS_COLORS[msg.status] || STATUS_COLORS.new
                              )}
                            >
                              <option value="new">New</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">
                            {new Date(msg.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {messagesData.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>
                      Page {messagesData.page} of {messagesData.totalPages} ({messagesData.total} total)
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="h-7 px-2 text-muted-foreground"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= (messagesData.totalPages || 1)}
                        className="h-7 px-2 text-muted-foreground"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Votes Tab */}
      {activeTab === "votes" && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">
              Service Votes {votesData?.votes?.length ? `(${votesData.votes.reduce((sum: number, v: any) => sum + (v.total_votes ?? 0), 0)} votes across ${votesData.votes.length} services)` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {votesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !votesData?.votes?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No service votes yet.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Service</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-44">Category</th>
                      <th className="text-center px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">
                        <ThumbsUp className="h-3 w-3 inline-block" />
                      </th>
                      <th className="text-center px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">
                        <ThumbsDown className="h-3 w-3 inline-block" />
                      </th>
                      <th className="text-center px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {votesData.votes.map((vote) => (
                      <tr key={vote.service_id} className="border-t border-border hover:bg-muted">
                        <td className="px-3 py-2.5 text-foreground max-w-[250px] truncate">{vote.service_name}</td>
                        <td className="px-3 py-2.5">
                          <Badge className={cn(getCategoryColor(vote.category), "text-[10px] px-1.5")}>
                            {vote.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-emerald-600 font-medium">{Number(vote.thumbs_up)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-red-500 font-medium">{Number(vote.thumbs_down)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-foreground font-medium">{Number(vote.total_votes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
