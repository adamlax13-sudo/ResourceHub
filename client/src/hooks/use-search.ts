import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, type SearchResponse } from "@shared/routes";
import { z } from "zod";

type SearchInput = z.infer<typeof api.search.query.input>;

interface ExtendedSearchResponse extends SearchResponse {
  query: string;
}

// SessionStorage cache for recent search results (survives navigation, clears on tab close)
const CACHE_KEY_PREFIX = 'rh_search_';
const MAX_CACHED = 20;

function getCacheKey(data: SearchInput): string {
  const parts = [data.query, data.location || '', JSON.stringify(data.categories || [])];
  if (data.genderRestriction) parts.push(data.genderRestriction);
  if (data.ageGroup) parts.push(data.ageGroup);
  return CACHE_KEY_PREFIX + parts.join('|');
}

function getCachedResult(key: string): ExtendedSearchResponse | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* storage full or parse error */ }
  return null;
}

function setCachedResult(key: string, result: ExtendedSearchResponse): void {
  try {
    // Evict oldest entries if over limit
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(CACHE_KEY_PREFIX)) keys.push(k);
    }
    while (keys.length >= MAX_CACHED) {
      sessionStorage.removeItem(keys.shift()!);
    }
    sessionStorage.setItem(key, JSON.stringify(result));
  } catch { /* storage full */ }
}

export function useSearch() {
  const abortRef = useRef<AbortController | null>(null);

  return useMutation<ExtendedSearchResponse, Error, SearchInput>({
    mutationFn: async (data) => {
      // Cancel any in-flight request (user typed a new query)
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      // Check sessionStorage cache first
      const cacheKey = getCacheKey(data);
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      const res = await fetch(api.search.query.path, {
        method: api.search.query.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch search results");
      }

      const response = await res.json();
      const result: ExtendedSearchResponse = {
        ...response,
        query: data.query,
      };

      // Cache in sessionStorage for back-navigation
      setCachedResult(cacheKey, result);

      return result;
    },
  });
}
