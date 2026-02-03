import { pgTable, text, serial, jsonb, timestamp, varchar, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  results: jsonb("results").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  name: varchar("name"),
  email: varchar("email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Services table - matches the scraper's database schema
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  serviceId: varchar("service_id", { length: 255 }).unique().notNull(),
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
  bookingUrl: text("booking_url"),
  dataSource: varchar("data_source", { length: 255 }),
  confidenceScore: integer("confidence_score").default(100),
  isActive: boolean("is_active").default(true),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastChecked: timestamp("last_checked").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  tags: jsonb("tags"),
  notes: text("notes"),
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

export const insertSearchSchema = createInsertSchema(searches).omit({ id: true, createdAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });

export type Search = typeof searches.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Service = typeof services.$inferSelect;
export type AiServiceEnrichment = typeof aiServiceEnrichments.$inferSelect;

export interface ServiceDetail {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  contact: string;
  eligibility: string;
  process: string[];
  waitTimes: string;
  requiredDocs: string[];
}
