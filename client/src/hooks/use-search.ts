import { useMutation } from "@tanstack/react-query";
import { api, type SearchResponse } from "@shared/routes";
import { z } from "zod";

type SearchInput = z.infer<typeof api.search.query.input>;

export function useSearch() {
  return useMutation<SearchResponse, Error, SearchInput>({
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

      return api.search.query.responses[200].parse(await res.json());
    },
  });
}
