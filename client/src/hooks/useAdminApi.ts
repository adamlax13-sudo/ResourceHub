import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Typed admin API helpers built on React Query.
 */

// Generic GET hook
export function useAdminQuery<T = unknown>(key: string | string[], url: string, enabled = true) {
  return useQuery<T>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,       // Auto-refresh every 60s
    refetchOnWindowFocus: true,    // Refresh when tab regains focus
    retry: false,
  });
}

// Generic mutation hook
export function useAdminMutation<TData = unknown, TVariables = unknown>(
  method: string,
  url: string | ((vars: TVariables) => string),
  options?: {
    invalidateKeys?: string[][];
    onSuccess?: (data: TData) => void;
  },
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const resolvedUrl = typeof url === "function" ? url(variables) : url;
      const res = await apiRequest(method, resolvedUrl, method === "GET" ? undefined : variables);
      return res.json();
    },
    onSuccess: (data) => {
      if (options?.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
      options?.onSuccess?.(data);
    },
  });
}
