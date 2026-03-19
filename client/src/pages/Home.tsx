import { useState, useRef, lazy, Suspense, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Hero } from "@/components/Hero";
import { useSearch } from "@/hooks/use-search";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceCardSkeleton } from "@/components/ServiceCardSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Info, SlidersHorizontal, X, Heart, LayoutList, Map as MapIcon } from "lucide-react";
import ucalgaryLogo from "@/assets/ucalgary-gear-logo.png";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useSearchContext, updateSearchUrl } from "@/contexts/SearchContext";
import { CategoryTiles } from "@/components/CategoryTiles";
import { IntakeWizard } from "@/components/IntakeWizard";
import { RefinePanel } from "@/components/RefinePanel";
import { MyShortlist } from "@/components/MyShortlist";
import { QuickExitButton } from "@/components/QuickExitButton";
import { useFavoritesContext } from "@/hooks/use-favorites";
import type { SearchFilters } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

const ServiceModal = lazy(() => import("@/components/ServiceModal").then(m => ({ default: m.ServiceModal })));
const MapView = lazy(() => import("@/components/MapView"));

interface FilterChip {
  key: string;
  label: string;
}

function buildContextLine(qu: {
  intent?: string;
  location?: string;
  attributes?: {
    demographic?: string;
    serviceFormat?: string[];
  };
}): string | null {
  const parts: string[] = [];

  if (qu.intent) {
    const label = qu.intent.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
    parts.push(`${label} services`);
  }

  if (qu.attributes?.demographic) {
    parts.push(`for ${qu.attributes.demographic}`);
  }

  if (qu.location) {
    parts.push(`near ${qu.location}`);
  }

  if (parts.length === 0) return null;

  let line: string;
  if (!qu.intent && qu.location) {
    line = `Services near ${qu.location}`;
  } else {
    line = parts.join(" ");
  }

  const formatMap: Record<string, string> = {
    in_person: "In-person",
    online: "Online",
    in_person_and_online: "In-person & Online",
  };
  const formats = (qu.attributes?.serviceFormat ?? [])
    .map(f => formatMap[f] ?? f)
    .filter(Boolean);
  if (formats.length > 0) {
    line += ` · ${formats.join(", ")}`;
  }

  return `Showing results for "${line}"`;
}

function buildFilterChips(filters: SearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  (filters.categories ?? []).forEach((cat) => {
    chips.push({ key: `cat_${cat}`, label: cat });
  });
  if (filters.genderRestriction && filters.genderRestriction !== "all") {
    chips.push({
      key: "genderRestriction",
      label: filters.genderRestriction === "women_only" ? "Women-only" : "Men-only",
    });
  }
  if (filters.ageGroup && filters.ageGroup !== "all_ages") {
    chips.push({
      key: "ageGroup",
      label: filters.ageGroup.charAt(0).toUpperCase() + filters.ageGroup.slice(1),
    });
  }
  if (filters.is24_7) chips.push({ key: "is24_7", label: "24/7" });
  if (filters.isFaithBased) chips.push({ key: "isFaithBased", label: "Faith-based" });
  if (filters.is12Step) chips.push({ key: "is12Step", label: "12-step" });
  if (filters.serviceFormat) {
    const formatLabels: Record<string, string> = {
      in_person: "In-person",
      online: "Online",
      in_person_and_online: "In-person & Online",
    };
    chips.push({
      key: "serviceFormat",
      label: formatLabels[filters.serviceFormat] ?? filters.serviceFormat,
    });
  }
  (filters.languagesSupported ?? []).forEach((lang) => {
    chips.push({ key: `lang_${lang}`, label: lang });
  });

  return chips;
}

function removeChip(filters: SearchFilters, chipKey: string): SearchFilters {
  const next = { ...filters };

  if (chipKey === "genderRestriction") {
    delete next.genderRestriction;
  } else if (chipKey === "ageGroup") {
    delete next.ageGroup;
  } else if (chipKey === "is24_7") {
    delete next.is24_7;
  } else if (chipKey === "isFaithBased") {
    delete next.isFaithBased;
  } else if (chipKey === "is12Step") {
    delete next.is12Step;
  } else if (chipKey === "serviceFormat") {
    delete next.serviceFormat;
  } else if (chipKey.startsWith("cat_")) {
    const cat = chipKey.slice(4);
    const cats = (next.categories ?? []).filter((c) => c !== cat);
    next.categories = cats.length > 0 ? cats : undefined;
  } else if (chipKey.startsWith("lang_")) {
    const lang = chipKey.slice(5);
    const langs = (next.languagesSupported ?? []).filter((l) => l !== lang);
    next.languagesSupported = langs.length > 0 ? langs : undefined;
  }

  return next;
}

export default function Home() {
  const { mutate: search, isPending, data, error } = useSearch();
  const { searchState, setSearchResults, setLocations, setFilters, clearFilters, activeFilterCount, setUserCoords } = useSearchContext();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() => {
    // Support deep-linking via ?service=ID (e.g. from share button)
    const params = new URLSearchParams(window.location.search);
    return params.get('service') || null;
  });
  const [feedbackContext, setFeedbackContext] = useState<{
    serviceId?: string;
    serviceName?: string;
  } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refinePanelOpen, setRefinePanelOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const { favoriteCount, isFavorite, toggleFavorite } = useFavoritesContext();
  const { t } = useTranslation();
  const { toast } = useToast();

  const searchStateRef = useRef(searchState);
  searchStateRef.current = searchState;

  // Fire-and-forget click tracking to /api/track-click
  const trackClick = useCallback((serviceId: string, position: number) => {
    const query = searchStateRef.current.query;
    if (!query) return;
    fetch("/api/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, query, position: position + 1 }),
    }).catch(() => {}); // silent — never block UI
  }, []);

  useEffect(() => {
    if (error) console.error('Search error:', error);
  }, [error]);

  // Store search results when data changes
  useEffect(() => {
    if (data && data.services) {
      setSearchResults(data.query, data.services);
      const current = searchStateRef.current;
      updateSearchUrl(data.query, current.locations[0], current.filters);
    }
  }, [data, setSearchResults]);

  const displayServices = data?.services || (searchState.hasSearched ? searchState.services : null);

  // Shared helper: build filter + coordinate params for search API calls
  const buildSearchParams = useCallback((filters: SearchFilters, coords?: { lat: number; lng: number } | null) => {
    const filterParams: Partial<SearchFilters> = {};
    if (filters.categories?.length) filterParams.categories = filters.categories;
    if (filters.genderRestriction && filters.genderRestriction !== "all") {
      filterParams.genderRestriction = filters.genderRestriction;
    }
    if (filters.ageGroup && filters.ageGroup !== "all_ages") {
      filterParams.ageGroup = filters.ageGroup;
    }
    if (filters.is24_7) filterParams.is24_7 = true;
    if (filters.isFaithBased) filterParams.isFaithBased = true;
    if (filters.is12Step) filterParams.is12Step = true;
    if (filters.serviceFormat) filterParams.serviceFormat = filters.serviceFormat;
    if (filters.languagesSupported?.length) {
      filterParams.languagesSupported = filters.languagesSupported;
    }
    const coordParams = coords ? { userLat: coords.lat, userLng: coords.lng } : {};
    return { ...filterParams, ...coordParams };
  }, []);

  const handleSearch = useCallback((query: string, locations: string[], hp?: string) => {
    const locationParam = locations.length > 0 ? locations[0] : undefined;
    const params = buildSearchParams(searchStateRef.current.filters, searchStateRef.current.userCoords);
    search({ query, location: locationParam, ...params, ...(hp ? { hp } : {}) });
  }, [search, buildSearchParams]);

  const handleNearMe = useCallback(() => {
    if (searchState.userCoords) {
      // Toggle off — clear coords and re-search without distance sorting
      setUserCoords(null);
      if (searchStateRef.current.query) {
        const params = buildSearchParams(searchStateRef.current.filters, null);
        const locationParam = searchStateRef.current.locations[0] || undefined;
        search({ query: searchStateRef.current.query, location: locationParam, ...params });
      }
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 1000) / 1000;
        const lng = Math.round(pos.coords.longitude * 1000) / 1000;
        const coords = { lat, lng, timestamp: Date.now() };
        setUserCoords(coords);
        setIsLocating(false);
        // Re-search with distance sorting if a search is already active
        if (searchStateRef.current.query) {
          const params = buildSearchParams(searchStateRef.current.filters, coords);
          const locationParam = searchStateRef.current.locations[0] || undefined;
          search({ query: searchStateRef.current.query, location: locationParam, ...params });
        }
      },
      (err) => {
        setIsLocating(false);
        const messages: Record<number, string> = {
          1: 'Location access denied. You can use the location dropdown instead.',
          2: "Couldn't determine your location. Try using the location dropdown.",
          3: 'Location request timed out. Try using the location dropdown.',
        };
        toast({ title: 'Location unavailable', description: messages[err.code] || messages[2], variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 },
    );
  }, [searchState.userCoords, setUserCoords, toast, search, buildSearchParams]);

  const handleSearchWithFilters = useCallback(
    (query: string, locations: string[], filters: SearchFilters) => {
      const locationParam = locations.length > 0 ? locations[0] : undefined;
      const params = buildSearchParams(filters, searchStateRef.current.userCoords);
      search({ query, location: locationParam, ...params });
    },
    [search, buildSearchParams]
  );

  // Auto-trigger search when page loads with URL params (shared link restoration)
  const hasTriggeredUrlSearch = useRef(false);
  useEffect(() => {
    if (searchState.query && !searchState.hasSearched && !isPending && !hasTriggeredUrlSearch.current) {
      hasTriggeredUrlSearch.current = true;
      handleSearchWithFilters(searchState.query, searchState.locations, searchState.filters);
    }
  }, [searchState.query, searchState.hasSearched, isPending, handleSearchWithFilters, searchState.locations, searchState.filters]);

  const handleLocationChange = useCallback((location: string) => {
    const newLocations = location ? [location] : [];
    setLocations(newLocations);
    // Re-trigger search if one is already active
    if (searchState.query) {
      handleSearchWithFilters(searchState.query, newLocations, searchState.filters);
    }
  }, [setLocations, searchState.query, searchState.filters, handleSearchWithFilters]);

  const handleEmergencySearch = useCallback(() => {
    const locationParam = searchState.locations.length > 0 ? searchState.locations[0] : undefined;
    search({ query: "crisis support emergency help right now", location: locationParam, emergency: true });
  }, [search, searchState.locations]);

  const handleCategorySelect = useCallback((query: string) => {
    handleSearch(query, searchState.locations);
  }, [handleSearch, searchState.locations]);

  const handleOpenWizard = useCallback(() => setWizardOpen(true), []);

  const handleWizardComplete = useCallback((query: string, filters: SearchFilters) => {
    setFilters(filters);
    handleSearchWithFilters(query, searchStateRef.current.locations, filters);
    setWizardOpen(false);
  }, [setFilters, handleSearchWithFilters]);

  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      setFilters(newFilters);
      if (searchState.query) {
        handleSearchWithFilters(searchState.query, searchState.locations, newFilters);
      }
    },
    [setFilters, searchState.query, searchState.locations, handleSearchWithFilters]
  );

  const handleClearFilters = useCallback(() => {
    clearFilters();
    if (searchState.query) {
      handleSearch(searchState.query, searchState.locations);
    }
  }, [clearFilters, searchState.query, searchState.locations, handleSearch]);

  const handleRemoveChip = useCallback(
    (chipKey: string) => {
      const newFilters = removeChip(searchState.filters, chipKey);
      handleFiltersChange(newFilters);
    },
    [searchState.filters, handleFiltersChange]
  );

  const filterChips = buildFilterChips(searchState.filters);

  return (
    <div className="min-h-screen bg-background font-sans overflow-x-hidden">
      {/* Floating quick exit — always visible, tracks mouse on desktop */}
      <QuickExitButton floating />
      <Hero
        onSearch={handleSearch}
        isLoading={isPending}
        hasResults={!!(displayServices || isPending || error)}
        initialQuery={searchState.query}
        locations={searchState.locations}
        onLocationChange={handleLocationChange}
        onEmergencySearch={handleEmergencySearch}
        onOpenWizard={handleOpenWizard}
        onOpenRefinePanel={() => setRefinePanelOpen(true)}
        activeFilterCount={activeFilterCount}
        userCoords={searchState.userCoords}
        onNearMe={handleNearMe}
        isLocating={isLocating}
        openFeedback={() => setFeedbackContext({})}
        contextLine={data?.queryUnderstanding ? buildContextLine(data.queryUnderstanding) : null}
      />

      <div className={`container mx-auto px-4 relative z-20 pb-20 ${(displayServices || isPending || error) ? '-mt-6 sm:-mt-20' : ''}`}>
        {/* Active filter chips — shown below Hero when there are active filters */}
        <AnimatePresence>
          {filterChips.length > 0 && !refinePanelOpen && (
            <motion.div
              key="filter-chips"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap gap-2 mb-4"
              aria-label="Active filters"
            >
              {filterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => handleRemoveChip(chip.key)}
                    aria-label={`Remove ${chip.label} filter`}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {error && !isPending && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card p-8 rounded-3xl shadow-xl text-center max-w-2xl mx-auto border border-destructive/20"
            >
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('search.error')}</h3>
              <p className="text-muted-foreground">Something went wrong with the search. Please try again.</p>
            </motion.div>
          )}

          {isPending && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ServiceCardSkeleton key={index} index={index} />
                ))}
              </div>
            </motion.div>
          )}

          {!isPending && displayServices && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Results toolbar: view toggle, action buttons */}
              <div className="flex items-center justify-between gap-2 mb-4">
                {/* List/Map toggle */}
                <div className="inline-flex gap-0.5 p-1 bg-muted rounded-lg border border-border" role="radiogroup" aria-label="View mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={viewMode === 'list'}
                    aria-label="List view"
                    onClick={() => setViewMode('list')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 sm:gap-1.5 sm:px-3.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'list'
                        ? 'bg-white text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LayoutList className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={viewMode === 'map'}
                    aria-label="Map view"
                    onClick={() => setViewMode('map')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 sm:gap-1.5 sm:px-3.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'map'
                        ? 'bg-white text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MapIcon className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Map</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShortlistOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  aria-label={favoriteCount > 0 ? `Open shortlist, ${favoriteCount} saved` : "Open shortlist"}
                >
                  <Heart
                    className={`w-4 h-4 ${favoriteCount > 0 ? 'text-red-500 fill-current' : 'text-muted-foreground'}`}
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">Shortlist</span>
                  {favoriteCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                      {favoriteCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRefinePanelOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors relative"
                  aria-label="Refine filters"
                  aria-expanded={refinePanelOpen}
                  aria-controls="refine-panel"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Refine</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 sm:ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
              {viewMode === 'map' ? (
                <motion.div
                  key="map-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Suspense fallback={
                    <div className="glass-card p-8 flex items-center justify-center h-[calc(100vh-200px)]">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  }>
                    <MapView
                      services={displayServices}
                      userLocation={searchState.userCoords}
                      onSelectService={(id) => setSelectedServiceId(id)}
                    />
                  </Suspense>
                </motion.div>
              ) : (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {displayServices.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    index={index}
                    onClick={() => { trackClick(String(service.id), index); setSelectedServiceId(service.id); }}
                    isFavorite={isFavorite(service.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>

              {displayServices.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  {t('search.noResults')}
                </div>
              )}

                </motion.div>
              )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {!displayServices && !isPending && !error && (
          <CategoryTiles onSelect={handleCategorySelect} />
        )}
      </div>

      {/* Refine Filter Panel */}
      <RefinePanel
        isOpen={refinePanelOpen}
        onClose={() => setRefinePanelOpen(false)}
        filters={searchState.filters}
        onFiltersChange={handleFiltersChange}
        onClear={handleClearFilters}
      />

      {/* Service Details Modal */}
      <Suspense fallback={null}>
        <ServiceModal
          serviceId={selectedServiceId}
          isOpen={!!selectedServiceId}
          onClose={() => setSelectedServiceId(null)}
          isFavorite={selectedServiceId ? isFavorite(selectedServiceId) : false}
          onToggleFavorite={toggleFavorite}
          openFeedback={(id, name) => setFeedbackContext({ serviceId: id, serviceName: name })}
        />
      </Suspense>

      {/* My Shortlist drawer */}
      <MyShortlist
        isOpen={shortlistOpen}
        onClose={() => setShortlistOpen(false)}
        onSelectService={(id) => {
          setSelectedServiceId(id);
          setShortlistOpen(false);
        }}
      />

      {/* Footer */}
      <footer className="bg-card py-12 border-t border-border mt-2">
        <div className="container mx-auto px-4 text-center">
          <a href="https://www.ucalgary.ca/about/commitments/recovery-campus" target="_blank" rel="noopener noreferrer">
            <img src={ucalgaryLogo} alt="University of Calgary Recovery on Campus logo" className="h-16 w-auto mx-auto mb-4 opacity-60 hover:opacity-80 transition-opacity" loading="lazy" />
          </a>
          <p className="text-muted-foreground text-sm mb-4">
            {t('app.footer')}
          </p>
        </div>
      </footer>

      <FeedbackModal
        open={!!feedbackContext}
        onClose={() => setFeedbackContext(null)}
        serviceId={feedbackContext?.serviceId}
        serviceName={feedbackContext?.serviceName}
        searchQuery={searchState.query}
      />

      <IntakeWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
