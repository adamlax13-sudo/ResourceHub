import { db } from "./db";
import { searches, type Search, type InsertSearch } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createSearch(search: InsertSearch): Promise<Search>;
  getSearchByQuery(query: string): Promise<Search | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createSearch(insertSearch: InsertSearch): Promise<Search> {
    const [search] = await db.insert(searches).values(insertSearch).returning();
    return search;
  }

  async getSearchByQuery(query: string): Promise<Search | undefined> {
    // Simple exact match for now, could be improved with vector search later
    const [search] = await db
      .select()
      .from(searches)
      .where(eq(searches.query, query));
    return search;
  }
}

export const storage = new DatabaseStorage();
