import { useEffect } from "react";
import { useAuth } from "./use-auth";
import { queryClient } from "@/lib/queryClient";

async function fetchRecommendations() {
  const response = await fetch("/api/recommendations", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to prefetch recommendations");
  }
  
  return response.json();
}

export function usePrefetchRecommendations() {
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const prefetch = () => {
      queryClient.prefetchQuery({
        queryKey: ["/api/recommendations"],
        queryFn: fetchRecommendations,
        staleTime: 0, // Always fresh
      });
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(prefetch, 1500);
      return () => clearTimeout(id);
    }
  }, [user, authLoading]);
}
