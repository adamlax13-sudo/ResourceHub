import { Search, MapPin, ChevronDown, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import rocLogo from "@/assets/About_Recovery_on_Campus_Alberta_1768060674341.png";

// Alberta locations for the dropdown
const ALBERTA_LOCATIONS = [
  { value: '', label: 'All of Alberta', isDefault: true },
  { value: 'calgary', label: 'Calgary' },
  { value: 'edmonton', label: 'Edmonton' },
  { value: 'red deer', label: 'Red Deer' },
  { value: 'lethbridge', label: 'Lethbridge' },
  { value: 'medicine hat', label: 'Medicine Hat' },
  { value: 'grande prairie', label: 'Grande Prairie' },
  { value: 'fort mcmurray', label: 'Fort McMurray' },
  { value: 'airdrie', label: 'Airdrie' },
  { value: 'st albert', label: 'St. Albert' },
  { value: 'spruce grove', label: 'Spruce Grove' },
  { value: 'leduc', label: 'Leduc' },
  { value: 'okotoks', label: 'Okotoks' },
  { value: 'cochrane', label: 'Cochrane' },
  { value: 'sherwood park', label: 'Sherwood Park' },
  { value: 'fort saskatchewan', label: 'Fort Saskatchewan' },
  { value: 'camrose', label: 'Camrose' },
  { value: 'lloydminster', label: 'Lloydminster' },
  { value: 'cold lake', label: 'Cold Lake' },
  { value: 'brooks', label: 'Brooks' },
  { value: 'canmore', label: 'Canmore' },
  { value: 'banff', label: 'Banff' },
];

interface HeroProps {
  onSearch: (query: string, locations: string[], hp?: string) => void;
  isLoading: boolean;
  initialQuery?: string;
  locations: string[];
  onLocationChange: (location: string) => void;
}

// Custom Location Dropdown Component with Portal
function LocationDropdown({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = ALBERTA_LOCATIONS.find(loc => loc.value === value) || ALBERTA_LOCATIONS[0];

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Close on scroll
  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => setIsOpen(false);
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);

  const dropdownMenu = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="min-w-[220px]"
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 border border-white/50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-purple-500/5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Location</p>
            </div>

            {/* Options */}
            <div
              className="max-h-[280px] overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
              role="listbox"
            >
              {ALBERTA_LOCATIONS.map((location, index) => {
                const isSelected = location.value === value;
                return (
                  <motion.button
                    key={location.value}
                    type="button"
                    onClick={() => {
                      onChange(location.value);
                      setIsOpen(false);
                    }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    whileHover={{ backgroundColor: 'rgba(139, 92, 246, 0.08)' }}
                    className={`
                      w-full px-4 py-2.5 flex items-center gap-3 text-left
                      transition-colors duration-150
                      ${isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 hover:text-gray-900'
                      }
                      ${location.isDefault ? 'border-b border-gray-100 mb-1' : ''}
                    `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      transition-all duration-200
                      ${isSelected
                        ? 'border-primary bg-primary'
                        : 'border-gray-300'
                      }
                    `}>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </div>
                    <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                      {location.label}
                    </span>
                    {location.isDefault && (
                      <span className="ml-auto text-xs text-gray-400 font-normal">Default</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative inline-block">
      {/* Trigger Button */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          inline-flex items-center gap-2.5 px-5 py-2.5
          bg-white/10 backdrop-blur-md
          border border-white/20 rounded-full
          text-white font-medium text-sm
          hover:bg-white/20 hover:border-white/40
          focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent
          transition-all duration-200 cursor-pointer
          shadow-lg shadow-black/10
          ${isOpen ? 'bg-white/20 border-white/40' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <MapPin className="w-4 h-4 text-white/80" />
        <span className="min-w-[100px] text-left">{selectedOption.label}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-white/60" />
        </motion.div>
      </motion.button>

      {/* Render dropdown via portal to avoid clipping */}
      {typeof document !== 'undefined' && createPortal(dropdownMenu, document.body)}
    </div>
  );
}

export function Hero({ onSearch, isLoading, initialQuery = "", locations, onLocationChange }: HeroProps) {
  const [query, setQuery] = useState(initialQuery);
  const [hp, setHp] = useState("");
  const { t } = useTranslation();

  // Get current selected location (first in array or empty for "All of Alberta")
  const selectedLocation = locations.length > 0 ? locations[0] : '';

  useEffect(() => {
    if (initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query, locations, hp);
    }
  };

  return (
    <div className="relative w-screen max-w-full overflow-hidden bg-primary text-primary-foreground pt-20 pb-32 md:pt-28 md:pb-48 rounded-b-[3rem] md:rounded-b-[4rem] shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-purple-900/50 opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />

      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://www.recoveryoncampusalberta.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 transition-transform hover:scale-105"
            >
              <img
                src={rocLogo}
                alt="ROC Logo"
                className="h-10 sm:h-12 w-auto"
              />
            </a>
            <span className="font-display font-bold text-white text-base sm:text-lg hidden sm:block leading-tight">
              Recovery on<br />Campus Alberta
            </span>
          </div>

          <LanguageSwitcher
            variant="ghost"
            className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
          />
        </div>
      </div>

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
        <motion.svg
          className="absolute -bottom-24 -right-24 w-72 h-72"
          viewBox="0 0 200 200"
          fill="none"
          animate={{
            y: [0, -15, -12, -15, 0],
            x: [0, 5, 3, 5, 0],
            rotate: [130, 140, 138, 142, 130]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.5, 0.6, 1] }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,70 70,150 130,150" stroke="white" strokeWidth="0.6" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.4" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.4" />
        </motion.svg>
        <motion.svg
          className="absolute top-[60%] -left-20 w-52 h-52"
          viewBox="0 0 200 200"
          fill="none"
          animate={{
            y: [0, 12, 10, 14, 0],
            x: [0, 8, 5, 8, 0],
            rotate: [200, 215, 212, 218, 200],
            opacity: [0.6, 0.85, 0.8, 0.85, 0.6]
          }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.45, 0.55, 1], delay: 1.5 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.7" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.4" />
        </motion.svg>
        <motion.svg
          className="absolute top-[8%] right-[8%] w-20 h-20"
          viewBox="0 0 200 200"
          fill="none"
          animate={{
            y: [0, -10, -7, -12, 0],
            rotate: [50, 70, 65, 75, 50]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", times: [0, 0.3, 0.45, 0.6, 1] }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1.5" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" />
        </motion.svg>
        <motion.svg
          className="absolute bottom-[20%] left-[18%] w-12 h-12"
          viewBox="0 0 200 200"
          fill="none"
          animate={{
            y: [0, -8, -5, -9, 0],
            x: [0, 4, 2, 5, 0],
            rotate: [160, 180, 175, 185, 160]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.5, 0.65, 1], delay: 2 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="2" fill="none" />
        </motion.svg>
        <motion.svg
          className="absolute top-[40%] right-[12%] w-16 h-16"
          viewBox="0 0 200 200"
          fill="none"
          animate={{
            y: [0, 8, 5, 10, 0],
            x: [0, -5, -3, -6, 0],
            rotate: [290, 310, 305, 315, 290]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.5, 0.6, 1], delay: 0.5 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1.8" fill="none" />
        </motion.svg>
        <motion.svg
          className="absolute bottom-[5%] left-[35%] w-32 h-32"
          viewBox="0 0 200 200"
          fill="none"
          animate={{
            y: [0, -10, -7, -12, 0],
            rotate: [100, 115, 110, 120, 100],
            opacity: [0.5, 0.75, 0.7, 0.8, 0.5]
          }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.45, 0.6, 1], delay: 3 }}
        >
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,50 50,160 150,160" stroke="white" strokeWidth="0.6" fill="none" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.4" />
        </motion.svg>
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
          {/* Honeypot field: hidden from humans, bots fill it and get silently rejected */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <label htmlFor="website-url">Website</label>
            <input id="website-url" name="website" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          </div>

          {/* Custom Location Dropdown */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <LocationDropdown
              value={selectedLocation}
              onChange={onLocationChange}
            />
          </motion.div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-white/30 via-primary/30 to-white/30 rounded-3xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <label htmlFor="hero-search" className="sr-only">{t('app.searchPlaceholder')}</label>
            <input
              id="hero-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('app.searchPlaceholder')}
              maxLength={200}
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
          <div className="mt-4 flex flex-col items-center gap-2">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-white font-medium"
              >
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Searching for resources...</span>
              </motion.div>
            ) : (
              <p id="search-hint" className="text-sm text-white/70 font-medium">
                {t('app.searchHint')}
              </p>
            )}
          </div>
        </motion.form>
      </div>
    </div>
  );
}
