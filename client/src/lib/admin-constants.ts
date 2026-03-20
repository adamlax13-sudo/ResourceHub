/**
 * Shared constants and helpers for admin pages.
 * Canonical source — imported by Quality, Review, Services, ServiceDetailPanel.
 */

/** Superset of field labels used across Quality, Review, and Services pages */
export const FIELD_LABELS: Record<string, string> = {
  // Contact (individual tracking + composite)
  phone: "Phone",
  email: "Email",
  noContact: "No Contact",
  // 14 required fields
  name: "Title",
  description: "Description",
  eligibility: "Eligibility",
  websiteUrl: "Website",
  address: "Address",
  hoursOfOperation: "Hours",
  waitTimes: "Wait Times",
  serviceFormat: "Service Format",
  processSteps: "Process Steps",
  requiredDocs: "Required Docs",
  languagesSupported: "Languages",
  tags: "Tags",
  freshEmbedding: "Fresh Embedding",
  freshGeocoding: "Fresh Geocoding",
  // Coverage bar keys (summary percentages)
  latitude: "Geocoding",
  embedding: "Embedding",
  embeddingFresh: "Embeddings Fresh",
  geocodingFresh: "Geocoding Fresh",
  // Non-flagging visibility
  lowConfidence: "Low Confidence",
  // Review-specific aliases
  staleEmbedding: "Stale Embedding",
  staleGeocoding: "Stale Geocoding",
};

/** Badge/card background colors by issue severity */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground border-border",
};

/** Stacked bar segment colors by severity */
export const SEVERITY_BAR_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
};

/** Returns a Tailwind text-color class for a confidence score */
export function confidenceColor(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 70) return "text-emerald-500";
  if (s >= 40) return "text-amber-500";
  return "text-red-500";
}

/** Formats a date string as a relative time (e.g. "5m ago", "3d ago") */
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
