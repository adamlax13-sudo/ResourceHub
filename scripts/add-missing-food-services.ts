/**
 * Add Missing Food Services to Database
 * Run with: npx tsx scripts/add-missing-food-services.ts
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

interface NewService {
  service_id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  address: string;
  phone: string | null;
  hours_of_operation: string | null;
  website_url: string | null;
  eligibility: string | null;
  process_steps: string[];
  tags: string[];
}

const newServices: NewService[] = [
  // ============ CALGARY SERVICES ============
  {
    service_id: 'streetlight-youth-unlimited-calgary',
    name: 'StreetLight - Youth Unlimited Calgary',
    category: 'Food Banks & Meals',
    description: 'StreetLight is a mobile drop-in centre that brings hope to Calgary\'s young homeless and at-risk population. The mobile drop-in provides physical resources, warm meals, and a safe space away from the pressure of the streets. They serve youth ages 12-24 who are homeless, at-risk, troubled, neglected, or sexually exploited. The program creates a community of safety and belonging while providing meals, practical needs, resources, and mentorship relationships.',
    location: 'Calgary',
    address: 'Bay #15, 1725 30 Avenue NE, Calgary, AB T2E 7P6',
    phone: '(403) 291-3179',
    hours_of_operation: 'Monday, Tuesday, and Thursday evenings (mobile service)',
    website_url: 'https://yucalgary.ca/streetlight',
    eligibility: 'Youth ages 12-24 who are homeless, at-risk, troubled, neglected, disadvantaged, or sexually exploited',
    process_steps: [
      'Visit the mobile drop-in location during operating hours',
      'No appointment or ID required',
      'Access meals, resources, and support services',
      'Crisis lines available: 403-470-9322 (general), 403-710-2879 (sexually exploited youth)'
    ],
    tags: ['youth', 'homeless', 'meals', 'drop-in', 'mobile', 'at-risk youth', 'free meals', 'mentorship']
  },
  {
    service_id: 'inn-from-the-cold-calgary',
    name: 'Inn from the Cold',
    category: 'Emergency Shelter',
    description: 'Inn from the Cold is Alberta\'s only dedicated family shelter, providing a safe haven for families experiencing homelessness. They offer emergency shelter, prevention and diversion services, supportive housing, and Indigenous-specific programs. The shelter provides comprehensive support including meals to families with children who are experiencing or at risk of homelessness.',
    location: 'Calgary',
    address: '110, 706 7 Avenue SW, Calgary, AB T2P 0Z1',
    phone: '(403) 263-8384',
    hours_of_operation: '24/7 Support Line available',
    website_url: 'https://innfromthecold.org/',
    eligibility: 'Families with children experiencing or at risk of homelessness',
    process_steps: [
      'Call the 24/7 support line at 403-263-8384',
      'Speak with intake staff about your family\'s situation',
      'Complete screening and assessment',
      'If eligible, receive shelter placement with meals and support services'
    ],
    tags: ['family shelter', 'homeless', 'emergency shelter', 'meals', 'children', 'families', 'indigenous programs']
  },
  {
    service_id: 'mustard-seed-calgary-downtown-support-centre',
    name: 'The Mustard Seed - Calgary Downtown Support Centre',
    category: 'Food Banks & Meals',
    description: 'The Mustard Seed Downtown Support Centre provides essential services to individuals experiencing homelessness and poverty in downtown Calgary. The centre offers a warm breakfast served by volunteers and donors, along with other support services. It serves as a welcoming space where people can access meals, rest, and connect with additional resources.',
    location: 'Calgary',
    address: '102 11 Avenue SE, Calgary, AB T2G 0X5',
    phone: '(403) 269-1319',
    hours_of_operation: '7 days a week: 9:00 AM – 5:30 PM',
    website_url: 'https://theseed.ca/downtownnc',
    eligibility: 'Open to anyone experiencing homelessness or poverty',
    process_steps: [
      'Visit the Downtown Support Centre during operating hours',
      'No appointment or referral required',
      'Access breakfast and other available services',
      'Speak with staff about additional support needs'
    ],
    tags: ['homeless', 'meals', 'breakfast', 'drop-in', 'downtown', 'support services', 'free meals']
  },
  {
    service_id: 'mustard-seed-calgary-marlborough-park',
    name: 'The Mustard Seed - Marlborough Park Neighbour Centre',
    category: 'Food Banks & Meals',
    description: 'The Mustard Seed Marlborough Park Neighbour Centre serves the northeast Calgary community by providing meals, food hampers, clothing, and support services to individuals and families in need. The centre offers a welcoming environment where community members can access essential resources and connect with support programs.',
    location: 'Calgary',
    address: '#24, 6060 Memorial Drive NE, Calgary, AB T2A 5Z5',
    phone: '(403) 453-0770',
    hours_of_operation: 'Mon/Wed/Fri: 9:00 AM – 4:00 PM, Tue/Thu: 1:00 PM – 7:00 PM (Closed daily 12-1 PM)',
    website_url: 'https://theseed.ca/cicmarlborough',
    eligibility: 'Open to community members in need',
    process_steps: [
      'Visit the Neighbour Centre during operating hours',
      'No appointment required for drop-in services',
      'Access meals, food hampers, and clothing',
      'Speak with staff about additional support programs'
    ],
    tags: ['meals', 'food hampers', 'clothing', 'community centre', 'northeast calgary', 'free meals']
  },
  {
    service_id: 'alpha-house-calgary-shelter-meals',
    name: 'Alpha House Calgary - Shelter with Meals',
    category: 'Emergency Shelter',
    description: 'Alpha House Society provides 24/7 shelter services for adults who are under the influence of alcohol or other drugs and need a safe and caring environment. The shelter program includes meals, ensuring guests have access to nourishment while they access other support services. Alpha House focuses on harm reduction and connecting individuals with housing and treatment options.',
    location: 'Calgary',
    address: '203 15 Avenue SE, Calgary, AB T2G 1G4',
    phone: '(403) 234-7388',
    hours_of_operation: '24/7',
    website_url: 'https://alphahousecalgary.com/',
    eligibility: 'Adults who are intoxicated and need safe shelter; no sobriety requirement for entry',
    process_steps: [
      'Arrive at the shelter at any time (24/7 access)',
      'Complete intake screening with staff',
      'Receive bed assignment and access to meals',
      'Optional: Connect with case workers for housing and treatment referrals'
    ],
    tags: ['shelter', 'meals', '24/7', 'harm reduction', 'intoxicated', 'homeless', 'addiction services']
  },

  // ============ EDMONTON SERVICES ============
  {
    service_id: 'fort-road-victory-church-meals',
    name: 'Fort Road Victory Church - Free Meals Program',
    category: 'Food Banks & Meals',
    description: 'Fort Road Victory Church provides free bagged lunches daily and hot dinners on Tuesdays to community members in need. This church-based meal program serves individuals experiencing food insecurity in the Beverly and northeast Edmonton area. The program offers consistent access to nutritious meals in a welcoming environment.',
    location: 'Edmonton',
    address: '13470 Fort Road NW, Edmonton, AB T5A 1C5',
    phone: '(780) 475-1647',
    hours_of_operation: 'Bagged Lunch: Sun-Fri 10:00 AM – 1:00 PM; Dinner: Tuesdays 5:00 PM – 6:00 PM',
    website_url: 'https://frvc.ca/',
    eligibility: 'Open to anyone in need; no requirements',
    process_steps: [
      'Visit the church during meal service hours',
      'Use the south entrance',
      'No ID or registration required',
      'Receive a bagged lunch or hot dinner'
    ],
    tags: ['church meals', 'free meals', 'bagged lunch', 'dinner', 'northeast edmonton', 'community meals']
  },
  {
    service_id: 'building-hope-edmonton',
    name: 'Building Hope Compassionate Association',
    category: 'Food Banks & Meals',
    description: 'Building Hope Compassionate Association serves the Beverly and surrounding communities in northeast Edmonton. They provide hot meals, emergency food hampers, a clothing bank, and community support services. The organization has been serving families in need since 2000, offering breakfast and lunch programs along with other essential resources.',
    location: 'Edmonton',
    address: '3831 116 Avenue NW, Edmonton, AB (Living Hope Christian Centre)',
    phone: null,
    hours_of_operation: 'Breakfast: 9:00 AM – 12:00 PM; Lunch: 12:00 PM – 2:00 PM (check for current days)',
    website_url: 'https://www.buildinghopeedmonton.ca/',
    eligibility: 'Open to individuals and families in need in Beverly and surrounding areas',
    process_steps: [
      'Visit during meal service hours',
      'No appointment required',
      'Access hot meals, food hampers, and clothing',
      'Speak with staff about additional community support'
    ],
    tags: ['meals', 'food hampers', 'clothing bank', 'northeast edmonton', 'beverly', 'community support', 'free meals']
  },
  {
    service_id: 'boyle-street-community-services-meals',
    name: 'Boyle Street Community Services - Meals Program',
    category: 'Food Banks & Meals',
    description: 'Boyle Street Community Services has been supporting people experiencing homelessness and poverty in Edmonton since 1971. The drop-in centre provides free and low-cost meals, along with laundry facilities, showers, and various support programs. Major community events include Thanksgiving dinner, beef dinners, round dances, and National Aboriginal Day celebrations. Intake and referral coordinators are available to link visitors with services and programs.',
    location: 'Edmonton',
    address: '10116 105 Avenue, Edmonton, AB T5H 0K2',
    phone: '(780) 424-4106',
    hours_of_operation: 'Monday to Friday (contact for specific meal times)',
    website_url: 'https://www.boylestreet.org/',
    eligibility: 'Open to anyone experiencing homelessness or poverty',
    process_steps: [
      'Visit the drop-in centre during operating hours',
      'No appointment required',
      'Access meals, showers, laundry facilities',
      'Speak with intake coordinators about additional services and referrals'
    ],
    tags: ['drop-in', 'meals', 'homeless', 'laundry', 'showers', 'indigenous programs', 'inner city', 'free meals']
  },
  {
    service_id: 'bissell-centre-meals',
    name: 'Bissell Centre - Meals and Basic Services',
    category: 'Food Banks & Meals',
    description: 'Bissell Centre helps people move out of poverty through housing-focused services, family supports, and financial empowerment programs. The centre provides meals, laundry facilities, and showers, ensuring visitors have access to basic needs. They offer housing services including Homeless to Homes and the Outreach Housing Team, along with job searching and skill development programs.',
    location: 'Edmonton',
    address: '10527 96 Street NW, Edmonton, AB T5H 2H6',
    phone: '(780) 423-2285',
    hours_of_operation: 'Monday to Friday (contact for specific hours)',
    website_url: 'https://bissellcentre.org/',
    eligibility: 'Open to individuals and families experiencing poverty or homelessness',
    process_steps: [
      'Visit Bissell Centre during operating hours',
      'Access meals, showers, and laundry services',
      'Speak with staff about housing support and programs',
      'For Homeless to Homes: Call 587-341-2074'
    ],
    tags: ['meals', 'housing support', 'homeless', 'laundry', 'showers', 'employment support', 'poverty reduction']
  },
  {
    service_id: 'e4c-edmonton-meals',
    name: 'e4c (Edmonton City Centre Church) - Meals Program',
    category: 'Food Banks & Meals',
    description: 'e4c (Edmonton City Centre Church Corporation) provides food security programs including three meals a day in their emergency shelter. The organization works to increase food security by providing essential support to individuals experiencing homelessness and poverty. They offer various programs addressing hunger and basic needs across Edmonton.',
    location: 'Edmonton',
    address: '9321 Jasper Avenue, Edmonton, AB T5H 3T7',
    phone: '(780) 424-7543',
    hours_of_operation: 'Contact for specific meal times',
    website_url: 'https://e4calberta.org/',
    eligibility: 'Open to individuals experiencing homelessness or food insecurity',
    process_steps: [
      'Contact e4c for information about meal programs',
      'Visit during meal service hours',
      'Access emergency shelter if needed',
      'Speak with staff about additional support programs'
    ],
    tags: ['meals', 'emergency shelter', 'food security', 'homeless', 'inner city', 'three meals daily']
  },
  {
    service_id: 'jasper-place-wellness-centre-meals',
    name: 'Jasper Place Wellness Centre - Drop-in Meals',
    category: 'Food Banks & Meals',
    description: 'Jasper Place Wellness Centre (JPWC) is a registered charity dedicated to building stronger communities by addressing inequities in health, housing, and employment in west Edmonton. The centre provides complimentary coffee, hot soup, and small snack options throughout the day. JPWC offers drop-in services including meals, harm reduction support, and connections to housing and employment resources.',
    location: 'Edmonton',
    address: '15308 Stony Plain Road, Edmonton, AB T5P 0L6',
    phone: '(780) 964-5755',
    hours_of_operation: '9:00 AM – 9:00 PM',
    website_url: 'https://www.jpwc.ca/',
    eligibility: 'Open to community members in need',
    process_steps: [
      'Visit the wellness centre during operating hours',
      'No appointment required for drop-in services',
      'Access soup, coffee, snacks, and other support',
      'Speak with staff about housing and employment resources'
    ],
    tags: ['drop-in', 'soup', 'snacks', 'west edmonton', 'harm reduction', 'housing support', 'free food']
  },
  {
    service_id: 'george-spady-centre-edmonton',
    name: 'George Spady Centre - Detox with Meals',
    category: 'Detox & Withdrawal',
    description: 'The George Spady Society operates a Medically Supported Detox program at the Aurora Centre in Edmonton. The 60-bed program includes 41 medically supported detox beds and 19 post-detox recovery beds. Services are free and include food and laundry. The centre provides a safe environment for individuals to begin their recovery journey with medical support.',
    location: 'Edmonton',
    address: '15625 Stony Plain Road, Edmonton, AB (Aurora Centre)',
    phone: '(780) 424-8335',
    hours_of_operation: '24 hours; Triage: Daily 8:30 AM – 9:30 AM at southwest door',
    website_url: 'https://www.gspady.org/',
    eligibility: 'Adults seeking detox services',
    process_steps: [
      'Walk in to triage at 8:30-9:30 AM daily (southwest door of Aurora Centre)',
      'Or call 780-424-8335 ext. 1 to book an appointment',
      'Complete intake assessment',
      'Receive bed assignment with meals and laundry included'
    ],
    tags: ['detox', 'withdrawal', 'meals', 'laundry', 'medical support', 'recovery', 'free services', 'addiction']
  },
  {
    service_id: 'robertson-wesley-united-church-dinner',
    name: 'Robertson-Wesley United Church - Community Dinner',
    category: 'Food Banks & Meals',
    description: 'Robertson-Wesley United Church hosts a monthly Community Dinner in Memorial Hall, offering a free hot meal to up to 200 people. This church-based meal program provides a welcoming environment where community members can enjoy a nutritious meal and connect with others. Volunteers handle everything from meal preparation to serving and cleanup.',
    location: 'Edmonton',
    address: '10209 123 Street NW, Edmonton, AB',
    phone: '(780) 482-1587',
    hours_of_operation: 'Second Saturday of each month: 5:00 PM – 6:00 PM',
    website_url: 'https://www.rwuc.org/',
    eligibility: 'Open to anyone; no requirements',
    process_steps: [
      'Check the schedule for the second Saturday of the month',
      'Arrive at Memorial Hall between 5:00 PM and 6:00 PM',
      'No registration or ID required',
      'Enjoy a free hot community meal'
    ],
    tags: ['church meals', 'community dinner', 'monthly', 'free meals', 'saturday dinner']
  }
];

function generateServiceId(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n=== ADDING MISSING FOOD SERVICES ===\n');

    // Check for existing services to avoid duplicates
    const existingResult = await pool.query(`
      SELECT service_id, name FROM services WHERE is_active = true
    `);
    const existingIds = new Set(existingResult.rows.map(r => r.service_id));
    const existingNames = new Set(existingResult.rows.map(r => r.name.toLowerCase()));

    let added = 0;
    let skipped = 0;

    for (const service of newServices) {
      // Check if service already exists
      if (existingIds.has(service.service_id) || existingNames.has(service.name.toLowerCase())) {
        console.log(`⏭️  Skipping (already exists): ${service.name}`);
        skipped++;
        continue;
      }

      try {
        await pool.query(`
          INSERT INTO services (
            service_id,
            name,
            category,
            description,
            location,
            address,
            phone,
            hours_of_operation,
            website_url,
            eligibility,
            process_steps,
            tags,
            is_active,
            confidence_score,
            last_checked,
            last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, 80, NOW(), NOW())
        `, [
          service.service_id,
          service.name,
          service.category,
          service.description,
          service.location,
          service.address,
          service.phone,
          service.hours_of_operation,
          service.website_url,
          service.eligibility,
          JSON.stringify(service.process_steps),
          JSON.stringify(service.tags)
        ]);

        console.log(`✅ Added: ${service.name}`);
        added++;
      } catch (err: any) {
        if (err.code === '23505') { // Unique constraint violation
          console.log(`⏭️  Skipping (duplicate): ${service.name}`);
          skipped++;
        } else {
          console.error(`❌ Error adding ${service.name}:`, err.message);
        }
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Added: ${added} services`);
    console.log(`Skipped: ${skipped} services`);
    console.log(`Total attempted: ${newServices.length} services`);

    // Refresh the materialized view if it exists
    try {
      await pool.query(`SELECT refresh_search_view()`);
      console.log('\n✅ Search view refreshed');
    } catch (err) {
      console.log('\n⚠️  Could not refresh search view (may not exist)');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
