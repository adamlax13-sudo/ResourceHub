import { db } from "./db";
import { searches, feedback, type Search, type Feedback, type InsertFeedback } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createSearch(search: { query: string; results: any }): Promise<Search>;
  getSearchByQuery(query: string): Promise<Search | undefined>;

  createFeedback(feedbackData: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
}

export class DatabaseStorage implements IStorage {
  async createSearch(insertSearch: { query: string; results: any }): Promise<Search> {
    const [search] = await db.insert(searches).values(insertSearch).returning();
    return search;
  }

  async getSearchByQuery(query: string): Promise<Search | undefined> {
    const [search] = await db.select().from(searches).where(eq(searches.query, query));
    return search;
  }

  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db.insert(feedback).values(feedbackData).returning();
    return newFeedback;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return await db.select().from(feedback);
  }
}

export const storage = new DatabaseStorage();
