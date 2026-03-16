import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export default function Feedback() {
  const [activeTab, setActiveTab] = useState<"messages" | "votes">("messages");
  const [page, setPage] = useState(1);

  const { data: messagesData, isPending: messagesLoading } = useQuery<{
    success: boolean;
    messages: FeedbackMessage[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ["/api/admin/feedback", page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/feedback?page=${page}&limit=25`);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Feedback</h2>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => { setActiveTab("messages"); setPage(1); }}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "messages"
              ? "border-teal-500 text-teal-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <MessageSquare className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          User Messages
        </button>
        <button
          onClick={() => setActiveTab("votes")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "votes"
              ? "border-teal-500 text-teal-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <ThumbsUp className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
          Service Votes
        </button>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 text-base">
              User Messages {messagesData?.total ? `(${messagesData.total})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {messagesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !messagesData?.messages?.length ? (
              <p className="text-sm text-gray-400 text-center py-8">No feedback messages yet.</p>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-32">Name</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-44">Email</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Message</th>
                        <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-36">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messagesData.messages.map((msg) => (
                        <tr key={msg.id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-gray-900 truncate">{msg.name || <span className="text-gray-400">Anonymous</span>}</td>
                          <td className="px-3 py-2.5 text-gray-500 truncate">{msg.email || <span className="text-gray-300">--</span>}</td>
                          <td className="px-3 py-2.5 text-gray-700">
                            <p className="line-clamp-2">{msg.message}</p>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">
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
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>
                      Page {messagesData.page} of {messagesData.totalPages} ({messagesData.total} total)
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="h-7 px-2 text-gray-500"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= (messagesData.totalPages || 1)}
                        className="h-7 px-2 text-gray-500"
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
        <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 text-base">
              Service Votes {votesData?.votes?.length ? `(${votesData.votes.length} services)` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {votesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !votesData?.votes?.length ? (
              <p className="text-sm text-gray-400 text-center py-8">No service votes yet.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Service</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-44">Category</th>
                      <th className="text-center px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                        <ThumbsUp className="h-3 w-3 inline-block" />
                      </th>
                      <th className="text-center px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">
                        <ThumbsDown className="h-3 w-3 inline-block" />
                      </th>
                      <th className="text-center px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {votesData.votes.map((vote) => (
                      <tr key={vote.service_id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-900 max-w-[250px] truncate">{vote.service_name}</td>
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
                        <td className="px-3 py-2.5 text-center text-gray-700 font-medium">{Number(vote.total_votes)}</td>
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
