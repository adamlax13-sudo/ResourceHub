/**
 * Category color mapping — maps service categories to Tailwind color classes.
 *
 * 7 groups: Crisis & Safety (red), Mental Health (purple), Addiction & Recovery (amber),
 * Housing (blue), Basic Needs (emerald), Community & Identity (indigo), Legal & Financial (orange).
 */

const CATEGORY_GROUP_COLORS: Record<string, string> = {
  // Crisis & Safety — red
  "Crisis Services": "bg-red-50 text-red-700 border-red-200",
  "Crisis Lines": "bg-red-50 text-red-700 border-red-200",
  "Hospital & Emergency": "bg-red-50 text-red-700 border-red-200",
  "Domestic Violence Support": "bg-red-50 text-red-700 border-red-200",
  "Human Trafficking Support": "bg-red-50 text-red-700 border-red-200",

  // Mental Health — purple
  "Mental Health & Counselling": "bg-purple-50 text-purple-700 border-purple-200",
  "Trauma & PTSD Support": "bg-purple-50 text-purple-700 border-purple-200",
  "Grief & Bereavement": "bg-purple-50 text-purple-700 border-purple-200",
  "Eating Disorder Services": "bg-purple-50 text-purple-700 border-purple-200",
  "Gambling Support": "bg-purple-50 text-purple-700 border-purple-200",

  // Addiction & Recovery — amber
  "Addiction Treatment": "bg-amber-50 text-amber-700 border-amber-200",
  "Detox & Withdrawal": "bg-amber-50 text-amber-700 border-amber-200",
  "Harm Reduction": "bg-amber-50 text-amber-700 border-amber-200",
  "Recovery & Peer Support": "bg-amber-50 text-amber-700 border-amber-200",
  "Residential Treatment": "bg-amber-50 text-amber-700 border-amber-200",

  // Housing — blue
  "Emergency Shelter": "bg-blue-50 text-blue-700 border-blue-200",
  "Transitional Housing": "bg-blue-50 text-blue-700 border-blue-200",
  "Affordable Housing": "bg-blue-50 text-blue-700 border-blue-200",
  "Supportive Housing": "bg-blue-50 text-blue-700 border-blue-200",

  // Basic Needs — emerald
  "Food Banks & Meals": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Basic Needs & Material Aid": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Transportation Assistance": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Healthcare Access": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Sexual Health Services": "bg-emerald-50 text-emerald-700 border-emerald-200",

  // Community & Identity — indigo
  "Community & Social Connection": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Youth Services": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Senior Services": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Family & Parenting Support": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Campus & Student Services": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Disability & Autism Support": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Indigenous Services": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "LGBTQ2S+ Services": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Newcomer & Settlement": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Veterans Services": "bg-indigo-50 text-indigo-700 border-indigo-200",

  // Legal & Financial — orange
  "Legal Aid": "bg-orange-50 text-orange-700 border-orange-200",
  "Financial Counselling & Debt Help": "bg-orange-50 text-orange-700 border-orange-200",
  "Employment Services": "bg-orange-50 text-orange-700 border-orange-200",
  "Criminal Justice Reintegration": "bg-orange-50 text-orange-700 border-orange-200",
};

/**
 * Returns Tailwind classes for a category badge.
 * Falls back to neutral gray for unknown categories.
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_GROUP_COLORS[category] || "bg-gray-50 text-gray-600 border-gray-200";
}
