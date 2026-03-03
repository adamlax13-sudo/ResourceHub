import { useState, lazy, Suspense, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Hero } from "@/components/Hero";
import { useSearch } from "@/hooks/use-search";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceCardSkeleton } from "@/components/ServiceCardSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Info, MessageSquare } from "lucide-react";
import rocLogo from "@/assets/About_Recovery_on_Campus_Alberta_1768060674341.png";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useSearchContext } from "@/contexts/SearchContext";
import { CategoryTiles } from "@/components/CategoryTiles";

const ServiceModal = lazy(() => import("@/components/ServiceModal").then(m => ({ default: m.ServiceModal })));
const WelcomeModal = lazy(() => import("@/components/WelcomeModal").then(m => ({ default: m.WelcomeModal })));

export default function Home() {
  const { mutate: search, isPending, data, error } = useSearch();
  const { searchState, setSearchResults, setLocations } = useSearchContext();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { t } = useTranslation();

  // Store search results when data changes
  // Note: We only depend on data and setSearchResults
  // The locations are already tracked in the context from when search was initiated
  useEffect(() => {
    if (data && data.services) {
      // Pass current locations from searchState at time of update
      setSearchResults(data.query, data.services);
    }
  }, [data, setSearchResults]);

  const displayServices = data?.services || (searchState.hasSearched ? searchState.services : null);

  const handleSearch = useCallback((query: string, locations: string[], hp?: string) => {
    // Single location from dropdown (or empty for "All of Alberta")
    const locationParam = locations.length > 0 ? locations[0] : undefined;
    search({ query, location: locationParam, ...(hp ? { hp } : {}) });
  }, [search]);

  const handleLocationChange = (location: string) => {
    // Set single location (empty string = "All of Alberta" = empty array)
    setLocations(location ? [location] : []);
  };

  const handleEmergencySearch = useCallback(() => {
    handleSearch("crisis support emergency help right now", searchState.locations);
  }, [handleSearch, searchState.locations]);

  const handleCategorySelect = useCallback((query: string) => {
    handleSearch(query, searchState.locations);
  }, [handleSearch, searchState.locations]);

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
      />

      <div className="container mx-auto px-4 -mt-20 relative z-20 pb-20">
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
              <p className="text-muted-foreground">{error.message}</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayServices.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    index={index}
                    onClick={() => setSelectedServiceId(service.id)}
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

      {/* Service Details Modal */}
      <Suspense fallback={null}>
        <ServiceModal
          serviceId={selectedServiceId}
          isOpen={!!selectedServiceId}
          onClose={() => setSelectedServiceId(null)}
        />
      </Suspense>

      {/* Footer */}
      <footer className="bg-card py-12 border-t border-border mt-2">
        <div className="container mx-auto px-4 text-center">
          <a href="https://www.recoveryoncampusalberta.ca/" target="_blank" rel="noopener noreferrer">
            <img src={rocLogo} alt="ROC Logo" className="h-16 w-auto mx-auto mb-4 opacity-60 hover:opacity-80 transition-opacity" loading="lazy" />
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
    </div>
  );
}
