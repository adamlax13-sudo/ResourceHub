/**
 * Admin system routes — /api/admin/system/*
 *
 * System health, configuration, and maintenance operations.
 */

import type { Express } from "express";
import { z } from "zod";
import { adminAuth, adminReadLimiter, adminWriteLimiter } from "../middleware/adminAuth";
import { asyncHandler } from "../helpers/errors";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerAdminSystemRoutes(app: Express): void {
  // ============= SYSTEM STATUS =============
  app.get("/api/admin/system/status", adminReadLimiter, adminAuth, asyncHandler(async (_req, res) => {
    // DB ping
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbPingMs = Date.now() - dbStart;

    // Service counts
    const countResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalServices",
        COUNT(*) FILTER (WHERE is_active = true)::int AS "activeServices",
        COUNT(*) FILTER (WHERE is_active = false)::int AS "inactiveServices",
        COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS "servicesWithEmbedding",
        COUNT(*) FILTER (WHERE latitude IS NOT NULL)::int AS "servicesWithGeocoding"
      FROM services
    `);

    // Last scraper run
    const scraperResult = await db.execute(sql`
      SELECT run_id, started_at, completed_at, status
      FROM scraper_logs
      ORDER BY started_at DESC
      LIMIT 1
    `);

    // Search cache stats
    const cacheResult = await db.execute(sql`
      SELECT COUNT(*)::int AS "cachedQueries"
      FROM searches
    `);

    res.json({
      success: true,
      database: {
        connected: true,
        pingMs: dbPingMs,
      },
      services: countResult.rows[0] || {},
      cache: cacheResult.rows[0] || {},
      lastScraperRun: scraperResult.rows[0] || null,
    });
  }));

  // ============= SYSTEM CONFIG =============
  app.get("/api/admin/system/config", adminReadLimiter, adminAuth, asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      config: {
        analyticsRetentionDays: 180, // 6 months default
        embeddingModel: 'text-embedding-3-large',
        embeddingDimensions: 1536,
        searchCacheEnabled: true,
      },
    });
  }));

  // ============= REGENERATE ALL EMBEDDINGS =============
  app.post("/api/admin/system/regenerate-all-embeddings", adminWriteLimiter, adminAuth, asyncHandler(async (req, res) => {
    const dryRunSchema = z.object({ dryRun: z.boolean().default(true) });
    const parsed = dryRunSchema.safeParse(req.body);
    const dryRun = !parsed.success || parsed.data.dryRun;

    // Count services that need embeddings
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM services WHERE is_active = true
    `);
    const total = (countResult.rows[0] as any)?.total || 0;

    // Estimate cost: ~$0.00002 per embedding (text-embedding-3-large)
    const estimatedCost = (total * 0.00002).toFixed(4);

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        totalServices: total,
        estimatedCostUSD: estimatedCost,
        message: `Would regenerate embeddings for ${total} services. Estimated cost: $${estimatedCost}`,
      });
    }

    // Fire-and-forget: iterate all active services and regenerate
    console.log(`[AdminSystem] Starting full embedding regeneration for ${total} services`);
    (async () => {
      const { getOpenAI } = await import("../helpers/openai");
      const openai = getOpenAI();
      let successCount = 0;
      let errorCount = 0;

      const allServices = await db.execute(sql`
        SELECT id, name, description, category, tags FROM services WHERE is_active = true ORDER BY id
      `);

      for (const svc of allServices.rows) {
        try {
          const s = svc as any;
          const parts = [s.name];
          if (s.description) parts.push(s.description);
          if (s.category) parts.push(s.category);
          if (Array.isArray(s.tags)) parts.push(s.tags.join(' '));
          const text = parts.join(' ').slice(0, 8000);

          const response = await openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: text,
            dimensions: 1536,
          });

          const embeddingStr = `[${response.data[0].embedding.join(',')}]`;
          await db.execute(
            sql`UPDATE services SET embedding = ${embeddingStr}::vector, embedding_updated_at = NOW() WHERE id = ${s.id}`
          );
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`[AdminSystem] Embedding regen failed for id=${(svc as any).id}:`, err);
        }
      }

      console.log(`[AdminSystem] Full embedding regen complete: ${successCount} success, ${errorCount} errors`);
    })();

    res.json({
      success: true,
      message: `Embedding regeneration started for ${total} services`,
      totalServices: total,
    });
  }));

  // ============= PURGE OLD ANALYTICS =============
  app.post("/api/admin/system/purge-analytics", adminWriteLimiter, adminAuth, asyncHandler(async (req, res) => {
    const schema = z.object({
      olderThanDays: z.number().int().min(30).max(365).default(180),
      dryRun: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    const { olderThanDays, dryRun } = parsed.success ? parsed.data : { olderThanDays: 180, dryRun: true };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    if (dryRun) {
      const countResult = await db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM search_analytics
        WHERE created_at < ${cutoff}
      `);
      const total = (countResult.rows[0] as any)?.total || 0;
      return res.json({
        success: true,
        dryRun: true,
        rowsToDelete: total,
        cutoffDate: cutoff.toISOString(),
      });
    }

    const deleteResult = await db.execute(sql`
      DELETE FROM search_analytics
      WHERE created_at < ${cutoff}
    `);
    const deletedCount = deleteResult.rowCount || 0;

    console.log(`[AdminSystem] Purged ${deletedCount} analytics rows older than ${olderThanDays} days`);
    res.json({ success: true, deleted: deletedCount, cutoffDate: cutoff.toISOString() });
  }));

  // ============= TRANSLATION MANAGEMENT =============

  // Get translation coverage stats per language
  app.get("/api/admin/translations/stats", adminReadLimiter, adminAuth, asyncHandler(async (_req, res) => {
    const { getTranslationStats } = await import('../translation/index');
    const stats = await getTranslationStats();
    res.json({ success: true, stats });
  }));

  // Warm French translations (or any language via ?lang=xx)
  app.post("/api/admin/translations/warm", adminWriteLimiter, adminAuth, asyncHandler(async (req, res) => {
    const schema = z.object({ lang: z.string().max(5).default('fr') });
    const parsed = schema.safeParse(req.body);
    const lang = parsed.success ? parsed.data.lang : 'fr';

    // Run in background — respond immediately
    const { warmTranslations } = await import('../translation/batch');
    res.json({ success: true, message: `Started warming ${lang} translations in background` });

    warmTranslations(lang, (done, total) => {
      if (done % 50 === 0 || done === total) {
        console.log(`[Translation] Warming ${lang}: ${done}/${total}`);
      }
    }).then(result => {
      console.log(`[Translation] Warming ${lang} complete:`, result);
    }).catch(err => {
      console.error(`[Translation] Warming ${lang} failed:`, err);
    });
  }));

  // Clear cached translations for a specific service
  app.delete("/api/admin/translations/:serviceId", adminWriteLimiter, adminAuth, asyncHandler(async (req, res) => {
    const serviceId = req.params.serviceId;
    const { invalidateTranslations } = await import('../translation/index');
    await invalidateTranslations(serviceId);
    res.json({ success: true, message: `Translations cleared for ${serviceId}` });
  }));

  // ============= SEARCH QUALITY DASHBOARD =============
  app.get("/api/admin/search-quality", adminReadLimiter, adminAuth, asyncHandler(async (_req, res) => {
    const { cacheStats } = await import('../search/index');

    // Search volume from recent analytics
    const volumeResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalSearches",
        COUNT(DISTINCT query)::int AS "uniqueQueries"
      FROM search_analytics
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    // Top queries without clicks (last 7 days)
    const noClickResult = await db.execute(sql`
      SELECT query, COUNT(*)::int AS searches
      FROM search_analytics
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND clicked_service_id IS NULL
        AND query IS NOT NULL
      GROUP BY query
      ORDER BY searches DESC
      LIMIT 10
    `);

    // DB cache entry count
    const dbCacheResult = await db.execute(sql`
      SELECT COUNT(*)::int AS "cachedQueries"
      FROM searches
    `);

    const total = cacheStats.hits + cacheStats.misses;
    const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(1) : 'n/a';

    res.json({
      success: true,
      volume: volumeResult.rows[0] || {},
      cache: {
        dbEntries: (dbCacheResult.rows[0] as any)?.cachedQueries || 0,
        inMemory: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate: `${hitRate}%`,
          since: new Date(cacheStats.lastReset).toISOString(),
        },
        recentMisses: cacheStats.recentMisses,
      },
      llm: {
        enabled: process.env.SEARCH_LLM_ENABLED !== 'false',
      },
      topQueriesWithoutClicks: noClickResult.rows,
    });
  }));
}
