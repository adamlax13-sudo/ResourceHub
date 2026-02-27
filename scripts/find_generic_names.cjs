#!/usr/bin/env node
/**
 * Find services with generic names that should include their hosting organization.
 * Analyzes descriptions and websites to detect organization names missing from titles.
 */
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://db_resourcenavigator_user:sjZnkniL7937GHPmR3mNfACf2wTp4wz6@dpg-d5juaqffte5s738u3qng-a.oregon-postgres.render.com/db_resourcenavigator',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const result = await pool.query(`
    SELECT service_id, name, description, website_url
    FROM services
    WHERE is_active = true
    ORDER BY name
  `);

  const issues = [];

  for (const row of result.rows) {
    if (!row.description) continue;
    const desc = row.description;
    const name = row.name;

    // Patterns to detect org names in descriptions that aren't in the title
    const orgPatterns = [
      // "OrgName offers/provides/is..." at start of description
      /^(?:The\s+)?([A-Z][A-Za-z0-9 &'()\-\.]+?(?:Society|Centre|Center|Association|Organization|Foundation|Agency|House|Institute|Counselling|Counseling|Calgary|YW Calgary|YWCA|CMHA|Church|Mission|Network|Coalition|Council|Clinic|Hospital))\s+(?:offers?|provides?|runs?|delivers?|is a|is an|is the|operates?|has\b)/i,
      // "offered/provided/operated by OrgName"
      /(?:offered|provided|operated|run|delivered|managed|administered|funded)\s+by\s+(?:the\s+)?([A-Z][A-Za-z0-9 &'()\-\.]+?(?:Society|Centre|Center|Association|Organization|Foundation|Agency|House|Institute|Counselling|Counseling|Church|Mission|Network|Coalition|Council|Clinic|Hospital))/i,
      // "part of OrgName"
      /part of\s+(?:the\s+)?([A-Z][A-Za-z0-9 &'()\-\.]+?(?:Society|Centre|Center|Association|Organization|Foundation|Agency|House|Institute|Counselling|Counseling|Church|Mission|Network|Coalition|Council|Clinic|Hospital))/i,
    ];

    for (const pattern of orgPatterns) {
      const match = desc.match(pattern);
      if (match && match[1]) {
        const orgName = match[1].trim();
        // Check org name is at least 3 words or ends with a known suffix
        if (orgName.split(/\s+/).length < 2) continue;

        // Check if org name is NOT already in the service name
        const orgLower = orgName.toLowerCase();
        const nameLower = name.toLowerCase();

        // Skip if the org name or a significant part of it is already in the service name
        const orgWords = orgLower.split(/\s+/).filter(w => w.length > 3);
        const matchingWords = orgWords.filter(w => nameLower.includes(w));
        const matchRatio = matchingWords.length / orgWords.length;

        if (matchRatio < 0.5) {
          issues.push({
            service_id: row.service_id,
            current_name: row.name,
            org_in_desc: orgName,
            website: row.website_url || '',
            desc_start: desc.substring(0, 200)
          });
          break;
        }
      }
    }
  }

  console.log("Services with generic names (organization not in title):\n");
  console.log("=" .repeat(100));
  for (const issue of issues) {
    console.log(`ID: ${issue.service_id}`);
    console.log(`Current Name: ${issue.current_name}`);
    console.log(`Org in Desc:  ${issue.org_in_desc}`);
    console.log(`Website:      ${issue.website}`);
    console.log(`Description:  ${issue.desc_start}...`);
    console.log("-".repeat(100));
  }
  console.log(`\nTotal: ${issues.length} services with potential naming issues`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
