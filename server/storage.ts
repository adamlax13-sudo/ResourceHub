import { db } from "./db";
import { users, searches, favorites, type User, type Search, type Favorite } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  createUser(user: Partial<User>): Promise<User>;

  createSearch(search: { query: string; results: any }): Promise<Search>;
  getSearchByQuery(query: string): Promise<Search | undefined>;

  getFavorites(userId: number): Promise<Favorite[]>;
  getFavorite(id: number): Promise<Favorite | undefined>;
  addFavorite(favorite: Omit<Favorite, 'id' | 'createdAt'>): Promise<Favorite>;
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

  async createUser(insertUser: Partial<User>): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async createSearch(insertSearch: { query: string; results: any }): Promise<Search> {
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

  async addFavorite(favorite: Omit<Favorite, 'id' | 'createdAt'>): Promise<Favorite> {
    const [newFavorite] = await db.insert(favorites).values(favorite as any).returning();
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
