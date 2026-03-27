import { db } from "../db";
import { services, searchAnalytics, serviceVotes } from "@shared/schema";
import { eq, gte, sql, type SQL } from "drizzle-orm";

export class AnalyticsStorage {
  async trackSearchClick(data: {
    query: string;
    normalizedQuery: string;
    resultCount: number;
    clickedServiceId?: string;
    clickPosition?: number;
    sessionId?: string;
    userAgent?: string;
  }): Promise<void> {
    // Use transaction to ensure atomicity of analytics + click count update
    await db.transaction(async (tx) => {
      await tx.insert(searchAnalytics).values({
        query: data.query,
        normalizedQuery: data.normalizedQuery,
        resultCount: data.resultCount,
        clickedServiceId: data.clickedServiceId || null,
        clickPosition: data.clickPosition || null,
        sessionId: data.sessionId || null,
        userAgent: data.userAgent || null,
      });

      // If a service was clicked, increment its click count and update last_clicked
      if (data.clickedServiceId) {
        await tx
          .update(services)
          .set({
            clickCount: sql`COALESCE(${services.clickCount}, 0) + 1`,
          })
          .where(eq(services.serviceId, data.clickedServiceId));
      }
    });
  }

  async getClickCountForService(serviceId: string): Promise<number> {
    const result = await db
      .select({ clickCount: services.clickCount })
      .from(services)
      .where(eq(services.serviceId, serviceId))
      .limit(1);
    return result[0]?.clickCount ?? 0;
  }

  async getPopularSearches(limit: number = 20): Promise<{ query: string; count: number }[]> {
    const result = await db
      .select({
        query: searchAnalytics.normalizedQuery,
        count: sql<number>`COUNT(*)`,
      })
      .from(searchAnalytics)
      .groupBy(searchAnalytics.normalizedQuery)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);
    return result.map(r => ({ query: r.query, count: Number(r.count) }));
  }

  async getPopularQueries(limit: number = 100, days: number = 30): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await db
      .select({
        query: searchAnalytics.normalizedQuery,
      })
      .from(searchAnalytics)
      .where(gte(searchAnalytics.createdAt, cutoff))
      .groupBy(searchAnalytics.normalizedQuery)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    return result.map(r => r.query);
  }

  async getQueryAffinities(normalizedQuery: string): Promise<{ serviceId: string; clickScore: number; voteScore: number }[]> {
    try {
      const result = await db.execute(sql`
        SELECT service_id, click_score, vote_score
        FROM query_service_affinities
        WHERE normalized_query = ${normalizedQuery}
        ORDER BY click_score DESC
        LIMIT 50
      `);
      return (result.rows as any[]).map(r => ({
        serviceId: r.service_id,
        clickScore: r.click_score ?? 0,
        voteScore: r.vote_score ?? 0,
      }));
    } catch {
      // Table may not exist yet — return empty
      return [];
    }
  }

  async createServiceVote(serviceId: string, vote: 'up' | 'down', queryContext?: string): Promise<void> {
    await db.insert(serviceVotes).values({ serviceId, vote, queryContext: queryContext ?? null });
  }

  async recordSearchQuality(data: {
    sessionId?: string;
    query: string;
    queryNormalized: string;
    resultCount: number;
  }): Promise<number | null> {
    try {
      const result = await db.execute(sql`
        INSERT INTO search_quality_metrics (session_id, query, query_normalized, result_count)
        VALUES (${data.sessionId || null}, ${data.query}, ${data.queryNormalized}, ${data.resultCount})
        RETURNING id
      `);
      return (result.rows[0] as any)?.id || null;
    } catch {
      return null;
    }
  }

  async updateSearchQuality(id: number, data: {
    firstClickPosition?: number;
    clickCount?: number;
    dwellTimeMs?: number;
    reformulated?: boolean;
  }): Promise<void> {
    try {
      const setClauses: SQL[] = [];
      if (data.firstClickPosition !== undefined) {
        setClauses.push(sql`first_click_position = ${data.firstClickPosition}`);
      }
      if (data.clickCount !== undefined) {
        setClauses.push(sql`click_count = ${data.clickCount}`);
      }
      if (data.dwellTimeMs !== undefined) {
        setClauses.push(sql`dwell_time_ms = ${data.dwellTimeMs}`);
      }
      if (data.reformulated !== undefined) {
        setClauses.push(sql`reformulated = ${data.reformulated}`);
      }
      if (setClauses.length > 0) {
        await db.execute(sql`
          UPDATE search_quality_metrics
          SET ${sql.join(setClauses, sql`, `)}
          WHERE id = ${id}
        `);
      }
    } catch (err) {
      console.warn('[Quality] Failed to update metrics:', err);
    }
  }

  /** Update the most recent quality metric for a session (used by click tracking) */
  async updateSearchQualityBySession(sessionId: string, data: {
    firstClickPosition?: number;
    clickCount?: number;
  }): Promise<void> {
    try {
      // Find most recent metric for this session
      const result = await db.execute(sql`
        SELECT id, click_count FROM search_quality_metrics
        WHERE session_id = ${sessionId}
        ORDER BY created_at DESC LIMIT 1
      `);
      const row = result.rows[0] as any;
      if (!row) return;

      const updates: SQL[] = [];
      if (data.firstClickPosition !== undefined && !row.first_click_position) {
        updates.push(sql`first_click_position = ${data.firstClickPosition}`);
      }
      const newCount = (Number(row.click_count) || 0) + 1;
      updates.push(sql`click_count = ${newCount}`);

      if (updates.length > 0) {
        await db.execute(sql`
          UPDATE search_quality_metrics
          SET ${sql.join(updates, sql`, `)}
          WHERE id = ${row.id}
        `);
      }
    } catch {
      // Non-critical — don't let quality tracking break click tracking
    }
  }

  async getSearchQualityReport(days: number = 7): Promise<{
    totalSearches: number;
    avgFirstClickPosition: number;
    reformulationRate: number;
    zeroResultRate: number;
  }> {
    try {
      const result = await db.execute(sql`SELECT * FROM get_search_quality_report(${days})`);
      const row = result.rows[0] as any;
      return {
        totalSearches: Number(row?.total_searches) || 0,
        avgFirstClickPosition: Number(row?.avg_first_click) || 0,
        reformulationRate: Number(row?.reformulation_rate) || 0,
        zeroResultRate: Number(row?.zero_result_rate) || 0,
      };
    } catch (err) {
      console.error('[storage] getSearchQualityReport error:', err);
      return {
        totalSearches: 0,
        avgFirstClickPosition: 0,
        reformulationRate: 0,
        zeroResultRate: 0,
      };
    }
  }
}
