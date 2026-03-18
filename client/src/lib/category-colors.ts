/**
 * Category color mapping — each category gets a distinct color
 * so they're visually distinguishable in lists and tables.
 */

const CATEGORY_COLORS: Record<string, string> = {
  // Crisis & Safety
  "Crisis Services": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  "Crisis Lines": "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700",
  "Hospital & Emergency": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  "Domestic Violence Support": "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
  "Human Trafficking Support": "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",

  // Mental Health
  "Mental Health & Counselling": "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  "Trauma & PTSD Support": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  "Grief & Bereavement": "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700",
  "Eating Disorder Services": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800",
  "Gambling Support": "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900 dark:text-violet-200 dark:border-violet-700",

  // Addiction & Recovery
  "Addiction Treatment": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  "Detox & Withdrawal": "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  "Harm Reduction": "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700",
  "Recovery & Peer Support": "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
  "Residential Treatment": "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700",

  // Housing
  "Emergency Shelter": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  "Transitional Housing": "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  "Affordable Housing": "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700",
  "Supportive Housing": "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900 dark:text-sky-200 dark:border-sky-700",

  // Basic Needs
  "Food Banks & Meals": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  "Basic Needs & Material Aid": "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  "Transportation Assistance": "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950 dark:text-lime-300 dark:border-lime-800",
  "Healthcare Access": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  "Sexual Health Services": "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-700",

  // Community & Identity — each gets its own color
  "Community & Social Connection": "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  "Youth Services": "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  "Senior Services": "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700",
  "Family & Parenting Support": "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800",
  "Campus & Student Services": "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800",
  "Disability & Autism Support": "bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900 dark:text-lime-200 dark:border-lime-700",
  "Indigenous Services": "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  "LGBTQ2S+ Services": "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-400 dark:border-fuchsia-800",
  "Newcomer & Settlement": "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
  "Veterans Services": "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",

  // Legal & Financial
  "Legal Aid": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  "Financial Counselling & Debt Help": "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700",
  "Employment Services": "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
  "Criminal Justice Reintegration": "bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-950 dark:text-stone-400 dark:border-stone-800",
};

/**
 * Returns Tailwind classes for a category badge.
 * Falls back to neutral gray for unknown categories.
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800";
}
