import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { ServiceSummary, SearchFilters } from "@shared/routes";

interface SearchState {
  query: string;
  locations: string[]; // Changed from single location to array
  services: ServiceSummary[];
  hasSearched: boolean;
  filters: SearchFilters;
}

interface SearchContextType {
  searchState: SearchState;
  setSearchResults: (query: string, services: ServiceSummary[], locations?: string[]) => void;
  setLocations: (locations: string[]) => void;
  toggleLocation: (location: string) => void;
  clearSearch: () => void;
  setFilters: (filters: SearchFilters) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}

const defaultState: SearchState = {
  query: '',
  locations: [],
  services: [],
  hasSearched: false,
  filters: {},
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

  // On mount, read URL params to restore filter state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (!q) return;

    const restoredFilters: SearchFilters = {};
    const cat = params.get('cat'); if (cat) restoredFilters.category = cat;
    const gender = params.get('gender'); if (gender) restoredFilters.genderRestriction = gender as SearchFilters['genderRestriction'];
    const age = params.get('age'); if (age) restoredFilters.ageGroup = age as SearchFilters['ageGroup'];
    if (params.get('24h')) restoredFilters.is24_7 = true;
    if (params.get('faith')) restoredFilters.isFaithBased = true;
    if (params.get('12step')) restoredFilters.is12Step = true;
    const format = params.get('format'); if (format) restoredFilters.serviceFormat = format;
    const lang = params.get('lang'); if (lang) restoredFilters.languagesSupported = lang.split(',');

    const loc = params.get('loc');
    setSearchState(prev => ({
      ...prev,
      query: q,
      locations: loc ? [loc] : prev.locations,
      filters: restoredFilters,
      services: [],        // clear stale results — URL is the source of truth
      hasSearched: false,  // Home.tsx will trigger a fresh search from URL params
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSearchResults = useCallback((query: string, services: ServiceSummary[], locations?: string[]) => {
    setSearchState(prev => ({
      query,
      locations: locations ?? prev.locations,
      services,
      hasSearched: true,
      filters: prev.filters,
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

  const setFilters = useCallback((filters: SearchFilters) => {
    setSearchState(prev => ({ ...prev, filters }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, filters: {} }));
  }, []);

  const activeFilterCount = Object.entries(searchState.filters).filter(([k, v]) => {
    if (v === undefined || v === false) return false;
    if (v === 'all' || v === 'all_ages') return false;  // sentinel values = no filter
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;

  return (
    <SearchContext.Provider value={{ searchState, setSearchResults, setLocations, toggleLocation, clearSearch, setFilters, clearFilters, activeFilterCount }}>
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

export function updateSearchUrl(query: string, location?: string, filters?: SearchFilters) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (location) params.set('loc', location);
  if (filters?.category) params.set('cat', filters.category);
  if (filters?.genderRestriction && filters.genderRestriction !== 'all') params.set('gender', filters.genderRestriction);
  if (filters?.ageGroup && filters.ageGroup !== 'all_ages') params.set('age', filters.ageGroup);
  if (filters?.is24_7) params.set('24h', '1');
  if (filters?.isFaithBased) params.set('faith', '1');
  if (filters?.is12Step) params.set('12step', '1');
  if (filters?.serviceFormat) params.set('format', filters.serviceFormat);
  if (filters?.languagesSupported?.length) params.set('lang', filters.languagesSupported.join(','));
  const qs = params.toString();
  window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname);
}

export type { SearchFilters };
