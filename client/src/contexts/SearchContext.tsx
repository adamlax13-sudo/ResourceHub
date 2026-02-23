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

// Type guard for validating parsed localStorage data
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchState, setSearchState] = useState<SearchState>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const savedLocations = localStorage.getItem(LOCATION_KEY);
      // Validate parsed data is actually a string array
      const parsedLocations = savedLocations ? JSON.parse(savedLocations) : [];
      const validLocations = isStringArray(parsedLocations) ? parsedLocations : [];
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...parsed, locations: validLocations };
      }
      return { ...defaultState, locations: validLocations };
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load search state from storage:', e);
      }
    }
    return defaultState;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(searchState));
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to save search state to storage:', e);
      }
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
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to save locations to storage:', e);
      }
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
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to save locations to storage:', e);
        }
      }
      return { ...prev, locations: newLocations };
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchState(prev => ({ ...defaultState, locations: prev.locations }));
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to clear search state from storage:', e);
      }
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
