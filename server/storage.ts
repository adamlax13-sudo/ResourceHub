import { db } from "./db";
import { users, searches, favorites, recommendationsCache, feedback, type User, type Search, type Favorite, type UpdateDemographics, type RecommendationsCache, type Feedback, type InsertFeedback } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: Partial<User> & { replitId: string }): Promise<User>;
  updateUserDemographics(userId: number, demographics: UpdateDemographics): Promise<User>;

  createSearch(search: { query: string; results: any }): Promise<Search>;
  getSearchByQuery(query: string): Promise<Search | undefined>;

  getFavorites(userId: number): Promise<Favorite[]>;
  getFavorite(id: number): Promise<Favorite | undefined>;
  addFavorite(favorite: Omit<Favorite, 'id' | 'createdAt'>): Promise<Favorite>;
  updateFavorite(id: number, updates: Partial<Favorite>): Promise<Favorite>;
  deleteFavorite(id: number): Promise<void>;

  // Recommendations cache
  getCachedRecommendations(profileHash: string): Promise<RecommendationsCache | undefined>;
  cacheRecommendations(profileHash: string, results: any): Promise<RecommendationsCache>;

  // Feedback
  submitFeedback(feedbackData: InsertFeedback): Promise<Feedback>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(insertUser: Partial<User> & { replitId: string }): Promise<User> {
    let user = await this.getUserByReplitId(insertUser.replitId);
    if (user) {
      const [updated] = await db.update(users)
        .set({ 
          email: insertUser.email,
          firstName: insertUser.firstName,
          lastName: insertUser.lastName,
          profileImageUrl: insertUser.profileImageUrl
        })
        .where(eq(users.replitId, insertUser.replitId))
        .returning();
      return updated;
    }
    
    if (insertUser.email) {
      user = await this.getUserByEmail(insertUser.email);
      if (user) {
        const [updated] = await db.update(users)
          .set({ 
            replitId: insertUser.replitId,
            firstName: insertUser.firstName,
            lastName: insertUser.lastName,
            profileImageUrl: insertUser.profileImageUrl
          })
          .where(eq(users.email, insertUser.email))
          .returning();
        return updated;
      }
    }
    
    const [newUser] = await db.insert(users).values(insertUser as any).returning();
    return newUser;
  }

  async updateUserDemographics(userId: number, demographics: UpdateDemographics): Promise<User> {
    const [updated] = await db.update(users)
      .set({
        age: demographics.age,
        gender: demographics.gender,
        race: demographics.race,
        sexuality: demographics.sexuality,
        education: demographics.education,
        religion: demographics.religion,
        inAddiction: demographics.inAddiction,
        university: demographics.university,
        location: demographics.location,
        customLocation: demographics.customLocation,
        disability: demographics.disability,
        serviceFormat: demographics.serviceFormat,
        supportStyle: demographics.supportStyle,
        profileCompleted: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
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

  async getCachedRecommendations(profileHash: string): Promise<RecommendationsCache | undefined> {
    const [cached] = await db.select().from(recommendationsCache).where(eq(recommendationsCache.profileHash, profileHash));
    return cached;
  }

  async cacheRecommendations(profileHash: string, results: any): Promise<RecommendationsCache> {
    // Delete existing cache for this profile hash first (upsert pattern)
    await db.delete(recommendationsCache).where(eq(recommendationsCache.profileHash, profileHash));
    const [newCache] = await db.insert(recommendationsCache).values({ profileHash, results }).returning();
    return newCache;
  }

  async submitFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db.insert(feedback).values(feedbackData).returning();
    return newFeedback;
  }
}

export const storage = new DatabaseStorage();
