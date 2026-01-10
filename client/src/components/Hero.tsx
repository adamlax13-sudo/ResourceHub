import { Search } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface HeroProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function Hero({ onSearch, isLoading }: HeroProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="relative overflow-hidden bg-primary text-primary-foreground pt-24 pb-32 md:pt-32 md:pb-48 rounded-b-[3rem] md:rounded-b-[4rem] shadow-xl">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-secondary blur-3xl" />
      </div>

      <div className="container max-w-4xl mx-auto px-4 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 text-white tracking-tight leading-tight">
            Find the support you need,<br className="hidden md:block" /> right here in Alberta.
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto font-light">
            Connect with mental health, financial aid, housing, and social services. 
            We're here to guide you through the process, step by step.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="relative max-w-2xl mx-auto"
        >
          <div className="relative group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., I need help paying my rent..."
              className="w-full h-16 pl-6 pr-16 rounded-2xl text-lg text-foreground bg-white shadow-2xl border-2 border-transparent focus:border-secondary focus:outline-none transition-all placeholder:text-slate-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 h-12 w-12 bg-secondary text-white rounded-xl flex items-center justify-center hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </button>
          </div>
          <p className="mt-4 text-sm text-blue-200 font-medium opacity-80">
            Try searching for "food banks in Calgary" or "mental health support for youth"
          </p>
        </motion.form>
      </div>
    </div>
  );
}
