import { useState } from "react";
import { Hero } from "@/components/Hero";
import { useSearch } from "@/hooks/use-search";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceModal } from "@/components/ServiceModal";
import { type ServiceDetail } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Info } from "lucide-react";

export default function Home() {
  const { mutate: search, isPending, data, error } = useSearch();
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);

  const handleSearch = (query: string) => {
    search({ query });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Hero onSearch={handleSearch} isLoading={isPending} />

      <div className="container mx-auto px-4 -mt-20 relative z-20 pb-20">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-2xl mx-auto border border-red-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Unable to complete search</h3>
              <p className="text-slate-600">{error.message}</p>
            </motion.div>
          )}

          {data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mb-12">
                <h2 className="text-2xl font-display font-bold text-foreground mb-4">Summary</h2>
                <p className="text-slate-600 leading-relaxed text-lg">{data.summary}</p>
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
                <div className="text-center py-20 text-slate-400">
                  No services found matching your criteria. Try a different search term.
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
                { title: "Search", desc: "Tell us what kind of support you need in plain English." },
                { title: "Review", desc: "We'll find relevant Alberta services and explain eligibility." },
                { title: "Connect", desc: "Get clear steps, contact info, and documentation lists." }
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center p-6">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-lg border border-slate-100 flex items-center justify-center text-primary font-bold text-xl mb-4">
                    {i + 1}
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm">{step.desc}</p>
                </div>
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
      <footer className="bg-white py-12 border-t border-slate-100 mt-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            © 2025 Alberta Support Finder. Information provided for guidance only.
            <br />
            {/* Scenic Alberta mountain landscape for reassuring atmosphere */}
            {/* HTML Comment: Unsplash image of scenic Alberta mountains */}
            <img 
              src="https://images.unsplash.com/photo-1561134643-6302518001e7?w=1920&q=80" 
              alt="Alberta Landscape" 
              className="w-24 h-24 object-cover rounded-2xl mx-auto mt-6 opacity-80 grayscale hover:grayscale-0 transition-all duration-500"
            />
          </p>
        </div>
      </footer>
    </div>
  );
}
