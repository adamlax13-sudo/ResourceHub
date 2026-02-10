import { useMutation } from "@tanstack/react-query";
import { api, type SearchResponse } from "@shared/routes";
import { z } from "zod";

type SearchInput = z.infer<typeof api.search.query.input>;

interface ExtendedSearchResponse extends SearchResponse {
  query: string;
}

export function useSearch() {
  return useMutation<ExtendedSearchResponse, Error, SearchInput>({
    mutationFn: async (data) => {
      const res = await fetch(api.search.query.path, {
        method: api.search.query.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch search results");
      }

      const response = await res.json();
      return {
        ...response,
        query: data.query,
      };
    },
  });
}
