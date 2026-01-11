import { useEffect, useRef } from "react";
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
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (authLoading || !user || hasPrefetched.current) {
      return;
    }

    const prefetch = () => {
      hasPrefetched.current = true;
      
      queryClient.prefetchQuery({
        queryKey: ["/api/recommendations"],
        queryFn: fetchRecommendations,
        staleTime: 1000 * 60 * 5,
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
