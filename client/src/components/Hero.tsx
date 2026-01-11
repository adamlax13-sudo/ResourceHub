import { Search, User, Sparkles, Heart, LogOut } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import rocLogo from "@assets/About_Recovery_on_Campus_Alberta_1768060674341.png";

interface HeroProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function Hero({ onSearch, isLoading }: HeroProps) {
  const [query, setQuery] = useState("");
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="relative overflow-hidden bg-primary text-primary-foreground pt-20 pb-32 md:pt-28 md:pb-48 rounded-b-[3rem] md:rounded-b-[4rem] shadow-xl">
      {/* Animated gradient overlay for extra flair */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-purple-900/50 opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
      
      {/* Navigation */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <a href="https://www.recoveryoncampusalberta.ca/" target="_blank" rel="noopener noreferrer">
              <img 
                src={rocLogo} 
                alt="ROC Logo" 
                className="h-12 w-auto" 
              />
            </a>
            <span className="font-display font-bold text-white text-lg hidden sm:block leading-tight">Recovery on<br />Campus Alberta</span>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-wrap justify-end">
            <LanguageSwitcher variant="ghost" className="text-white hover:bg-white/20" />
            {!authLoading && user ? (
              <>
                <Link href="/recommended">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 md:hidden" data-testid="link-recommended-mobile">
                    <Sparkles className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" className="text-white hover:bg-white/20 hidden md:flex" data-testid="link-recommended">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('nav2.recommended')}
                  </Button>
                </Link>
                <Link href="/my-resources">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 md:hidden" data-testid="link-my-resources-mobile">
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" className="text-white hover:bg-white/20 hidden md:flex" data-testid="link-my-resources">
                    {t('nav.myResources')}
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 md:hidden" data-testid="link-profile-mobile">
                    <User className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" className="text-white hover:bg-white/20 hidden md:flex" data-testid="link-profile">
                    <User className="w-4 h-4 mr-2" />
                    {t('nav2.profile')}
                  </Button>
                </Link>
                <a href="/api/logout">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 md:hidden" data-testid="button-logout-mobile">
                    <LogOut className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/20 hidden md:flex" data-testid="button-logout">
                    {t('nav.logout')}
                  </Button>
                </a>
              </>
            ) : (
              <a href="/api/login">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/20" data-testid="button-login">
                  <User className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{t('nav.signIn')}</span>
                  <span className="sm:hidden">Login</span>
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Geometric Background Pattern - Inspired by ROC crystalline triangle with animation */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-25 pointer-events-none">
        <motion.svg 
          className="absolute -top-20 -left-20 w-96 h-96" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,70 70,150 130,150" stroke="white" strokeWidth="1" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.5" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.5" />
        </motion.svg>
        <motion.svg 
          className="absolute top-1/4 right-0 w-72 h-72 rotate-45" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="1" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" />
        </motion.svg>
        <motion.svg 
          className="absolute bottom-10 left-1/4 w-48 h-48 -rotate-12" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.5" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.5" />
        </motion.svg>
        {/* Additional floating triangles with varied orientations - spaced out */}
        {/* Large complex triangle - bottom right */}
        <motion.svg 
          className="absolute -bottom-16 -right-16 w-80 h-80" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, -12, 0], rotate: [130, 145, 130] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,70 70,150 130,150" stroke="white" strokeWidth="0.6" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.4" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.4" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.4" />
        </motion.svg>
        {/* Large complex triangle - center left */}
        <motion.svg 
          className="absolute top-1/3 -left-10 w-72 h-72" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, 15, 0], rotate: [220, 235, 220], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.7" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.4" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.4" />
        </motion.svg>
        {/* Medium triangle - top center-right */}
        <motion.svg 
          className="absolute top-8 right-[15%] w-36 h-36" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, -18, 0], rotate: [45, 65, 45] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1.2" fill="none" />
          <polygon points="100,50 50,160 150,160" stroke="white" strokeWidth="0.6" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.4" />
        </motion.svg>
        {/* Small triangle - far left bottom */}
        <motion.svg 
          className="absolute bottom-[15%] left-[5%] w-20 h-20" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, -12, 0], rotate: [160, 180, 160] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1.5" fill="none" />
        </motion.svg>
        {/* Small triangle - center area */}
        <motion.svg 
          className="absolute top-[45%] right-[35%] w-14 h-14" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, 10, 0], rotate: [280, 300, 280] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="2" fill="none" />
        </motion.svg>
        {/* Tiny triangle - bottom center */}
        <motion.svg 
          className="absolute bottom-[25%] left-[45%] w-10 h-10" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, -8, 0], rotate: [70, 90, 70], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="2.5" fill="none" />
        </motion.svg>
        {/* Medium complex triangle - far right center */}
        <motion.svg 
          className="absolute top-[55%] -right-8 w-48 h-48" 
          viewBox="0 0 200 200" 
          fill="none"
          animate={{ y: [0, 10, 0], rotate: [310, 325, 310], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.5" fill="none" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.3" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.3" />
        </motion.svg>
        {/* Additional floating particles */}
        <motion.div 
          className="absolute top-1/3 left-1/3 w-2 h-2 bg-white rounded-full"
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-2/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full"
          animate={{ y: [0, -15, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-1/4 w-1 h-1 bg-white rounded-full"
          animate={{ y: [0, -10, 0], opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      <div className="container max-w-4xl mx-auto px-4 relative z-10 text-center mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-white tracking-tight">
            <span className="block">Recovery on Campus</span>
            <span className="block mt-2">Alberta Resource Hub</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto font-light">
            {t('app.subtitle')}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="relative max-w-2xl mx-auto"
          role="search"
          aria-label={t('app.searchPlaceholder')}
        >
          <div className="relative group">
            {/* Glow effect on focus */}
            <div className="absolute -inset-1 bg-gradient-to-r from-white/30 via-primary/30 to-white/30 rounded-3xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <label htmlFor="hero-search" className="sr-only">{t('app.searchPlaceholder')}</label>
            <input
              id="hero-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('app.searchPlaceholder')}
              className="relative w-full h-16 pl-6 pr-16 rounded-2xl text-lg text-foreground bg-white shadow-2xl border-2 border-transparent focus:border-primary/30 focus:outline-none transition-all placeholder:text-muted-foreground focus:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              disabled={isLoading}
              aria-describedby="search-hint"
              data-testid="input-search"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 h-12 w-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              aria-label={isLoading ? "Searching..." : "Search"}
              data-testid="button-search"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
              ) : (
                <Search className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
          <p id="search-hint" className="mt-4 text-sm text-white/70 font-medium">
            {t('app.searchHint')}
          </p>
        </motion.form>
      </div>
    </div>
  );
}
