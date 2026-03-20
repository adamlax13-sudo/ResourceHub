import { db } from "../db";
import { services, serviceChangeRequests, serviceHistory, scraperLogs, type ScraperLog } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export class DashboardStorage {
  async getDashboardStats(): Promise<{ activeServices: number; pendingReviews: number; searchesToday: number; qualityScore: number }> {
    const [activeResult, pendingResult, searchResult, qualityResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(services).where(eq(services.isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(serviceChangeRequests).where(eq(serviceChangeRequests.status, 'pending')),
      db.execute(sql`
        SELECT COUNT(*) AS count FROM search_analytics
        WHERE created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Edmonton')::date
      `),
      db.execute(sql`
        SELECT
          ROUND(AVG(
            CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END +
            CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END +
            CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 ELSE 0 END +
            CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END +
            CASE WHEN address IS NOT NULL AND address != '' THEN 1 ELSE 0 END +
            CASE WHEN hours_of_operation IS NOT NULL AND hours_of_operation != '' THEN 1 ELSE 0 END +
            CASE WHEN eligibility IS NOT NULL AND eligibility != '' THEN 1 ELSE 0 END +
            CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END
          ) / 8.0 * 100, 1) AS quality_score
        FROM services WHERE is_active = true
      `),
    ]);

    return {
      activeServices: Number(activeResult[0]?.count ?? 0),
      pendingReviews: Number(pendingResult[0]?.count ?? 0),
      searchesToday: Number((searchResult.rows[0] as any)?.count ?? 0),
      qualityScore: Number((qualityResult.rows[0] as any)?.quality_score ?? 0),
    };
  }

  async getRecentActivity(limit: number = 20): Promise<any[]> {
    return await db
      .select({
        id: serviceHistory.id,
        serviceId: serviceHistory.serviceId,
        name: serviceHistory.name,
        category: serviceHistory.category,
        changeType: serviceHistory.changeType,
        changedFields: serviceHistory.changedFields,
        recordedAt: serviceHistory.recordedAt,
        confidenceScore: serviceHistory.confidenceScore,
        numericServiceId: services.id,
      })
      .from(serviceHistory)
      .leftJoin(services, eq(serviceHistory.serviceId, services.serviceId))
      .orderBy(desc(serviceHistory.recordedAt))
      .limit(limit);
  }

  async getScraperRuns(params: { page?: number; limit?: number }): Promise<{ runs: ScraperLog[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(scraperLogs),
      db.select().from(scraperLogs)
        .orderBy(desc(scraperLogs.startedAt))
        .limit(limit).offset(offset),
    ]);

    return {
      runs: dataResult,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getScraperRunById(id: number): Promise<ScraperLog | null> {
    const [run] = await db.select().from(scraperLogs).where(eq(scraperLogs.id, id));
    return run ?? null;
  }
}
