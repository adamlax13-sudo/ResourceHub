/**
 * Apply enrichment data to low-confidence services (conf < 50) and submit to admin review.
 * Services are either enriched with Firecrawl-scraped data, or flagged for deactivation
 * (churches with no social service component, dead/hijacked websites).
 *
 * Usage:
 *   node scripts/apply-lowconf-enrichment.mjs
 *   DRY_RUN=false node scripts/apply-lowconf-enrichment.mjs
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const BATCH_ID = `low-conf-reenrich-2026-03-29`;

// =====================================================================
// ENRICH — Legitimate social services with scraped website data
// =====================================================================
const enrichments = [
  {
    id: 118,
    description: "The Government of Alberta funds emergency shelters and transitional shelters across the province to support anyone experiencing homelessness. Emergency shelters are always open 24/7, providing a welcoming, safe space and basic needs support including accommodation, meals, and connection to services. Transitional shelters provide more private, long-term accommodation with supports to help people move to permanent housing.",
    process_steps: [
      "If you need emergency shelter, go to any year-round shelter listed on alberta.ca/homelessness-response — they are open 24/7 and accept walk-ins",
      "For Edmonton shelters, contact Hope Mission at 780-422-2018, The Mustard Seed at 780-919-1735, or any shelter listed on the provincial directory",
      "For transitional housing (longer-term with supports), ask shelter staff for a referral as these are referral-based",
      "If you're unsure where to start, call 211 to be connected with the nearest shelter or housing service"
    ],
    eligibility: "Shelter accommodations must be offered to all people regardless of political or religious beliefs, ethno-cultural background, health, disability, gender identity, or sexual orientation.",
    hours: "Emergency shelters are open 24/7",
    phone: null, email: null,
    confidence: 75,
    source_urls: ["https://www.alberta.ca/homelessness-response"],
  },
  {
    id: 534,
    description: "Al Rashid Mosque serves the Edmonton Muslim community of over 100,000 members comprising over 62 cultures. The mosque offers family services including marriages, Islamic divorce, and Islamic wills testimony, funeral and burial services according to Islamic tradition, youth programming through the Al Rashid Youth Club, and seniors support through the Canadian Islamic Senior Society providing accessible and culturally-relevant programs.",
    process_steps: [
      "Visit the Al Rashid Mosque website at alrashidmosque.ca to learn about available community and family services",
      "For family services (marriages, Islamic divorce, wills), visit the Family Services page on the website",
      "For seniors programming, connect through the Canadian Islamic Senior Society section",
      "For youth activities, visit the Youth section to learn about the Al Rashid Youth Club"
    ],
    eligibility: null,
    hours: null,
    phone: null, email: null,
    confidence: 60,
    source_urls: ["https://alrashidmosque.ca/"],
  },
  {
    id: 635,
    description: "The Mustard Seed Edmonton Wellness Centre staff work with agencies across Edmonton to provide advocacy, mental health and addiction counselling, chaplaincy, tax and ID clinics. Advocates connect with guests to provide assistance when applying for Alberta Works, AISH, and obtaining referrals for clothing, prescription glasses, food security and more.",
    process_steps: [
      "Call The Mustard Seed's Edmonton Wellness Centre at 833-448-4673 to connect with an advocate or ask about available health, counselling, and employment support",
      "Have a referring agency complete the online referral form at surveymonkey.ca/r/HealthandWellnessEdmontonReferral",
      "Alternatively, print and fax the referral form to 1-833-381-0920",
      "Visit the Edmonton Wellness Centre at 11355 105 Ave NW, Edmonton for in-person support"
    ],
    eligibility: "Individuals experiencing poverty and homelessness seeking health and wellness support.",
    hours: null,
    phone: "833-448-4673", email: null,
    confidence: 85,
    source_urls: ["https://theseed.ca/services"],
  },
  {
    id: 854,
    description: "The Mustard Seed Red Deer provides emergency shelter, a community impact centre offering warm meals, clothing and hygiene products, a wellness centre with counselling, medical support, ID assistance, and employment and housing referrals, an employment program with skills development and job search support, and a school lunch program delivering 500+ nutritious meals daily to low-income students.",
    process_steps: [
      "For emergency shelter, arrive at the Red Deer shelter between 8 PM and 10 PM check-in time (shelter operates 8 PM to 8 AM)",
      "For wellness support, complete the referral form at surveymonkey.ca/r/HealthandWellnessRedDeerReferral or visit the Community Impact Centre at 6002 54 Ave, Red Deer",
      "For employment support, visit the Community Impact Centre to connect with an employment coach for resume building, job search, and skills development",
      "For the School Lunch Program, email SchoolLunchRD@theseed.ca to inquire about joining",
      "Call The Mustard Seed at 1-877-731-7333 for general inquiries"
    ],
    eligibility: "Individuals experiencing homelessness and poverty in the Red Deer area. School Lunch Program serves low-income students during the school year.",
    hours: "Shelter: 8 PM - 8 AM, check-in 8 PM - 10 PM",
    phone: "1-877-731-7333", email: null,
    confidence: 85,
    source_urls: ["https://theseed.ca/services"],
  },
  {
    id: 2951,
    description: "Bow Valley Connections Centre is a non-profit organization that generates opportunities for individuals with developmental disabilities to build on existing friendships and foster new relationships. The centre enhances the quality of life for those with developmental disabilities by fostering social connections, personal growth, and involvement in the community. Individuals participate in a variety of social activities at their weekly gatherings in Canmore.",
    process_steps: [
      "Email bvcc.office@gmail.com to register as a new participant or ask about programs",
      "Download the BVCC brochure at bowvalleyconnectionscentre.com for program details",
      "Attend Tuesday afternoon sessions from noon to 2:30 PM at Ralph Connor Memorial United Church, 617 8 St, Canmore (bring your own lunch)",
      "To volunteer, visit bowvalleyconnectionscentre.com/volunteer/ to learn about opportunities"
    ],
    eligibility: "Individuals with developmental disabilities in the Bow Valley area.",
    hours: "Tuesday afternoons, noon to 2:30 PM",
    phone: null, email: "bvcc.office@gmail.com",
    confidence: 85,
    source_urls: ["https://bowvalleyconnectionscentre.com/"],
  },
  {
    id: 3046,
    description: "Seniors Life Centre improves the wellbeing of vulnerable and isolated seniors through a holistic care model that provides quality healthcare, builds community, and ensures basic needs are met. Programs include a Basic Life Support Program, a Stay Healthy and Active Program, and a Seniors Lodge Program.",
    process_steps: [
      "Visit the Seniors Life Centre website at seniorslifecentre.org to learn about available programs",
      "Review the Basic Life Support, Stay Healthy and Active, and Seniors Lodge programs to find the best fit",
      "Contact the organization through their website to inquire about enrollment or support"
    ],
    eligibility: "Vulnerable and isolated seniors",
    hours: null,
    phone: null, email: null,
    confidence: 65,
    source_urls: ["https://seniorslifecentre.org/"],
  },
  {
    id: 2511,
    description: "The Angel Project is a registered Canadian charity giving a voice to those who are forgotten. Many patients spend decades at Complex Care units in hospitals and will never go home again — accident victims, MS and ALS patients, and others left without the tools or finances to fend for themselves. The Angel Project raises funds and coordinates volunteers to visit these patients, some of whom hadn't seen a visitor in over a decade.",
    process_steps: [
      "Visit theangelproject.ca to learn about the Adopt A Patient program and volunteer opportunities",
      "To volunteer, go to the Volunteer page at theangelproject.ca/volunteer and sign up",
      "To support patients financially, donate via PayPal through the Donate link on the website",
      "To adopt a patient, visit the Adopt A Patient page to learn how to provide ongoing support"
    ],
    eligibility: "Patients in Complex Care units at hospitals throughout Canada who have been abandoned by family or lack support.",
    hours: null,
    phone: null, email: null,
    confidence: 70,
    source_urls: ["https://theangelproject.ca/"],
  },
  {
    id: 2878,
    description: "The Al-Ansaar Islamic Foundation is a Calgary-based Islamic charity focused on knowledge, scholarship, and community development. Programs include the Darul-Uloom (full-time and part-time Islamic education), Evening Quran & Islamic School for boys and girls ages 5+, Tahfiz al-Quran memorization programs, Mishkat Institute seminars and classes, Al-Ansaar Relief (charity for those in need), and interfaith dialogue initiatives. Their mission is to create opportunities for all groups of life irrespective of colour, origin, gender or religion.",
    process_steps: [
      "Visit alansaar.ca to explore available programs including Islamic education, Quran school, and relief services",
      "For Evening Quran & Islamic School (ages 5+), register through the Darul-Uloom page at alansaar.ca/darul-uloom",
      "For charitable relief or to donate Zakat/Sadaqa, visit alansaar.ca/donate",
      "For interfaith dialogue or general inquiries, use the contact form at alansaar.ca/contact-us"
    ],
    eligibility: "Open to all groups irrespective of colour, origin, gender or religion. Evening Quran School for ages 5+.",
    hours: "Evening Quran & Islamic School: Monday-Thursday, Session 1: 4:45 PM - 6:15 PM, Session 2: 6:20 PM - 7:50 PM",
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://alansaar.ca/"],
  },
  {
    id: 2714,
    description: "Grace United Church in Lloydminster is a welcoming and inclusive church where all are included in the life and ministry of the Grace Family and diversity is celebrated. The church operates community outreach programs including an Outreach Pantry, Community Coffee gatherings, a Homework Club for students, Souper 5 meal program, Care Home Worship visits, and Kidz Praiz children's programming.",
    process_steps: [
      "For the Outreach Pantry (free food), visit the church on Thursdays from 1:00 PM - 2:00 PM",
      "For Community Coffee (free, open to all), drop in Thursdays from 1:00 PM - 2:00 PM in the Hall/Kitchen",
      "For the Homework Club, students can attend Tuesdays from 3:30 PM - 5:00 PM",
      "Visit graceunitedchurch.ca for current announcements and service times, or join Sunday worship in person or via Facebook/YouTube livestream"
    ],
    eligibility: "All are welcome. Diversity is celebrated.",
    hours: "Outreach Pantry: Thursday 1:00 PM - 2:00 PM. Homework Club: Tuesday 3:30 PM - 5:00 PM.",
    phone: null, email: null,
    confidence: 75,
    source_urls: ["https://www.graceunitedchurch.ca/"],
  },
  {
    id: 2703,
    description: "The Hillhurst Sunnyside Community Association serves the inner-city communities of Hillhurst and Sunnyside in Calgary. HSCA offers a Sustainable Food Program, Senior Community Connections with online programming, community composting, a farmers' market, daycare, out-of-school care, recreational programs including soccer, yoga, and qigong, a flea market, and volunteer and membership opportunities.",
    process_steps: [
      "Visit hsca.ca to explore programs including the Community Food Program, seniors programming, daycare, and recreational activities",
      "Sign up for the HSCA newsletter on their homepage to stay informed about upcoming events and programs",
      "For specific questions about programs, use the 'who to call' contact page at hsca.ca/contact",
      "Consider becoming a member or volunteer through the links on the website"
    ],
    eligibility: null,
    hours: null,
    phone: null, email: null,
    confidence: 75,
    source_urls: ["https://www.hsca.ca"],
  },
  {
    id: 2865,
    description: "Millwoods Community Church is a protestant church in Edmonton celebrating the Moravian tradition. The church serves its community through partnerships with WINGS of Providence, which supports women and children who have experienced family violence and abuse (physical, sexual, emotional, financial), and operates as a WeCan Food Basket Society order and pickup location, helping community members access affordable food.",
    process_steps: [
      "Email office@mcchurch.ca for general inquiries about community programs",
      "To access affordable food through the WeCan Food Basket, visit the church as an order and pickup location or go to wecanfood.com for details",
      "For support related to family violence, ask the church about their WINGS of Providence partnership",
      "Sunday services are held at 10:30 AM at 2304-38 Street NW, Edmonton, with coffee fellowship afterward — all are welcome"
    ],
    eligibility: null,
    hours: "Sunday services at 10:30 AM",
    phone: null, email: "office@mcchurch.ca",
    confidence: 70,
    source_urls: ["https://mcchurch.ca"],
  },
  {
    id: 2711,
    description: "The Church of Christ in Red Deer is a community of faith that serves both locally and overseas. Locally, they serve monthly at Potter's Hands and run programs including gathering coats, socks, and backpacks for those in need. They offer Sunday worship services, Sunday Bible study, Wednesday evening Bible study, and community gatherings.",
    process_steps: [
      "Visit reddeerchurchofchrist.com for information about their community service programs",
      "Participate in their coat, sock, and backpack drives for those in need",
      "Connect with their monthly service at Potter's Hands",
      "Services are also streamed live on their Facebook page at 10 AM Mountain time"
    ],
    eligibility: null,
    hours: null,
    phone: null, email: null,
    confidence: 60,
    source_urls: ["https://www.reddeerchurchofchrist.com"],
  },
];

// =====================================================================
// DEACTIVATION CANDIDATES — Churches with no social service component
// =====================================================================
const deactivations = [
  { id: 3016, name: "City View Christian Centre", reason: "Church with worship services only — no direct social service programs found on website." },
  { id: 3014, name: "All Saints Traditional Anglican Church Renfrew", reason: "Church with worship services only — categorized as Food Banks & Meals but no food bank or social services found on website." },
  { id: 799,  name: "Fort City Church — Counselling Services (Fort McMurray)", reason: "Church with worship services only — no counselling or social service programs found on website despite service name." },
  { id: 2723, name: "Fort Saskatchewan Pentecostal Assembly", reason: "Church (Hope Chapel) with worship services only — no social service programs found on website." },
  { id: 2713, name: "The Alliance Church", reason: "Church with worship services and small groups only — no direct social service programs found on website." },
  { id: 2749, name: "The Evangelical Covenant Church of Calgary", reason: "Website redirected to Commons Church — worship services only, no social service programs." },
  { id: 2848, name: "Canadian Reformed Church Coaldale", reason: "Church with worship services only — supports missions but no direct local social services found." },
  { id: 2932, name: "Crosspointe Fellowship (Calgary)", reason: "Multicultural church with worship services only — no social service programs found on website." },
  { id: 2817, name: "Grace Presbyterian Church of Calgary Alberta", reason: "Church with worship/small groups only — no direct social service programs found on website." },
  { id: 2886, name: "Morinville Pastoral Charge", reason: "Church with worship services and spiritual guidance only — no social service programs found on website." },
  { id: 2659, name: "Red Deer First Church of the Nazarene", reason: "Extremely thin website — worship service time and streaming links only, no social services." },
  { id: 2717, name: "St Matthews Evangelical Lutheran Church", reason: "Church with worship/Bible study/history only — no community service programs found despite extensive website." },
  { id: 2851, name: "Bethel Pentecostal Church", reason: "Very thin website — worship service and giving only, no social programs." },
  { id: 3026, name: "Dormition of the Most Holy Mother of God Ukrainian Catholic", reason: "Liturgy schedules and Holy Week announcements only — no social programs." },
  { id: 3053, name: "Lord of Life Lutheran Church", reason: "Vague mention of donation programs — no direct, identifiable social service component on website." },
];

// =====================================================================
// DEAD SITES — Website down, hijacked, or placeholder
// =====================================================================
const deadSites = [
  { id: 2775, name: "Spirit West United Church", reason: "DEAD-SITE: Domain hijacked by spam blog (home renovation/curtain cleaning content)." },
  { id: 2721, name: "Bonnyville Community Church", reason: "DEAD-SITE: Website returns only images, no readable text content." },
  { id: 2891, name: "Cameroonian-Canadian Foundation", reason: "DEAD-SITE: Website ccf-fcc.org is completely down (repeated socket hang up)." },
  { id: 2736, name: "The Strongest Oak Foundation", reason: "DEAD-SITE: Website thestrongestoak.org returns only placeholder text 'test'." },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log(`\n=== Apply Low-Confidence Enrichment + Deactivation Review ===`);
    console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
    console.log(`Enrichments: ${enrichments.length}`);
    console.log(`Deactivation candidates: ${deactivations.length}`);
    console.log(`Dead sites: ${deadSites.length}`);
    console.log(`Total: ${enrichments.length + deactivations.length + deadSites.length}\n`);

    let updated = 0, reviewed = 0, deactivated = 0, errors = 0;

    // ---- Phase 1: Enrich legitimate services ----
    console.log("--- Phase 1: Enriching services ---");
    for (const e of enrichments) {
      const setClauses = [];
      const values = [e.id];
      let idx = 2;

      const fields = {
        description: e.description,
        phone: e.phone,
        email: e.email,
        hours_of_operation: e.hours,
        process_steps: e.process_steps ? JSON.stringify(e.process_steps) : null,
        eligibility: e.eligibility,
        confidence_score: e.confidence,
        source_urls: e.source_urls ? JSON.stringify(e.source_urls) : null,
        enrichment_source: "found",
        enrichment_date: new Date().toISOString(),
      };

      for (const [key, val] of Object.entries(fields)) {
        if (val === null || val === undefined) continue;
        setClauses.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }

      if (setClauses.length === 0) continue;

      const fieldNames = Object.keys(fields).filter(k => fields[k] != null).join(", ");

      if (!DRY_RUN) {
        try {
          await client.query(
            `UPDATE services SET ${setClauses.join(", ")}, last_updated = NOW() WHERE id = $1`,
            values
          );

          const svc = (await client.query(
            `SELECT id, service_id, name, category, description, location, eligibility, process_steps,
                    hours_of_operation, phone, email, website_url, address
             FROM services WHERE id = $1`, [e.id]
          )).rows[0];

          if (svc) {
            const proposedChanges = {
              id: svc.id, name: svc.name, category: svc.category,
              description: svc.description || "", location: svc.location || "",
              eligibility: svc.eligibility || "", processSteps: svc.process_steps,
              hoursOfOperation: svc.hours_of_operation || "",
              phone: svc.phone || "", email: svc.email || "",
              websiteUrl: svc.website_url || "", address: svc.address || "",
              isActive: true,
            };

            await client.query(`
              INSERT INTO service_change_requests
                (service_id, change_type, proposed_changes, source, source_plugin, batch_id, status)
              VALUES ($1, 'update', $2, 'low-conf-reenrich', 'firecrawl-reenrich', $3, 'pending')
            `, [svc.id, JSON.stringify(proposedChanges), BATCH_ID]);
            reviewed++;
          }

          updated++;
          console.log(`  [UPD+REV] id=${e.id} — conf=${e.confidence} fields=${fieldNames}`);
        } catch (err) {
          console.error(`  [ERR] id=${e.id}: ${err.message}`);
          errors++;
        }
      } else {
        console.log(`  [DRY] id=${e.id} — conf=${e.confidence} fields=${fieldNames}`);
        updated++;
      }
    }

    // ---- Phase 2: Flag non-service churches for deactivation review ----
    console.log("\n--- Phase 2: Flagging non-service churches for deactivation review ---");
    for (const d of [...deactivations, ...deadSites]) {
      if (!DRY_RUN) {
        try {
          const svc = (await client.query(
            `SELECT id, service_id, name, category, description, location, eligibility, process_steps,
                    hours_of_operation, phone, email, website_url, address
             FROM services WHERE id = $1`, [d.id]
          )).rows[0];

          if (svc) {
            const proposedChanges = {
              id: svc.id, name: svc.name, category: svc.category,
              description: svc.description || "", location: svc.location || "",
              eligibility: svc.eligibility || "", processSteps: svc.process_steps,
              hoursOfOperation: svc.hours_of_operation || "",
              phone: svc.phone || "", email: svc.email || "",
              websiteUrl: svc.website_url || "", address: svc.address || "",
              isActive: false,
              _deactivationReason: d.reason,
            };

            await client.query(`
              INSERT INTO service_change_requests
                (service_id, change_type, proposed_changes, source, source_plugin, batch_id, status)
              VALUES ($1, 'update', $2, 'low-conf-reenrich', 'firecrawl-reenrich', $3, 'pending')
            `, [svc.id, JSON.stringify(proposedChanges), BATCH_ID]);
            deactivated++;
            console.log(`  [DEACT-REV] id=${d.id} "${d.name}" — ${d.reason.substring(0, 60)}...`);
          }
        } catch (err) {
          console.error(`  [ERR] id=${d.id}: ${err.message}`);
          errors++;
        }
      } else {
        console.log(`  [DRY-DEACT] id=${d.id} "${d.name}" — ${d.reason.substring(0, 60)}...`);
        deactivated++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Enriched + reviewed: ${updated}`);
    console.log(`Deactivation proposals: ${deactivated}`);
    console.log(`Total change requests: ${reviewed + deactivated}`);
    console.log(`Errors: ${errors}`);
    if (DRY_RUN) console.log(`\nDRY RUN. Run with DRY_RUN=false to apply.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
