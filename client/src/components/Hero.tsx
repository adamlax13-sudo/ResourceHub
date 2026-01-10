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
      {/* Navigation */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={rocLogo} alt="ROC Logo" className="h-10 w-auto" />
            <span className="font-display font-bold text-white text-lg hidden sm:block">{t('app.name')}</span>
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

      {/* Geometric Background Pattern - Inspired by ROC crystalline triangle */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
        <svg className="absolute -top-20 -left-20 w-96 h-96" viewBox="0 0 200 200" fill="none">
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,70 70,150 130,150" stroke="white" strokeWidth="1" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.5" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.5" />
        </svg>
        <svg className="absolute top-1/4 right-0 w-72 h-72 rotate-45" viewBox="0 0 200 200" fill="none">
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="1" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" />
        </svg>
        <svg className="absolute bottom-10 left-1/4 w-48 h-48 -rotate-12" viewBox="0 0 200 200" fill="none">
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.5" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="container max-w-4xl mx-auto px-4 relative z-10 text-center mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-white tracking-tight leading-tight">
            {t('app.title')}
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
        >
          <div className="relative group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('app.searchPlaceholder')}
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
            {t('app.searchHint')}
          </p>
        </motion.form>
      </div>
    </div>
  );
}
