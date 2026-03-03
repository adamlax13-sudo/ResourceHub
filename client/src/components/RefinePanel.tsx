import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { SearchFilters } from "@shared/routes";

interface RefinePanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

const LANGUAGES = ["English", "French", "Spanish", "Punjabi", "Tagalog", "Mandarin", "Arabic"];

type GenderRestriction = NonNullable<SearchFilters["genderRestriction"]>;
type AgeGroup = NonNullable<SearchFilters["ageGroup"]>;

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function RefinePanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onClear,
}: RefinePanelProps) {
  // Track whether we're on mobile to use correct animation axis
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(prev => (prev === mobile ? prev : mobile));
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Lock body scroll while panel is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  function update(patch: Partial<SearchFilters>) {
    onFiltersChange({ ...filters, ...patch });
  }

  function toggleLanguage(lang: string) {
    const current = filters.languagesSupported ?? [];
    const next = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    update({ languagesSupported: next.length > 0 ? next : undefined });
  }

  const genderOptions: { value: GenderRestriction; label: string }[] = [
    { value: "all", label: "All" },
    { value: "women_only", label: "Women-only" },
    { value: "men_only", label: "Men-only" },
  ];

  const ageOptions: { value: AgeGroup; label: string }[] = [
    { value: "all_ages", label: "All ages" },
    { value: "youth", label: "Youth" },
    { value: "adult", label: "Adult" },
    { value: "senior", label: "Senior" },
  ];

  const serviceFormatOptions: { value: string; label: string }[] = [
    { value: "in_person", label: "In-person" },
    { value: "online", label: "Online" },
    { value: "in_person_and_online", label: "Both" },
  ];

  const panelVariants = useMemo(() => isMobile
    ? {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
      }
    : {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
      },
    [isMobile]
  );

  const panelClass = isMobile
    ? "fixed bottom-0 left-0 right-0 rounded-t-2xl bg-card shadow-2xl z-50 flex flex-col max-h-[90vh]"
    : "fixed inset-y-0 right-0 w-80 bg-card shadow-2xl z-50 flex flex-col";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="refine-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="refine-panel"
            id="refine-panel"
            initial={panelVariants.initial}
            animate={panelVariants.animate}
            exit={panelVariants.exit}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={panelClass}
            role="dialog"
            aria-modal="true"
            aria-label="Refine search filters"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Refine Results</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClear}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close filter panel"
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
              {/* Gender restriction */}
              <section aria-labelledby="filter-gender-heading">
                <h3
                  id="filter-gender-heading"
                  className="text-sm font-medium text-foreground mb-3"
                >
                  Gender restriction
                </h3>
                <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="filter-gender-heading">
                  {genderOptions.map((opt) => {
                    const active =
                      (filters.genderRestriction ?? "all") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() =>
                          update({
                            genderRestriction:
                              opt.value === "all" ? undefined : opt.value,
                          })
                        }
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          active
                            ? "bg-primary text-white border-primary"
                            : "bg-background border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Age group */}
              <section aria-labelledby="filter-age-heading">
                <h3
                  id="filter-age-heading"
                  className="text-sm font-medium text-foreground mb-3"
                >
                  Age group
                </h3>
                <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="filter-age-heading">
                  {ageOptions.map((opt) => {
                    const active =
                      (filters.ageGroup ?? "all_ages") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() =>
                          update({
                            ageGroup:
                              opt.value === "all_ages" ? undefined : opt.value,
                          })
                        }
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          active
                            ? "bg-primary text-white border-primary"
                            : "bg-background border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Toggle filters */}
              <section aria-labelledby="filter-toggles-heading">
                <h3
                  id="filter-toggles-heading"
                  className="text-sm font-medium text-foreground mb-3"
                >
                  Availability &amp; program type
                </h3>
                <div className="space-y-3">
                  {(
                    [
                      { key: "is24_7", label: "24/7 available" },
                      { key: "isFaithBased", label: "Faith-based" },
                      { key: "is12Step", label: "12-step program" },
                    ] as { key: "is24_7" | "isFaithBased" | "is12Step"; label: string }[]
                  ).map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3"
                    >
                      <label
                        htmlFor={`toggle-${key}`}
                        className="text-sm text-foreground cursor-pointer select-none"
                      >
                        {label}
                      </label>
                      <Toggle
                        id={`toggle-${key}`}
                        checked={filters[key] === true}
                        onChange={(v) => update({ [key]: v || undefined })}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Service format */}
              <section aria-labelledby="filter-format-heading">
                <h3
                  id="filter-format-heading"
                  className="text-sm font-medium text-foreground mb-3"
                >
                  Service format
                </h3>
                <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="filter-format-heading">
                  {serviceFormatOptions.map((opt) => {
                    const active = filters.serviceFormat === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() =>
                          update({
                            serviceFormat: active ? undefined : opt.value,
                          })
                        }
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          active
                            ? "bg-primary text-white border-primary"
                            : "bg-background border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Languages */}
              <section aria-labelledby="filter-lang-heading">
                <h3
                  id="filter-lang-heading"
                  className="text-sm font-medium text-foreground mb-3"
                >
                  Languages supported
                </h3>
                <div className="space-y-2">
                  {LANGUAGES.map((lang) => {
                    const checked = (filters.languagesSupported ?? []).includes(lang);
                    return (
                      <label
                        key={lang}
                        className="flex items-center gap-3 cursor-pointer select-none group"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLanguage(lang)}
                          className="w-4 h-4 accent-primary rounded shrink-0"
                        />
                        <span
                          className={`text-sm transition-colors ${
                            checked
                              ? "text-primary font-medium"
                              : "text-foreground group-hover:text-primary"
                          }`}
                        >
                          {lang}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
