import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Hero } from "@/components/Hero";
import { useSearch } from "@/hooks/use-search";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceModal } from "@/components/ServiceModal";
import { WelcomeModal } from "@/components/WelcomeModal";
import { type ServiceDetail } from "@shared/routes";
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";
import rocLogo from "@assets/About_Recovery_on_Campus_Alberta_1768060674341.png";

export default function Home() {
  const { mutate: search, isPending, data, error } = useSearch();
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);
  const { t } = useTranslation();

  const handleSearch = (query: string) => {
    search({ query });
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <WelcomeModal />
      <Hero onSearch={handleSearch} isLoading={isPending} />

      <div className="container mx-auto px-4 -mt-20 relative z-20 pb-20">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
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

          {data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-card p-8 rounded-3xl shadow-xl border border-border mb-12">
                <h2 className="text-2xl font-display font-bold text-foreground mb-4">{t('search.summary')}</h2>
                <p className="text-muted-foreground leading-relaxed text-lg">{data.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.services.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    index={index}
                    onClick={() => setSelectedService(service)}
                  />
                ))}
              </div>

              {data.services.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  {t('search.noResults')}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {!data && !isPending && !error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-32"
          >
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { title: t('howItWorks.step1Title'), desc: t('howItWorks.step1Desc'), icon: "🔍" },
                { title: t('howItWorks.step2Title'), desc: t('howItWorks.step2Desc'), icon: "📋" },
                { title: t('howItWorks.step3Title'), desc: t('howItWorks.step3Desc'), icon: "🤝" }
              ].map((step, i) => (
                <motion.div 
                  key={i} 
                  className="flex flex-col items-center p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.15 }}
                >
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg border border-primary/20 flex items-center justify-center text-primary font-bold text-xl group-hover:scale-110 transition-transform duration-300">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2 text-foreground group-hover:text-primary transition-colors">{step.title}</h3>
                  <p className="text-muted-foreground text-sm text-center">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Service Details Modal */}
      <ServiceModal
        service={selectedService}
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
      />

      {/* Footer */}
      <footer className="bg-card py-12 border-t border-border mt-20">
        <div className="container mx-auto px-4 text-center">
          <img src={rocLogo} alt="ROC Logo" className="h-16 w-auto mx-auto mb-4 opacity-60" />
          <p className="text-muted-foreground text-sm">
            {t('app.footer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
