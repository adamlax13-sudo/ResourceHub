import { Search, MapPin, ChevronDown, Check, Mic, MicOff, SlidersHorizontal, Locate, LocateFixed, Loader2, MessageSquarePlus } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QuickExitButton } from './QuickExitButton';
import { SearchSuggestions } from './SearchSuggestions';
import ucalgaryLogo from "@/assets/ucalgary-gear-logo.png";
import { extractQueryLocation } from "@/lib/extract-query-location";

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
  hasResults?: boolean;
  initialQuery?: string;
  locations: string[];
  onLocationChange: (location: string) => void;
  onEmergencySearch: () => void;
  onOpenWizard: () => void;
  onOpenRefinePanel: () => void;
  activeFilterCount: number;
  userCoords: { lat: number; lng: number } | null;
  onNearMe: () => void;
  isLocating: boolean;
  openFeedback?: () => void;
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

  // Close on scroll (but not when scrolling inside the dropdown)
  useEffect(() => {
    if (isOpen) {
      const handleScroll = (e: Event) => {
        // Don't close if scrolling inside the dropdown
        if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
          return;
        }
        setIsOpen(false);
      };
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);

  // Close on resize (dropdown position becomes stale)
  useEffect(() => {
    if (isOpen) {
      const handleResize = () => setIsOpen(false);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
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
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-accent/5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Location</p>
            </div>

            {/* Options */}
            <div
              className="max-h-[280px] overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
              role="listbox"
              id="location-listbox"
              aria-label="Select location"
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
        aria-label={`Location filter: ${selectedOption.label}`}
        aria-controls="location-listbox"
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

// Minimal interface for the Web Speech Recognition instance
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

// Module-level constant — API lookup runs once, not on every render
const SpeechRecognitionAPI: (new () => SpeechRecognitionInstance) | undefined =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : undefined;

// Voice search hook — uses browser-native Web Speech API, no backend needed
function useVoiceSearch() {
  const isSupported = Boolean(SpeechRecognitionAPI);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Cleanup on unmount — prevents handlers firing on an unmounted component
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback((onResult: (transcript: string) => void) => {
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-CA';

    recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, []);

  return { isSupported, isListening, startListening, stopListening };
}

export function Hero({ onSearch, isLoading, hasResults, initialQuery = "", locations, onLocationChange, onEmergencySearch, onOpenWizard, onOpenRefinePanel, activeFilterCount, userCoords, onNearMe, isLocating, openFeedback }: HeroProps) {
  const [query, setQuery] = useState(initialQuery);
  const [hp, setHp] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const { isSupported: voiceSupported, isListening, startListening, stopListening } = useVoiceSearch();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Clamp between min (64px / h-16) and max (160px)
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 64), 160)}px`;
  }, []);

  useLayoutEffect(() => { autoResize(); }, [query, autoResize]);

  // Get current selected location (first in array or empty for "All of Alberta")
  const selectedLocation = locations.length > 0 ? locations[0] : '';
  const locationsRef = useRef(locations);
  locationsRef.current = locations;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowSuggestions(false);

    const detectedLocation = extractQueryLocation(query);
    // If query mentions a location that differs from the dropdown, sync it.
    // onLocationChange updates state async, so we pass detectedLocation
    // directly to onSearch rather than relying on the updated locations prop.
    if (detectedLocation !== null && detectedLocation !== selectedLocation) {
      onLocationChange(detectedLocation);
      onSearch(query, detectedLocation ? [detectedLocation] : [], hp);
    } else {
      onSearch(query, locations, hp);
    }
  };

  return (
    <div className={`relative w-screen max-w-full overflow-hidden bg-[#D6001C] text-white pt-16 ${hasResults ? 'pb-10' : 'pb-14'} md:pt-20 md:pb-24 rounded-b-[3rem] md:rounded-b-[4rem] shadow-xl`}>
      {/* Flowing wave background — red/orange/pink layers inspired by UCalgary */}
      <div className="absolute inset-0">
        <svg className="w-full h-full" viewBox="0 0 1440 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="heroWave1" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#7A0014" />
              <stop offset="40%" stopColor="#D6001C" />
              <stop offset="100%" stopColor="#FF671F" />
            </linearGradient>
            <linearGradient id="heroWave2" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ED0A72" />
              <stop offset="50%" stopColor="#E8461E" />
              <stop offset="100%" stopColor="#D6001C" />
            </linearGradient>
            <linearGradient id="heroWave3" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF671F" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFA300" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <rect width="1440" height="800" fill="#D6001C" />
          {/* Deep wave from bottom-left */}
          <path d="M0,120 C180,40 380,220 700,160 C1020,100 1240,280 1440,220 L1440,800 L0,800Z" fill="url(#heroWave1)" opacity="0.85" />
          {/* Pink/coral sweep from top-right */}
          <path d="M500,0 C700,90 860,25 1060,130 C1260,235 1380,85 1440,160 L1440,0 L500,0Z" fill="url(#heroWave2)" opacity="0.5" />
          {/* Mid wave — orange accent */}
          <path d="M0,380 C260,270 520,430 820,320 C1120,210 1360,370 1440,310 L1440,800 L0,800Z" fill="url(#heroWave2)" opacity="0.55" />
          {/* Top-right warm glow */}
          <path d="M700,0 C900,60 1100,20 1300,100 C1400,140 1440,80 1440,80 L1440,0Z" fill="url(#heroWave3)" opacity="0.45" />
        </svg>
      </div>
      {/* Diagonal hatching overlay */}
      <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.035) 3px, rgba(255,255,255,0.035) 6px)' }} />

      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://www.ucalgary.ca/about/commitments/recovery-campus"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 transition-transform hover:scale-105"
            >
              <img
                src={ucalgaryLogo}
                alt="University of Calgary Recovery on Campus logo"
                className="h-10 sm:h-12 w-auto"
              />
            </a>
            <span className="font-display font-bold text-white text-base sm:text-lg hidden sm:block leading-tight">
              Recovery on<br />Campus Alberta
            </span>
          </div>

          <div className="flex items-center gap-2">
            {openFeedback && (
              <button
                onClick={openFeedback}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
                aria-label={t('feedback.headerButton')}
                data-testid="button-header-feedback"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('feedback.headerButton')}</span>
              </button>
            )}
            <QuickExitButton
              className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
            />
            <LanguageSwitcher
              variant="ghost"
              className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Floating geometric triangles — 4-column layout, no overlap */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-35 pointer-events-none">
        {/* Row 1 — top edge */}
        {/* Large, top-left corner overflow */}
        <motion.svg className="absolute -top-12 -left-12 w-72 h-72" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, 18, -6, 14, 0], y: [0, -12, 8, -16, 0], rotate: [0, 12, 6, 18, 0] }}
          transition={prefersReducedMotion ? {} : { duration: 22, repeat: Infinity, ease: "easeInOut" }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.5" fill="none" />
          <polygon points="100,70 70,150 130,150" stroke="white" strokeWidth="0.3" fill="none" />
        </motion.svg>
        {/* Small, top ~30% */}
        <motion.svg className="absolute top-[4%] left-[28%] w-10 h-10" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -10, 8, -6, 0], y: [0, 12, -8, 14, 0], rotate: [20, 50, 35, 60, 20] }}
          transition={prefersReducedMotion ? {} : { duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="2.5" fill="none" />
        </motion.svg>
        {/* Medium, top-center */}
        <motion.svg className="absolute top-[2%] left-[50%] w-32 h-32" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -14, 10, -12, 0], y: [0, 16, -6, 18, 0], rotate: [80, 100, 90, 108, 80] }}
          transition={prefersReducedMotion ? {} : { duration: 16, repeat: Infinity, ease: "easeInOut", delay: 3 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.4" />
        </motion.svg>
        {/* Large, top-right overflow */}
        <motion.svg className="absolute -top-8 -right-10 w-64 h-64" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -16, 6, -12, 0], y: [0, 14, -10, 16, 0], rotate: [130, 148, 138, 155, 130], opacity: [0.6, 1, 0.8, 0.9, 0.6] }}
          transition={prefersReducedMotion ? {} : { duration: 20, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,45 45,165 155,165" stroke="white" strokeWidth="0.5" fill="none" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.3" />
        </motion.svg>

        {/* Row 2 — upper-mid ~25-40% */}
        {/* Small, left quarter */}
        <motion.svg className="absolute top-[28%] left-[8%] w-8 h-8" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, 12, -8, 10, 0], y: [0, -10, 14, -8, 0], rotate: [0, 35, 18, 42, 0] }}
          transition={prefersReducedMotion ? {} : { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="3" fill="none" />
        </motion.svg>
        {/* Medium, left-center */}
        <motion.svg className="absolute top-[30%] left-[30%] w-28 h-28" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, 20, -8, 16, 0], y: [0, -18, 12, -14, 0], rotate: [200, 222, 212, 228, 200] }}
          transition={prefersReducedMotion ? {} : { duration: 15, repeat: Infinity, ease: "easeInOut", delay: 4 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1" fill="none" />
          <polygon points="100,50 50,160 150,160" stroke="white" strokeWidth="0.6" fill="none" />
        </motion.svg>
        {/* Small, right-center */}
        <motion.svg className="absolute top-[26%] right-[28%] w-12 h-12" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -8, 10, -6, 0], y: [0, 10, -12, 8, 0], rotate: [90, 112, 100, 118, 90] }}
          transition={prefersReducedMotion ? {} : { duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="2" fill="none" />
        </motion.svg>
        {/* Medium, far right */}
        <motion.svg className="absolute top-[32%] right-[4%] w-24 h-24" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -18, 8, -14, 0], y: [0, 14, -16, 10, 0], rotate: [280, 300, 290, 306, 280] }}
          transition={prefersReducedMotion ? {} : { duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1.2" fill="none" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.4" />
        </motion.svg>

        {/* Row 3 — lower-mid ~50-65% */}
        {/* Large, left overflow */}
        <motion.svg className="absolute top-[52%] -left-8 w-56 h-56" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, 22, -4, 18, 0], y: [0, -14, 10, -18, 0], rotate: [160, 178, 168, 184, 160] }}
          transition={prefersReducedMotion ? {} : { duration: 18, repeat: Infinity, ease: "easeInOut", delay: 3 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.5" fill="none" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.3" />
        </motion.svg>
        {/* Small, center-left */}
        <motion.svg className="absolute top-[58%] left-[35%] w-6 h-6" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, 8, -10, 6, 0], y: [0, -8, 12, -10, 0], rotate: [40, 65, 52, 72, 40] }}
          transition={prefersReducedMotion ? {} : { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="3.5" fill="none" />
        </motion.svg>
        {/* Medium, center-right */}
        <motion.svg className="absolute top-[55%] right-[30%] w-20 h-20" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -14, 10, -12, 0], y: [0, 16, -8, 14, 0], rotate: [310, 330, 320, 336, 310] }}
          transition={prefersReducedMotion ? {} : { duration: 11, repeat: Infinity, ease: "easeInOut", delay: 4.5 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1.5" fill="none" />
        </motion.svg>
        {/* Small, far right */}
        <motion.svg className="absolute top-[60%] right-[8%] w-10 h-10" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -10, 6, -8, 0], y: [0, -12, 10, -14, 0], rotate: [240, 265, 252, 272, 240] }}
          transition={prefersReducedMotion ? {} : { duration: 8, repeat: Infinity, ease: "easeInOut", delay: 5 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="2.5" fill="none" />
        </motion.svg>

        {/* Row 4 — bottom edge */}
        {/* Medium, bottom-left */}
        <motion.svg className="absolute bottom-[6%] left-[6%] w-24 h-24" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, 16, -6, 14, 0], y: [0, -18, 8, -14, 0], rotate: [60, 80, 70, 86, 60] }}
          transition={prefersReducedMotion ? {} : { duration: 14, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="1.2" fill="none" />
          <line x1="10" y1="190" x2="145" y2="100" stroke="white" strokeWidth="0.4" />
        </motion.svg>
        {/* Large, bottom-center */}
        <motion.svg className="absolute -bottom-14 left-[30%] w-60 h-60" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -14, 10, -10, 0], y: [0, -10, 14, -12, 0], rotate: [150, 168, 158, 174, 150], opacity: [0.5, 0.9, 0.7, 0.85, 0.5] }}
          transition={prefersReducedMotion ? {} : { duration: 21, repeat: Infinity, ease: "easeInOut", delay: 2 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,40 40,170 160,170" stroke="white" strokeWidth="0.5" fill="none" />
          <polygon points="100,70 70,150 130,150" stroke="white" strokeWidth="0.3" fill="none" />
        </motion.svg>
        {/* Small, bottom ~60% */}
        <motion.svg className="absolute bottom-[8%] right-[35%] w-8 h-8" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, 10, -8, 12, 0], y: [0, -10, 8, -6, 0], rotate: [180, 205, 192, 210, 180] }}
          transition={prefersReducedMotion ? {} : { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 3.5 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="3" fill="none" />
        </motion.svg>
        {/* Large, bottom-right overflow */}
        <motion.svg className="absolute -bottom-10 -right-8 w-52 h-52" viewBox="0 0 200 200" fill="none"
          animate={prefersReducedMotion ? {} : { x: [0, -18, 6, -14, 0], y: [0, -16, 10, -18, 0], rotate: [320, 340, 330, 345, 320] }}
          transition={prefersReducedMotion ? {} : { duration: 17, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
          <polygon points="100,10 10,190 190,190" stroke="white" strokeWidth="0.8" fill="none" />
          <polygon points="100,45 45,165 155,165" stroke="white" strokeWidth="0.5" fill="none" />
          <line x1="190" y1="190" x2="55" y2="100" stroke="white" strokeWidth="0.3" />
        </motion.svg>

        {/* Floating dots — evenly placed in gaps */}
        <motion.div className="absolute top-[18%] left-[18%] w-2 h-2 bg-white rounded-full"
          animate={prefersReducedMotion ? {} : { x: [0, 12, -8, 10, 0], y: [0, -14, 8, -10, 0], opacity: [0.3, 0.8, 0.4, 0.7, 0.3] }}
          transition={prefersReducedMotion ? {} : { duration: 7, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute top-[42%] left-[55%] w-1.5 h-1.5 bg-white rounded-full"
          animate={prefersReducedMotion ? {} : { x: [0, -10, 6, -8, 0], y: [0, 12, -10, 14, 0], opacity: [0.4, 0.9, 0.5, 0.8, 0.4] }}
          transition={prefersReducedMotion ? {} : { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
        <motion.div className="absolute bottom-[20%] left-[70%] w-1 h-1 bg-white rounded-full"
          animate={prefersReducedMotion ? {} : { x: [0, 8, -6, 10, 0], y: [0, -8, 12, -6, 0], opacity: [0.2, 0.7, 0.3, 0.6, 0.2] }}
          transition={prefersReducedMotion ? {} : { duration: 9, repeat: Infinity, ease: "easeInOut", delay: 4 }} />
      </div>

      <div className="container max-w-4xl mx-auto px-4 relative z-10 text-center mt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-5 text-white tracking-tight">
            <span className="block">Recovery on Campus</span>
            <span className="block mt-2">Alberta Resource Hub</span>
          </h1>
          <p className="text-base md:text-lg text-white/80 mb-10 max-w-2xl mx-auto font-light">
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

          {/* Emergency + Location — side by side */}
          <div className="flex items-center justify-center gap-4 mb-7 flex-wrap">
            <button
              type="button"
              onClick={onEmergencySearch}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full
                         bg-white/10 backdrop-blur-md border border-white/20 text-white/90
                         hover:bg-red-500/20 hover:border-red-400/40 hover:text-white
                         focus:outline-none focus:ring-2 focus:ring-white/30
                         transition-all duration-200 text-sm font-medium shadow-sm"
              aria-label="Get immediate crisis support"
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" aria-hidden="true" />
              I need help right now
            </button>

            {'geolocation' in navigator && (
              <button
                type="button"
                onClick={onNearMe}
                disabled={isLocating}
                className={`
                  inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full
                  backdrop-blur-md border text-sm font-medium
                  focus:outline-none focus:ring-2 focus:ring-white/30
                  transition-[background-color,border-color,color,box-shadow] duration-300 ease-in-out
                  ${userCoords
                    ? 'bg-white text-primary border-white shadow-md'
                    : 'bg-white/10 border-white/20 text-white/90 shadow-sm hover:bg-white/20 hover:border-white/30 hover:text-white'
                  }
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
                aria-label="Find services near your current location"
                aria-busy={isLocating}
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : userCoords ? (
                  <LocateFixed className="w-4 h-4" />
                ) : (
                  <Locate className="w-4 h-4" />
                )}
                {isLocating ? 'Locating...' : 'Near me'}
              </button>
            )}

            <LocationDropdown
              value={selectedLocation}
              onChange={onLocationChange}
            />
          </div>

          <div ref={searchContainerRef} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-white/30 via-primary/30 to-white/30 rounded-3xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <label htmlFor="hero-search" className="sr-only">{t('app.searchPlaceholder')}</label>
            {/* Filter icon — opens RefinePanel for pre-search refinement */}
            <button
              type="button"
              onClick={onOpenRefinePanel}
              className="absolute left-2 top-2 h-12 w-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all z-10"
              aria-label="Open search filters"
            >
              <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
            </button>
            <textarea
              ref={textareaRef}
              id="hero-search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                // Submit on Enter (without Shift for newline)
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  setShowSuggestions(false);
                  if (query.trim()) handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder={t('app.searchPlaceholder')}
              maxLength={500}
              rows={1}
              className={`relative w-full min-h-[64px] pl-14 pt-[18px] rounded-2xl text-lg text-foreground bg-white shadow-2xl border-2 border-transparent focus:border-primary/30 focus:outline-none transition-all placeholder:text-muted-foreground focus:shadow-[0_0_30px_rgba(255,255,255,0.3)] resize-none overflow-hidden ${voiceSupported ? 'pr-28' : 'pr-16'}`}
              disabled={isLoading}
              aria-describedby="search-hint"
              data-testid="input-search"
            />

            {/* Mic button — only rendered when Web Speech API is available */}
            {voiceSupported && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  if (isListening) {
                    stopListening();
                  } else {
                    startListening((transcript) => {
                      setQuery(transcript);
                      const detectedLocation = extractQueryLocation(transcript);
                      if (detectedLocation !== null && detectedLocation !== selectedLocation) {
                        onLocationChange(detectedLocation);
                        onSearch(transcript, detectedLocation ? [detectedLocation] : []);
                      } else {
                        onSearch(transcript, locationsRef.current);
                      }
                    });
                  }
                }}
                className={`absolute right-16 top-2 h-12 w-12 rounded-xl flex items-center justify-center transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
                aria-label={isListening ? "Stop listening" : "Search by voice"}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-5 h-5" aria-hidden="true" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full animate-pulse" aria-hidden="true" />
                  </>
                ) : (
                  <Mic className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            )}

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

            <SearchSuggestions
              query={query}
              isVisible={showSuggestions && !isLoading}
              anchorRef={searchContainerRef}
              onSelect={(suggestion) => {
                setQuery(suggestion);
                setShowSuggestions(false);
                onSearch(suggestion, locationsRef.current);
              }}
              onDismiss={() => setShowSuggestions(false)}
            />
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-white font-medium"
              >
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Searching for resources...</span>
              </motion.div>
            ) : !hasResults ? (
              <>
                <p id="search-hint" className="text-sm text-white/70 font-medium">
                  {t('app.searchHint')}
                </p>
                <button
                  type="button"
                  onClick={onOpenWizard}
                  className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-full
                             bg-white/15 backdrop-blur-sm border border-white/25 text-white/90
                             hover:bg-white/25 hover:text-white
                             transition-all duration-200 text-sm font-medium"
                >
                  Not sure what to search for? Let us guide you →
                </button>
              </>
            ) : null}
          </div>
        </motion.form>
      </div>
    </div>
  );
}
