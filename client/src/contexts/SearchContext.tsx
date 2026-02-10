import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { ServiceSummary } from "@shared/routes";

interface SearchState {
  query: string;
  location: string;
  services: ServiceSummary[];
  hasSearched: boolean;
}

interface SearchContextType {
  searchState: SearchState;
  setSearchResults: (query: string, services: ServiceSummary[], location?: string) => void;
  setLocation: (location: string) => void;
  clearSearch: () => void;
}

const defaultState: SearchState = {
  query: '',
  location: '',
  services: [],
  hasSearched: false,
};

const SearchContext = createContext<SearchContextType | null>(null);

const STORAGE_KEY = 'roc_search_state';
const LOCATION_KEY = 'roc_selected_location';

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchState, setSearchState] = useState<SearchState>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const savedLocation = localStorage.getItem(LOCATION_KEY) || '';
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...parsed, location: savedLocation };
      }
      return { ...defaultState, location: savedLocation };
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

  const setSearchResults = useCallback((query: string, services: ServiceSummary[], location?: string) => {
    setSearchState(prev => ({
      query,
      location: location ?? prev.location,
      services,
      hasSearched: true,
    }));
  }, []);

  const setLocation = useCallback((location: string) => {
    setSearchState(prev => ({ ...prev, location }));
    try {
      localStorage.setItem(LOCATION_KEY, location);
    } catch (e) {
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchState(prev => ({ ...defaultState, location: prev.location }));
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
    }
  }, []);

  return (
    <SearchContext.Provider value={{ searchState, setSearchResults, setLocation, clearSearch }}>
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
