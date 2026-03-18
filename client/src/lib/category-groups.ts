/**
 * Category groups for the filter panel and admin UI.
 * Shared across RefinePanel, SearchContext, Services admin page, and ServiceForm.
 */

export const CATEGORY_GROUPS: { label: string; categories: string[] }[] = [
  {
    label: "Crisis & Safety",
    categories: ["Crisis Services", "Crisis Lines", "Hospital & Emergency", "Domestic Violence Support", "Human Trafficking Support"],
  },
  {
    label: "Mental Health",
    categories: ["Mental Health & Counselling", "Trauma & PTSD Support", "Grief & Bereavement", "Eating Disorder Services", "Gambling Support"],
  },
  {
    label: "Addiction & Recovery",
    categories: ["Addiction Treatment", "Detox & Withdrawal", "Harm Reduction", "Recovery & Peer Support", "Residential Treatment"],
  },
  {
    label: "Housing",
    categories: ["Emergency Shelter", "Transitional Housing", "Affordable Housing", "Supportive Housing"],
  },
  {
    label: "Basic Needs",
    categories: ["Food Banks & Meals", "Basic Needs & Material Aid", "Transportation Assistance", "Healthcare Access", "Sexual Health Services"],
  },
  {
    label: "Community & Identity",
    categories: [
      "Community & Social Connection", "Youth Services", "Senior Services", "Family & Parenting Support",
      "Campus & Student Services", "Disability & Autism Support", "Indigenous Services",
      "LGBTQ2S+ Services", "Newcomer & Settlement", "Veterans Services",
    ],
  },
  {
    label: "Legal & Financial",
    categories: ["Legal Aid", "Financial Counselling & Debt Help", "Employment Services", "Criminal Justice Reintegration"],
  },
];
