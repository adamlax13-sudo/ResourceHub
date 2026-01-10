import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  results: jsonb("results").notNull(), // Cache the AI results
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSearchSchema = createInsertSchema(searches).omit({ 
  id: true, 
  createdAt: true 
});

export type InsertSearch = z.infer<typeof insertSearchSchema>;
export type Search = typeof searches.$inferSelect;

export interface ServiceDetail {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  contact: string;
  eligibility: string;
  process: string[]; // Steps for diagram
  waitTimes: string;
  requiredDocs: string[];
}

export interface SearchResponse {
  services: ServiceDetail[];
  summary: string;
}
