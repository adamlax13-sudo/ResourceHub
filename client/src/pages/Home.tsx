import { useState, lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Hero } from "@/components/Hero";
import { useSearch } from "@/hooks/use-search";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceCardSkeleton } from "@/components/ServiceCardSkeleton";
import { type ServiceSummary } from "@shared/routes";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Search, ClipboardList, Heart, RotateCcw, MessageSquare } from "lucide-react";
import rocLogo from "@/assets/About_Recovery_on_Campus_Alberta_1768060674341.png";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useSearchContext } from "@/contexts/SearchContext";

const ServiceModal = lazy(() => import("@/components/ServiceModal").then(m => ({ default: m.ServiceModal })));
const WelcomeModal = lazy(() => import("@/components/WelcomeModal").then(m => ({ default: m.WelcomeModal })));

function FlipCard({ frontContent, backContent, index }: { 
  frontContent: React.ReactNode; 
  backContent: React.ReactNode;
  index: number;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  return (
    <motion.div
      className="relative h-64 cursor-pointer perspective-1000"
      onClick={() => setIsFlipped(!isFlipped)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 + index * 0.15 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      data-testid={`flip-card-${index}`}
    >
      <motion.div
        className="w-full h-full relative"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ 
          duration: 0.6, 
          type: "spring", 
          stiffness: 100,
          damping: 15
        }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div 
          className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 shadow-lg hover:shadow-xl hover:shadow-primary/5 transition-shadow duration-300 p-6 flex flex-col items-center justify-center"
          style={{ backfaceVisibility: "hidden" }}
        >
          {frontContent}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1 text-xs text-muted-foreground/60">
            <RotateCcw className="w-3 h-3" />
            <span>{t('howItWorks.clickToFlip')}</span>
          </div>
        </div>
        
        {/* Back */}
        <div 
          className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-card border border-primary/20 shadow-xl p-6 flex flex-col items-center justify-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {backContent}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const { mutate: search, isPending, data, error } = useSearch();
  const { searchState, setSearchResults, toggleLocation } = useSearchContext();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (data && data.services) {
      setSearchResults(data.query, data.services, searchState.locations);
    }
  }, [data, setSearchResults, searchState.locations]);

  const displayServices = data?.services || (searchState.hasSearched ? searchState.services : null);

  const handleSearch = (query: string, locations: string[], hp?: string) => {
    // Join multiple locations with comma for the API
    const locationParam = locations.length > 0 ? locations.join(',') : undefined;
    search({ query, location: locationParam, ...(hp ? { hp } : {}) });
  };

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
        onToggleLocation={toggleLocation}
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
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-32"
          >
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto" style={{ perspective: "1000px" }}>
              {[
                { 
                  title: t('howItWorks.step1Title'), 
                  desc: t('howItWorks.step1Desc'), 
                  back: t('howItWorks.step1Back'),
                  Icon: Search 
                },
                { 
                  title: t('howItWorks.step2Title'), 
                  desc: t('howItWorks.step2Desc'), 
                  back: t('howItWorks.step2Back'),
                  Icon: ClipboardList 
                },
                { 
                  title: t('howItWorks.step3Title'), 
                  desc: t('howItWorks.step3Desc'), 
                  back: t('howItWorks.step3Back'),
                  Icon: Heart 
                }
              ].map((step, i) => (
                <FlipCard
                  key={i}
                  index={i}
                  frontContent={
                    <>
                      <div className="relative mb-4">
                        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-50" />
                        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg border border-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                          {i + 1}
                        </div>
                      </div>
                      <h3 className="font-display font-bold text-lg mb-2 text-foreground">{step.title}</h3>
                      <p className="text-muted-foreground text-sm text-center">{step.desc}</p>
                    </>
                  }
                  backContent={
                    <>
                      <step.Icon className="w-10 h-10 text-primary mb-4" />
                      <h3 className="font-display font-bold text-lg mb-3 text-foreground">{step.title}</h3>
                      <p className="text-muted-foreground text-sm text-center leading-relaxed">{step.back}</p>
                    </>
                  }
                />
              ))}
            </div>
          </motion.div>
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
