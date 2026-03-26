import { Users, Calendar, Clock, Monitor, Globe, LayoutGrid, ChevronDown, X, ShieldAlert, Brain, HeartPulse, Home, Package, Handshake, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { SearchFilters } from "@shared/routes";

interface RefinePanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

const LANGUAGES = ["English", "French", "Spanish", "Punjabi", "Tagalog", "Mandarin", "Arabic"];

const GROUP_ICONS: Record<string, LucideIcon> = {
  "Crisis & Safety": ShieldAlert,
  "Mental Health": Brain,
  "Addiction & Recovery": HeartPulse,
  "Housing": Home,
  "Basic Needs": Package,
  "Community & Identity": Handshake,
  "Legal & Financial": Scale,
};

import { CATEGORY_GROUPS } from "@/lib/category-groups";

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
        checked ? "bg-primary" : "bg-gray-200"
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

function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.categories?.length) count += filters.categories.length;
  if (filters.genderRestriction && filters.genderRestriction !== "all") count++;
  if (filters.ageGroup && filters.ageGroup !== "all_ages") count++;
  if (filters.is24_7) count++;
  if (filters.isFaithBased) count++;
  if (filters.is12Step) count++;
  if (filters.serviceFormat) count++;
  if (filters.languagesSupported && filters.languagesSupported.length > 0) count += filters.languagesSupported.length;
  return count;
}

export function RefinePanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onClear,
}: RefinePanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Auto-expand when categories become active (e.g. URL restore)
  useEffect(() => {
    if ((filters.categories ?? []).length > 0) setCategoriesOpen(true);
  }, [filters.categories]);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Focus trap: focus panel on open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  function update(patch: Partial<SearchFilters>) {
    onFiltersChange({ ...filters, ...patch });
  }

  function toggleCategory(cat: string) {
    const current = filters.categories ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    update({ categories: next.length > 0 ? next : undefined });
  }

  function toggleLanguage(lang: string) {
    const current = filters.languagesSupported ?? [];
    const next = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    update({ languagesSupported: next.length > 0 ? next : undefined });
  }

  const activeCount = countActiveFilters(filters);

  const genderOptions: { value: GenderRestriction; label: string }[] = [
    { value: "all", label: t('filters.all') },
    { value: "women_only", label: t('filters.womenOnly') },
    { value: "men_only", label: t('filters.menOnly') },
  ];

  const ageOptions: { value: AgeGroup; label: string }[] = [
    { value: "all_ages", label: t('filters.allAges') },
    { value: "youth", label: t('filters.youth') },
    { value: "adult", label: t('filters.adult') },
    { value: "senior", label: t('filters.senior') },
  ];

  const serviceFormatOptions: { value: string; label: string }[] = [
    { value: "in_person", label: t('filters.inPerson') },
    { value: "online", label: t('filters.online') },
    { value: "in_person_and_online", label: t('filters.both') },
  ];

  const hasCategories = (filters.categories ?? []).length > 0;
  const hasGender = filters.genderRestriction && filters.genderRestriction !== "all";
  const hasAge = filters.ageGroup && filters.ageGroup !== "all_ages";
  const hasToggles = filters.is24_7 || filters.isFaithBased || filters.is12Step;
  const hasFormat = !!filters.serviceFormat;
  const hasLanguages = (filters.languagesSupported ?? []).length > 0;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabIndex={-1}
        className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-[95vw] max-w-3xl rounded-2xl bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 outline-none"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('filters.title')}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t('filters.subtitle')}
                </p>
              </div>
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {t('filters.applied', { count: activeCount })}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClear}
              className={`text-xs font-medium transition-colors px-3 py-1.5 rounded-lg ${
                activeCount > 0
                  ? "text-primary hover:bg-primary/5 cursor-pointer"
                  : "text-gray-300 cursor-default"
              }`}
              disabled={activeCount === 0}
            >
              {t('common.clearAll')}
            </button>
          </div>
        </div>

        {/* Filter content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gender restriction */}
            <section
              className={`rounded-xl p-4 transition-colors ${hasGender ? "bg-primary/[0.03] ring-1 ring-primary/10" : "bg-gray-50/80"}`}
              aria-labelledby="filter-gender-heading"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasGender ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Users className="w-4 h-4" />
                </div>
                <h3 id="filter-gender-heading" className="text-sm font-semibold text-gray-800">
                  {t('filters.gender')}
                </h3>
                {hasGender && (
                  <button
                    type="button"
                    onClick={() => update({ genderRestriction: undefined })}
                    className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear gender filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="filter-gender-heading">
                {genderOptions.map((opt) => {
                  const active = (filters.genderRestriction ?? "all") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        update({
                          genderRestriction: opt.value === "all" ? undefined : opt.value,
                        })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                        active
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white border-gray-200 text-gray-600 hover:border-primary/40 hover:text-gray-900"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Age group */}
            <section
              className={`rounded-xl p-4 transition-colors ${hasAge ? "bg-primary/[0.03] ring-1 ring-primary/10" : "bg-gray-50/80"}`}
              aria-labelledby="filter-age-heading"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasAge ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 id="filter-age-heading" className="text-sm font-semibold text-gray-800">
                  {t('filters.ageGroup')}
                </h3>
                {hasAge && (
                  <button
                    type="button"
                    onClick={() => update({ ageGroup: undefined })}
                    className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear age filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="filter-age-heading">
                {ageOptions.map((opt) => {
                  const active = (filters.ageGroup ?? "all_ages") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        update({
                          ageGroup: opt.value === "all_ages" ? undefined : opt.value,
                        })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                        active
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white border-gray-200 text-gray-600 hover:border-primary/40 hover:text-gray-900"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Toggle filters */}
            <section
              className={`rounded-xl p-4 transition-colors ${hasToggles ? "bg-primary/[0.03] ring-1 ring-primary/10" : "bg-gray-50/80"}`}
              aria-labelledby="filter-toggles-heading"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasToggles ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <h3 id="filter-toggles-heading" className="text-sm font-semibold text-gray-800">
                  {t('filters.availability')}
                </h3>
              </div>
              <div className="space-y-3 pl-[42px]">
                {(
                  [
                    { key: "is24_7", label: t('filters.is24_7') },
                    { key: "isFaithBased", label: t('filters.faithBased') },
                    { key: "is12Step", label: t('filters.twelveStep') },
                  ] as { key: "is24_7" | "isFaithBased" | "is12Step"; label: string }[]
                ).map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3"
                  >
                    <label
                      htmlFor={`toggle-${key}`}
                      className="text-sm text-gray-600 cursor-pointer select-none"
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
            <section
              className={`rounded-xl p-4 transition-colors ${hasFormat ? "bg-primary/[0.03] ring-1 ring-primary/10" : "bg-gray-50/80"}`}
              aria-labelledby="filter-format-heading"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasFormat ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Monitor className="w-4 h-4" />
                </div>
                <h3 id="filter-format-heading" className="text-sm font-semibold text-gray-800">
                  {t('filters.serviceFormat')}
                </h3>
                {hasFormat && (
                  <button
                    type="button"
                    onClick={() => update({ serviceFormat: undefined })}
                    className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear format filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
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
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                        active
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white border-gray-200 text-gray-600 hover:border-primary/40 hover:text-gray-900"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Languages */}
            <section
              className={`rounded-xl p-4 transition-colors md:col-span-2 ${hasLanguages ? "bg-primary/[0.03] ring-1 ring-primary/10" : "bg-gray-50/80"}`}
              aria-labelledby="filter-lang-heading"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasLanguages ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <h3 id="filter-lang-heading" className="text-sm font-semibold text-gray-800">
                  {t('filters.languages')}
                </h3>
                {hasLanguages && (
                  <button
                    type="button"
                    onClick={() => update({ languagesSupported: undefined })}
                    className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear language filters"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => {
                  const checked = (filters.languagesSupported ?? []).includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                        checked
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white border-gray-200 text-gray-600 hover:border-primary/40 hover:text-gray-900"
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Service categories — collapsible, below main filters */}
          <section
            className={`rounded-xl transition-colors mt-4 border ${hasCategories ? "bg-primary/[0.03] border-primary/20" : "bg-white border-gray-200 border-dashed"}`}
            aria-labelledby="filter-category-heading"
          >
            <button
              type="button"
              onClick={() => setCategoriesOpen((o) => !o)}
              className="flex items-center gap-2.5 w-full text-left p-4"
              aria-expanded={categoriesOpen}
              aria-controls="category-filter-content"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasCategories ? "bg-primary/10 text-primary" : "bg-primary/5 text-primary/60"}`}>
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div>
                <h3 id="filter-category-heading" className="text-sm font-semibold text-gray-800">
                  {t('filters.browseCategory')}
                </h3>
                {!categoriesOpen && !hasCategories && (
                  <p className="text-xs text-gray-400 mt-0.5">{t('filters.filterByType')}</p>
                )}
              </div>
              {!categoriesOpen && hasCategories && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {t('filters.selected', { count: filters.categories!.length })}
                </span>
              )}
              {hasCategories && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); update({ categories: undefined }); }}
                  className="ml-auto mr-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear category filters"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${hasCategories ? "" : "ml-auto"} ${categoriesOpen ? "rotate-180" : ""}`} />
            </button>

            {categoriesOpen && (
              <div id="category-filter-content" className="px-4 pb-4 pt-1 space-y-1">
                {CATEGORY_GROUPS.map((group) => {
                  const Icon = GROUP_ICONS[group.label];
                  return (
                  <div key={group.label} className="rounded-lg bg-gray-50/70 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.categories.map((cat) => {
                        const active = (filters.categories ?? []).includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                              active
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-white border-gray-200 text-gray-600 hover:border-primary/40 hover:text-gray-900"
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Bottom action bar */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-all"
          >
            {t('filters.applyFilters')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
