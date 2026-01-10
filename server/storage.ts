import { db } from "./db";
import { users, searches, favorites, type User, type InsertUser, type Search, type InsertSearch, type Favorite, type InsertFavorite } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Search operations
  createSearch(search: InsertSearch): Promise<Search>;
  getSearchByQuery(query: string): Promise<Search | undefined>;

  // Favorite operations
  getFavorites(userId: number): Promise<Favorite[]>;
  getFavorite(id: number): Promise<Favorite | undefined>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  updateFavorite(id: number, updates: Partial<Favorite>): Promise<Favorite>;
  deleteFavorite(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createSearch(insertSearch: InsertSearch): Promise<Search> {
    const [search] = await db.insert(searches).values(insertSearch).returning();
    return search;
  }

  async getSearchByQuery(query: string): Promise<Search | undefined> {
    const [search] = await db.select().from(searches).where(eq(searches.query, query));
    return search;
  }

  async getFavorites(userId: number): Promise<Favorite[]> {
    return await db.select().from(favorites).where(eq(favorites.userId, userId));
  }

  async getFavorite(id: number): Promise<Favorite | undefined> {
    const [favorite] = await db.select().from(favorites).where(eq(favorites.id, id));
    return favorite;
  }

  async addFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const [newFavorite] = await db.insert(favorites).values(favorite).returning();
    return newFavorite;
  }

  async updateFavorite(id: number, updates: Partial<Favorite>): Promise<Favorite> {
    const [updated] = await db.update(favorites).set(updates).where(eq(favorites.id, id)).returning();
    return updated;
  }

  async deleteFavorite(id: number): Promise<void> {
    await db.delete(favorites).where(eq(favorites.id, id));
  }
}

export const storage = new DatabaseStorage();
