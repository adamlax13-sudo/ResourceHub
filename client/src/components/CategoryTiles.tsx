import { motion } from "framer-motion";

export const CATEGORIES = [
  { label: "Crisis Support",         icon: "🆘", gradient: "from-red-500/20 to-orange-400/20",     query: "crisis support emergency help" },
  { label: "Addiction Recovery",     icon: "🌱", gradient: "from-green-500/20 to-teal-400/20",    query: "addiction recovery treatment" },
  { label: "Mental Health",          icon: "🧠", gradient: "from-purple-500/20 to-indigo-400/20",  query: "mental health counselling therapy" },
  { label: "Housing",                icon: "🏠", gradient: "from-blue-500/20 to-cyan-400/20",     query: "housing shelter accommodation" },
  { label: "Food & Basic Needs",     icon: "🍽️", gradient: "from-yellow-500/20 to-amber-400/20",  query: "food bank meals basic needs" },
  { label: "Disability Support",     icon: "♿", gradient: "from-slate-500/20 to-zinc-400/20",    query: "disability support accessibility" },
  { label: "Healthcare",             icon: "⚕️", gradient: "from-rose-500/20 to-pink-400/20",    query: "healthcare medical clinic" },
  { label: "Employment",             icon: "💼", gradient: "from-orange-500/20 to-yellow-400/20", query: "employment job training work" },
] as const;

interface CategoryTilesProps {
  onSelect: (query: string) => void;
}

export function CategoryTiles({ onSelect }: CategoryTilesProps) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <p className="text-center text-muted-foreground mb-6 text-sm">
        Not sure where to start? Browse by category:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat, i) => (
          <motion.button
            key={cat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => onSelect(cat.query)}
            className={`
              flex flex-col items-center gap-2 p-4 rounded-2xl border border-border/50
              bg-gradient-to-br ${cat.gradient} backdrop-blur-sm
              hover:border-primary/40 hover:scale-105 transition-all duration-200
              cursor-pointer text-center
            `}
          >
            <span className="text-3xl" role="img" aria-label={cat.label}>{cat.icon}</span>
            <span className="text-xs font-semibold text-foreground leading-tight">{cat.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
