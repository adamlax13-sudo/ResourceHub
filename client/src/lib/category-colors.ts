/**
 * Category color mapping — each category gets a distinct color
 * so they're visually distinguishable in lists and tables.
 */

const CATEGORY_COLORS: Record<string, string> = {
  // Crisis & Safety
  "Crisis Services": "bg-red-50 text-red-700 border-red-200",
  "Crisis Lines": "bg-red-100 text-red-800 border-red-300",
  "Hospital & Emergency": "bg-rose-50 text-rose-700 border-rose-200",
  "Domestic Violence Support": "bg-pink-50 text-pink-700 border-pink-200",
  "Human Trafficking Support": "bg-red-50 text-red-600 border-red-200",

  // Mental Health
  "Mental Health & Counselling": "bg-purple-50 text-purple-700 border-purple-200",
  "Trauma & PTSD Support": "bg-violet-50 text-violet-700 border-violet-200",
  "Grief & Bereavement": "bg-purple-100 text-purple-800 border-purple-300",
  "Eating Disorder Services": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  "Gambling Support": "bg-violet-100 text-violet-800 border-violet-300",

  // Addiction & Recovery
  "Addiction Treatment": "bg-amber-50 text-amber-700 border-amber-200",
  "Detox & Withdrawal": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Harm Reduction": "bg-amber-100 text-amber-800 border-amber-300",
  "Recovery & Peer Support": "bg-orange-50 text-orange-600 border-orange-200",
  "Residential Treatment": "bg-yellow-100 text-yellow-800 border-yellow-300",

  // Housing
  "Emergency Shelter": "bg-blue-50 text-blue-700 border-blue-200",
  "Transitional Housing": "bg-sky-50 text-sky-700 border-sky-200",
  "Affordable Housing": "bg-blue-100 text-blue-800 border-blue-300",
  "Supportive Housing": "bg-sky-100 text-sky-800 border-sky-300",

  // Basic Needs
  "Food Banks & Meals": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Basic Needs & Material Aid": "bg-green-50 text-green-700 border-green-200",
  "Transportation Assistance": "bg-lime-50 text-lime-700 border-lime-200",
  "Healthcare Access": "bg-teal-50 text-teal-700 border-teal-200",
  "Sexual Health Services": "bg-emerald-100 text-emerald-800 border-emerald-300",

  // Community & Identity — each gets its own color
  "Community & Social Connection": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Youth Services": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Senior Services": "bg-stone-100 text-stone-700 border-stone-300",
  "Family & Parenting Support": "bg-rose-50 text-rose-600 border-rose-200",
  "Campus & Student Services": "bg-sky-50 text-sky-600 border-sky-200",
  "Disability & Autism Support": "bg-lime-100 text-lime-800 border-lime-300",
  "Indigenous Services": "bg-amber-50 text-amber-600 border-amber-200",
  "LGBTQ2S+ Services": "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200",
  "Newcomer & Settlement": "bg-violet-50 text-violet-600 border-violet-200",
  "Veterans Services": "bg-slate-100 text-slate-700 border-slate-300",

  // Legal & Financial
  "Legal Aid": "bg-orange-50 text-orange-700 border-orange-200",
  "Financial Counselling & Debt Help": "bg-orange-100 text-orange-800 border-orange-300",
  "Employment Services": "bg-yellow-50 text-yellow-600 border-yellow-200",
  "Criminal Justice Reintegration": "bg-stone-50 text-stone-600 border-stone-200",
};

/**
 * Returns Tailwind classes for a category badge.
 * Falls back to neutral gray for unknown categories.
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "bg-gray-50 text-gray-600 border-gray-200";
}
