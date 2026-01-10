import { users, type User } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  upsertUserByReplitId(userData: {
    replitId: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  }): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user;
  }

  async upsertUserByReplitId(userData: {
    replitId: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  }): Promise<User> {
    // First try to find existing user
    const existingUser = await this.getUserByReplitId(userData.replitId);
    
    if (existingUser) {
      // Update existing user - only update identity fields, preserve demographics
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
          // Explicitly preserve demographic fields - do not overwrite
        })
        .where(eq(users.replitId, userData.replitId))
        .returning();
      return user;
    } else {
      // Insert new user - demographics will be NULL initially (added via Profile page)
      const [user] = await db
        .insert(users)
        .values({
          replitId: userData.replitId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
        })
        .returning();
      return user;
    }
  }
}

export const authStorage = new AuthStorage();
