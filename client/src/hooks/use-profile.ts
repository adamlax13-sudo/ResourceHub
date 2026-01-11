import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UpdateDemographics, User } from "@shared/schema";

export function useProfile() {
  return useQuery<User>({
    queryKey: ["/api/profile"],
    enabled: true,
    retry: false,
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: UpdateDemographics) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });
}

interface RecommendationsResponse {
  recommendations: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    reasoning: string;
    location: string;
    contact: string;
    eligibility: string;
    process: string[];
    waitTimes: string;
    requiredDocs: string[];
  }>;
  summary: string;
}

export function useRecommendations() {
  return useQuery<RecommendationsResponse>({
    queryKey: ["/api/recommendations"],
    enabled: true,
    retry: false,
    staleTime: 0, // Always fetch fresh recommendations for variety
    gcTime: 0, // Don't cache - each page load gets new recommendations
  });
}
