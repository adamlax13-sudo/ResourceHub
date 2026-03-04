/**
 * Add Social Connection & Recreation Services to Database
 * Run with: npx tsx scripts/add-social-connection-services.ts
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
  email: string | null;
  hours_of_operation: string | null;
  website_url: string | null;
  eligibility: string | null;
  service_format: string | null;
  process_steps: string[];
  tags: string[];
}

const newServices: NewService[] = [
  // ============ RECREATION & DROP-IN ============
  {
    service_id: 'city-of-calgary-recreation-drop-in',
    name: 'City of Calgary Recreation - Drop-In Programs',
    category: 'Community & Social Connection',
    description: 'The City of Calgary operates numerous recreation centres offering drop-in fitness classes, swimming, skating, pickleball, basketball, and more across all quadrants. No registration required for drop-in activities. The Fair Entry Program provides subsidized access for low-income Calgarians, making recreation affordable for everyone.',
    location: 'Calgary',
    address: 'Multiple locations city-wide, Calgary, AB',
    phone: '403-268-3800',
    email: null,
    hours_of_operation: 'Vary by facility; see website for schedules',
    website_url: 'https://www.calgary.ca/parks-rec-programs/drop-in-schedules.html',
    eligibility: 'Open to all ages. Fair Entry Program available for low-income residents.',
    service_format: 'in-person',
    process_steps: [
      'Visit the City of Calgary recreation website for drop-in schedules',
      'Choose a recreation centre and activity',
      'Drop in during scheduled times - no registration needed',
      'Apply for Fair Entry Program online if you need subsidized access'
    ],
    tags: ['recreation', 'fitness', 'swimming', 'skating', 'sports', 'drop-in', 'calgary', 'social connection', 'low-cost', 'subsidized', 'community']
  },
  {
    service_id: 'trico-centre-family-wellness-calgary',
    name: 'Trico Centre for Family Wellness',
    category: 'Community & Social Connection',
    description: 'Community-owned, not-for-profit recreation centre offering over 90 drop-in fitness classes per week, a warm water wave pool, waterslide, arenas for skating and shinny, and registered programs including sports, gymnastics, dance, art, and martial arts. A welcoming space for families and individuals to stay active and connect with the community.',
    location: 'Calgary',
    address: '11150 Bonaventure Drive SE, Calgary, AB T2J 6R9',
    phone: '403-278-7542',
    email: null,
    hours_of_operation: 'Mon-Fri 6:00 AM - 10:00 PM; Sat-Sun 7:00 AM - 8:00 PM',
    website_url: 'https://tricocentre.ca/',
    eligibility: 'All ages, families welcome',
    service_format: 'in-person',
    process_steps: [
      'Visit the Trico Centre website or call to learn about programs',
      'Choose drop-in or registered programs',
      'Visit during operating hours - memberships and day passes available'
    ],
    tags: ['recreation', 'fitness', 'swimming', 'skating', 'family', 'drop-in', 'calgary', 'social connection', 'community', 'wellness', 'arts', 'sports']
  },
  {
    service_id: 'city-of-edmonton-recreation-leisure-access',
    name: 'City of Edmonton - Drop-In Recreation & Leisure Access Program',
    category: 'Community & Social Connection',
    description: 'The City of Edmonton offers over 450 weekly free drop-in fitness classes (Zumba, yoga, cycle, barre, and more) across its recreation centres and pools. The Leisure Access Program (LAP) provides free or reduced-cost admission for low-income Edmontonians, including unlimited free facility admission and free drop-in child minding - removing financial barriers to recreation and social connection.',
    location: 'Edmonton',
    address: 'Multiple recreation centres city-wide, Edmonton, AB',
    phone: null,
    email: null,
    hours_of_operation: 'Vary by facility; see website for schedules',
    website_url: 'https://www.edmonton.ca/activities_parks_recreation/drop-in-programs-activities',
    eligibility: 'Open to all. Leisure Access Program available for low-income Edmonton residents.',
    service_format: 'in-person',
    process_steps: [
      'Visit the City of Edmonton recreation website for drop-in schedules',
      'Choose a recreation centre and activity',
      'Many classes are completely free - just show up',
      'Apply for Leisure Access Program if you need free or reduced admission'
    ],
    tags: ['recreation', 'fitness', 'swimming', 'free', 'drop-in', 'edmonton', 'social connection', 'subsidized', 'community', 'yoga', 'zumba']
  },
  // ============ CULTURAL & INDIGENOUS ============
  {
    service_id: 'canadian-native-friendship-centre-edmonton',
    name: 'Canadian Native Friendship Centre',
    category: 'Community & Social Connection',
    description: 'The Canadian Native Friendship Centre serves approximately 10,000 people annually with cultural and social programs that foster community connection. Programs include Pow Wow Fitness, Wellbriety Support Group, Dene Drumming, Conversational Cree Classes, Drop-In Pow Wow classes, Traditional Arts and Crafts, Metis Jigging and Dance, and a bi-monthly LGBTQ2 Support Group. A vibrant hub for Indigenous cultural connection and community belonging.',
    location: 'Edmonton',
    address: '10128 121 Street, Edmonton, AB',
    phone: '780-761-1900',
    email: null,
    hours_of_operation: 'Vary by program; see website for schedule',
    website_url: 'https://www.cnfc.ca/',
    eligibility: 'Primarily serves Indigenous people in Edmonton; programs open to all',
    service_format: 'in-person',
    process_steps: [
      'Visit the CNFC website or call for program schedules',
      'Drop in for cultural programs and activities',
      'No referral needed - open to the community'
    ],
    tags: ['indigenous', 'cultural', 'pow wow', 'cree', 'dene', 'metis', 'drumming', 'arts', 'crafts', 'social connection', 'edmonton', 'free', 'LGBTQ2', 'community']
  },
  // ============ SOCIAL CONNECTION & FRIENDSHIP ============
  {
    service_id: 'in-her-circle-alberta',
    name: 'In Her Circle - Women\'s Friendship Club',
    category: 'Community & Social Connection',
    description: 'In Her Circle is a women\'s friendship club and events company designed to fight loneliness and help women create authentic friendships. Events are kept intentionally small (max 20 people) to foster genuine connection. Monthly events include workshops, game nights, happy hours, and other social gatherings in Calgary and Edmonton. A welcoming space for women who may be new to the city, going through life transitions, or simply looking to expand their social circle.',
    location: 'Calgary and Edmonton',
    address: 'Various event locations in Calgary and Edmonton, AB',
    phone: null,
    email: null,
    hours_of_operation: 'Monthly events, typically evenings and weekends',
    website_url: 'https://www.inhercircle.ca/',
    eligibility: 'Women of all ages',
    service_format: 'in-person',
    process_steps: [
      'Visit the In Her Circle website to see upcoming events',
      'Purchase a ticket for an event that interests you',
      'Attend and connect with other women in a small group setting'
    ],
    tags: ['women', 'friendship', 'loneliness', 'social connection', 'events', 'calgary', 'edmonton', 'community', 'belonging']
  },
  {
    service_id: 'carya-social-connections-calgary',
    name: 'Carya - Social Connections Programs',
    category: 'Community & Social Connection',
    description: 'Carya runs Social Connections programs specifically designed to reduce isolation and build community in Calgary. Programs include food, art, wellness, social, and educational activities - all providing space to build meaningful relationships. They also operate a Men\'s Shed program. Three convenient locations across Calgary make it accessible to diverse communities.',
    location: 'Calgary',
    address: '800-1000 7 Ave SW (Central Commons); 5000 Bowness Road NW (Bowmont Commons); 201, 610 8 Avenue SE (Village Commons), Calgary, AB',
    phone: '403-205-5244',
    email: null,
    hours_of_operation: 'Vary by program; see website for schedules',
    website_url: 'https://caryacalgary.ca/get-support/social-connections/',
    eligibility: 'Calgarians of all ages; specific programs for seniors, families, and newcomers',
    service_format: 'in-person',
    process_steps: [
      'Visit the Carya website or call to learn about Social Connections programs',
      'Choose activities that interest you - food, art, wellness, or social programs',
      'Drop in or register for programs at any of the three locations'
    ],
    tags: ['social connection', 'isolation', 'community', 'art', 'wellness', 'food', 'men\'s shed', 'calgary', 'seniors', 'newcomers', 'families', 'free', 'low-cost']
  },
  // ============ VOLUNTEERING ============
  {
    service_id: 'volunteer-alberta-connector',
    name: 'Volunteer Alberta - Volunteer Connector',
    category: 'Community & Social Connection',
    description: 'Volunteer Alberta\'s Volunteer Connector is a province-wide platform that matches individuals with volunteer opportunities based on location, interests, and time commitment. Volunteering is one of the most effective ways to build social connections while contributing to community. The platform connects to local volunteer centres across Alberta including Volunteer Calgary, Volunteer Lethbridge, and many more. An excellent starting point for anyone looking to get involved and meet people.',
    location: 'Alberta',
    address: 'Province-wide (online platform)',
    phone: null,
    email: null,
    hours_of_operation: 'Online platform available 24/7',
    website_url: 'https://www.volunteerconnector.org/',
    eligibility: 'Anyone in Alberta',
    service_format: 'online, in-person',
    process_steps: [
      'Visit volunteerconnector.org',
      'Search for opportunities by location, interest, and availability',
      'Apply to volunteer with organizations that match your interests',
      'Connect with your local volunteer centre for personalized matching'
    ],
    tags: ['volunteering', 'social connection', 'community', 'alberta', 'free', 'civic engagement', 'online', 'in-person']
  },
  // ============ OUTDOOR & NATURE ============
  {
    service_id: 'core-society-calgary-outdoor-recreation',
    name: 'CORE Society - Calgary Outdoor Recreation Enthusiasts',
    category: 'Community & Social Connection',
    description: 'CORE (Calgary Outdoor Recreation Enthusiasts) is an outdoor recreation club founded in 1999 with approximately 125 members. Activities include hiking, scrambling, cycling, cross-country skiing, snowshoeing, urban walking, and social outings. A welcoming group for all skill levels and ages - a great way to explore Alberta\'s outdoors while making friends.',
    location: 'Calgary',
    address: 'Activities throughout Calgary and the Rocky Mountain region, AB',
    phone: null,
    email: 'mailbox@corehike.org',
    hours_of_operation: 'Activities scheduled regularly; see website for calendar',
    website_url: 'https://corehike.org/',
    eligibility: 'Open to all adults; range of skill levels welcome',
    service_format: 'in-person',
    process_steps: [
      'Visit corehike.org to see upcoming activities',
      'Join as a member ($25/year)',
      'Sign up for hikes, rides, and social events on the calendar'
    ],
    tags: ['hiking', 'outdoors', 'cycling', 'skiing', 'snowshoeing', 'social connection', 'calgary', 'nature', 'recreation', 'community', 'low-cost']
  },
  // ============ ADAPTIVE & INCLUSIVE RECREATION ============
  {
    service_id: 'between-friends-inclusive-recreation-calgary',
    name: 'Between Friends - Inclusive Recreation',
    category: 'Community & Social Connection',
    description: 'Between Friends creates opportunities for people with disabilities to connect, grow, and belong through inclusive social and recreational activities. Offers approximately 150 programs per year including Zumba, hip hop, swimming, pottery, badminton, drawing, and ballet. Summer day camps (Camp Bonaventure, Camp Fun\'zAmust) and inclusive community activities serve all age groups. A leader in creating belonging through recreation.',
    location: 'Calgary',
    address: '#205, 8989 Macleod Trail S, Calgary, AB T2H 0M2',
    phone: '403-930-3852',
    email: 'SGreanya@betweenfriends.ab.ca',
    hours_of_operation: 'Programs run evenings and weekends; seasonal schedules (winter, spring, summer, fall)',
    website_url: 'https://betweenfriends.ab.ca/',
    eligibility: 'Individuals with disabilities and their peers; all ages',
    service_format: 'in-person',
    process_steps: [
      'Visit betweenfriends.ab.ca to view the seasonal program guide',
      'Call 403-508-0110 to register for programs',
      'Programs run in winter, spring, summer, and fall sessions'
    ],
    tags: ['disability', 'inclusive', 'recreation', 'social connection', 'adaptive', 'sports', 'arts', 'camps', 'calgary', 'community', 'belonging']
  },
  {
    service_id: 'paralympic-sports-association-edmonton',
    name: 'Paralympic Sports Association',
    category: 'Community & Social Connection',
    description: 'A charitable, volunteer-driven organization providing sport and recreation opportunities for children, youth, teens, adults, and seniors with disabilities. Programs include Wheelchair Floor Hockey, Sledge Hockey, Paracycling, Adapted Swimming, Adapted Taekwondo, Adapted Golf, Adapted Kayaking, and Summer Camps. Operating in Edmonton, Medicine Hat, and Hinton.',
    location: 'Edmonton',
    address: '#305, 11010 101 Street, Edmonton, AB',
    phone: '780-439-8687',
    email: 'info@parasportsab.com',
    hours_of_operation: 'Vary by program; see website for schedules',
    website_url: 'https://www.parasportsab.com/',
    eligibility: 'People with disabilities and their family/friends; all ages',
    service_format: 'in-person',
    process_steps: [
      'Visit parasportsab.com to explore available sports',
      'Contact the association to register for programs',
      'Equipment is provided for most activities'
    ],
    tags: ['disability', 'adaptive sports', 'wheelchair', 'hockey', 'swimming', 'social connection', 'edmonton', 'recreation', 'inclusive', 'community']
  },
  {
    service_id: 'wheelchair-sports-alberta',
    name: 'Wheelchair Sports Alberta',
    category: 'Community & Social Connection',
    description: 'Provincial organization for wheelchair basketball, para athletics, wheelchair rugby, para ice hockey, and wheelchair tennis. Offers school programs with wheelchair rentals and instruction, equipment rental/loan programs, coaching programs, and grants for financial assistance to developing athletes. Connecting people with physical disabilities through competitive and recreational sport across Alberta.',
    location: 'Edmonton',
    address: 'Percy Page Centre, 11759 Groat Road NW, Edmonton, AB T5M 3K6',
    phone: '780-427-8699',
    email: 'jen@wheelchairsportsalberta.com',
    hours_of_operation: 'Contact for program schedules',
    website_url: 'https://wheelchairsportsalberta.com/',
    eligibility: 'People with physical disabilities requiring wheelchair use for sport',
    service_format: 'in-person',
    process_steps: [
      'Visit wheelchairsportsalberta.com to learn about available sports',
      'Contact the organization or call toll-free 1-888-453-6770',
      'Apply for grants if financial assistance is needed',
      'Equipment rental and loan programs available'
    ],
    tags: ['disability', 'wheelchair', 'basketball', 'rugby', 'tennis', 'athletics', 'adaptive sports', 'edmonton', 'alberta', 'social connection', 'grants']
  },
  {
    service_id: 'rocky-mountain-adaptive-canmore',
    name: 'Rocky Mountain Adaptive',
    category: 'Community & Social Connection',
    description: 'A not-for-profit providing individuals of all abilities the chance to access sporting and recreational activities in the Canadian Rockies. Offers over 20 different adaptive sport and recreational activities for children and adults with physical, intellectual, cognitive, or developmental impairments. Programs, lessons, and experiences in the Bow Valley (Canmore, Banff, Lake Louise) with specialized equipment rental available.',
    location: 'Canmore',
    address: 'Unit 168 - 105 Bow Meadows Crescent, Canmore, AB',
    phone: null,
    email: null,
    hours_of_operation: 'Seasonal programs; see website for availability',
    website_url: 'https://rockymountainadaptive.com/',
    eligibility: 'Individuals with any disability; children and adults',
    service_format: 'in-person',
    process_steps: [
      'Visit rockymountainadaptive.com to explore activities',
      'Contact the organization to book programs or lessons',
      'Specialized adaptive equipment is available for rental'
    ],
    tags: ['disability', 'adaptive', 'outdoors', 'skiing', 'recreation', 'canmore', 'banff', 'rockies', 'social connection', 'inclusive', 'nature']
  },
  {
    service_id: 'calgary-adapted-hub',
    name: 'Calgary Adapted Hub',
    category: 'Community & Social Connection',
    description: 'The go-to resource for inclusive and accessible sport and recreation programming in Calgary. Connects children, youth, and families living with disabilities to recreational, developmental, or high-performance adapted sport opportunities. Offers free consultations to discuss interests and match to appropriate programs. Powered by Jumpstart, the Hub maintains a comprehensive directory of adapted sport programs across Calgary.',
    location: 'Calgary',
    address: 'Calgary, AB',
    phone: '403-955-5736',
    email: 'cah.research@ucalgary.ca',
    hours_of_operation: 'Contact for consultation availability',
    website_url: 'https://www.calgaryadaptedhub.com/',
    eligibility: 'Children, youth, and families with disabilities (physical, intellectual, sensory, developmental)',
    service_format: 'in-person, online',
    process_steps: [
      'Visit calgaryadaptedhub.com to browse adapted sport programs',
      'Book a free consultation to discuss your interests',
      'Get matched with appropriate adapted sport and recreation programs in Calgary'
    ],
    tags: ['disability', 'adaptive sports', 'inclusive', 'children', 'youth', 'families', 'calgary', 'social connection', 'recreation', 'free consultation']
  },
  // ============ COMMUNITY GARDENS & FARMING ============
  {
    service_id: 'grow-calgary-community-farm',
    name: 'Grow Calgary - Community Farm',
    category: 'Community & Social Connection',
    description: 'A 100% volunteer-run community farm on 11 acres near Canada Olympic Park that donates all produce grown to social agencies with food access programs. Volunteers participate in gardening, administration, and fundraising. Team-building opportunities available through the COGS program. Uses agroecology farming practices and provides small-scale farming education. A meaningful way to connect with community while contributing to food security.',
    location: 'Calgary',
    address: '10319 West Valley Rd SW, Calgary, AB T3B 5T2',
    phone: '403-383-3420',
    email: null,
    hours_of_operation: 'Seasonal (growing season); see website for volunteer days',
    website_url: 'https://growcalgary.ca/',
    eligibility: 'All ages; no experience necessary',
    service_format: 'in-person',
    process_steps: [
      'Visit growcalgary.ca to learn about volunteer opportunities',
      'Sign up for a volunteer session during growing season',
      'Show up ready to garden - tools and guidance provided'
    ],
    tags: ['gardening', 'farming', 'volunteer', 'food security', 'community', 'outdoors', 'calgary', 'social connection', 'free', 'nature']
  },
  {
    service_id: 'city-of-edmonton-community-gardens',
    name: 'City of Edmonton - Community Gardens',
    category: 'Community & Social Connection',
    description: 'Over 80 community gardens (50 on public land) where residents grow food, connect with neighbours, and participate in outdoor recreation. Each garden is managed by a local garden group. The City also offers a Pop-Up Community Gardens Program for temporary growing spaces. Community gardens are proven to reduce isolation and build neighbourhood connections.',
    location: 'Edmonton',
    address: '80+ locations across Edmonton, AB',
    phone: null,
    email: null,
    hours_of_operation: 'Seasonal; vary by garden',
    website_url: 'https://www.edmonton.ca/residential_neighbourhoods/gardens_lawns_trees/community-gardens',
    eligibility: 'Edmonton residents; contact individual garden groups for plot availability',
    service_format: 'in-person',
    process_steps: [
      'Visit the City of Edmonton website to find a community garden near you',
      'Contact the local garden group for plot availability',
      'Apply for a plot (typically around $30/year; some gardens have waitlists)',
      'Garden and connect with your neighbours throughout the growing season'
    ],
    tags: ['gardening', 'community', 'outdoors', 'food', 'neighbours', 'edmonton', 'social connection', 'nature', 'low-cost']
  },
  // ============ MAKERSPACES & WORKSHOPS ============
  {
    service_id: 'alberta-mens-shed-association',
    name: 'Alberta Men\'s Shed Association',
    category: 'Community & Social Connection',
    description: 'Men\'s Sheds provide a space for men (especially retirees) to connect, share knowledge, and work on projects shoulder-to-shoulder. Over 31 sheds across Alberta, including locations in Calgary, Edmonton, Airdrie, Beaumont, Chestermere, Cochrane, Cold Lake, and more. Individual sheds offer woodworking, crafts, social gatherings, and community projects. Research shows Men\'s Sheds significantly reduce isolation and improve mental health.',
    location: 'Alberta',
    address: 'Multiple locations across Alberta; see website to find a shed near you',
    phone: null,
    email: null,
    hours_of_operation: 'Vary by shed; typically weekday mornings/afternoons',
    website_url: 'https://www.albertamenssheds.ca/',
    eligibility: 'Primarily men; some sheds welcome all genders. Especially beneficial for retirees and those experiencing isolation.',
    service_format: 'in-person',
    process_steps: [
      'Visit albertamenssheds.ca and use the Find a Shed tool',
      'Contact your local shed to learn about their schedule and activities',
      'Drop in during their open hours - no commitment required'
    ],
    tags: ['men', 'social connection', 'woodworking', 'crafts', 'retirement', 'isolation', 'mental health', 'alberta', 'community', 'free', 'workshop']
  },
  {
    service_id: 'protospace-calgary-makerspace',
    name: 'Protospace - Calgary Makerspace',
    category: 'Community & Social Connection',
    description: 'Calgary\'s original makerspace and community workshop. Offers access to laser cutters, 3D printers, woodworking tools, electronics equipment, and more. Free open house every Tuesday 7-9 PM where the public can tour, interact with members, and try things out. A community of makers, creators, and learners who share tools, skills, and friendship.',
    location: 'Calgary',
    address: '1530 27th Avenue NE, Bay 108, Calgary, AB T2E 7S6',
    phone: '587-774-5672',
    email: null,
    hours_of_operation: 'Members: flexible access. Public open house: Tuesdays 7-9 PM (free)',
    website_url: 'https://protospace.ca/',
    eligibility: 'Anyone; no experience required. Student/low-income memberships available.',
    service_format: 'in-person',
    process_steps: [
      'Attend a free Tuesday open house (7-9 PM) to tour the space',
      'Talk with members about projects and interests',
      'Sign up for a membership ($55/month; $35/month student/low-income)',
      'Start using tools and learning new skills with the community'
    ],
    tags: ['makerspace', 'workshop', 'woodworking', '3D printing', 'electronics', 'social connection', 'calgary', 'community', 'creativity', 'learning', 'low-cost']
  },
  // ============ YMCA ============
  {
    service_id: 'ymca-calgary',
    name: 'YMCA Calgary',
    category: 'Community & Social Connection',
    description: 'The YMCA of Calgary operates 6 health and wellness facilities, child development centres, and over 60 community program sites across Calgary. Programs include fitness classes, swimming, youth programs, child care, community outreach, and social recreation. The YMCA is committed to ensuring financial barriers don\'t prevent participation - financial assistance is available for memberships and programs.',
    location: 'Calgary',
    address: 'Multiple locations across Calgary, AB',
    phone: null,
    email: null,
    hours_of_operation: 'Vary by facility; see website',
    website_url: 'https://www.ymcacalgary.org/',
    eligibility: 'Open to all ages. Financial assistance available.',
    service_format: 'in-person',
    process_steps: [
      'Visit ymcacalgary.org to find a location and programs',
      'Apply for financial assistance if needed',
      'Register for programs or purchase a membership',
      'Participate in fitness, recreation, and community activities'
    ],
    tags: ['fitness', 'swimming', 'youth', 'recreation', 'community', 'calgary', 'social connection', 'child care', 'financial assistance', 'wellness']
  },
  {
    service_id: 'ymca-northern-alberta',
    name: 'YMCA of Northern Alberta',
    category: 'Community & Social Connection',
    description: 'The YMCA of Northern Alberta serves Edmonton, Red Deer, Grande Prairie, and Wood Buffalo with fitness, child care, youth programs, newcomer settlement, and the free Y Mind mental health program for youth aged 15-25. A comprehensive community organization that connects people through health, wellness, and social programs across northern Alberta.',
    location: 'Edmonton',
    address: 'Multiple locations in Edmonton, Red Deer, Grande Prairie, and Fort McMurray, AB',
    phone: null,
    email: null,
    hours_of_operation: 'Vary by facility; see website',
    website_url: 'https://ymcanab.ca/',
    eligibility: 'Open to all ages. Financial assistance available. Y Mind program free for youth 15-25.',
    service_format: 'in-person',
    process_steps: [
      'Visit ymcanab.ca to find locations and programs',
      'Apply for financial assistance if needed',
      'Register for fitness, child care, youth, or newcomer programs'
    ],
    tags: ['fitness', 'youth', 'recreation', 'community', 'edmonton', 'red deer', 'grande prairie', 'fort mcmurray', 'social connection', 'child care', 'newcomers', 'mental health', 'financial assistance']
  }
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n=== ADDING SOCIAL CONNECTION & RECREATION SERVICES ===\n');

    // Check for existing services to avoid duplicates
    const existingResult = await pool.query(
      'SELECT service_id, name FROM services WHERE is_active = true'
    );
    const existingIds = new Set(existingResult.rows.map((r: any) => r.service_id));
    const existingNames = new Set(existingResult.rows.map((r: any) => r.name.toLowerCase()));

    let added = 0;
    let skipped = 0;

    for (const service of newServices) {
      if (existingIds.has(service.service_id) || existingNames.has(service.name.toLowerCase())) {
        console.log('Skipping (already exists): ' + service.name);
        skipped++;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO services (
            service_id, name, category, description, location, address,
            phone, email, hours_of_operation, website_url, eligibility,
            service_format, process_steps, tags, is_active, confidence_score,
            last_checked, last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, 80, NOW(), NOW())`,
          [
            service.service_id,
            service.name,
            service.category,
            service.description,
            service.location,
            service.address,
            service.phone,
            service.email,
            service.hours_of_operation,
            service.website_url,
            service.eligibility,
            service.service_format,
            JSON.stringify(service.process_steps),
            JSON.stringify(service.tags)
          ]
        );

        console.log('Added: ' + service.name);
        added++;
      } catch (err: any) {
        if (err.code === '23505') {
          console.log('Skipping (duplicate): ' + service.name);
          skipped++;
        } else {
          console.error('Error adding ' + service.name + ':', err.message);
        }
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log('Added: ' + added + ' services');
    console.log('Skipped: ' + skipped + ' services');
    console.log('Total attempted: ' + newServices.length + ' services');

    // Refresh the materialized view if it exists
    try {
      await pool.query('SELECT refresh_search_view()');
      console.log('\nSearch view refreshed');
    } catch (err) {
      console.log('\nCould not refresh search view (may not exist)');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
