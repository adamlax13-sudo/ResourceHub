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

export const insertSearchSchema = createInsertSchema(searches).omit({ id: true, createdAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });

export type Search = typeof searches.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Service = typeof services.$inferSelect;

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
