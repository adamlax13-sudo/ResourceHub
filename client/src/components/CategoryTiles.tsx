import { motion } from "framer-motion";
import {
  ShieldAlert,
  Sprout,
  Brain,
  Home,
  UtensilsCrossed,
  Accessibility,
  HeartPulse,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  label: string;
  icon: LucideIcon;
  query: string;
}

export const CATEGORIES: Category[] = [
  { label: "Crisis Support",     icon: ShieldAlert,     query: "crisis support emergency help" },
  { label: "Addiction Recovery", icon: Sprout,           query: "addiction recovery treatment" },
  { label: "Mental Health",      icon: Brain,            query: "mental health counselling therapy" },
  { label: "Housing",            icon: Home,             query: "housing shelter accommodation" },
  { label: "Food & Basic Needs", icon: UtensilsCrossed,  query: "food bank meals basic needs" },
  { label: "Disability Support", icon: Accessibility,    query: "disability support accessibility" },
  { label: "Healthcare",         icon: HeartPulse,       query: "healthcare medical clinic" },
  { label: "Employment",         icon: Briefcase,        query: "employment job training work" },
];

interface CategoryTilesProps {
  onSelect: (query: string) => void;
}

export function CategoryTiles({ onSelect }: CategoryTilesProps) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <p className="text-center text-foreground/70 mb-6 text-base font-medium">
        Not sure where to start? Browse by category:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat, i) => {
          const Icon = cat.icon;
          return (
            <motion.button
              type="button"
              key={cat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => onSelect(cat.query)}
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
