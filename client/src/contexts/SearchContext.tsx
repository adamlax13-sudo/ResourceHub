import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { ServiceDetail } from "@shared/routes";

interface SearchState {
  query: string;
  mode: 'fast' | 'comprehensive';
  services: ServiceDetail[];
  hasSearched: boolean;
}

interface SearchContextType {
  searchState: SearchState;
  setSearchResults: (query: string, mode: 'fast' | 'comprehensive', services: ServiceDetail[]) => void;
  clearSearch: () => void;
}

const defaultState: SearchState = {
  query: '',
  mode: 'fast',
  services: [],
  hasSearched: false,
};

const SearchContext = createContext<SearchContextType | null>(null);

const STORAGE_KEY = 'roc_search_state';

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchState, setSearchState] = useState<SearchState>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
    }
    return defaultState;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(searchState));
    } catch (e) {
    }
  }, [searchState]);

  const setSearchResults = useCallback((query: string, mode: 'fast' | 'comprehensive', services: ServiceDetail[]) => {
    setSearchState({
      query,
      mode,
      services,
      hasSearched: true,
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchState(defaultState);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
    }
  }, []);

  return (
    <SearchContext.Provider value={{ searchState, setSearchResults, clearSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}
