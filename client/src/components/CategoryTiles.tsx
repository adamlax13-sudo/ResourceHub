import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Brain,
  Home,
  UtensilsCrossed,
  Accessibility,
  HeartPulse,
  Briefcase,
  HandHeart,
  Baby,
  Scale,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  label: string;
  icon: LucideIcon;
  query: string;
}

export const CATEGORIES: Category[] = [
  { label: "Crisis Support",      icon: ShieldAlert,     query: "crisis support emergency help" },
  { label: "Domestic Violence",    icon: ShieldCheck,     query: "domestic violence abuse safety support" },
  { label: "Mental Health",        icon: Brain,           query: "mental health counselling therapy" },
  { label: "Addiction Recovery",   icon: Sprout,          query: "addiction recovery treatment" },
  { label: "Housing",              icon: Home,            query: "housing shelter accommodation" },
  { label: "Food & Basic Needs",   icon: UtensilsCrossed, query: "food bank meals basic needs" },
  { label: "Healthcare",           icon: HeartPulse,      query: "healthcare medical clinic" },
  { label: "Disability Support",   icon: Accessibility,   query: "disability support accessibility" },
  { label: "Social Connection",    icon: HandHeart,       query: "social connection community recreation programs" },
  { label: "Family & Parenting",   icon: Baby,            query: "family parenting pregnancy child support" },
  { label: "Employment",           icon: Briefcase,       query: "employment job training work" },
  { label: "Legal Aid",            icon: Scale,           query: "legal aid lawyer court advocacy" },
];

interface CategoryTilesProps {
  onSelect: (query: string) => void;
}

export function CategoryTiles({ onSelect }: CategoryTilesProps) {
  const { t } = useTranslation();
  // Track which categories have been prefetched to avoid duplicate requests
  const prefetchedRef = useRef<Set<string>>(new Set());

  // Prefetch category results on hover (low-priority background fetch)
  const prefetchCategory = useCallback((query: string) => {
    if (prefetchedRef.current.has(query)) return;
    prefetchedRef.current.add(query);

    // Low-priority background fetch — results go into server cache
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, page: 1, pageSize: 30 }),
      priority: 'low' as RequestPriority,
    }).catch(() => {
      // Remove from set so it can be retried
      prefetchedRef.current.delete(query);
    });
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <p className="text-center text-foreground/70 mb-6 text-base font-medium">
        {t('hero.browseByCategory')}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat, i) => {
          const Icon = cat.icon;
          return (
            <motion.button
              type="button"
              key={cat.label}
              aria-label={`Search for ${cat.label} services`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => onSelect(cat.query)}
              onMouseEnter={() => prefetchCategory(cat.query)}
              onFocus={() => prefetchCategory(cat.query)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-border
                         bg-card hover:bg-primary/5 hover:border-primary/25
                         hover:scale-105 transition-all duration-200
                         cursor-pointer text-center shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-foreground leading-tight">{cat.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
