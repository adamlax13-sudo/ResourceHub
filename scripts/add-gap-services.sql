-- ResourceHub Service Gap Fill Migration
-- Adds ~134 new services across 17 categories
-- Generated 2026-03-04

-- Use ON CONFLICT to skip duplicates (by service_id)
-- All services start with confidence_score=80 (manually researched, URLs need verification)

BEGIN;

-- ============================================================
-- PART 1A: Veterans Services (11 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('osiss-peer-support-network-alberta', 'OSISS Peer Support Network', 'Veterans Services', 'Operational Stress Injury Social Support program for Canadian Armed Forces members, veterans, and families dealing with PTSD and operational stress injuries. Trained peer support coordinators with lived experience provide confidential one-on-one support.', 'Edmonton & Calgary', 'https://www.osiss.ca', NULL, '["veterans", "peer support", "PTSD", "military", "operational stress"]', 80, true),

('homes-for-heroes-foundation', 'Homes for Heroes Foundation', 'Veterans Services', 'Transitional housing through tiny home communities for homeless veterans. Edmonton village includes individual tiny homes with wraparound supports including mental health, employment assistance, and life skills. Goal is permanent housing within one year.', 'Edmonton - 11440 Kingsway NW', 'https://www.homesforheroes.ca', NULL, '["veterans", "housing", "homeless", "transitional", "tiny homes"]', 80, true),

('vets-canada-alberta', 'VETS Canada', 'Veterans Services', 'Emergency assistance for veterans in crisis including food, clothing, shelter, and referrals. Operates street patrols to locate and help homeless veterans. Provides immediate emergency support while connecting veterans to longer-term resources.', 'Alberta (province-wide)', 'https://vetscanada.org', NULL, '["veterans", "emergency", "homeless", "crisis", "food", "clothing"]', 70, true),

('wounded-warriors-canada-can-praxis', 'Wounded Warriors Canada - Can Praxis', 'Veterans Services', 'Mental health programs for veterans and first responders including trauma-focused therapy, couples counselling, equine therapy at Can Praxis program near Rocky Mountain House, service dog program, and veterans transition program.', 'Rocky Mountain House, AB', 'https://woundedwarriors.ca', NULL, '["veterans", "PTSD", "equine therapy", "couples", "first responders", "trauma"]', 80, true),

('cockrell-house-calgary', 'Cockrell House', 'Veterans Services', 'Transitional housing facility for veterans experiencing homelessness in Calgary. Provides safe accommodation along with support services to help veterans stabilize and transition to permanent housing.', 'Calgary', 'https://www.cockrellhouse.ca', NULL, '["veterans", "housing", "homeless", "transitional", "calgary"]', 70, true),

('carewest-colonel-belcher', 'Carewest Colonel Belcher', 'Veterans Services', 'Long-term care facility in Calgary specifically serving veterans and seniors. Provides 24-hour nursing care, rehabilitation services, and specialized veteran programming. Dedicated veteran care beds funded by Veterans Affairs Canada.', 'Calgary - 1939 Veterans Way NW', 'https://www.carewest.ca/our-centres/carewest-colonel-belcher/', NULL, '["veterans", "long-term care", "seniors", "nursing", "rehabilitation"]', 80, true),

('royal-canadian-legion-ab-nwt-command', 'Royal Canadian Legion - AB/NWT Command', 'Veterans Services', 'Provides veteran advocacy, emergency financial assistance through the Poppy Fund, housing assistance, and social programming for veterans and families. Over 100 branches across Alberta offering community support and help navigating VAC benefits.', 'Edmonton HQ, branches province-wide', 'https://www.albertanwtcommand.com', NULL, '["veterans", "legion", "financial assistance", "advocacy", "poppy fund"]', 70, true),

('edmonton-mfrc', 'Edmonton Military Family Resource Centre', 'Veterans Services', 'Comprehensive support for military families including deployment support, children''s programs, employment assistance for military spouses, counselling, crisis support, and community integration programs.', 'CFB Edmonton', 'https://www.cafconnection.ca/Edmonton/', NULL, '["military", "family", "deployment", "counselling", "employment", "edmonton"]', 80, true),

('4-wing-cold-lake-mfrc', '4 Wing Cold Lake Military Family Resource Centre', 'Veterans Services', 'Family support services for the 4 Wing Cold Lake military community. Programs include childcare, deployment support, mental health counselling, employment assistance, second language training, and community connection.', 'Cold Lake, AB', 'https://www.cafconnection.ca/Cold-Lake/', NULL, '["military", "family", "cold lake", "rural", "deployment"]', 80, true),

('cfb-suffield-mfrc', 'CFB Suffield Military Family Resource Centre', 'Veterans Services', 'Family support services for the CFB Suffield military community in southeastern Alberta. Provides deployment support, family counselling, children''s programs, and community integration for military families.', 'Ralston / Medicine Hat area, AB', 'https://www.cafconnection.ca/Suffield/', NULL, '["military", "family", "suffield", "medicine hat", "rural"]', 80, true),

('wainwright-mfrc', 'Wainwright Military Family Resource Centre', 'Veterans Services', 'Family support for the 3rd Canadian Division Support Base Wainwright community. Services include childcare, deployment support, mental health services, employment support for spouses, and emergency assistance.', 'Wainwright, AB', 'https://www.cafconnection.ca/Wainwright/', NULL, '["military", "family", "wainwright", "rural", "deployment"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 1B: Gambling Support (7 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active, is_24_7)
VALUES
('ahs-addiction-helpline-gambling', 'AHS Addiction Helpline (Gambling Support)', 'Gambling Support', '24/7 confidential helpline providing information, support, and referrals for gambling addiction. Connects callers with local gambling treatment resources across Alberta. Available in multiple languages.', 'Alberta (province-wide)', 'https://www.albertahealthservices.ca/info/page15557.aspx', '1-866-332-2322', '["gambling", "helpline", "24/7", "free", "confidential", "addiction"]', 80, true, true),

('aglc-gamesense-program', 'AGLC GameSense Program', 'Gambling Support', 'AGLC''s responsible gambling program with GameSense information centres at major Alberta casinos. Provides information about how gambling works, odds, self-exclusion, voluntary spending limits, and connections to treatment resources.', 'Alberta (province-wide, at casinos)', 'https://gamesense.aglc.ca', NULL, '["gambling", "responsible gambling", "education", "casino", "self-exclusion"]', 70, true, false),

('aglc-self-exclusion-program', 'AGLC Voluntary Self-Exclusion Program', 'Gambling Support', 'Free, voluntary program allowing individuals to ban themselves from all Alberta casinos and racing entertainment centres. Available in 6-month, 1-year, 3-year, or lifetime periods. Includes referral to counselling services.', 'Alberta (province-wide)', 'https://aglc.ca/responsible-gambling/self-exclusion', NULL, '["gambling", "self-exclusion", "free", "casino", "self-help"]', 70, true, false),

('alberta-gambling-research-institute', 'Alberta Gambling Research Institute', 'Gambling Support', 'Research consortium based at University of Lethbridge (with U of A and U of C) providing evidence-based gambling research and educational resources. Funds research into gambling behaviour, addiction, and treatment.', 'Lethbridge (University of Lethbridge)', 'https://www.abgamblinginstitute.ca', NULL, '["gambling", "research", "education", "university", "evidence-based"]', 70, true, false),

('calgary-counselling-centre-gambling', 'Calgary Counselling Centre - Problem Gambling', 'Gambling Support', 'Individual and group counselling for problem gambling with sliding scale fees based on income. Experienced counsellors specializing in gambling addiction, financial impacts, and family effects of problem gambling.', 'Calgary', 'https://www.calgarycounselling.com', NULL, '["gambling", "counselling", "sliding scale", "affordable", "calgary"]', 80, true, false),

('ahs-gambling-treatment-edmonton', 'AHS Problem Gambling Treatment - Edmonton', 'Gambling Support', 'Alberta Health Services outpatient gambling treatment programs in Edmonton. Provides assessment, individual counselling, group therapy, and relapse prevention for adults with gambling problems. No charge for AHS services.', 'Edmonton', 'https://www.albertahealthservices.ca', NULL, '["gambling", "treatment", "free", "outpatient", "edmonton", "AHS"]', 80, true, false),

('ahs-gambling-treatment-calgary', 'AHS Problem Gambling Treatment - Calgary', 'Gambling Support', 'Alberta Health Services outpatient gambling treatment in Calgary. Individual and group counselling for problem gambling available at multiple AHS addiction and mental health clinics. No charge.', 'Calgary', 'https://www.albertahealthservices.ca', NULL, '["gambling", "treatment", "free", "outpatient", "calgary", "AHS"]', 80, true, false)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 1C: Eating Disorder Services (7 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('eating-disorder-support-network-alberta', 'Eating Disorder Support Network of Alberta', 'Eating Disorder Services', 'Provincial non-profit providing support groups, education, and advocacy for individuals affected by eating disorders and families. Offers peer support groups across Alberta, educational workshops, and a resource directory.', 'Alberta (province-wide, based in Edmonton)', 'https://www.edsna.ca', NULL, '["eating disorder", "peer support", "education", "advocacy", "anorexia", "bulimia"]', 70, true),

('ahs-edmonton-eating-disorder-program', 'AHS Edmonton Eating Disorder Program', 'Eating Disorder Services', 'Specialized AHS eating disorder treatment program offering assessment, outpatient treatment, day treatment, and inpatient care for adults and adolescents with anorexia nervosa, bulimia nervosa, and other eating disorders. Referral through physician required.', 'Edmonton', 'https://www.albertahealthservices.ca', NULL, '["eating disorder", "treatment", "inpatient", "outpatient", "AHS", "edmonton"]', 80, true),

('ahs-calgary-eating-disorder-program', 'AHS Calgary Eating Disorder Program', 'Eating Disorder Services', 'Comprehensive AHS eating disorder program at Foothills Medical Centre providing assessment, outpatient counselling, intensive day treatment, and inpatient stabilization. Multidisciplinary team including psychiatrists, psychologists, dietitians, and social workers.', 'Calgary (Foothills Medical Centre)', 'https://www.albertahealthservices.ca', NULL, '["eating disorder", "treatment", "inpatient", "outpatient", "AHS", "calgary"]', 80, true),

('alberta-childrens-hospital-ed-program', 'Alberta Children''s Hospital - Eating Disorder Program', 'Eating Disorder Services', 'Specialized pediatric eating disorder treatment for children and adolescents. Provides medical stabilization, nutritional rehabilitation, family-based treatment (Maudsley approach), and outpatient follow-up.', 'Calgary (Alberta Children''s Hospital)', 'https://www.albertahealthservices.ca', NULL, '["eating disorder", "pediatric", "youth", "children", "family therapy", "calgary"]', 80, true),

('stollery-childrens-hospital-ed-program', 'Stollery Children''s Hospital - Eating Disorder Program', 'Eating Disorder Services', 'Pediatric and adolescent eating disorder treatment in Edmonton. Provides medical assessment, inpatient stabilization, day treatment, and outpatient follow-up for youth with eating disorders.', 'Edmonton (Stollery Children''s Hospital)', 'https://www.albertahealthservices.ca', NULL, '["eating disorder", "pediatric", "youth", "children", "edmonton"]', 80, true),

('body-brave-virtual-alberta', 'Body Brave (Virtual)', 'Eating Disorder Services', 'Virtual eating disorder treatment programs accessible to Albertans including intensive outpatient program, individual therapy, dietitian support, and peer support groups. Sliding scale fees available.', 'Virtual (serves Alberta)', 'https://bodybrave.ca', NULL, '["eating disorder", "virtual", "online", "sliding scale", "outpatient"]', 70, true),

('sheenas-place-virtual-alberta', 'Sheena''s Place (Virtual Support Groups)', 'Eating Disorder Services', 'Free virtual support groups for people affected by eating disorders. Offers over 30 weekly support groups covering body image, recovery, family support, and art therapy. No diagnosis or referral required.', 'Virtual (serves Alberta)', 'https://sheenasplace.org', NULL, '["eating disorder", "virtual", "free", "support groups", "body image"]', 70, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 1D: Family & Parenting Support (11 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('parent-link-centres-alberta', 'Parent Link Centres', 'Family & Parenting Support', 'Government-funded family resource centres across Alberta (46+ locations). Free drop-in programs for families with children 0-6 including parenting workshops, early childhood development, play groups, nutrition programs, and breastfeeding support.', 'Alberta (46+ locations province-wide)', 'https://www.alberta.ca/parent-link-centres', NULL, '["parenting", "children", "free", "early childhood", "family", "province-wide"]', 80, true),

('calgary-fcss', 'City of Calgary FCSS', 'Family & Parenting Support', 'Municipally funded preventive social services. Funds numerous family programs including parenting courses, family counselling, home visitation for new parents, and family resource centres across Calgary.', 'Calgary', 'https://www.calgary.ca/social-services/fcss.html', NULL, '["parenting", "family", "counselling", "free", "calgary", "FCSS"]', 80, true),

('edmonton-fcss', 'City of Edmonton FCSS', 'Family & Parenting Support', 'Funds preventive social programs for families in Edmonton including parent education, family counselling, crisis support, and community development programs.', 'Edmonton', 'https://www.edmonton.ca/programs_services/for_families', NULL, '["parenting", "family", "counselling", "free", "edmonton", "FCSS"]', 80, true),

('boys-girls-clubs-calgary', 'Boys & Girls Clubs of Calgary', 'Family & Parenting Support', 'After-school and summer programs for children and youth ages 5-18. Programs include homework help, leadership development, recreation, arts, STEM activities, and mentoring in a safe environment.', 'Calgary (multiple club locations)', 'https://www.boysandgirlsclubsofcalgary.ca', NULL, '["youth", "children", "after-school", "mentoring", "recreation", "calgary"]', 80, true),

('bgc-big-brothers-big-sisters-edmonton', 'Boys & Girls Clubs Big Brothers Big Sisters of Edmonton', 'Family & Parenting Support', 'Combined organization providing youth mentoring programs, after-school clubs, summer camps, and one-to-one mentoring matches. Serves children and youth aged 6-18.', 'Edmonton', 'https://www.bgcbigs.ca', NULL, '["youth", "mentoring", "after-school", "summer camp", "edmonton"]', 80, true),

('big-brothers-big-sisters-calgary', 'Big Brothers Big Sisters of Calgary', 'Family & Parenting Support', 'Mentoring programs matching children and youth with adult volunteer mentors. Programs include traditional one-to-one mentoring, in-school mentoring, group mentoring, and teen mentoring for ages 6-16.', 'Calgary', 'https://www.bigbrothersbigsisters.ca/calgary', NULL, '["youth", "mentoring", "children", "volunteers", "calgary"]', 80, true),

('catholic-family-service-calgary', 'Catholic Family Service of Calgary', 'Family & Parenting Support', 'Comprehensive family services including individual and family counselling, parenting programs, refugee and immigrant support, adoption services, in-home family support, and mental health services. Open to all faiths. Sliding scale fees.', 'Calgary', 'https://www.cfs-ab.org', NULL, '["family", "counselling", "parenting", "adoption", "sliding scale", "calgary"]', 80, true),

('jewish-family-service-calgary', 'Jewish Family Service Calgary', 'Family & Parenting Support', 'Counselling, family support, seniors services, and community programs including individual/family/couples counselling, parenting support, financial assistance, immigrant settlement, and seniors wellness. Open to all backgrounds.', 'Calgary', 'https://www.jfsc.org', NULL, '["family", "counselling", "seniors", "financial assistance", "calgary"]', 80, true),

('mcman-youth-family-community', 'McMan Youth, Family and Community Services', 'Family & Parenting Support', 'Major Alberta non-profit providing family strengthening programs, in-home family support, parent education, youth transitioning out of care support, early intervention, and community-based family services across the province.', 'Edmonton, Calgary, Red Deer, Grande Prairie, Lethbridge, Medicine Hat', 'https://www.mcman.ca', NULL, '["family", "youth", "in-home support", "parenting", "province-wide"]', 80, true),

('hull-services-family', 'Hull Services - Family Support', 'Family & Parenting Support', 'Family support services including family counselling, in-home support, foster care, residential treatment for youth, and early intervention programs. Specializes in serving families with complex needs and children with behavioural challenges.', 'Calgary', 'https://www.hullservices.ca', NULL, '["family", "counselling", "foster care", "youth", "complex needs", "calgary"]', 80, true),

('calgary-counselling-centre-family', 'Calgary Counselling Centre - Family Programs', 'Family & Parenting Support', 'Affordable counselling services including family therapy, parent-child relationship counselling, co-parenting support, blended family counselling, and parenting skills programs. Sliding scale fees. One of Canada''s largest non-profit counselling centres.', 'Calgary (multiple locations)', 'https://www.calgarycounselling.com', NULL, '["family", "counselling", "parenting", "sliding scale", "affordable", "calgary"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2A: Financial Counselling & Debt Help (6 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('money-mentors-alberta', 'Money Mentors', 'Financial Counselling & Debt Help', 'Alberta''s only non-profit credit counselling agency. Offers free one-on-one consultations, budgeting and money management tools, financial literacy courses, and the Orderly Payment of Debts (OPD) program — Alberta''s unique court-supervised debt repayment program.', 'Edmonton HQ, Calgary, Red Deer, Lethbridge, Grande Prairie, Medicine Hat', 'https://moneymentors.ca', '1-888-294-0076', '["financial", "debt", "credit counselling", "budgeting", "free", "OPD", "province-wide"]', 90, true),

('credit-counselling-society-alberta', 'Credit Counselling Society - Alberta', 'Financial Counselling & Debt Help', 'National non-profit with Alberta offices offering free credit counselling, debt management programs, budgeting help, and financial education workshops.', 'Calgary & Edmonton', 'https://www.nomoredebts.org', NULL, '["financial", "debt", "credit counselling", "free", "budgeting"]', 70, true),

('momentum-calgary', 'Momentum', 'Financial Counselling & Debt Help', 'Financial empowerment for low-income Calgarians. Programs include free financial coaching (up to 5 sessions), matched savings accounts, money management courses, micro-lending, business development training, and tax filing assistance. Serving Calgarians for 30+ years.', 'Calgary', 'https://momentum.org', NULL, '["financial", "coaching", "savings", "business training", "tax filing", "low-income", "calgary"]', 90, true),

('bissell-centre-financial', 'Bissell Centre - Financial Programs', 'Financial Counselling & Debt Help', 'Multi-service organization offering emergency financial assistance, free tax clinics, financial literacy programs, and employment readiness services for people experiencing poverty and homelessness.', 'Edmonton - 10527 96 Street NW', 'https://www.bissellcentre.org', NULL, '["financial", "tax clinic", "emergency assistance", "employment", "edmonton"]', 80, true),

('cvitp-free-tax-clinics-alberta', 'Free Tax Clinics (CVITP)', 'Financial Counselling & Debt Help', 'CRA-supported free tax filing by trained volunteers for low-income individuals. Available February through April (some sites year-round). Hosted at community centres, libraries, and non-profits across Alberta.', 'Alberta (province-wide)', 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/community-volunteer-income-tax-program.html', NULL, '["tax", "free", "financial", "low-income", "volunteers", "province-wide"]', 80, true),

('alberta-supports-financial', 'Alberta Supports', 'Financial Counselling & Debt Help', 'Provincial government program providing income support, emergency financial assistance, health benefits, child care subsidies, and employment training. Key entry point for government financial help in Alberta.', 'Alberta (province-wide offices)', 'https://www.alberta.ca/alberta-supports', NULL, '["financial", "income support", "emergency", "government", "child care", "province-wide"]', 90, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2B: Transportation Assistance (6 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('calgary-low-income-transit-pass', 'Calgary Low-Income Transit Pass', 'Transportation Assistance', 'Subsidized monthly transit pass (~$5.60/month) for low-income Calgarians through the Fair Entry program. Covers all CTrain and bus services. Apply through the City of Calgary Fair Entry program.', 'Calgary', 'https://www.calgary.ca/social-services/fair-entry.html', '311', '["transit", "bus pass", "low-income", "subsidized", "calgary", "fair entry"]', 80, true),

('edmonton-ride-transit-program', 'Edmonton Ride Transit Program', 'Transportation Assistance', 'Reduced-cost Arc card ($36/month) for eligible low-income Edmontonians. Qualifying income at or below LICO + 10%. Also available to those on AISH, CPP Disability, EI, or newcomers. Covers ETS and DATS for registered clients.', 'Edmonton', 'https://www.edmonton.ca/ets/subsidized-transit', '311', '["transit", "bus pass", "low-income", "subsidized", "edmonton", "AISH"]', 90, true),

('dats-edmonton', 'DATS (Disabled Adult Transit Service)', 'Transportation Assistance', 'Door-to-door shared-ride transit service for Edmonton residents with disabilities who cannot use conventional transit. Operates 365 days per year. Requires eligibility assessment.', 'Edmonton', 'https://www.edmonton.ca/ets/dats', '780-496-4567', '["transit", "disability", "accessible", "door-to-door", "edmonton"]', 90, true),

('calgary-transit-access', 'Calgary Transit Access', 'Transportation Assistance', 'Specialized door-to-door transit for Calgarians with disabilities who cannot use conventional transit. Shared-ride service requiring advance booking.', 'Calgary', 'https://www.calgarytransit.com', '403-537-7777', '["transit", "disability", "accessible", "door-to-door", "calgary"]', 80, true),

('drivehappiness-edmonton', 'DriveHappiness', 'Transportation Assistance', 'Non-profit volunteer-based transportation service for seniors. Door-to-door service for medical appointments, social outings, and errands in the Edmonton area.', 'Edmonton', 'https://www.drivehappiness.ca', NULL, '["transit", "seniors", "volunteers", "medical appointments", "edmonton"]', 70, true),

('alberta-community-transit-fund', 'Alberta Community Transit Fund', 'Transportation Assistance', 'Provincial grants supporting local and regional transit in rural and smaller urban communities across Alberta. Funds capital and operating costs for community transit services.', 'Alberta (rural focus)', 'https://www.alberta.ca/community-transit-fund', NULL, '["transit", "rural", "grants", "government", "province-wide"]', 70, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2C: Healthcare Access - Low Income (8 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('the-alex-community-health-centre', 'The Alex Community Health Centre', 'Healthcare Access', 'Calgary''s first community health centre (est. 1973). Provides physical and mental health care, dental, pharmacy, lab, social work, and justice navigation — all under one roof for low-income Calgarians. Available to anyone without a family doctor, plus Indigenous and LGBTQ2S+ Calgarians of all income levels.', 'Calgary - 2840 2 Avenue SE', 'https://www.thealex.ca', '403-266-2622', '["healthcare", "dental", "mental health", "free", "low-income", "calgary", "walk-in"]', 90, true),

('radius-community-health-edmonton', 'Radius Community Health & Healing (formerly Boyle McCauley)', 'Healthcare Access', 'Edmonton''s only non-profit, community-owned health centre serving the inner city since 1980. Free primary care, dental, foot care, mental health, addiction services, women''s clinic, youth clinic, and outreach. Over 13,000 patient contacts monthly. Judgement-free.', 'Edmonton - 10628 96 Street NW', 'https://radiushealth.ca', '780-422-7333', '["healthcare", "dental", "free", "low-income", "inner city", "edmonton", "walk-in"]', 90, true),

('alberta-adult-health-benefit', 'Alberta Adult Health Benefit (AAHB)', 'Healthcare Access', 'Provincial program covering prescriptions, dental, optical, ambulance, and diabetic supplies for low-income adults not on income support. Income-tested. Apply through Alberta Supports.', 'Alberta (province-wide)', 'https://www.alberta.ca/alberta-adult-health-benefit', NULL, '["healthcare", "dental", "prescriptions", "optical", "low-income", "government", "province-wide"]', 80, true),

('alberta-child-health-benefit', 'Alberta Child Health Benefit (ACHB)', 'Healthcare Access', 'Provincial program covering dental, optical, prescriptions, and ambulance services for children in low-income families. Apply through Alberta Supports.', 'Alberta (province-wide)', 'https://www.alberta.ca/alberta-child-health-benefit', NULL, '["healthcare", "dental", "children", "prescriptions", "optical", "low-income", "government"]', 80, true),

('uofa-dental-clinic', 'University of Alberta Dental Clinic', 'Healthcare Access', 'Reduced-cost dental services from supervised dental students including cleanings, fillings, extractions, and dentures at significant savings compared to private practice.', 'Edmonton', 'https://www.ualberta.ca/school-of-dentistry', NULL, '["dental", "affordable", "university", "edmonton", "low-cost"]', 80, true),

('uofc-dental-clinic', 'University of Calgary Dental Clinic', 'Healthcare Access', 'Reduced-cost dental care from supervised dental students. Quality treatment at lower costs for cleanings, restorations, and other dental procedures.', 'Calgary', 'https://dentistry.ucalgary.ca', NULL, '["dental", "affordable", "university", "calgary", "low-cost"]', 80, true),

('sheldon-chumir-health-centre', 'Sheldon M. Chumir Health Centre', 'Healthcare Access', '24/7 urgent care centre in downtown Calgary offering addiction services, sexual health clinics, STI testing, community health programs, and walk-in medical care. No cost through Alberta Health.', 'Calgary - 1213 4 Street SW', 'https://www.albertahealthservices.ca', '403-955-6200', '["healthcare", "urgent care", "24/7", "sexual health", "STI", "free", "calgary"]', 90, true),

('cnib-alberta', 'CNIB Alberta', 'Healthcare Access', 'Vision rehabilitation services, assistive technology, and peer support for people with vision loss. Programs include orientation and mobility training, technology access, employment support, and community connections.', 'Calgary & Edmonton', 'https://www.cnib.ca', '1-800-563-2642', '["vision", "blindness", "assistive technology", "rehabilitation", "disability"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2D: Sexual Health Services (6 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('centre-for-sexuality-calgary', 'Centre for Sexuality', 'Sexual Health Services', 'Community-based organization providing comprehensive sexual health education in schools, youth programs (WiseGuyz, Camp fYrefly for LGBTQ2S+ youth), parent workshops, and individual support on sexual health, sexuality, gender, and healthy relationships.', 'Calgary - 1509 Centre Street SW', 'https://www.centreforsexuality.ca', '403-930-9946', '["sexual health", "education", "LGBTQ2S+", "youth", "schools", "calgary"]', 90, true),

('options-sexual-health-edmonton', 'Options Sexual Health', 'Sexual Health Services', 'Low-cost/no-cost sexual health clinic offering STI testing, pregnancy testing and options counselling, birth control, and Pap tests. Walk-ins welcome at multiple Edmonton locations.', 'Edmonton (multiple locations)', 'https://www.optionssexualhealth.ca', NULL, '["sexual health", "STI testing", "pregnancy", "birth control", "free", "edmonton"]', 70, true),

('ahs-sti-clinic-calgary', 'AHS STI Clinic - Calgary (Sheldon Chumir)', 'Sexual Health Services', 'Free confidential STI and HIV testing and treatment, hepatitis vaccinations, PrEP/PEP. No health care card or referral required. Walk-in and appointment-based services.', 'Calgary (Sheldon Chumir Health Centre)', 'https://www.albertahealthservices.ca/findhealth/Service.aspx?id=1668&serviceAtFacilityID=1039203', NULL, '["STI", "HIV", "testing", "free", "confidential", "PrEP", "calgary"]', 90, true),

('ahs-sti-clinic-edmonton', 'AHS STI Clinic - Edmonton', 'Sexual Health Services', 'Free confidential STI testing, diagnosis, treatment, hepatitis A/B/HPV vaccines, and HIV/hepatitis C testing. Walk-in and appointment-based in a non-judgmental, inclusive environment.', 'Edmonton', 'https://www.albertahealthservices.ca/findhealth/Service.aspx?id=1001498', NULL, '["STI", "HIV", "testing", "free", "confidential", "vaccines", "edmonton"]', 90, true),

('central-alberta-sexual-assault-support', 'Central Alberta Sexual Assault Support Centre', 'Sexual Health Services', 'Crisis support, counselling, court support, and public education for sexual assault survivors in Central Alberta including Red Deer and surrounding communities.', 'Red Deer', 'https://casasc.ca', NULL, '["sexual assault", "crisis", "counselling", "red deer", "rural"]', 70, true),

('skipping-stone-foundation', 'Skipping Stone Foundation', 'Sexual Health Services', 'Supports transgender and gender-diverse youth and families across Alberta. Services include healthcare navigation, peer support, family counselling, and educational workshops.', 'Calgary (serves province)', 'https://www.skippingstone.ca', NULL, '["transgender", "gender-diverse", "youth", "healthcare navigation", "LGBTQ2S+"]', 70, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2E: Prenatal & Maternal Health (5 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('healthy-parents-healthy-children-ahs', 'Healthy Parents, Healthy Children (AHS)', 'Prenatal & Maternal Health', 'AHS prenatal education and parenting resources including online guides, in-person classes, and public health nurse connections. Free comprehensive resource covering pregnancy, birth, and early childhood development.', 'Alberta (province-wide)', 'https://www.healthyparentshealthychildren.ca', NULL, '["prenatal", "parenting", "free", "education", "AHS", "province-wide"]', 80, true),

('alberta-prenatal-benefit', 'Alberta Prenatal Benefit', 'Prenatal & Maternal Health', 'Monthly financial benefit for low-income pregnant women to purchase nutritious food. Apply through Alberta Supports. Supports maternal and fetal health during pregnancy.', 'Alberta (province-wide)', 'https://www.alberta.ca/alberta-supports', NULL, '["prenatal", "financial", "nutrition", "low-income", "government", "province-wide"]', 80, true),

('alberta-association-of-midwives', 'Alberta Association of Midwives', 'Prenatal & Maternal Health', 'Connects Albertans with registered midwives. Midwifery is fully funded by Alberta Health (no cost to patients). Full prenatal, birth, and postpartum care available in Calgary, Edmonton, Lethbridge, Red Deer, Cochrane, and more.', 'Alberta (province-wide)', 'https://www.albertamidwives.org', NULL, '["midwife", "prenatal", "birth", "postpartum", "free", "province-wide"]', 70, true),

('families-first-home-visitation', 'Families First Home Visitation', 'Prenatal & Maternal Health', 'Home visits for vulnerable new parents by public health nurses and family support workers. Provides parenting education, developmental screening, breastfeeding support, and connections to community resources.', 'Edmonton & Calgary', NULL, NULL, '["prenatal", "postpartum", "home visits", "parenting", "breastfeeding", "free"]', 70, true),

('ahs-postpartum-mental-health', 'AHS Postpartum Mental Health Screening', 'Prenatal & Maternal Health', 'Public health nurses screen for postpartum depression and connect new parents to counselling, support groups, and psychiatric services. Available through AHS public health offices province-wide.', 'Alberta (province-wide)', 'https://www.albertahealthservices.ca', NULL, '["postpartum", "depression", "mental health", "screening", "free", "AHS"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2F: Criminal Justice Reintegration (7 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('john-howard-society-alberta', 'John Howard Society of Alberta', 'Criminal Justice Reintegration', 'Major reintegration provider offering halfway houses, employment readiness, community reintegration, crime prevention, victim-offender mediation, and youth justice programs across Alberta.', 'Edmonton, Calgary, Red Deer, Lethbridge, Grande Prairie, Drumheller', 'https://johnhoward.ab.ca', NULL, '["reintegration", "halfway house", "employment", "crime prevention", "province-wide"]', 90, true),

('calgary-john-howard-society', 'Calgary John Howard Society', 'Criminal Justice Reintegration', 'Reintegration services including Faris House (halfway house), employment programs, and a new $9.6M Employment Hub targeting crime reduction through strengthening employment outcomes for people transitioning from the justice system.', 'Calgary', 'https://www.cjhs.ca', NULL, '["reintegration", "employment", "halfway house", "calgary"]', 90, true),

('john-howard-society-red-deer', 'John Howard Society of Red Deer', 'Criminal Justice Reintegration', 'Community-based organization providing reintegration support, crime prevention programs, and criminal justice education in central Alberta including rural northwestern communities.', 'Red Deer', 'https://www.jhsrd.ca', NULL, '["reintegration", "crime prevention", "red deer", "rural"]', 80, true),

('elizabeth-fry-society-edmonton', 'Elizabeth Fry Society of Edmonton', 'Criminal Justice Reintegration', 'Supports women and girls in the justice system with transitional housing/halfway house, community reintegration programs, court support, advocacy, and in-facility programming.', 'Edmonton - 10523 100 Avenue NW', 'https://www.efryedmonton.ab.ca', NULL, '["reintegration", "women", "halfway house", "court support", "edmonton"]', 80, true),

('elizabeth-fry-society-calgary', 'Elizabeth Fry Society of Calgary', 'Criminal Justice Reintegration', 'Supports women and gender-diverse individuals in conflict with the law. Programs include community support, court assistance, transitional housing, employment support, and reintegration services.', 'Calgary', 'https://www.elizabethfrycalgary.com', NULL, '["reintegration", "women", "gender-diverse", "housing", "calgary"]', 80, true),

('native-counselling-services-alberta', 'Native Counselling Services of Alberta (NCSA)', 'Criminal Justice Reintegration', 'Culturally-based programs for Indigenous people in the justice system. Operates Section 81 Healing Lodges including Stan Daniels Healing Centre and Buffalo Sage Wellness House in Edmonton. Court worker program, healing programs, and restorative justice.', 'Edmonton HQ (services across Alberta)', 'https://www.ncsa.ca', '780-423-2141', '["Indigenous", "reintegration", "healing lodge", "restorative justice", "court support", "edmonton"]', 90, true),

('st-leonards-society-calgary', 'St. Leonard''s Society (Calgary)', 'Criminal Justice Reintegration', 'Community residential facility (halfway house) for federal offenders transitioning to community. Provides structured reintegration support and supervision.', 'Calgary', 'https://www.stleonardsyyc.ca', NULL, '["reintegration", "halfway house", "federal offenders", "calgary"]', 70, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2G: FASD Support (9 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('alberta-fasd-service-networks', 'Alberta FASD Service Networks', 'FASD Support', 'Twelve regional networks funded by the Government of Alberta providing FASD assessment, diagnosis, support services, mentoring, and caregiver resources across every region of the province. Single point of entry for FASD assistance.', 'Alberta (12 regions province-wide)', 'https://www.alberta.ca/fasd-programs-and-services', NULL, '["FASD", "fetal alcohol", "assessment", "diagnosis", "caregiver support", "province-wide"]', 90, true),

('fasd-alberta-resource-hub', 'FASD Alberta (Resource Hub)', 'FASD Support', 'Central resource directory for FASD services across Alberta. Connects individuals, families, and professionals with local FASD networks, assessment services, and support programs.', 'Alberta (province-wide)', 'https://fasdalberta.ca', NULL, '["FASD", "fetal alcohol", "directory", "resources", "province-wide"]', 90, true),

('south-alberta-fasd-network', 'South Alberta FASD Network', 'FASD Support', 'Regional FASD service network delivering awareness, prevention, assessment, diagnosis, and support services across southern Alberta including the Lethbridge area.', 'Lethbridge area', 'https://safasd.ca', NULL, '["FASD", "fetal alcohol", "lethbridge", "southern alberta", "assessment"]', 90, true),

('central-alberta-fasd-network', 'Central Alberta FASD Network', 'FASD Support', 'Serving Red Deer and surrounding areas with FASD education, outreach, assessment coordination, and advocacy for individuals and families affected by FASD.', 'Red Deer area', 'https://www.centralfasd.org', NULL, '["FASD", "fetal alcohol", "red deer", "central alberta", "assessment"]', 90, true),

('seafan-southeast-alberta-fasd', 'South East Alberta FASD Network (SEAFAN)', 'FASD Support', 'FASD service network providing assessment coordination, family support, and community education in the Medicine Hat and southeast Alberta region.', 'Medicine Hat area', 'https://seafan.ca', NULL, '["FASD", "fetal alcohol", "medicine hat", "southeast alberta"]', 90, true),

('neafan-northeast-fasd-network', 'Northeast FASD Network (NEAFAN)', 'FASD Support', 'FASD service network operating within the Wood Buffalo Municipal Area including Fort McMurray and surrounding communities. Provides assessment, diagnosis, and support services.', 'Fort McMurray / Wood Buffalo', 'https://neafan.ca', NULL, '["FASD", "fetal alcohol", "fort mcmurray", "wood buffalo", "northern"]', 90, true),

('willow-winds-support-network', 'Willow Winds Support Network', 'FASD Support', 'Prevention, awareness, assessment, diagnosis, and support services for FASD and brain domain challenges in northwest-central Alberta. Serves Jasper, Hinton, Edson, Barrhead, Westlock, Whitecourt, Swan Hills, Slave Lake, and Athabasca.', 'Jasper, Hinton, Edson, Slave Lake, Athabasca (rural NW Alberta)', 'https://wwsn.ca', NULL, '["FASD", "fetal alcohol", "rural", "northern", "jasper", "slave lake"]', 90, true),

('edmonton-fetal-alcohol-network', 'Edmonton Fetal Alcohol Network Society (EFAN)', 'FASD Support', 'Edmonton''s FASD service network providing diagnostic clinic referrals, caregiver support groups, training for professionals, and community education about FASD.', 'Edmonton', 'https://edmontonfetalalcoholnetwork.org', NULL, '["FASD", "fetal alcohol", "edmonton", "assessment", "caregiver support"]', 90, true),

('canfasd-research-network', 'Canada FASD Research Network (CanFASD)', 'FASD Support', 'National research network headquartered in Edmonton conducting FASD research, developing clinical guidelines, publishing evidence-based resources, and supporting policy development.', 'Edmonton (national HQ)', 'https://canfasd.ca', NULL, '["FASD", "fetal alcohol", "research", "clinical guidelines", "edmonton"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2H: Brain Injury Support (5 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('alberta-brain-injury-society', 'Alberta Brain Injury Society', 'Brain Injury Support', 'Province-wide no-cost support services for people affected by acquired brain injury including peer support groups, education, and referral navigation.', 'Alberta (province-wide)', 'https://www.abisociety.ab.ca', NULL, '["brain injury", "peer support", "free", "education", "province-wide"]', 70, true),

('synapse-alberta', 'Synapse Alberta', 'Brain Injury Support', 'Brain injury rehabilitation and community integration in Edmonton. Provides cognitive rehabilitation, life skills training, employment support, and social programs for adults with acquired brain injury.', 'Edmonton', 'https://www.synapsealberta.com', NULL, '["brain injury", "rehabilitation", "employment", "life skills", "edmonton"]', 70, true),

('brain-care-centre-edmonton', 'Brain Care Centre', 'Brain Injury Support', 'Community resource centre for brain injury in Edmonton offering drop-in support, recreation programs, computer access, lending library, peer support, and referral services.', 'Edmonton', 'https://www.braincarecentre.com', NULL, '["brain injury", "drop-in", "peer support", "recreation", "edmonton"]', 70, true),

('glenrose-abi-program', 'Glenrose Rehabilitation Hospital - ABI Program', 'Brain Injury Support', 'AHS tertiary rehabilitation centre providing inpatient and outpatient acquired brain injury rehabilitation, neuropsychological assessment, and multidisciplinary therapy.', 'Edmonton', 'https://www.albertahealthservices.ca/grh', NULL, '["brain injury", "rehabilitation", "inpatient", "outpatient", "AHS", "edmonton"]', 80, true),

('foothills-brain-injury-rehab', 'Foothills Medical Centre - Brain Injury Rehabilitation', 'Brain Injury Support', 'AHS Calgary zone brain injury services including acute neurosurgery, inpatient rehabilitation, and outpatient brain injury clinics at Foothills Medical Centre.', 'Calgary', 'https://www.albertahealthservices.ca', NULL, '["brain injury", "rehabilitation", "neurosurgery", "AHS", "calgary"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2I: Human Trafficking Support (4 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('act-alberta', 'ACT Alberta (Action Coalition on Human Trafficking)', 'Human Trafficking Support', 'Provincial coalition coordinating anti-trafficking efforts. Provides service referrals for survivors, public education, training for professionals, and policy advocacy. Operates a helpline for trafficking survivors.', 'Edmonton (province-wide)', 'https://www.actalberta.org', NULL, '["human trafficking", "exploitation", "crisis", "advocacy", "province-wide"]', 70, true),

('cease-edmonton', 'CEASE (Centre to End All Sexual Exploitation)', 'Human Trafficking Support', 'Works to end sexual exploitation and trafficking in Edmonton through outreach, exit support, trauma counselling, court support, and public awareness campaigns.', 'Edmonton', 'https://www.ceasenow.org', NULL, '["human trafficking", "sexual exploitation", "counselling", "exit support", "edmonton"]', 70, true),

('reset-society-calgary', 'RESET Society of Calgary', 'Human Trafficking Support', 'Supports individuals exiting sexual exploitation and trafficking with trauma counselling, housing support, life skills, employment readiness, and drop-in services.', 'Calgary', 'https://www.resetsociety.ca', NULL, '["human trafficking", "sexual exploitation", "housing", "counselling", "calgary"]', 70, true),

('canadian-human-trafficking-hotline', 'Canadian Human Trafficking Hotline', 'Human Trafficking Support', '24/7 multilingual national hotline connecting Alberta callers to local services for human trafficking survivors. Operated by the Canadian Centre to End Human Trafficking.', 'National (serves Alberta)', 'https://www.canadiancentretoendhumantrafficking.ca', '1-833-900-1010', '["human trafficking", "hotline", "24/7", "crisis", "multilingual"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2J: Chronic Pain Management (4 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('calgary-chronic-pain-centre', 'Calgary Chronic Pain Centre', 'Chronic Pain Management', 'AHS multidisciplinary chronic pain program offering medical management, physiotherapy, psychology, occupational therapy, group programs, and self-management education. Physician referral required.', 'Calgary', 'https://www.albertahealthservices.ca', NULL, '["chronic pain", "multidisciplinary", "physiotherapy", "psychology", "AHS", "calgary"]', 80, true),

('edmonton-multidisciplinary-pain-centre', 'Edmonton Multidisciplinary Pain Centre', 'Chronic Pain Management', 'AHS chronic pain program at the University of Alberta Hospital providing comprehensive pain assessment, medication management, physiotherapy, and cognitive behavioral therapy.', 'Edmonton (University of Alberta Hospital)', 'https://www.albertahealthservices.ca', NULL, '["chronic pain", "multidisciplinary", "CBT", "AHS", "edmonton"]', 80, true),

('pain-society-of-alberta', 'Pain Society of Alberta', 'Chronic Pain Management', 'Provincial professional organization promoting chronic pain education, research, and advocacy. Provides patient resources, physician directories, and hosts conferences on pain management.', 'Alberta (province-wide)', 'https://www.painsocietyofalberta.ca', NULL, '["chronic pain", "education", "research", "patient resources", "province-wide"]', 70, true),

('ahs-alberta-pain-strategy', 'AHS Alberta Pain Strategy', 'Chronic Pain Management', 'AHS strategic initiative improving chronic pain care across Alberta through community-based pain programs, primary care pain supports, and reduced reliance on opioids. Non-opioid treatment options.', 'Alberta (province-wide)', 'https://www.albertahealthservices.ca', NULL, '["chronic pain", "non-opioid", "community-based", "AHS", "province-wide"]', 70, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2K: Child Welfare / Aging Out of Care (6 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('office-child-youth-advocate', 'Office of the Child and Youth Advocate (OCYA)', 'Child Welfare & Aging Out of Care', 'Independent office of the Alberta Legislature that investigates complaints about child intervention services, advocates for children and youth in care, and makes systemic recommendations to improve outcomes.', 'Edmonton & Calgary', 'https://www.ocya.alberta.ca', '1-800-661-3446', '["child welfare", "advocacy", "complaints", "youth in care", "government"]', 80, true),

('advancing-futures-bursary', 'Advancing Futures Bursary', 'Child Welfare & Aging Out of Care', 'Post-secondary bursary and support program for youth who were in government care. Covers tuition, living expenses, and provides mentorship and academic support to help former youth in care succeed.', 'Alberta (province-wide)', 'https://www.alberta.ca/advancing-futures', NULL, '["youth in care", "education", "bursary", "post-secondary", "province-wide"]', 80, true),

('youth-aging-out-transition-program', 'Youth Aging Out of Care - Transition to Adulthood', 'Child Welfare & Aging Out of Care', 'Government of Alberta supports for youth leaving care at age 18. Includes financial benefits, housing support, education funding, and life skills programming through the Support and Financial Assistance Agreements (SFAA).', 'Alberta (province-wide)', 'https://www.alberta.ca/support-for-youth-aging-out-of-care', NULL, '["youth in care", "transition", "18+", "financial", "housing", "life skills"]', 80, true),

('align-association-community-services', 'Align Association of Community Services', 'Child Welfare & Aging Out of Care', 'Provincial association of child and family service agencies providing advocacy, training, research, and coordination for organizations serving children and youth in care across Alberta.', 'Edmonton (province-wide)', 'https://www.alignab.ca', NULL, '["child welfare", "advocacy", "training", "family services", "province-wide"]', 70, true),

('parachutes-for-parents', 'Parachutes for Parents', 'Child Welfare & Aging Out of Care', 'Support for kinship and foster caregivers navigating the child welfare system. Offers peer support, information sessions, advocacy, and help understanding caregivers'' rights and responsibilities.', 'Calgary', 'https://www.parachutesforparents.com', NULL, '["kinship care", "foster care", "caregiver support", "advocacy", "calgary"]', 70, true),

('kinship-care-alberta', 'Kinship Care Alberta', 'Child Welfare & Aging Out of Care', 'Government program supporting relatives and close family friends caring for children who cannot live with their parents. Provides financial supports, respite care, and navigation services.', 'Alberta (province-wide)', 'https://www.alberta.ca/kinship-care', NULL, '["kinship care", "financial support", "respite", "family", "government", "province-wide"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2L: Affordable Housing (7 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('capital-region-housing-edmonton', 'Capital Region Housing', 'Affordable Housing', 'Manages 4,500+ affordable and subsidized housing units in the Edmonton area. Programs include community housing, rent supplements, and near-market rental programs for low-income individuals and families.', 'Edmonton', 'https://www.crhc.ca', '780-420-6161', '["housing", "affordable", "subsidized", "rent supplement", "edmonton"]', 80, true),

('calgary-housing-company', 'Calgary Housing Company', 'Affordable Housing', 'Calgary''s largest residential landlord managing 10,000+ affordable housing units including subsidized housing, community housing, and rent supplement programs for low-income Calgarians.', 'Calgary', 'https://www.calgaryhousingcompany.org', '403-265-3350', '["housing", "affordable", "subsidized", "rent supplement", "calgary"]', 80, true),

('habitat-for-humanity-southern-alberta', 'Habitat for Humanity Southern Alberta', 'Affordable Housing', 'Builds affordable homes for qualifying families through volunteer labour and donations. Homeowners contribute sweat equity and pay affordable mortgages. Serving Calgary and southern Alberta.', 'Calgary / Southern Alberta', 'https://www.habitatsouthernalberta.ca', NULL, '["housing", "affordable", "home ownership", "volunteer", "calgary"]', 80, true),

('habitat-for-humanity-edmonton', 'Habitat for Humanity Edmonton', 'Affordable Housing', 'Builds affordable homes in the Edmonton area. Partner families earn home ownership through volunteer hours, financial literacy training, and affordable mortgage payments.', 'Edmonton', 'https://www.hfrp.ca', NULL, '["housing", "affordable", "home ownership", "volunteer", "edmonton"]', 70, true),

('alberta-rent-supplement-program', 'Alberta Rent Supplement Program', 'Affordable Housing', 'Provincial rent assistance for low-income Albertans. Supplements paid directly to landlords to bridge the gap between market rent and what tenants can afford. Apply through local housing management bodies.', 'Alberta (province-wide)', 'https://www.alberta.ca/rent-supplement', NULL, '["housing", "rent supplement", "affordable", "government", "province-wide"]', 80, true),

('homespace-society-calgary', 'HomeSpace Society', 'Affordable Housing', 'Non-profit housing developer and operator in Calgary that builds and manages permanent affordable rental housing for individuals and families with low incomes.', 'Calgary', 'https://www.homespace.org', NULL, '["housing", "affordable", "rental", "non-profit", "calgary"]', 70, true),

('silvera-for-seniors', 'Silvera for Seniors', 'Affordable Housing', 'Affordable and supportive housing for seniors in Calgary with 26 communities offering independent living, lodge programs, and enhanced care at subsidized rates.', 'Calgary (26 communities)', 'https://www.silvera.ca', '403-567-5301', '["housing", "affordable", "seniors", "independent living", "calgary"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 2M: Pet/Animal Assistance (5 new)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('aarcs-pet-food-bank', 'AARCS Pet Food Bank', 'Pet & Animal Assistance', 'Alberta Animal Rescue Crew Society distributes pet food and supplies to low-income families to help keep pets with their owners. Also operates animal rescue and adoption programs.', 'Calgary (province-wide)', 'https://www.aarcs.ca', NULL, '["pets", "food bank", "animal", "low-income", "calgary"]', 70, true),

('calgary-humane-society-community', 'Calgary Humane Society - Community Support', 'Pet & Animal Assistance', 'Beyond adoption — offers subsidized veterinary care, pet food assistance, and outreach programs for pet owners facing financial hardship or crisis situations.', 'Calgary', 'https://www.calgaryhumane.ca', NULL, '["pets", "veterinary", "subsidized", "pet food", "crisis", "calgary"]', 70, true),

('edmonton-humane-society-community', 'Edmonton Humane Society - Community Programs', 'Pet & Animal Assistance', 'Animal welfare organization with community programs including low-cost spay/neuter, pet food bank, and temporary pet fostering for people in crisis (e.g., fleeing domestic violence).', 'Edmonton', 'https://www.edmontonhumanesociety.com', NULL, '["pets", "spay neuter", "pet food", "crisis fostering", "domestic violence", "edmonton"]', 70, true),

('alberta-spca-crisis', 'Alberta SPCA - Emergency Pet Services', 'Pet & Animal Assistance', 'Provincial animal welfare organization providing emergency boarding for pets of people in crisis, animal cruelty investigations, and educational programs across Alberta.', 'Alberta (province-wide)', 'https://www.albertaspca.org', NULL, '["pets", "emergency boarding", "animal welfare", "crisis", "province-wide"]', 70, true),

('paaw-foundation-calgary', 'PAAW Foundation', 'Pet & Animal Assistance', 'Provides emergency pet food, supplies, and veterinary care for families in crisis. Partners with shelters and social agencies to ensure people don''t have to surrender pets due to financial hardship.', 'Calgary', 'https://www.paawfoundation.com', NULL, '["pets", "emergency", "food", "veterinary", "crisis", "calgary"]', 70, true)

ON CONFLICT (service_id) DO NOTHING;

-- ============================================================
-- PART 3: Recovery Communities (rural Alberta)
-- ============================================================

INSERT INTO services (service_id, name, category, description, location, website_url, phone, tags, confidence_score, is_active)
VALUES
('lakeview-recovery-community-gunn', 'Lakeview Recovery Community', 'Residential Treatment', 'Recovery Alberta recovery community providing long-term addiction treatment beds, counselling, and support programs in a residential setting. Part of Alberta''s $350M investment in recovery communities.', 'Gunn, AB', 'https://www.alberta.ca/recovery-communities', NULL, '["recovery", "residential", "addiction", "rural", "recovery community"]', 80, true),

('ehn-red-deer-recovery-community', 'EHN Red Deer Recovery Community', 'Residential Treatment', 'Recovery community in Red Deer providing addiction treatment and recovery support as part of Alberta''s provincial recovery community initiative.', 'Red Deer', 'https://www.edgewoodhealthnetwork.com/locations/red-deer-recovery-community/', NULL, '["recovery", "residential", "addiction", "red deer", "recovery community"]', 80, true)

ON CONFLICT (service_id) DO NOTHING;

COMMIT;
