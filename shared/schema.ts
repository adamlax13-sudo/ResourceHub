import { pgTable, text, serial, jsonb, timestamp, varchar, boolean, integer, real, unique } from "drizzle-orm/pg-core";

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  results: jsonb("results").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("general"),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  serviceId: varchar("service_id", { length: 255 }),
  serviceName: varchar("service_name", { length: 255 }),
  searchQuery: varchar("search_query", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Services table - matches the scraper's database schema
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }).default("Alberta"),
  contact: text("contact"),
  eligibility: text("eligibility"),
  // Normalized contact fields (extracted for better search)
  phone: varchar("phone", { length: 100 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  processSteps: jsonb("process_steps"),
  waitTimes: varchar("wait_times", { length: 255 }),
  requiredDocs: jsonb("required_docs"),
  hoursOfOperation: varchar("hours_of_operation", { length: 500 }),
  languagesSupported: jsonb("languages_supported"),
  serviceFormat: varchar("service_format", { length: 100 }),
  websiteUrl: text("website_url"),
  confidenceScore: integer("confidence_score").default(100),
  isActive: boolean("is_active").default(true),
  lastChecked: timestamp("last_checked").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  tags: jsonb("tags"),
  // Search improvement columns (added by add_search_improvements.sql)
  popularityScore: integer("popularity_score").default(0),
  clickCount: integer("click_count").default(0),
  // Enrichment tracking
  enrichmentSource: text("enrichment_source"),
  enrichmentDate: timestamp("enrichment_date"),
  sourcePageHash: text("source_page_hash"),
  // Category columns still in use
  genderRestriction: varchar("gender_restriction", { length: 50 }), // women_only, men_only, all
  is24_7: boolean("is_24_7").default(false),
  ageGroup: varchar("age_group", { length: 20 }).default('all_ages'),
  isFaithBased: boolean("is_faith_based").default(false),
  is12Step: boolean("is_12_step").default(false),
  // Geocoding columns (added by add_geocoding_columns.sql)
  latitude: real("latitude"),
  longitude: real("longitude"),
  geocodeSource: varchar("geocode_source", { length: 50 }),
  geocodedAt: timestamp("geocoded_at"),
  embeddingUpdatedAt: timestamp("embedding_updated_at"),
  duplicateOf: integer("duplicate_of"),
});

// Service history — change log for every modification (created by scraper/init_db.sql)
export const serviceHistory = pgTable("service_history", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }),
  contact: text("contact"),
  eligibility: text("eligibility"),
  processSteps: jsonb("process_steps"),
  waitTimes: varchar("wait_times", { length: 255 }),
  requiredDocs: jsonb("required_docs"),
  hoursOfOperation: varchar("hours_of_operation", { length: 500 }),
  languagesSupported: jsonb("languages_supported"),
  serviceFormat: varchar("service_format", { length: 100 }),
  websiteUrl: text("website_url"),
  changedFields: jsonb("changed_fields"),
  changeType: varchar("change_type", { length: 50 }),
  recordedAt: timestamp("recorded_at").defaultNow(),
  confidenceScore: integer("confidence_score").default(100),
});

export type ServiceHistory = typeof serviceHistory.$inferSelect;

// Scraper run logs (created by scraper/init_db.sql)
export const scraperLogs = pgTable("scraper_logs", {
  id: serial("id").primaryKey(),
  runId: varchar("run_id", { length: 100 }).unique().notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: varchar("status", { length: 50 }),
  servicesChecked: integer("services_checked").default(0),
  servicesUpdated: integer("services_updated").default(0),
  servicesCreated: integer("services_created").default(0),
  servicesDeactivated: integer("services_deactivated").default(0),
  errorsCount: integer("errors_count").default(0),
  errors: jsonb("errors"),
  durationSeconds: integer("duration_seconds"),
  sourceResults: jsonb("source_results"),
  phasesRun: jsonb("phases_run"),
  config: jsonb("config"),
});

export type ScraperLog = typeof scraperLogs.$inferSelect;

// Admin-facing change request queue — proposed updates from scraper or human review
export const serviceChangeRequests = pgTable("service_change_requests", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id"),
  changeType: varchar("change_type", { length: 20 }).notNull(),
  proposedChanges: jsonb("proposed_changes").notNull(),
  previousValues: jsonb("previous_values"),
  source: varchar("source", { length: 20 }).notNull(),
  sourcePlugin: varchar("source_plugin", { length: 100 }),
  sourceUrl: text("source_url"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  batchId: varchar("batch_id", { length: 100 }),
  duplicateOf: integer("duplicate_of"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 100 }),
  reviewNotes: text("review_notes"),
});

export type ServiceChangeRequest = typeof serviceChangeRequests.$inferSelect;
export type InsertServiceChangeRequest = typeof serviceChangeRequests.$inferInsert;

// Archive table for feature columns (created by archive_feature_columns.sql)
export const serviceFeatureArchive = pgTable("service_feature_archive", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).notNull(), // Intentionally no FK — archive rows survive service deletion
  serviceType: varchar("service_type", { length: 100 }),
  eligibilityTags: jsonb("eligibility_tags").default([]),
  demographicTags: jsonb("demographic_tags").default([]),
  ageRestriction: varchar("age_restriction", { length: 100 }),
  isWalkIn: boolean("is_walk_in").default(false),
  requiresReferral: boolean("requires_referral").default(false),
  archivedAt: timestamp("archived_at").defaultNow(),
});

// Deduplication log table (created by handle_duplicates.sql)
export const deduplicationLog = pgTable("deduplication_log", {
  id: serial("id").primaryKey(),
  keptServiceId: varchar("kept_service_id", { length: 255 }).notNull(),
  removedServiceId: varchar("removed_service_id", { length: 255 }).notNull(),
  duplicateType: varchar("duplicate_type", { length: 50 }).notNull(),
  matchValue: text("match_value"),
  reason: text("reason"),
  deduplicatedAt: timestamp("deduplicated_at").defaultNow(),
});

// Search analytics - tracks user searches and clicks for improving results
export const searchAnalytics = pgTable("search_analytics", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  normalizedQuery: text("normalized_query").notNull(),
  resultCount: integer("result_count").default(0),
  clickedServiceId: varchar("clicked_service_id", { length: 255 }),
  clickPosition: integer("click_position"),
  sessionId: varchar("session_id", { length: 255 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Service aliases - for acronyms, common names, and known misspellings
export const serviceAliases = pgTable("service_aliases", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).notNull(),
  alias: varchar("alias", { length: 255 }).notNull(),
  aliasType: varchar("alias_type", { length: 50 }).default("common_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI-generated service enrichments cache
// Stores OpenAI-generated details per service so future searches can skip the API call
export const aiServiceEnrichments = pgTable("ai_service_enrichments", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).notNull().unique(),
  serviceName: varchar("service_name", { length: 500 }).notNull(),
  aiDescription: text("ai_description").notNull(),
  aiCategory: varchar("ai_category", { length: 255 }),
  aiProcessSteps: jsonb("ai_process_steps").notNull(),
  aiEligibility: text("ai_eligibility"),
  aiWaitTimes: varchar("ai_wait_times", { length: 255 }),
  aiRequiredDocs: jsonb("ai_required_docs"),
  aiLocation: text("ai_location"),
  aiContact: text("ai_contact"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Search = typeof searches.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Service = typeof services.$inferSelect;
export type AiServiceEnrichment = typeof aiServiceEnrichments.$inferSelect;
export type SearchAnalytics = typeof searchAnalytics.$inferSelect;
export type ServiceAlias = typeof serviceAliases.$inferSelect;

// Service vote feedback (thumbs up/down on search result cards)
export const serviceVotes = pgTable("service_votes", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).notNull().references(() => services.serviceId),
  vote: varchar("vote", { length: 10 }).notNull(), // 'up' | 'down' — enforced by Zod in routes/feedback.ts
  queryContext: text("query_context"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ServiceVote = typeof serviceVotes.$inferSelect;

// Query-service affinity scores — computed from click-through data
// Used to boost services that users consistently find helpful for specific queries
export const queryServiceAffinities = pgTable("query_service_affinities", {
  id: serial("id").primaryKey(),
  normalizedQuery: text("normalized_query").notNull(),
  serviceId: varchar("service_id", { length: 255 }).notNull(),
  clickScore: real("click_score").default(0),  // CTR-based score
  voteScore: real("vote_score").default(0),     // Vote-based score
  computedAt: timestamp("computed_at").defaultNow(),
}, (table) => [
  unique().on(table.normalizedQuery, table.serviceId),
]);

export type QueryServiceAffinity = typeof queryServiceAffinities.$inferSelect;

