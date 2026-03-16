import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface AdminAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Admin authentication hook.
 * Checks auth state via a lightweight API call on mount.
 * Provides login/logout methods.
 */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
  });

  // Check auth on mount by hitting a protected endpoint
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiRequest("GET", "/api/admin/dashboard/stats");
        if (!cancelled) setState({ isAuthenticated: true, isLoading: false });
      } catch {
        if (!cancelled) setState({ isAuthenticated: false, isLoading: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (apiKey: string) => {
    const res = await apiRequest("POST", "/api/admin/auth/login", { apiKey });
    const data = await res.json();
    if (data.success) {
      setState({ isAuthenticated: true, isLoading: false });
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/admin/auth/logout");
    } catch {
      // ignore
    }
    setState({ isAuthenticated: false, isLoading: false });
  }, []);

  return { ...state, login, logout };
}
