import { pgTable, text, serial, jsonb, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Mandatory for Replit Auth
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  replitId: text("replit_id").unique(),
  // Optional demographic fields for personalized recommendations
  age: varchar("age"),
  gender: varchar("gender"),
  race: varchar("race"),
  sexuality: varchar("sexuality"),
  education: varchar("education"),
  religion: varchar("religion"),
  inAddiction: varchar("in_addiction"),
  university: varchar("university"),
  // Accessibility
  disability: varchar("disability"), // none, physical, sensory, cognitive, mental-health, chronic, multiple, other, prefer-not-to-say
  // Service delivery preferences
  serviceFormat: varchar("service_format"), // virtual, in-person, no-preference
  supportStyle: varchar("support_style"), // one-on-one, group, no-preference
  profileCompleted: timestamp("profile_completed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  results: jsonb("results").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("saved"), // 'saved', 'in_progress', 'completed'
  completedSteps: jsonb("completed_steps").notNull().default([]),
  // Store full service details for comprehensive process tracking
  serviceDetails: jsonb("service_details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSearchSchema = createInsertSchema(searches).omit({ id: true, createdAt: true });
export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });

// Schema for updating user demographics (all optional)
export const updateDemographicsSchema = z.object({
  age: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  race: z.string().optional().nullable(),
  sexuality: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  inAddiction: z.string().optional().nullable(),
  university: z.string().optional().nullable(),
  disability: z.string().optional().nullable(),
  serviceFormat: z.string().optional().nullable(),
  supportStyle: z.string().optional().nullable(),
});

export type UpdateDemographics = z.infer<typeof updateDemographicsSchema>;

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Search = typeof searches.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;

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
