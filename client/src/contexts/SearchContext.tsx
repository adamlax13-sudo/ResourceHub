import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { ServiceSummary, SearchFilters } from "@shared/routes";
import { CATEGORY_GROUPS } from "../components/RefinePanel";

interface UserCoords {
  lat: number;
  lng: number;
  timestamp: number;
}

interface SearchState {
  query: string;
  locations: string[]; // Changed from single location to array
  services: ServiceSummary[];
  hasSearched: boolean;
  filters: SearchFilters;
  userCoords: UserCoords | null;
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
  setUserCoords: (coords: UserCoords | null) => void;
}

const defaultState: SearchState = {
  query: '',
  locations: [],
  services: [],
  hasSearched: false,
  filters: {},
  userCoords: null,
};

const SearchContext = createContext<SearchContextType | null>(null);

const STORAGE_KEY = 'roc_search_state';
const LOCATION_KEY = 'roc_selected_locations';
const COORDS_KEY = 'roc_user_coords';
const COORDS_TTL = 60 * 60 * 1000; // 1 hour

function loadStoredCoords(): UserCoords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat === 'number' && parsed.lat >= -90 && parsed.lat <= 90 &&
      typeof parsed?.lng === 'number' && parsed.lng >= -180 && parsed.lng <= 180 &&
      typeof parsed?.timestamp === 'number' && Date.now() - parsed.timestamp < COORDS_TTL
    ) {
      return parsed;
    }
    localStorage.removeItem(COORDS_KEY);
  } catch { /* ignore */ }
  return null;
}

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
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            query: typeof parsed.query === 'string' ? parsed.query.slice(0, 500) : '',
            services: Array.isArray(parsed.services) ? parsed.services : [],
            hasSearched: typeof parsed.hasSearched === 'boolean' ? parsed.hasSearched : false,
            filters: typeof parsed.filters === 'object' && parsed.filters !== null && !Array.isArray(parsed.filters) ? parsed.filters : {},
            locations: validLocations,
            userCoords: loadStoredCoords(),
          };
        }
      }
      return { ...defaultState, locations: validLocations, userCoords: loadStoredCoords() };
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
    const VALID_CATEGORIES = new Set(CATEGORY_GROUPS.flatMap(g => g.categories));
    const cats = params.get('cats');
    if (cats) {
      const validCats = cats.split(',').filter(c => VALID_CATEGORIES.has(c)).slice(0, 10);
      if (validCats.length > 0) restoredFilters.categories = validCats;
    }
    const VALID_GENDERS = ['all', 'women_only', 'men_only'];
    const VALID_AGES = ['all_ages', 'youth', 'adult', 'senior', 'youth_and_adult'];
    const gender = params.get('gender');
    if (gender && VALID_GENDERS.includes(gender)) restoredFilters.genderRestriction = gender as SearchFilters['genderRestriction'];
    const age = params.get('age');
    if (age && VALID_AGES.includes(age)) restoredFilters.ageGroup = age as SearchFilters['ageGroup'];
    if (params.get('24h')) restoredFilters.is24_7 = true;
    if (params.get('faith')) restoredFilters.isFaithBased = true;
    if (params.get('12step')) restoredFilters.is12Step = true;
    const VALID_FORMATS = ['in_person', 'virtual', 'both'];
    const format = params.get('format');
    if (format && VALID_FORMATS.includes(format)) restoredFilters.serviceFormat = format;
    const VALID_LANGS = new Set(['en', 'fr', 'es', 'ar', 'zh', 'hi', 'ko', 'ja', 'de', 'pt', 'tl', 'pa', 'ur', 'vi', 'so', 'ti', 'am']);
    const lang = params.get('lang');
    if (lang) {
      const validLangs = lang.split(',').filter(l => VALID_LANGS.has(l.trim().toLowerCase()));
      if (validLangs.length > 0) restoredFilters.languagesSupported = validLangs;
    }

    const VALID_LOCATIONS = new Set([
      'calgary', 'edmonton', 'red deer', 'lethbridge', 'medicine hat',
      'grande prairie', 'fort mcmurray', 'airdrie', 'spruce grove',
      'leduc', 'okotoks', 'cochrane', 'camrose', 'brooks',
      'lloydminster', 'wetaskiwin', 'canmore', 'banff', 'drumheller',
      'st. albert', 'sherwood park', 'chestermere',
    ]);
    const loc = params.get('loc');
    const validLoc = loc && VALID_LOCATIONS.has(loc.toLowerCase()) ? loc : null;
    setSearchState(prev => ({
      ...prev,
      query: q,
      locations: validLoc ? [validLoc] : prev.locations,
      filters: restoredFilters,
      services: [],        // clear stale results — URL is the source of truth
      hasSearched: false,  // Home.tsx will trigger a fresh search from URL params
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSearchResults = useCallback((query: string, services: ServiceSummary[], locations?: string[]) => {
    setSearchState(prev => ({
      ...prev,
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

  const setFilters = useCallback((filters: SearchFilters) => {
    setSearchState(prev => ({ ...prev, filters }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, filters: {} }));
  }, []);

  const setUserCoords = useCallback((coords: UserCoords | null) => {
    setSearchState(prev => ({ ...prev, userCoords: coords }));
    try {
      if (coords) {
        localStorage.setItem(COORDS_KEY, JSON.stringify(coords));
      } else {
        localStorage.removeItem(COORDS_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  const activeFilterCount = Object.entries(searchState.filters).filter(([k, v]) => {
    if (v === undefined || v === false) return false;
    if (v === 'all' || v === 'all_ages') return false;  // sentinel values = no filter
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;

  return (
    <SearchContext.Provider value={{ searchState, setSearchResults, setLocations, toggleLocation, clearSearch, setFilters, clearFilters, activeFilterCount, setUserCoords }}>
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
  if (filters?.categories?.length) params.set('cats', filters.categories.join(','));
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

export type { SearchFilters, UserCoords };
