import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { ServiceSummary } from "@shared/routes";

interface SearchState {
  query: string;
  locations: string[]; // Changed from single location to array
  services: ServiceSummary[];
  hasSearched: boolean;
}

interface SearchContextType {
  searchState: SearchState;
  setSearchResults: (query: string, services: ServiceSummary[], locations?: string[]) => void;
  setLocations: (locations: string[]) => void;
  toggleLocation: (location: string) => void;
  clearSearch: () => void;
}

const defaultState: SearchState = {
  query: '',
  locations: [],
  services: [],
  hasSearched: false,
};

const SearchContext = createContext<SearchContextType | null>(null);

const STORAGE_KEY = 'roc_search_state';
const LOCATION_KEY = 'roc_selected_locations';

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchState, setSearchState] = useState<SearchState>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const savedLocations = localStorage.getItem(LOCATION_KEY);
      const parsedLocations = savedLocations ? JSON.parse(savedLocations) : [];
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...parsed, locations: parsedLocations };
      }
      return { ...defaultState, locations: parsedLocations };
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

  const setSearchResults = useCallback((query: string, services: ServiceSummary[], locations?: string[]) => {
    setSearchState(prev => ({
      query,
      locations: locations ?? prev.locations,
      services,
      hasSearched: true,
    }));
  }, []);

  const setLocations = useCallback((locations: string[]) => {
    setSearchState(prev => ({ ...prev, locations }));
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(locations));
    } catch (e) {
    }
  }, []);

  const toggleLocation = useCallback((location: string) => {
    setSearchState(prev => {
      const newLocations = prev.locations.includes(location)
        ? prev.locations.filter(l => l !== location)
        : [...prev.locations, location];
      try {
        localStorage.setItem(LOCATION_KEY, JSON.stringify(newLocations));
      } catch (e) {
      }
      return { ...prev, locations: newLocations };
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchState(prev => ({ ...defaultState, locations: prev.locations }));
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
    }
  }, []);

  return (
    <SearchContext.Provider value={{ searchState, setSearchResults, setLocations, toggleLocation, clearSearch }}>
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
