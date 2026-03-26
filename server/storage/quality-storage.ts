import { db } from "../db";
import { services, type Service } from "@shared/schema";
import { sql } from "drizzle-orm";

export class QualityStorage {
  async getQualitySummary(): Promise<Record<string, number>> {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '') * 100.0 / NULLIF(COUNT(*), 0) AS phone,
        COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') * 100.0 / NULLIF(COUNT(*), 0) AS email,
        COUNT(*) FILTER (WHERE website_url IS NOT NULL AND website_url != '') * 100.0 / NULLIF(COUNT(*), 0) AS "websiteUrl",
        COUNT(*) FILTER (WHERE address IS NOT NULL AND address != '') * 100.0 / NULLIF(COUNT(*), 0) AS address,
        COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') * 100.0 / NULLIF(COUNT(*), 0) AS description,
        COUNT(*) FILTER (WHERE hours_of_operation IS NOT NULL AND hours_of_operation != '') * 100.0 / NULLIF(COUNT(*), 0) AS "hoursOfOperation",
        COUNT(*) FILTER (WHERE eligibility IS NOT NULL AND eligibility != '') * 100.0 / NULLIF(COUNT(*), 0) AS eligibility,
        COUNT(*) FILTER (WHERE wait_times IS NOT NULL AND wait_times != '') * 100.0 / NULLIF(COUNT(*), 0) AS "waitTimes",
        COUNT(*) FILTER (WHERE service_format IS NOT NULL AND service_format != '') * 100.0 / NULLIF(COUNT(*), 0) AS "serviceFormat",
        COUNT(*) FILTER (WHERE process_steps IS NOT NULL AND process_steps::text != '[]' AND process_steps::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS "processSteps",
        COUNT(*) FILTER (WHERE required_docs IS NOT NULL AND required_docs::text != '[]' AND required_docs::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS "requiredDocs",
        COUNT(*) FILTER (WHERE languages_supported IS NOT NULL AND languages_supported::text != '[]' AND languages_supported::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS "languagesSupported",
        COUNT(*) FILTER (WHERE latitude IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) AS latitude,
        COUNT(*) FILTER (WHERE tags IS NOT NULL AND tags::text != '[]' AND tags::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS tags,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) AS embedding,
        -- % of services with embeddings that are up-to-date (embedding_updated_at >= last_updated)
        COUNT(*) FILTER (WHERE embedding IS NOT NULL AND (embedding_updated_at IS NULL OR embedding_updated_at >= last_updated)) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE embedding IS NOT NULL), 0) AS "embeddingFresh",
        -- % of geocoded services that are up-to-date
        COUNT(*) FILTER (WHERE latitude IS NOT NULL AND (geocoded_at IS NULL OR geocoded_at >= last_updated)) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE latitude IS NOT NULL), 0) AS "geocodingFresh"
      FROM services
      WHERE is_active = true
    `);

    const row = result.rows[0] as any;
    const summary: Record<string, number> = {};
    for (const field of ['phone', 'email', 'websiteUrl', 'address', 'description', 'hoursOfOperation', 'eligibility', 'waitTimes', 'serviceFormat', 'processSteps', 'requiredDocs', 'languagesSupported', 'latitude', 'tags', 'embedding', 'embeddingFresh', 'geocodingFresh']) {
      summary[field] = Math.round(Number(row?.[field] ?? 0) * 10) / 10;
    }
    return summary;
  }

  async getQualityIssues(params: {
    page?: number;
    limit?: number;
    fieldFilter?: string;
    severityFilter?: string;
  }): Promise<{ issues: { service: Service; severity: string; missingFields: string[] }[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const offset = (page - 1) * limit;

    // Map field filter values to SQL conditions (for server-side filtering)
    const FIELD_SQL: Record<string, string> = {
      phone: "(phone IS NULL OR phone = '')",
      email: "(email IS NULL OR email = '')",
      noContact: "((phone IS NULL OR phone = '') AND (email IS NULL OR email = ''))",
      websiteUrl: "(website_url IS NULL OR website_url = '')",
      name: "(name IS NULL OR name = '')",
      description: "(description IS NULL OR description = '')",
      eligibility: "(eligibility IS NULL OR eligibility = '')",
      address: "(address IS NULL OR address = '')",
      lowConfidence: "confidence_score < 30",
      hoursOfOperation: "(hours_of_operation IS NULL OR hours_of_operation = '')",
      waitTimes: "(wait_times IS NULL OR wait_times = '')",
      serviceFormat: "(service_format IS NULL OR service_format = '')",
      processSteps: "(process_steps IS NULL OR process_steps::text = '[]' OR process_steps::text = 'null')",
      requiredDocs: "(required_docs IS NULL OR required_docs::text = '[]' OR required_docs::text = 'null')",
      languagesSupported: "(languages_supported IS NULL OR languages_supported::text = '[]' OR languages_supported::text = 'null')",
      tags: "(tags IS NULL OR tags::text = '[]' OR tags::text = 'null')",
      // "Fresh" = has the data AND it's up-to-date; NOT fresh = missing OR stale
      freshEmbedding: "(embedding IS NULL OR (embedding_updated_at IS NOT NULL AND last_updated > embedding_updated_at))",
      freshGeocoding: "(latitude IS NULL OR (geocoded_at IS NOT NULL AND last_updated > geocoded_at))",
      // Legacy individual filters still useful for drilling down
      latitude: "latitude IS NULL",
      embedding: "embedding IS NULL",
      staleEmbedding: "(embedding IS NOT NULL AND embedding_updated_at IS NOT NULL AND last_updated > embedding_updated_at)",
      staleGeocoding: "(latitude IS NOT NULL AND geocoded_at IS NOT NULL AND last_updated > geocoded_at)",
    };

    const SEVERITY_SQL: Record<string, string> = {
      critical: "((phone IS NULL OR phone = '') AND (email IS NULL OR email = ''))",
      high: "(description IS NULL OR description = '')",
      medium: "NOT ((phone IS NULL OR phone = '') AND (email IS NULL OR email = '')) AND NOT (description IS NULL OR description = '')",
    };

    // Build extra WHERE conditions from filters
    const extraConditions: string[] = [];
    if (params.fieldFilter && FIELD_SQL[params.fieldFilter]) {
      extraConditions.push(FIELD_SQL[params.fieldFilter]);
    }
    if (params.severityFilter && SEVERITY_SQL[params.severityFilter]) {
      extraConditions.push(SEVERITY_SQL[params.severityFilter]);
    }
    const extraWhere = extraConditions.length > 0
      ? `AND ${extraConditions.join(' AND ')}`
      : '';

    // A service is flagged if it's missing core fields that affect usability.
    // Optional fields (wait_times, required_docs, address) are trackable via
    // field filters but don't inflate the main issue count — many services
    // legitimately lack these (no docs required, virtual/province-wide, etc.)
    const baseWhere = `is_active = true
        AND (
          -- Core: name/title
          (name IS NULL OR name = '')
          -- Core: description
          OR (description IS NULL OR description = '')
          -- Core: eligibility
          OR (eligibility IS NULL OR eligibility = '')
          -- Core: process steps
          OR (process_steps IS NULL OR process_steps::text = '[]' OR process_steps::text = 'null')
          -- Core: hours of operation
          OR (hours_of_operation IS NULL OR hours_of_operation = '')
          -- Core: service format
          OR (service_format IS NULL OR service_format = '')
          -- Core: tags
          OR (tags IS NULL OR tags::text = '[]' OR tags::text = 'null')
          -- Core: languages
          OR (languages_supported IS NULL OR languages_supported::text = '[]' OR languages_supported::text = 'null')
          -- Core: website
          OR (website_url IS NULL OR website_url = '')
          -- Infrastructure: fresh embedding (must exist AND be up-to-date)
          OR embedding IS NULL OR (embedding_updated_at IS NOT NULL AND last_updated > embedding_updated_at)
          -- Infrastructure: fresh geotagging (must exist AND be up-to-date)
          OR latitude IS NULL OR (geocoded_at IS NOT NULL AND last_updated > geocoded_at)
          -- Critical: missing ALL contact details (no phone AND no email)
          OR ((phone IS NULL OR phone = '') AND (email IS NULL OR email = ''))
        )`;

    // Query active services that have quality issues, ordered by confidence ASC
    // Note: baseWhere and extraWhere are hardcoded SQL from constant maps, not user input
    const result = await db.execute(sql`
      SELECT *,
        CASE
          WHEN (phone IS NULL OR phone = '') AND (email IS NULL OR email = '') THEN 'critical'
          WHEN (description IS NULL OR description = '') THEN 'high'
          ELSE 'medium'
        END AS severity_level
      FROM services
      WHERE ${sql.raw(baseWhere)}
        ${sql.raw(extraWhere)}
      ORDER BY
        CASE
          WHEN (phone IS NULL OR phone = '') AND (email IS NULL OR email = '') THEN 1
          WHEN (description IS NULL OR description = '') THEN 2
          ELSE 3
        END,
        COALESCE(confidence_score, 999) ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM services
      WHERE ${sql.raw(baseWhere)}
        ${sql.raw(extraWhere)}
    `);

    const issues = (result.rows as any[]).map(row => {
      const missingFields: string[] = [];

      // Contact fields (individually tracked for visibility)
      if (!row.phone) missingFields.push('phone');
      if (!row.email) missingFields.push('email');
      // Composite: no contact at all
      if (!row.phone && !row.email) missingFields.push('noContact');

      // 14 required fields
      if (!row.name) missingFields.push('name');
      if (!row.description) missingFields.push('description');
      if (!row.eligibility) missingFields.push('eligibility');
      if (!row.website_url) missingFields.push('websiteUrl');
      if (!row.address) missingFields.push('address');
      if (!row.hours_of_operation) missingFields.push('hoursOfOperation');
      if (!row.wait_times) missingFields.push('waitTimes');
      if (!row.service_format) missingFields.push('serviceFormat');
      const ps = row.process_steps;
      if (!ps || (typeof ps === 'string' ? ps === '[]' || ps === 'null' : Array.isArray(ps) && ps.length === 0)) missingFields.push('processSteps');
      const rd = row.required_docs;
      if (!rd || (typeof rd === 'string' ? rd === '[]' || rd === 'null' : Array.isArray(rd) && rd.length === 0)) missingFields.push('requiredDocs');
      const ls = row.languages_supported;
      if (!ls || (typeof ls === 'string' ? ls === '[]' || ls === 'null' : Array.isArray(ls) && ls.length === 0)) missingFields.push('languagesSupported');
      const tg = row.tags;
      if (!tg || (typeof tg === 'string' ? tg === '[]' || tg === 'null' : Array.isArray(tg) && tg.length === 0)) missingFields.push('tags');

      // Fresh embedding: must exist AND be up-to-date
      const hasEmbedding = !!row.embedding;
      const embeddingStale = hasEmbedding && row.embedding_updated_at && row.last_updated &&
          new Date(row.embedding_updated_at) < new Date(row.last_updated);
      if (!hasEmbedding || embeddingStale) missingFields.push('freshEmbedding');

      // Fresh geotagging: must exist AND be up-to-date
      const hasGeo = !!row.latitude;
      const geoStale = hasGeo && row.geocoded_at && row.last_updated &&
          new Date(row.geocoded_at) < new Date(row.last_updated);
      if (!hasGeo || geoStale) missingFields.push('freshGeocoding');

      // Non-flagging visibility fields (for data quality tracking only)
      if (row.confidence_score < 30) missingFields.push('lowConfidence');

      // Map raw row to Service shape
      const service: Service = {
        id: row.id,
        serviceId: row.service_id,
        name: row.name,
        category: row.category,
        description: row.description,
        location: row.location,
        contact: row.contact,
        eligibility: row.eligibility,
        phone: row.phone,
        email: row.email,
        address: row.address,
        processSteps: row.process_steps,
        waitTimes: row.wait_times,
        requiredDocs: row.required_docs,
        hoursOfOperation: row.hours_of_operation,
        languagesSupported: row.languages_supported,
        serviceFormat: row.service_format,
        websiteUrl: row.website_url,
        confidenceScore: row.confidence_score,
        isActive: row.is_active,
        lastChecked: row.last_checked,
        lastUpdated: row.last_updated,
        tags: row.tags,
        popularityScore: row.popularity_score,
        clickCount: row.click_count,
        enrichmentSource: row.enrichment_source,
        enrichmentDate: row.enrichment_date,
        sourcePageHash: row.source_page_hash,
        genderRestriction: row.gender_restriction,
        is24_7: row.is_24_7,
        ageGroup: row.age_group,
        isFaithBased: row.is_faith_based,
        is12Step: row.is_12_step,
        latitude: row.latitude,
        longitude: row.longitude,
        geocodeSource: row.geocode_source,
        geocodedAt: row.geocoded_at,
        embeddingUpdatedAt: row.embedding_updated_at,
        duplicateOf: row.duplicate_of ?? null,
      };

      return {
        service,
        severity: row.severity_level as string,
        missingFields,
      };
    });

    return {
      issues,
      total: Number((countResult.rows[0] as any)?.total ?? 0),
    };
  }
}
