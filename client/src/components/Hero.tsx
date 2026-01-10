import { Search, User, BookMarked } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

interface HeroProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function Hero({ onSearch, isLoading }: HeroProps) {
  const [query, setQuery] = useState("");
  const { user, isLoading: authLoading } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="relative overflow-hidden bg-primary text-primary-foreground pt-20 pb-32 md:pt-28 md:pb-48 rounded-b-[3rem] md:rounded-b-[4rem] shadow-xl">
      {/* Navigation */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <BookMarked className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-white text-lg hidden sm:block">Recovery Hub</span>
          </div>
          
          <div className="flex items-center gap-3">
            {!authLoading && user ? (
              <>
                <Link href="/my-resources">
                  <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="link-my-resources">
                    My Resources
                  </Button>
                </Link>
                <a href="/api/logout">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/20" data-testid="button-logout">
                    Logout
                  </Button>
                </a>
              </>
            ) : (
              <a href="/api/login">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/20" data-testid="button-login">
                  <User className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-white blur-3xl" />
      </div>

      <div className="container max-w-4xl mx-auto px-4 relative z-10 text-center mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-white tracking-tight leading-tight">
            Recovery on Campus<br className="hidden md:block" /> Resource Hub
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto font-light">
            Find the support you need. Mental health, financial aid, housing, and more.
            We'll guide you through the process, step by step.
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
              placeholder="What kind of support do you need today?"
              className="w-full h-16 pl-6 pr-16 rounded-2xl text-lg text-foreground bg-white shadow-2xl border-2 border-transparent focus:border-primary/30 focus:outline-none transition-all placeholder:text-muted-foreground"
              disabled={isLoading}
              data-testid="input-search"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 h-12 w-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              data-testid="button-search"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </button>
          </div>
          <p className="mt-4 text-sm text-white/70 font-medium">
            Try "mental health support" or "help with tuition"
          </p>
        </motion.form>
      </div>
    </div>
  );
}
