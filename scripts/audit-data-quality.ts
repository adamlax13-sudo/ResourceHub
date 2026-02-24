/**
 * Data Quality Audit Script
 *
 * Identifies services with missing contact info, truncated descriptions,
 * and other data quality issues that affect search result quality.
 */

import 'dotenv/config';
import { db } from '../server/db';
import { services, aiServiceEnrichments } from '@shared/schema';
import { eq, isNull, or, sql } from 'drizzle-orm';

interface DataQualityIssue {
  serviceId: string;
  name: string;
  issues: string[];
}

async function auditDataQuality() {
  console.log('='.repeat(60));
  console.log('DATA QUALITY AUDIT');
  console.log('='.repeat(60));

  const allServices = await db
    .select()
    .from(services)
    .where(eq(services.isActive, true));

  console.log(`\nTotal active services: ${allServices.length}\n`);

  const issuesByType = {
    missingPhone: [] as DataQualityIssue[],
    missingDescription: [] as DataQualityIssue[],
    truncatedDescription: [] as DataQualityIssue[],
    missingContact: [] as DataQualityIssue[],
    missingLocation: [] as DataQualityIssue[],
    missingWebsite: [] as DataQualityIssue[],
  };

  for (const service of allServices) {
    const issues: string[] = [];

    // Check for missing phone
    if (!service.phone?.trim()) {
      issues.push('missing_phone');
    }

    // Check for missing or empty description
    if (!service.description?.trim()) {
      issues.push('missing_description');
    } else if (service.description.length < 50) {
      issues.push('short_description');
    } else if (service.description.endsWith('...') || service.description.endsWith('…')) {
      issues.push('truncated_description');
    }

    // Check for missing contact info (no phone AND no email AND no contact field)
    if (!service.phone?.trim() && !service.email?.trim() && !service.contact?.trim()) {
      issues.push('no_contact_info');
    }

    // Check for missing location
    if (!service.location?.trim() && !service.address?.trim()) {
      issues.push('missing_location');
    }

    // Check for missing website
    if (!service.websiteUrl?.trim()) {
      issues.push('missing_website');
    }

    if (issues.length > 0) {
      const issue: DataQualityIssue = {
        serviceId: service.serviceId,
        name: service.name,
        issues,
      };

      if (issues.includes('missing_phone')) {
        issuesByType.missingPhone.push(issue);
      }
      if (issues.includes('missing_description') || issues.includes('short_description')) {
        issuesByType.missingDescription.push(issue);
      }
      if (issues.includes('truncated_description')) {
        issuesByType.truncatedDescription.push(issue);
      }
      if (issues.includes('no_contact_info')) {
        issuesByType.missingContact.push(issue);
      }
      if (issues.includes('missing_location')) {
        issuesByType.missingLocation.push(issue);
      }
      if (issues.includes('missing_website')) {
        issuesByType.missingWebsite.push(issue);
      }
    }
  }

  // Print summary
  console.log('ISSUE SUMMARY:');
  console.log('-'.repeat(40));
  console.log(`Missing phone number:     ${issuesByType.missingPhone.length} services`);
  console.log(`Missing/short description: ${issuesByType.missingDescription.length} services`);
  console.log(`Truncated description:    ${issuesByType.truncatedDescription.length} services`);
  console.log(`No contact info at all:   ${issuesByType.missingContact.length} services`);
  console.log(`Missing location:         ${issuesByType.missingLocation.length} services`);
  console.log(`Missing website:          ${issuesByType.missingWebsite.length} services`);

  // Check for existing enrichments that could fill gaps
  const enrichments = await db.select().from(aiServiceEnrichments);
  const enrichmentMap = new Map(enrichments.map(e => [e.serviceId, e]));

  let canFillFromEnrichment = 0;
  let needsNewEnrichment = 0;

  for (const issue of issuesByType.missingContact) {
    const enrichment = enrichmentMap.get(issue.serviceId);
    if (enrichment?.aiContact?.trim()) {
      canFillFromEnrichment++;
    } else {
      needsNewEnrichment++;
    }
  }

  console.log('\n' + '-'.repeat(40));
  console.log('ENRICHMENT STATUS:');
  console.log(`Total enrichments in DB:  ${enrichments.length}`);
  console.log(`Services needing contact info:`);
  console.log(`  - Can fill from existing enrichment: ${canFillFromEnrichment}`);
  console.log(`  - Needs new AI enrichment:           ${needsNewEnrichment}`);

  // Show sample of services without phone
  console.log('\n' + '-'.repeat(40));
  console.log('SAMPLE: Services without phone numbers (first 10):');
  for (const issue of issuesByType.missingPhone.slice(0, 10)) {
    console.log(`  - ${issue.name}`);
  }

  // Check for duplicates
  console.log('\n' + '-'.repeat(40));
  console.log('DUPLICATE CHECK:');

  const nameCounts = new Map<string, string[]>();
  for (const service of allServices) {
    const normalizedName = service.name.toLowerCase().trim();
    if (!nameCounts.has(normalizedName)) {
      nameCounts.set(normalizedName, []);
    }
    nameCounts.get(normalizedName)!.push(service.serviceId);
  }

  const duplicates = Array.from(nameCounts.entries())
    .filter(([_, ids]) => ids.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Services with duplicate names: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('Top duplicates:');
    for (const [name, ids] of duplicates.slice(0, 5)) {
      console.log(`  - "${name}" (${ids.length} instances)`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(60));

  if (canFillFromEnrichment > 0) {
    console.log(`1. Run: npx tsx scripts/backfill-enrichments.ts`);
    console.log(`   This will fill ${canFillFromEnrichment} services from existing AI data.`);
  }

  if (needsNewEnrichment > 0) {
    console.log(`2. Run: npx tsx scripts/enrich-missing-contacts.ts`);
    console.log(`   This will generate AI enrichments for ${needsNewEnrichment} services.`);
  }

  if (duplicates.length > 0) {
    console.log(`3. Run: npx tsx scripts/detect-duplicates.ts`);
    console.log(`   This will identify and help resolve ${duplicates.length} duplicate services.`);
  }

  process.exit(0);
}

auditDataQuality().catch(console.error);
