import { useState, useEffect, useCallback, useRef } from "react";

interface UseSessionFiltersOptions<T extends Record<string, unknown>> {
  /** sessionStorage key */
  storageKey: string;
  /** Default values for each filter */
  defaults: T;
  /** Optional: URL param name to override a specific key (e.g., { selected: "selected" }) */
  urlOverrides?: Partial<Record<keyof T, string>>;
}

interface UseSessionFiltersReturn<T extends Record<string, unknown>> {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setFilters: (updates: Partial<T>) => void;
  resetFilters: () => void;
}

function readStorage<T>(key: string): Partial<T> | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readUrlOverrides<T extends Record<string, unknown>>(
  overrides: Partial<Record<keyof T, string>> | undefined,
): Partial<T> {
  if (!overrides) return {};
  const result: Record<string, unknown> = {};
  const params = new URLSearchParams(window.location.search);
  for (const [filterKey, paramName] of Object.entries(overrides)) {
    const val = params.get(paramName as string);
    if (val != null) result[filterKey] = val;
  }
  return result as Partial<T>;
}

export function useSessionFilters<T extends Record<string, unknown>>({
  storageKey,
  defaults,
  urlOverrides,
}: UseSessionFiltersOptions<T>): UseSessionFiltersReturn<T> {
  const defaultsRef = useRef(defaults);

  const [filters, setFiltersRaw] = useState<T>(() => {
    const saved = readStorage<T>(storageKey);
    const urlVals = readUrlOverrides<T>(urlOverrides);
    return { ...defaults, ...saved, ...urlVals } as T;
  });

  // Persist to sessionStorage on change
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(filters));
  }, [storageKey, filters]);

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersRaw((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setFilters = useCallback((updates: Partial<T>) => {
    setFiltersRaw((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersRaw(defaultsRef.current);
  }, []);

  return { filters, setFilter, setFilters, resetFilters };
}
