import { useState, useRef, lazy, Suspense, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Hero } from "@/components/Hero";
import { useSearch } from "@/hooks/use-search";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceCardSkeleton } from "@/components/ServiceCardSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Info, MessageSquare, SlidersHorizontal, X, Heart, Share2 } from "lucide-react";
import ucalgaryLogo from "@/assets/ucalgary-gear-logo.png";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useSearchContext, updateSearchUrl } from "@/contexts/SearchContext";
import { CategoryTiles } from "@/components/CategoryTiles";
import { IntakeWizard } from "@/components/IntakeWizard";
import { RefinePanel } from "@/components/RefinePanel";
import { MyShortlist } from "@/components/MyShortlist";
import { useFavoritesContext } from "@/hooks/use-favorites";
import type { SearchFilters } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

const ServiceModal = lazy(() => import("@/components/ServiceModal").then(m => ({ default: m.ServiceModal })));
const WelcomeModal = lazy(() => import("@/components/WelcomeModal").then(m => ({ default: m.WelcomeModal })));

interface FilterChip {
  key: string;
  label: string;
}

function buildFilterChips(filters: SearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];

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
  } else if (chipKey.startsWith("lang_")) {
    const lang = chipKey.slice(5);
    const langs = (next.languagesSupported ?? []).filter((l) => l !== lang);
    next.languagesSupported = langs.length > 0 ? langs : undefined;
  }

  return next;
}

export default function Home() {
  const { mutate: search, isPending, data, error } = useSearch();
  const { searchState, setSearchResults, setLocations, setFilters, clearFilters, activeFilterCount } = useSearchContext();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refinePanelOpen, setRefinePanelOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
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

  const handleSearch = useCallback((query: string, locations: string[], hp?: string) => {
    // Single location from dropdown (or empty for "All of Alberta")
    const locationParam = locations.length > 0 ? locations[0] : undefined;
    const filters = searchStateRef.current.filters;
    const filterParams: Partial<SearchFilters> = {};
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
    search({ query, location: locationParam, ...filterParams, ...(hp ? { hp } : {}) });
  }, [search]);

  const handleSearchWithFilters = useCallback(
    (query: string, locations: string[], filters: SearchFilters) => {
      const locationParam = locations.length > 0 ? locations[0] : undefined;
      const filterParams: Partial<SearchFilters> = {};
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
      search({ query, location: locationParam, ...filterParams });
    },
    [search]
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

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Share this link to show the same search results." });
    } catch {
      toast({ title: "Copy this link", description: url });
    }
  }, [toast]);

  const filterChips = buildFilterChips(searchState.filters);

  return (
    <div className="min-h-screen bg-background font-sans overflow-x-hidden">
      <Suspense fallback={null}>
        <WelcomeModal />
      </Suspense>
      <Hero
        onSearch={handleSearch}
        isLoading={isPending}
        initialQuery={searchState.query}
        locations={searchState.locations}
        onLocationChange={handleLocationChange}
        onEmergencySearch={handleEmergencySearch}
        onOpenWizard={handleOpenWizard}
      />

      <div className={`container mx-auto px-4 relative z-20 pb-20 ${(displayServices || isPending || error) ? '-mt-20' : ''}`}>
        {/* Active filter chips — shown below Hero when there are active filters */}
        <AnimatePresence>
          {filterChips.length > 0 && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              {/* Results toolbar: Shortlist + Refine buttons */}
              <div className="flex items-center justify-end gap-2 mb-4">
                {favoriteCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShortlistOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    aria-label={`Open shortlist, ${favoriteCount} saved`}
                  >
                    <Heart className="w-4 h-4 text-red-500 fill-current" aria-hidden="true" />
                    Shortlist ({favoriteCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  aria-label="Share search results"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => setRefinePanelOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors relative"
                  aria-expanded={refinePanelOpen}
                  aria-controls="refine-panel"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Refine
                  {activeFilterCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <button
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            data-testid="button-open-feedback"
          >
            <MessageSquare className="w-4 h-4" />
            {t('feedback.link')}
          </button>
        </div>
      </footer>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <IntakeWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
