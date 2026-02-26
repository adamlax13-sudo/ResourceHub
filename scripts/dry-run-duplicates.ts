/**
 * Dry run: Show what duplicates will be deactivated
 */
import 'dotenv/config';
import { Pool } from 'pg';

interface DeactivateItem {
  name: string;
  id: string;
  reason: string;
  keepName: string;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('=== DRY RUN: Services to be DEACTIVATED ===\n');

  const deactivateList: DeactivateItem[] = [];

  try {
    // 1. enCompass duplicates
    const encompass = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%enCompass%Nalah%' AND is_active = true
      ORDER BY LENGTH(name) DESC
    `);
    if (encompass.rows.length >= 2) {
      deactivateList.push({
        name: encompass.rows[1].name,
        id: encompass.rows[1].service_id,
        reason: 'Shorter duplicate',
        keepName: encompass.rows[0].name
      });
    }

    // 2. Iikaisskini
    const iik = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%Iikaisskini%' AND is_active = true
    `);
    const iikKeep = iik.rows.find((r: any) => !r.name.toLowerCase().endsWith('lethbridge'));
    const iikDeact = iik.rows.find((r: any) => r.name.toLowerCase().endsWith('lethbridge'));
    if (iikKeep && iikDeact && iikKeep.service_id !== iikDeact.service_id) {
      deactivateList.push({ name: iikDeact.name, id: iikDeact.service_id, reason: 'City suffix duplicate', keepName: iikKeep.name });
    }

    // 3. ConnecTeen
    const connecteen = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%ConnecTeen%' AND is_active = true
    `);
    const ctKeep = connecteen.rows.find((r: any) => r.name === 'ConnecTeen');
    const ctDeact = connecteen.rows.find((r: any) => r.name.includes('Calgary'));
    if (ctKeep && ctDeact && ctKeep.service_id !== ctDeact.service_id) {
      deactivateList.push({ name: ctDeact.name, id: ctDeact.service_id, reason: 'City suffix duplicate', keepName: ctKeep.name });
    }

    // 4. CMHA Edmonton (not distress/crisis)
    const cmha = await pool.query(`
      SELECT service_id, name FROM services
      WHERE (name ILIKE '%Canadian Mental Health Association%Edmonton%' OR name = 'CMHA Edmonton')
      AND name NOT ILIKE '%Distress%' AND name NOT ILIKE '%Crisis%' AND name NOT ILIKE '%Chat%'
      AND is_active = true
    `);
    const cmhaKeep = cmha.rows.find((r: any) => r.name.includes('Canadian Mental Health'));
    const cmhaDeact = cmha.rows.find((r: any) => r.name === 'CMHA Edmonton');
    if (cmhaKeep && cmhaDeact) {
      deactivateList.push({ name: cmhaDeact.name, id: cmhaDeact.service_id, reason: 'Abbreviated duplicate', keepName: cmhaKeep.name });
    }

    // 5. Distress Line Edmonton
    const distress = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%Distress Line%' AND name ILIKE '%Edmonton%' AND is_active = true
    `);
    const distKeep = distress.rows.find((r: any) => r.name.includes('Canadian Mental Health') || r.name.includes('CMHA'));
    const distDeact = distress.rows.find((r: any) => r.name === 'Distress Line Edmonton');
    if (distKeep && distDeact) {
      deactivateList.push({ name: distDeact.name, id: distDeact.service_id, reason: 'Missing org name', keepName: distKeep.name });
    }

    // 6. Family Centre
    const family = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%Family Centre%' AND is_active = true
    `);
    const famKeep = family.rows.find((r: any) => r.name.includes('Northern Alberta'));
    const famDeact = family.rows.find((r: any) => r.name === 'The Family Centre');
    if (famKeep && famDeact) {
      deactivateList.push({ name: famDeact.name, id: famDeact.service_id, reason: 'Missing region', keepName: famKeep.name });
    }

    // 7. Lurana Shelter
    const lurana = await pool.query(`
      SELECT service_id, name, address FROM services
      WHERE name ILIKE '%Lurana%' AND is_active = true
      ORDER BY CASE WHEN address IS NOT NULL AND address != '' THEN 0 ELSE 1 END
    `);
    if (lurana.rows.length >= 2) {
      deactivateList.push({
        name: lurana.rows[1].name,
        id: lurana.rows[1].service_id,
        reason: 'No address',
        keepName: lurana.rows[0].name + ' (has address)'
      });
    }

    // 8. U of Lethbridge
    const uleth = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%Lethbridge%Counselling%' AND is_active = true
    `);
    const ulethKeep = uleth.rows.find((r: any) => r.name.includes('University of Lethbridge'));
    const ulethDeact = uleth.rows.find((r: any) => r.name.includes('U of Lethbridge'));
    if (ulethKeep && ulethDeact && ulethKeep.service_id !== ulethDeact.service_id) {
      deactivateList.push({ name: ulethDeact.name, id: ulethDeact.service_id, reason: 'Abbreviated name', keepName: ulethKeep.name });
    }

    // 9. SAGE Seniors Safe House
    const sage = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%Safe House%' AND name ILIKE '%Senior%' AND is_active = true
    `);
    const sageKeep = sage.rows.find((r: any) => r.name.includes('SAGE'));
    const sageDeact = sage.rows.find((r: any) => !r.name.includes('SAGE'));
    if (sageKeep && sageDeact) {
      deactivateList.push({ name: sageDeact.name, id: sageDeact.service_id, reason: 'Missing org name', keepName: sageKeep.name });
    }

    // 10. UAlberta Wellness
    const uawellness = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%Wellness Supports%' AND is_active = true
    `);
    const uaKeep = uawellness.rows.find((r: any) => r.name.includes('University of Alberta'));
    const uaDeact = uawellness.rows.find((r: any) => r.name === 'Wellness Supports');
    if (uaKeep && uaDeact) {
      deactivateList.push({ name: uaDeact.name, id: uaDeact.service_id, reason: 'Missing institution', keepName: uaKeep.name });
    }

    // 11. Red Deer Meals on Wheels
    const rdmow = await pool.query(`
      SELECT service_id, name FROM services
      WHERE name ILIKE '%Red Deer Meals on Wheels%' AND is_active = true
    `);
    const rdKeep = rdmow.rows.find((r: any) => r.name === 'Red Deer Meals on Wheels');
    const rdDeact = rdmow.rows.find((r: any) => r.name.includes('Meal Delivery'));
    if (rdKeep && rdDeact) {
      deactivateList.push({ name: rdDeact.name, id: rdDeact.service_id, reason: 'Subset service', keepName: rdKeep.name });
    }

    // 12. Red Deer detox at 5246 53 Avenue
    const rdDetox = await pool.query(`
      SELECT service_id, name, LENGTH(COALESCE(description, '')) as desc_len FROM services
      WHERE address ILIKE '%5246 53 Avenue%' AND is_active = true
      ORDER BY desc_len DESC
    `);
    if (rdDetox.rows.length > 1) {
      const keep = rdDetox.rows[0];
      for (let i = 1; i < rdDetox.rows.length; i++) {
        deactivateList.push({
          name: rdDetox.rows[i].name,
          id: rdDetox.rows[i].service_id,
          reason: 'Same address duplicate (5246 53 Ave Red Deer)',
          keepName: keep.name
        });
      }
    }

    // 13. AARC at 303 Forge Road SE
    const aarc = await pool.query(`
      SELECT service_id, name, LENGTH(COALESCE(description, '')) as desc_len FROM services
      WHERE address ILIKE '%303 Forge Road%' AND is_active = true
      ORDER BY desc_len DESC
    `);
    if (aarc.rows.length > 1) {
      const keep = aarc.rows[0];
      for (let i = 1; i < aarc.rows.length; i++) {
        deactivateList.push({
          name: aarc.rows[i].name,
          id: aarc.rows[i].service_id,
          reason: 'Same address duplicate (303 Forge Rd Calgary)',
          keepName: keep.name
        });
      }
    }

    // 14. AHS duplicates - find addresses with both "Alberta Health Services" and shorter names
    const ahsAddresses = await pool.query(`
      SELECT DISTINCT s1.address
      FROM services s1
      JOIN services s2 ON s1.address = s2.address AND s1.service_id != s2.service_id
      WHERE s1.is_active = true AND s2.is_active = true
        AND s1.address IS NOT NULL AND s1.address != ''
        AND s1.name ILIKE 'Alberta Health Services%'
        AND s2.name NOT ILIKE 'Alberta Health Services%'
        AND (s2.name ILIKE '%Addiction%' OR s2.name ILIKE '%Detox%' OR s2.name ILIKE '%Recovery%' OR s2.name ILIKE '%Treatment%')
    `);

    for (const addrRow of ahsAddresses.rows) {
      const servicesAtAddr = await pool.query(`
        SELECT service_id, name, LENGTH(COALESCE(description, '')) as desc_len
        FROM services
        WHERE address = $1 AND is_active = true
        ORDER BY
          CASE WHEN name ILIKE 'Alberta Health Services%' THEN 0 ELSE 1 END,
          desc_len DESC
      `, [addrRow.address]);

      if (servicesAtAddr.rows.length > 1) {
        const ahsEntry = servicesAtAddr.rows.find((r: any) => r.name.startsWith('Alberta Health Services'));
        const shortEntries = servicesAtAddr.rows.filter((r: any) =>
          !r.name.startsWith('Alberta Health Services') &&
          r.service_id !== ahsEntry?.service_id
        );

        if (ahsEntry && shortEntries.length > 0) {
          for (const short of shortEntries) {
            deactivateList.push({
              name: short.name,
              id: short.service_id,
              reason: 'Short name duplicate of AHS entry',
              keepName: ahsEntry.name.substring(0, 60) + '...'
            });
          }
        }
      }
    }

    // Print results
    console.log('SERVICES TO DEACTIVATE:\n');
    for (let i = 0; i < deactivateList.length; i++) {
      const item = deactivateList[i];
      console.log(`${i + 1}. DEACTIVATE: ${item.name}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Reason: ${item.reason}`);
      console.log(`   KEEP: ${item.keepName}`);
      console.log('');
    }

    console.log(`\n=== TOTAL: ${deactivateList.length} services to deactivate ===`);
    console.log('\nReply "proceed" to execute these changes.');

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
