import { pgTable, text, serial, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
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

export const insertSearchSchema = createInsertSchema(searches).omit({ id: true, createdAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });

export type Search = typeof searches.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

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
