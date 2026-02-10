/**
 * Database Category Analysis Script
 *
 * Analyzes service categorization issues in the PostgreSQL database
 * Run with: npx tsx scripts/analyze-categories.ts
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

interface Service {
  service_id: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  eligibility: string | null;
}

interface CategoryIssue {
  service_id: string;
  name: string;
  current_category: string;
  issue: string;
  suggested_category?: string;
  reason: string;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('\n=== DATABASE CATEGORY ANALYSIS ===\n');

    // 1. Get category distribution
    const categoryResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM services
      WHERE is_active = true
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('📊 CATEGORY DISTRIBUTION:\n');
    console.log('Category | Count');
    console.log('-'.repeat(60));
    for (const row of categoryResult.rows) {
      console.log(`${row.category.padEnd(50)} | ${row.count}`);
    }

    // 2. Get all active services
    const servicesResult = await pool.query<Service>(`
      SELECT service_id, name, category, description, location, eligibility
      FROM services
      WHERE is_active = true
    `);

    const services = servicesResult.rows;
    const issues: CategoryIssue[] = [];

    // 3. Analyze each service for categorization issues
    for (const svc of services) {
      const desc = (svc.description || '').toLowerCase();
      const name = svc.name.toLowerCase();
      const elig = (svc.eligibility || '').toLowerCase();
      const loc = (svc.location || '').toLowerCase();
      const cat = svc.category.toLowerCase();

      // ISSUE 1: Women's shelter in generic shelter category
      if (
        (name.includes('women') || desc.includes('women') || elig.includes('women')) &&
        cat.includes('shelter') &&
        !cat.includes('women') &&
        !cat.includes('domestic')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'WOMEN_SHELTER_MISCATEGORIZED',
          suggested_category: 'Domestic Violence & Womens Shelters',
          reason: `Service targets women but is in generic shelter category. Eligibility: "${svc.eligibility}"`
        });
      }

      // ISSUE 2: Men's shelter not clearly marked
      if (
        (desc.includes('mens shelter') || desc.includes("men's shelter") || name.includes('men ')) &&
        !cat.includes('men')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'MENS_SERVICE_NOT_MARKED',
          suggested_category: svc.category + ' (Men Only)',
          reason: `Service is for men only but category doesn't indicate this. Description: "${svc.description?.slice(0, 100)}"`
        });
      }

      // ISSUE 3: Youth shelter not in youth category
      if (
        (name.includes('youth') || elig.includes('youth') || elig.includes('ages 15-') || elig.includes('18-24')) &&
        !cat.includes('youth') &&
        cat.includes('shelter')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'YOUTH_SERVICE_MISCATEGORIZED',
          suggested_category: 'Youth Services',
          reason: `Youth-specific service in generic category. Eligibility: "${svc.eligibility}"`
        });
      }

      // ISSUE 4: Location mismatch - service in wrong city category
      if (cat.includes('lethbridge') && !loc.includes('lethbridge') && loc.length > 0) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'LOCATION_CATEGORY_MISMATCH',
          reason: `Category says Lethbridge but location is: "${svc.location}"`
        });
      }

      if (cat.includes('edmonton') && !loc.includes('edmonton') && loc.length > 0) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'LOCATION_CATEGORY_MISMATCH',
          reason: `Category says Edmonton but location is: "${svc.location}"`
        });
      }

      if (cat.includes('calgary') && !loc.includes('calgary') && loc.length > 0 && !loc.includes('alberta')) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'LOCATION_CATEGORY_MISMATCH',
          reason: `Category says Calgary but location is: "${svc.location}"`
        });
      }

      // ISSUE 5: Province-wide service in city-specific category
      if (
        (loc.includes('alberta-wide') || loc.includes('alberta wide') || loc.includes('province')) &&
        (cat.includes('calgary') || cat.includes('edmonton') || cat.includes('lethbridge'))
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'PROVINCE_WIDE_IN_CITY_CATEGORY',
          reason: `Province-wide service in city-specific category. Location: "${svc.location}"`
        });
      }

      // ISSUE 6: City-specific service labeled as province-wide
      if (
        (loc.includes('calgary') || loc.includes('edmonton') || loc.includes('lethbridge')) &&
        !loc.includes('alberta') &&
        cat.includes('provincial')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'CITY_SERVICE_IN_PROVINCIAL_CATEGORY',
          reason: `City-specific service in provincial category. Location: "${svc.location}"`
        });
      }

      // ISSUE 7: Indigenous service not in Indigenous category
      if (
        (name.includes('indigenous') || name.includes('first nation') ||
         desc.includes('indigenous') || elig.includes('indigenous') ||
         name.includes('métis') || name.includes('inuit')) &&
        !cat.includes('indigenous')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'INDIGENOUS_SERVICE_MISCATEGORIZED',
          suggested_category: 'Indigenous Services',
          reason: `Indigenous-focused service not in Indigenous category`
        });
      }

      // ISSUE 8: Domestic violence service not in DV category
      if (
        (desc.includes('domestic violence') || desc.includes('family violence') ||
         desc.includes('fleeing violence') || elig.includes('fleeing violence')) &&
        !cat.includes('domestic') &&
        !cat.includes('violence')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'DV_SERVICE_MISCATEGORIZED',
          suggested_category: 'Domestic Violence & Womens Shelters',
          reason: `Domestic violence service not in appropriate category`
        });
      }

      // ISSUE 9: Addiction service not clearly categorized
      if (
        (desc.includes('addiction') || desc.includes('detox') || desc.includes('recovery') ||
         desc.includes('substance use') || desc.includes('sober')) &&
        !cat.includes('addiction') && !cat.includes('detox') && !cat.includes('recovery') &&
        !cat.includes('treatment') && !cat.includes('harm reduction') &&
        !cat.includes('mental health')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'ADDICTION_SERVICE_NOT_CLEAR',
          reason: `Addiction/recovery service in vague category. Description: "${svc.description?.slice(0, 80)}"`
        });
      }

      // ISSUE 10: LGBTQ+ service not clearly marked
      if (
        (name.includes('lgbtq') || name.includes('2slgbtq') || desc.includes('lgbtq') ||
         elig.includes('lgbtq') || desc.includes('trans') || elig.includes('queer')) &&
        !cat.includes('lgbtq') &&
        !cat.includes('2s')
      ) {
        issues.push({
          service_id: svc.service_id,
          name: svc.name,
          current_category: svc.category,
          issue: 'LGBTQ_SERVICE_MISCATEGORIZED',
          suggested_category: 'LGBTQ2S+ Services',
          reason: `LGBTQ+ focused service not in appropriate category`
        });
      }
    }

    // 4. Print issues by type
    console.log('\n\n📋 CATEGORIZATION ISSUES FOUND:\n');

    const issueTypes = [...new Set(issues.map(i => i.issue))];

    for (const type of issueTypes) {
      const typeIssues = issues.filter(i => i.issue === type);
      console.log(`\n🔴 ${type} (${typeIssues.length} services)\n`);
      console.log('-'.repeat(80));

      for (const issue of typeIssues) {
        console.log(`  Service: ${issue.name}`);
        console.log(`  Current: ${issue.current_category}`);
        if (issue.suggested_category) {
          console.log(`  Suggested: ${issue.suggested_category}`);
        }
        console.log(`  Reason: ${issue.reason}`);
        console.log('');
      }
    }

    // 5. Summary statistics
    console.log('\n\n📈 SUMMARY:\n');
    console.log(`Total active services: ${services.length}`);
    console.log(`Total issues found: ${issues.length}`);
    console.log(`Unique issue types: ${issueTypes.length}`);
    console.log('\nIssue breakdown:');
    for (const type of issueTypes) {
      const count = issues.filter(i => i.issue === type).length;
      console.log(`  ${type}: ${count}`);
    }

    // 6. Check for vague category names
    console.log('\n\n⚠️ VAGUE CATEGORY NAMES (need service type):\n');
    const vagueCategories = categoryResult.rows.filter(r =>
      r.category === 'Edmonton Services' ||
      r.category === 'Lethbridge Services' ||
      r.category === 'Medicine Hat Services' ||
      r.category === 'Other Provincial Services'
    );
    for (const cat of vagueCategories) {
      console.log(`  ${cat.category}: ${cat.count} services`);
    }

    // 7. Check for potential duplicates
    console.log('\n\n🔄 POTENTIAL DUPLICATE SERVICES:\n');
    const nameMap = new Map<string, Service[]>();
    for (const svc of services) {
      const simpleName = svc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!nameMap.has(simpleName)) {
        nameMap.set(simpleName, []);
      }
      nameMap.get(simpleName)!.push(svc);
    }

    for (const [, dupes] of nameMap) {
      if (dupes.length > 1) {
        console.log(`  Possible duplicates (${dupes.length} entries):`);
        for (const d of dupes) {
          console.log(`    - ${d.name} | ${d.category} | ${d.location}`);
        }
        console.log('');
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
