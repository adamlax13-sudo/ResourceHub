"""
Comprehensive Alberta Mental Health & Social Services Reference Database.
Parsed from ALBERTA_SERVICES_REFERENCE in server/routes.ts
"""
from typing import List, Dict


def load_alberta_services() -> List[Dict]:
    """
    Load all Alberta mental health and social services.

    Returns:
        List of service dictionaries with structured information
    """
    services = []

    # ==================== IMPORTANT NUMBERS & 24/7 CRISIS LINES ====================
    crisis_services = [
        {
            'name': '211 Alberta',
            'category': '24/7 Crisis Lines',
            'contact': 'Dial 211, ab.211.ca',
            'description': '24/7 info on housing, food, mental health with language support',
            'process': ['Dial 211 from any phone', 'Explain what kind of help you need', 'Receive referrals to appropriate services'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone in Alberta needing information or referrals',
            'hours_of_operation': '24/7'
        },
        {
            'name': '311 Calgary',
            'category': '24/7 Crisis Lines',
            'contact': 'Dial 311',
            'description': 'City services info with translation',
            'process': ['Dial 311', 'Describe the city service you need', 'Get connected to the right department'],
            'waitTimes': 'Immediate',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone in Calgary',
            'hours_of_operation': '24/7'
        },
        {
            'name': '811 Health Link',
            'category': '24/7 Crisis Lines',
            'contact': 'Dial 811',
            'description': '24/7 health advice from nurses',
            'process': ['Dial 811', 'Speak with registered nurse', 'Receive health advice or referral'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone in Alberta needing health advice',
            'hours_of_operation': '24/7'
        },
        {
            'name': '988 Suicide Crisis Helpline',
            'category': '24/7 Crisis Lines',
            'contact': 'Call or text 988, 988.ca',
            'description': '24/7 national suicide prevention',
            'process': ['Call or text 988', 'Connect with trained crisis counselor', 'Share what you are experiencing', 'Receive immediate support and safety planning'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Canada-wide (available in Alberta)',
            'eligibility': 'Anyone experiencing suicidal thoughts or emotional distress',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Mental Health Help Line',
            'category': '24/7 Crisis Lines',
            'contact': '1-877-303-2642',
            'description': '24/7 crisis intervention, confidential',
            'process': ['Call 1-877-303-2642', 'Speak with crisis counselor', 'Describe your situation', 'Receive immediate support'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone experiencing a mental health crisis',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Addiction Helpline',
            'category': '24/7 Crisis Lines',
            'contact': '1-866-332-2322',
            'description': '24/7 confidential addiction support',
            'process': ['Call 1-866-332-2322', 'Speak with addiction counselor', 'Discuss your needs', 'Receive referrals to treatment'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone seeking addiction support',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Recovery Alberta Help Line',
            'category': '24/7 Crisis Lines',
            'contact': '1-888-594-0211',
            'description': '24/7 provincial addiction support',
            'process': ['Call 1-888-594-0211', 'Connect with recovery specialist', 'Get matched to treatment programs'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone seeking addiction recovery support',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Distress Centre Calgary',
            'category': '24/7 Crisis Lines',
            'contact': '403-266-4357, distresscentre.com',
            'description': '24/7 phone, text, in-person crisis counselling',
            'process': ['Call 403-266-4357 or text', 'Speak with trained volunteer', 'Receive crisis support', 'Get connected to resources'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone in crisis',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Distress Line Edmonton',
            'category': '24/7 Crisis Lines',
            'contact': '780-482-HELP (4357)',
            'description': '24/7 crisis support',
            'process': ['Call 780-482-4357', 'Speak with crisis support worker', 'Receive emotional support'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone in crisis',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'ConnecTeen Calgary',
            'category': '24/7 Crisis Lines',
            'contact': '403-264-8336, text 587-333-2724, calgaryconnecteen.com',
            'description': 'Youth peer support',
            'process': ['Call 403-264-8336 or text 587-333-2724', 'Connect with peer volunteer', 'Share what you are going through', 'Receive support and resources'],
            'waitTimes': 'Immediate availability',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Youth and young adults',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Kids Help Phone',
            'category': '24/7 Crisis Lines',
            'contact': '1-800-668-6868, text CONNECT to 686868, kidshelpphone.ca',
            'description': '24/7 for youth',
            'process': ['Call 1-800-668-6868 or text CONNECT to 686868', 'Connect with counselor', 'Discuss your concerns', 'Receive immediate support'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Canada-wide',
            'eligibility': 'Children and youth up to age 25',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Hope for Wellness Helpline',
            'category': '24/7 Crisis Lines',
            'contact': '1-855-242-3310, hopeforwellness.ca',
            'description': '24/7 Indigenous support in Cree, Ojibway, Inuktitut, English, French',
            'process': ['Call 1-855-242-3310', 'Choose your language', 'Connect with culturally-informed counselor', 'Receive support'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Canada-wide',
            'eligibility': 'Indigenous peoples',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Indigenous Support Line (AHS)',
            'category': '24/7 Crisis Lines',
            'contact': '1-844-944-4744',
            'description': 'Mon-Fri 10am-6pm culturally safe support',
            'process': ['Call 1-844-944-4744', 'Connect with Indigenous support worker', 'Receive culturally appropriate support'],
            'waitTimes': 'Same-day availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Indigenous peoples',
            'hours_of_operation': 'Mon-Fri 10am-6pm'
        },
        {
            'name': 'Talk Suicide Canada',
            'category': '24/7 Crisis Lines',
            'contact': '1-833-456-4566, talksuicide.ca',
            'description': '24/7 crisis support',
            'process': ['Call 1-833-456-4566', 'Connect with crisis responder', 'Receive immediate support'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Canada-wide',
            'eligibility': 'Anyone experiencing suicidal thoughts',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Family Violence Info Line',
            'category': '24/7 Crisis Lines',
            'contact': '310-1818',
            'description': '24/7 in 170+ languages',
            'process': ['Dial 310-1818', 'Request interpreter if needed', 'Receive crisis support and referrals'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone experiencing family violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Domestic Violence Hotline Calgary',
            'category': '24/7 Crisis Lines',
            'contact': '403-234-7233 (SAFE), fearisnotlove.ca',
            'description': '24/7 counselling, shelter intake',
            'process': ['Call 403-234-7233', 'Speak with crisis counselor', 'Receive safety planning', 'Get connected to shelter if needed'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone experiencing domestic violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Elder Abuse Resource Team',
            'category': '24/7 Crisis Lines',
            'contact': '403-705-3250',
            'description': 'Confidential reporting',
            'process': ['Call 403-705-3250', 'Report suspected elder abuse', 'Receive support and referrals'],
            'waitTimes': 'Same-day response',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Seniors and concerned parties',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Emergency Financial Assistance',
            'category': '24/7 Crisis Lines',
            'contact': '1-877-644-9992, alberta.ca/emergency-financial-assistance',
            'description': 'Provincial emergency financial support',
            'process': ['Call 1-877-644-9992 or apply online', 'Complete application', 'Provide documentation', 'Receive emergency funds'],
            'waitTimes': '1-3 business days',
            'requiredDocs': ['ID', 'Proof of emergency need', 'Income information'],
            'location': 'Alberta-wide',
            'eligibility': 'Alberta residents in financial crisis',
            'hours_of_operation': 'Mon-Fri 8:15am-4:30pm'
        },
        {
            'name': 'Calgary Police Non-Emergency',
            'category': '24/7 Crisis Lines',
            'contact': '403-266-1234',
            'description': 'Non-emergency police assistance',
            'process': ['Call 403-266-1234', 'Describe the situation', 'Receive appropriate police response'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone needing police assistance',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Access 24/7 Edmonton',
            'category': '24/7 Crisis Lines',
            'contact': '780-424-2424',
            'description': 'Adult intake services',
            'process': ['Call 780-424-2424', 'Speak with intake worker', 'Complete assessment', 'Receive referrals'],
            'waitTimes': 'Same-day appointments available',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Edmonton - 13211 Fort Rd NW',
            'eligibility': 'Adults 18+ needing mental health or addiction services',
            'hours_of_operation': '8am-10pm daily'
        },
        {
            'name': 'Virtual Opioid Dependency Program (VODP)',
            'category': '24/7 Crisis Lines',
            'contact': '1-844-383-7688, vodp.ca',
            'description': 'Same-day OAT access',
            'process': ['Call 1-844-383-7688 or visit vodp.ca', 'Complete phone assessment', 'Get same-day prescription', 'Receive ongoing virtual support'],
            'waitTimes': 'Same-day access',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Alberta-wide (virtual)',
            'eligibility': 'Alberta residents with opioid dependency',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'ECMHS Crisis Counselling Line',
            'category': '24/7 Crisis Lines',
            'contact': '403-299-9699',
            'description': 'Multilingual family & youth crisis Calgary',
            'process': ['Call 403-299-9699', 'Request interpreter if needed', 'Speak with crisis counselor', 'Receive support and referrals'],
            'waitTimes': 'Immediate availability',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Families and youth in crisis',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Protection for Persons in Care',
            'category': '24/7 Crisis Lines',
            'contact': '1-888-357-9339',
            'description': 'Report abuse in care facilities',
            'process': ['Call 1-888-357-9339', 'Report suspected abuse', 'Provide details', 'Investigation initiated'],
            'waitTimes': 'Immediate response',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone concerned about care facility abuse',
            'hours_of_operation': 'Business hours with emergency callback'
        },
    ]
    services.extend(crisis_services)

    # ==================== CALGARY MENTAL HEALTH URGENT CARE CENTRES ====================
    calgary_urgent_care = [
        {
            'name': 'Sheldon M. Chumir Health Centre',
            'category': 'Calgary Mental Health Urgent Care',
            'contact': '1213 4 St SW, Calgary',
            'description': '24/7 walk-in mental health all ages',
            'process': ['Walk in to 1213 4 St SW', 'Check in at reception', 'Complete brief assessment', 'See mental health professional', 'Receive care and follow-up plan'],
            'waitTimes': 'Variable, typically 1-3 hours',
            'requiredDocs': ['Alberta Health Care card (recommended)', 'ID'],
            'location': 'Calgary - 1213 4 St SW',
            'eligibility': 'All ages, no referral needed',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'South Calgary Health Centre',
            'category': 'Calgary Mental Health Urgent Care',
            'contact': '31 Sunpark Plaza SE',
            'description': 'Daily 12-8:15pm, walk-in assessments',
            'process': ['Walk in during operating hours', 'Register at front desk', 'Complete assessment', 'Receive mental health care'],
            'waitTimes': '1-2 hours typical',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 31 Sunpark Plaza SE',
            'eligibility': 'All ages, no referral needed',
            'hours_of_operation': 'Daily 12-8:15pm'
        },
        {
            'name': 'Airdrie Mental Health Urgent Care',
            'category': 'Calgary Mental Health Urgent Care',
            'contact': '604 Main St S, Airdrie',
            'description': 'Mon-Fri 2:30-9pm, Weekends 10am-5pm',
            'process': ['Walk in during hours', 'Complete intake', 'See clinician', 'Receive treatment plan'],
            'waitTimes': '1-2 hours',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Airdrie - 604 Main St S',
            'eligibility': 'All ages, no referral needed',
            'hours_of_operation': 'Mon-Fri 2:30-9pm, Weekends 10am-5pm'
        },
        {
            'name': 'Banff Mental Health Urgent Care',
            'category': 'Calgary Mental Health Urgent Care',
            'contact': '305 Lynx St, Banff',
            'description': 'Daily 2-9pm',
            'process': ['Walk in during hours', 'Complete intake', 'See mental health professional'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Banff - 305 Lynx St',
            'eligibility': 'All ages, no referral needed',
            'hours_of_operation': 'Daily 2-9pm'
        },
        {
            'name': 'Canmore Urgent Mental Health',
            'category': 'Calgary Mental Health Urgent Care',
            'contact': '1100 Hospital Pl, Canmore',
            'description': 'Daily 2-9pm',
            'process': ['Walk in during hours', 'Register', 'Complete assessment', 'Receive care'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Canmore - 1100 Hospital Pl',
            'eligibility': 'All ages, no referral needed',
            'hours_of_operation': 'Daily 2-9pm'
        },
        {
            'name': 'Cochrane Mental Health Urgent Care',
            'category': 'Calgary Mental Health Urgent Care',
            'contact': '60 Grand Blvd, Cochrane',
            'description': 'Mon-Fri 12-7pm, Weekends 10am-5pm',
            'process': ['Walk in during hours', 'Check in', 'See clinician', 'Receive treatment'],
            'waitTimes': '1-2 hours typical',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Cochrane - 60 Grand Blvd',
            'eligibility': 'All ages, no referral needed',
            'hours_of_operation': 'Mon-Fri 12-7pm, Weekends 10am-5pm'
        },
        {
            'name': 'Okotoks Mental Health Urgent Care',
            'category': 'Calgary Mental Health Urgent Care',
            'contact': '11 Cimarron Common, Okotoks',
            'description': 'Daily 10am-6pm',
            'process': ['Walk in during hours', 'Register at desk', 'Complete assessment', 'See professional'],
            'waitTimes': '1-2 hours',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Okotoks - 11 Cimarron Common',
            'eligibility': 'All ages, no referral needed',
            'hours_of_operation': 'Daily 10am-6pm'
        },
    ]
    services.extend(calgary_urgent_care)

    # ==================== CALGARY MENTAL HEALTH & ADDICTION SERVICES ====================
    calgary_mh_addiction = [
        {
            'name': 'Access Mental Health Calgary',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '403-943-1500',
            'description': 'Free, no referral needed, Mon-Fri 8am-5pm',
            'process': ['Call 403-943-1500', 'Speak with intake coordinator', 'Complete phone assessment', 'Receive referral to appropriate service', 'Book first appointment'],
            'waitTimes': 'Initial call same-day, appointments vary',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary-wide services',
            'eligibility': 'Calgary residents, all ages, no referral required',
            'hours_of_operation': 'Mon-Fri 8am-5pm'
        },
        {
            'name': 'Alpha House Society Calgary',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '203-15 Ave SE, 403-234-7388, alphahousecalgary.com',
            'description': '24/7 emergency shelter (120+ beds), detox (42 beds), housing programs, DOAP Team outreach',
            'process': ['Walk in to 203-15 Ave SE or call 403-234-7388', 'Speak with intake worker', 'Complete assessment', 'Receive appropriate service'],
            'waitTimes': 'Emergency shelter: immediate. Detox: may have wait',
            'requiredDocs': ['ID helpful but not required for emergency services'],
            'location': 'Calgary - 203-15 Ave SE',
            'eligibility': 'Adults experiencing homelessness or addiction issues',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Alpha House Detox',
            'category': 'Calgary Mental Health & Addiction',
            'contact': 'detox@alphahousecalgary.com, 403-234-7388',
            'description': 'Medically supervised withdrawal, 30 active beds + 12 transitional',
            'process': ['Call 403-234-7388 or email detox@alphahousecalgary.com', 'Complete phone screening', 'Arrange admission', 'Begin medically supervised detox'],
            'waitTimes': 'Depends on bed availability, typically same-week',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 203-15 Ave SE',
            'eligibility': 'Adults requiring supervised detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'CMHA Calgary',
            'category': 'Calgary Mental Health & Addiction',
            'contact': 'cmha.calgary.ab.ca, 403-297-1402',
            'description': 'Mental health education, support, advocacy',
            'process': ['Call 403-297-1402 or visit website', 'Inquire about programs', 'Register for services', 'Access support programs'],
            'waitTimes': 'Varies by program',
            'requiredDocs': [],
            'location': 'Calgary - multiple locations',
            'eligibility': 'Anyone interested in mental health support',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Recovery College Calgary (CMHA)',
            'category': 'Calgary Mental Health & Addiction',
            'contact': 'recoverycollegecalgary.ca, 403-297-1402',
            'description': 'FREE courses on mental health & recovery, peer-led, ages 16+, no referral, drop-ins Wed',
            'process': ['Visit recoverycollegecalgary.ca', 'Browse course catalog', 'Register for courses (free)', 'Attend classes'],
            'waitTimes': 'No waitlist - register online',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Ages 16+, anyone interested in mental health education',
            'hours_of_operation': 'Varies by course, drop-in Wed'
        },
        {
            'name': 'Calgary Counselling Centre',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '403-265-4980, calgarycounselling.com',
            'description': 'Sliding scale, no waitlist',
            'process': ['Call 403-265-4980 or visit calgarycounselling.com', 'Complete intake form', 'Discuss sliding scale fees', 'Schedule first appointment'],
            'waitTimes': 'No waitlist - appointments available quickly',
            'requiredDocs': ['Proof of income for sliding scale'],
            'location': 'Calgary - multiple locations',
            'eligibility': 'Anyone needing counselling',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Rapid Access Addiction Medicine (RAAM)',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '707 10 Ave SW, Calgary',
            'description': 'Walk-in urgent addiction care',
            'process': ['Walk in to 707 10 Ave SW', 'Complete intake', 'See addiction medicine specialist', 'Begin treatment same-day'],
            'waitTimes': 'Same-day access',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 707 10 Ave SW',
            'eligibility': 'Adults with addiction concerns',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'AHS Opioid Dependency Program',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '1213 4 St SW, 403-955-3600',
            'description': 'OAT, counselling, harm reduction',
            'process': ['Call 403-955-3600', 'Complete assessment', 'Begin OAT treatment', 'Attend counselling sessions'],
            'waitTimes': 'Typically within 1 week',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 1213 4 St SW',
            'eligibility': 'Adults with opioid dependency',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Renfrew Recovery Centre (Adult Detox)',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '1611 Remington Rd NE, 403-297-3337',
            'description': '24/7 supervised detox',
            'process': ['Call 403-297-3337', 'Complete phone assessment', 'Arrange admission', 'Begin supervised detox'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 1611 Remington Rd NE',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Calgary Dream Centre',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '403-243-5598, calgarydreamcentre.com',
            'description': '90-day mens residential, Indigenous stream, transitional housing',
            'process': ['Call 403-243-5598', 'Complete intake interview', 'Submit to admission process', 'Begin 90-day program'],
            'waitTimes': 'Waitlist varies, typically 2-4 weeks',
            'requiredDocs': ['ID', 'Criminal record check may be required'],
            'location': 'Calgary',
            'eligibility': 'Men 18+ committed to recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Calgary Drop-In Centre - Withdrawal Management',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '1 Dermot Baldwin Way SE, 403-266-3600, calgarydropin.ca',
            'description': '24/7 withdrawal management and detox services with housing support',
            'service_type': 'addiction_recovery',
            'process': ['Walk in to 1 Dermot Baldwin Way SE', 'Check in at front desk', 'Access shelter, meals, or withdrawal management', 'Connect with support services'],
            'waitTimes': 'Immediate access',
            'requiredDocs': [],
            'location': 'Calgary - 1 Dermot Baldwin Way SE',
            'eligibility': 'Anyone experiencing homelessness',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'The Alex Community Health Centre',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '4920 17 Ave SE, 403-266-2622, thealex.ca',
            'description': 'Drop-in peer advocacy, food centre, health care',
            'process': ['Walk in to 4920 17 Ave SE', 'Access drop-in services', 'See health care providers', 'Get peer advocacy support'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - 4920 17 Ave SE',
            'eligibility': 'Low-income individuals and families',
            'hours_of_operation': 'Business hours with extended clinic hours'
        },
        {
            'name': 'Woods Homes Calgary',
            'category': 'Calgary Mental Health & Addiction',
            'contact': 'woodshomes.ca',
            'description': 'Children, youth, families crisis services',
            'process': ['Call or visit woodshomes.ca', 'Complete intake', 'Access appropriate services', 'Begin treatment'],
            'waitTimes': 'Varies by service',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary - multiple locations',
            'eligibility': 'Children, youth, and families',
            'hours_of_operation': 'Varies by location'
        },
        {
            'name': 'Eastside Community Mental Health (Woods Homes)',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '#255, 495 36 St NE, Calgary',
            'description': 'Walk-in Tue 11-7, Thu 11-6, Sat 11-5',
            'process': ['Walk in during operating hours', 'Complete intake', 'See mental health professional', 'Receive treatment plan'],
            'waitTimes': '1-2 hours walk-in wait',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary - #255, 495 36 St NE',
            'eligibility': 'Children, youth, families',
            'hours_of_operation': 'Tue 11-7, Thu 11-6, Sat 11-5'
        },
        {
            'name': 'The Summit (Sinneave Centre)',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '403-955-5437, albertahealthservices.ca/summit',
            'description': 'Youth walk-in mental health',
            'process': ['Walk in or call 403-955-5437', 'Complete intake', 'See youth mental health specialist', 'Receive support and treatment'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary',
            'eligibility': 'Children and youth',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Hull Services Calgary',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '403-251-8000, hullservices.ca',
            'description': 'Youth recovery, PChAD, detox, crisis services',
            'process': ['Call 403-251-8000', 'Complete assessment', 'Access appropriate program', 'Begin treatment'],
            'waitTimes': 'Varies by program',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Youth and families',
            'hours_of_operation': '24/7 crisis line, programs vary'
        },
        {
            'name': 'YouthSMART',
            'category': 'Calgary Mental Health & Addiction',
            'contact': 'youthsmart.ca',
            'description': 'Mental health education, stigma reduction',
            'process': ['Visit youthsmart.ca', 'Access educational resources', 'Participate in programs'],
            'waitTimes': 'Self-paced online resources',
            'requiredDocs': [],
            'location': 'Alberta-wide (online)',
            'eligibility': 'Youth, educators, families',
            'hours_of_operation': 'Online access 24/7'
        },
        {
            'name': 'Community Connect YYC',
            'category': 'Calgary Mental Health & Addiction',
            'contact': 'communityconnectyyc.ca',
            'description': 'Affordable barrier-free counselling, interpreters',
            'process': ['Visit communityconnectyyc.ca', 'Complete online form', 'Get matched with counselor', 'Begin sessions (phone/online/in-person)'],
            'waitTimes': 'Typically within 2 weeks',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone needing affordable counselling',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'Carya Calgary',
            'category': 'Calgary Mental Health & Addiction',
            'contact': 'caryacalgary.ca',
            'description': 'Barrier-free programs, community support',
            'process': ['Visit caryacalgary.ca or call', 'Inquire about programs', 'Register for services', 'Access support'],
            'waitTimes': 'Varies by program',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'All ages, families',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'CUPS Calgary',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '403-221-8780',
            'description': 'Free health care and dental for low-income',
            'process': ['Call 403-221-8780', 'Complete intake', 'Book appointment', 'Access health and dental services'],
            'waitTimes': 'Varies by service',
            'requiredDocs': ['Alberta Health Care card', 'Proof of low income'],
            'location': 'Calgary',
            'eligibility': 'Low-income individuals and families',
            'hours_of_operation': 'Clinic hours vary'
        },
        {
            'name': 'Calgary Navigation and Support Centre',
            'category': 'Calgary Mental Health & Addiction',
            'contact': '428 9 Ave SE, 403-410-1167',
            'description': 'Multi-service hub (ID, mental health, housing)',
            'process': ['Walk in to 428 9 Ave SE', 'Meet with navigator', 'Access multiple services in one location', 'Receive support plan'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - 428 9 Ave SE',
            'eligibility': 'Anyone needing social services',
            'hours_of_operation': 'Business hours'
        },
    ]
    services.extend(calgary_mh_addiction)

    # ==================== CALGARY EMERGENCY SHELTERS & HOMELESS SERVICES ====================
    calgary_shelters = [
        {
            'name': 'Calgary Drop-In Centre - Emergency Shelter',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '1 Dermot Baldwin Way SE, 403-266-3600, calgarydropin.ca',
            'description': '24/7 low-barrier emergency shelter with 1000+ beds',
            'service_type': 'emergency_shelter',
            'process': ['Walk in to 1 Dermot Baldwin Way SE anytime', 'Check in at reception', 'Access shelter bed', 'Receive meals and support services', 'Connect with case management if desired'],
            'waitTimes': 'Immediate access, low-barrier',
            'requiredDocs': [],
            'location': 'Calgary - 1 Dermot Baldwin Way SE',
            'eligibility': 'Anyone experiencing homelessness',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Alpha House Shelter',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '203-15 Ave SE, 403-234-7388, alphahousecalgary.com',
            'description': 'Mens shelter with substance use support - men only',
            'process': ['Walk in to 203-15 Ave SE or call 403-234-7388', 'Speak with intake staff', 'Access shelter bed', 'Connect with substance use support services'],
            'waitTimes': 'Same-day access',
            'requiredDocs': [],
            'location': 'Calgary - 203-15 Ave SE',
            'eligibility': 'Men experiencing homelessness',
            'hours_of_operation': '24/7',
            'gender_restriction': 'men_only',
            'service_type': 'emergency_shelter'
        },
        {
            'name': 'Salvation Army Centre of Hope',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '420 9 Ave SE, 403-410-1111, salvationarmycalgary.org',
            'description': 'Mens emergency shelter - men only',
            'process': ['Walk in to 420 9 Ave SE', 'Complete intake', 'Receive shelter bed', 'Access meals and programs'],
            'waitTimes': 'Same-day access',
            'requiredDocs': [],
            'location': 'Calgary - 420 9 Ave SE',
            'eligibility': 'Men experiencing homelessness',
            'hours_of_operation': '24/7',
            'gender_restriction': 'men_only',
            'service_type': 'emergency_shelter'
        },
        {
            'name': 'Mustard Seed Foothills',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '7025 44 St SE, 403-723-9422',
            'description': 'Emergency shelter',
            'process': ['Walk in to 7025 44 St SE', 'Register at front desk', 'Access shelter services', 'Connect with support programs'],
            'waitTimes': 'Same-day access',
            'requiredDocs': [],
            'location': 'Calgary - 7025 44 St SE',
            'eligibility': 'Anyone experiencing homelessness',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Mustard Seed Womens',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '110 11 Ave SE, 587-447-1345',
            'description': 'Womens emergency shelter - women only',
            'process': ['Walk in to 110 11 Ave SE or call 587-447-1345', 'Complete intake', 'Access shelter bed', 'Receive support services'],
            'waitTimes': 'Same-day access',
            'requiredDocs': [],
            'location': 'Calgary - 110 11 Ave SE',
            'eligibility': 'Women experiencing homelessness',
            'hours_of_operation': '24/7',
            'gender_restriction': 'women_only',
            'service_type': 'emergency_shelter'
        },
        {
            'name': 'YW Calgary Emergency Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '1715 17 Ave SE, 403-705-0315',
            'description': 'Womens emergency shelter and crisis services',
            'process': ['Call 403-705-0315 or walk in to 1715 17 Ave SE', 'Speak with intake worker', 'Access emergency shelter', 'Receive crisis support'],
            'waitTimes': 'Immediate access',
            'requiredDocs': [],
            'location': 'Calgary - 1715 17 Ave SE',
            'eligibility': 'Women in crisis',
            'hours_of_operation': '24/7',
            'gender_restriction': 'women_only',
            'service_type': 'emergency_shelter'
        },
        {
            'name': 'Inn from the Cold',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '110 11 Ave SE, 403-263-8384, innfromthecold.org',
            'description': 'Family shelter',
            'process': ['Call 403-263-8384', 'Complete family intake assessment', 'Access family shelter space', 'Receive family support services'],
            'waitTimes': 'Depends on availability',
            'requiredDocs': [],
            'location': 'Calgary - 110 11 Ave SE',
            'eligibility': 'Families with children experiencing homelessness',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Trellis Society Avenue 15',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '938 15 Ave SW, 403-543-9651, growwithtrellis.ca',
            'description': 'Youth shelter 18-24, 2SLGBTQIA+',
            'process': ['Call 403-543-9651', 'Complete youth intake', 'Access youth shelter', 'Connect with support services'],
            'waitTimes': 'Same-day access if space available',
            'requiredDocs': [],
            'location': 'Calgary - 938 15 Ave SW',
            'eligibility': 'Youth 18-24, LGBTQ2S+ inclusive',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'HELP Team Calgary',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '403-998-7388',
            'description': 'Street-level outreach',
            'process': ['Call 403-998-7388', 'Request outreach support', 'Team provides street-level assistance', 'Get connected to services'],
            'waitTimes': 'Variable response time',
            'requiredDocs': [],
            'location': 'Calgary - mobile outreach',
            'eligibility': 'Anyone experiencing homelessness',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Calgary Homeless Foundation',
            'category': 'Calgary Emergency Shelters & Homeless Services',
            'contact': '403-237-6456, calgaryhomeless.com',
            'description': 'Extreme weather response, coordination',
            'process': ['Call 403-237-6456 or visit calgaryhomeless.com', 'Inquire about extreme weather response', 'Get connected to emergency shelter', 'Access coordinated services'],
            'waitTimes': 'Immediate during extreme weather',
            'requiredDocs': [],
            'location': 'Calgary-wide',
            'eligibility': 'Anyone experiencing homelessness',
            'hours_of_operation': 'Business hours, emergency response as needed'
        },
    ]
    services.extend(calgary_shelters)

    # ==================== CALGARY LOW-COST/SLIDING SCALE COUNSELLING ====================
    calgary_low_cost_counselling = [
        {
            'name': 'Calgary Counselling Centre',
            'category': 'Calgary Low-Cost/Sliding Scale Counselling',
            'contact': '403-265-4980, calgarycounselling.com',
            'description': 'Income-based sliding scale, no waitlist',
            'process': ['Call 403-265-4980 or visit calgarycounselling.com', 'Complete intake form', 'Discuss income for sliding scale fee', 'Schedule first counselling appointment', 'Begin therapy sessions'],
            'waitTimes': 'No waitlist - appointments available quickly',
            'requiredDocs': ['Proof of income for sliding scale'],
            'location': 'Calgary - multiple locations',
            'eligibility': 'Anyone needing counselling',
            'hours_of_operation': 'Extended hours including evenings'
        },
        {
            'name': 'Affordable Therapy Network',
            'category': 'Calgary Low-Cost/Sliding Scale Counselling',
            'contact': 'affordabletherapynetwork.com',
            'description': 'Low-cost therapist connections',
            'process': ['Visit affordabletherapynetwork.com', 'Browse available therapists', 'Contact therapist directly', 'Discuss fees and availability', 'Begin counselling'],
            'waitTimes': 'Varies by therapist',
            'requiredDocs': [],
            'location': 'Calgary-wide',
            'eligibility': 'Anyone seeking affordable therapy',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'Virtuous Circle Counselling',
            'category': 'Calgary Low-Cost/Sliding Scale Counselling',
            'contact': 'vccounselling.com',
            'description': 'Limited sliding scale spots',
            'process': ['Visit vccounselling.com', 'Inquire about sliding scale availability', 'Complete intake', 'Schedule appointment', 'Begin sessions'],
            'waitTimes': 'Depends on sliding scale spot availability',
            'requiredDocs': ['May require proof of income'],
            'location': 'Calgary',
            'eligibility': 'Limited sliding scale availability',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'Jade Counselling Services',
            'category': 'Calgary Low-Cost/Sliding Scale Counselling',
            'contact': 'jadecounsellingservices.com',
            'description': '$20-$50/session, no proof of income required',
            'process': ['Visit jadecounsellingservices.com', 'Complete online inquiry form', 'Schedule appointment', 'Pay $20-$50 per session', 'Begin counselling'],
            'waitTimes': 'Typically within 1-2 weeks',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone needing affordable counselling',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'Community Connect YYC',
            'category': 'Calgary Low-Cost/Sliding Scale Counselling',
            'contact': 'communityconnectyyc.ca',
            'description': 'Phone, online, or in-person, barrier-free',
            'process': ['Visit communityconnectyyc.ca', 'Complete online matching form', 'Get matched with counselor', 'Choose phone, online, or in-person', 'Begin sessions'],
            'waitTimes': 'Typically within 2 weeks',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Barrier-free access',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'The Mustard Seed Counselling',
            'category': 'Calgary Low-Cost/Sliding Scale Counselling',
            'contact': '587-393-4020, theseed.ca/cicmarlborough',
            'description': 'Free for adults',
            'process': ['Call 587-393-4020', 'Complete intake', 'Schedule free counselling session', 'Attend appointments', 'Access ongoing support'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary - Marlborough location',
            'eligibility': 'Adults',
            'hours_of_operation': 'Business hours'
        },
    ]
    services.extend(calgary_low_cost_counselling)

    # ==================== LICENSED RESIDENTIAL TREATMENT - CALGARY ====================
    licensed_residential_calgary = [
        {
            'name': 'Alpha House Detox & Transitional',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-234-7388, alphahousecalgary.com',
            'description': 'Licensed detox, transitional beds',
            'process': ['Call 403-234-7388', 'Complete phone assessment', 'Arrange admission to detox', 'Begin medically supervised withdrawal', 'Transition to ongoing support'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 203-15 Ave SE',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'AARC Adolescent Recovery Centre',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-253-5250, aarc.ab.ca',
            'description': 'Youth 12-step residential',
            'process': ['Call 403-253-5250', 'Complete youth assessment', 'Submit application', 'Begin 12-step residential program', 'Participate in recovery activities'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['ID', 'Medical information'],
            'location': 'Calgary',
            'eligibility': 'Youth with addiction issues',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Aventa Centre for Women (Mission)',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-245-9050, aventa.org',
            'description': 'Womens addiction treatment',
            'process': ['Call 403-245-9050', 'Complete intake assessment', 'Apply for program admission', 'Begin women-specific treatment', 'Receive trauma-informed care'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - Mission location',
            'eligibility': 'Women with addiction issues',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Aventa Centre for Women (Sunalta)',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-245-9050, aventa.org',
            'description': 'Long-term womens program',
            'process': ['Call 403-245-9050', 'Complete assessment', 'Apply for long-term program', 'Begin residential treatment', 'Participate in recovery programming'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - Sunalta location',
            'eligibility': 'Women seeking long-term treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Calgary Dream Centre Mens',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-243-5598, calgarydreamcentre.com',
            'description': '90-day mens residential',
            'process': ['Call 403-243-5598', 'Complete intake interview', 'Apply for 90-day program', 'Begin residential recovery', 'Participate in life skills and recovery programming'],
            'waitTimes': 'Typically 2-4 weeks waitlist',
            'requiredDocs': ['ID', 'Criminal record check may be required'],
            'location': 'Calgary',
            'eligibility': 'Men 18+ committed to recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Fresh Start Recovery Site 1',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-387-6266, freshstartrecovery.ca',
            'description': 'Licensed residential',
            'process': ['Call 403-387-6266', 'Complete assessment', 'Apply for admission', 'Begin residential program', 'Engage in recovery activities'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Adults seeking residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Hull Services Youth Recovery',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-251-8000, hullservices.ca',
            'description': 'Youth detox, PChAD, residential',
            'process': ['Call 403-251-8000', 'Complete youth assessment', 'Determine appropriate program', 'Begin treatment', 'Receive family support'],
            'waitTimes': 'Varies by program',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Youth and families',
            'hours_of_operation': '24/7 crisis, programs vary'
        },
        {
            'name': 'NAM Niwas 1-4',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '587-777-4722, namrecovery.com',
            'description': 'Holistic addiction/mental health recovery',
            'process': ['Call 587-777-4722', 'Complete holistic assessment', 'Apply for admission', 'Begin integrated treatment', 'Participate in wellness activities'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Adults seeking holistic recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Oxford House Foundation Calgary',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-214-2046, oxfordhouse.ca',
            'description': 'Acadia, Allandale, Arlington, Astoria houses',
            'process': ['Call 403-214-2046', 'Attend house interview', 'Complete orientation', 'Move into sober living house', 'Participate in house meetings and recovery'],
            'waitTimes': 'Depends on house availability',
            'requiredDocs': ['ID', 'Sobriety commitment'],
            'location': 'Calgary - multiple houses',
            'eligibility': 'Individuals in recovery seeking sober living',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Recovery Acres Calgary',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-245-1196, recoveryacres.org',
            'description': '1822/1835/1839 House residential recovery',
            'process': ['Call 403-245-1196', 'Complete intake assessment', 'Apply for house placement', 'Begin residential recovery', 'Engage in peer support'],
            'waitTimes': 'Variable',
            'requiredDocs': ['ID'],
            'location': 'Calgary - multiple houses',
            'eligibility': 'Men seeking residential recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Alcove Addiction Recovery for Women',
            'category': 'Licensed Residential Treatment - Calgary',
            'contact': '403-919-5715, alcoverecovery.ca',
            'description': 'Elderberry, Family Program',
            'process': ['Call 403-919-5715', 'Complete women-specific assessment', 'Apply for program', 'Begin residential treatment', 'Participate in family program if applicable'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Women seeking addiction recovery',
            'hours_of_operation': 'Residential program'
        },
    ]
    services.extend(licensed_residential_calgary)

    # ==================== INDIGENOUS SERVICES - CALGARY ====================
    indigenous_calgary = [
        {
            'name': 'Sunrise Healing Lodge Society',
            'category': 'Indigenous Services - Calgary',
            'contact': '403-261-7921, nass.ca',
            'description': 'Gender-inclusive addiction recovery, cultural healing',
            'process': ['Call 403-261-7921', 'Complete cultural intake', 'Apply for lodge program', 'Begin Indigenous-focused healing', 'Participate in ceremonies and cultural activities'],
            'waitTimes': 'Variable',
            'requiredDocs': ['ID', 'May require status card'],
            'location': 'Calgary',
            'eligibility': 'Indigenous peoples seeking culturally-grounded recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Miskanawah',
            'category': 'Indigenous Services - Calgary',
            'contact': '403-247-5003, miskanawah.ca',
            'description': 'Nanatawiho Kamik Healing Lodge, cultural support, recovery circles, youth, Elders, ceremonies',
            'process': ['Call 403-247-5003', 'Connect with Indigenous support worker', 'Access healing lodge or community programs', 'Participate in cultural ceremonies', 'Engage with Elders'],
            'waitTimes': 'Varies by service',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Indigenous peoples and families',
            'hours_of_operation': 'Business hours, programs vary'
        },
        {
            'name': 'Aboriginal Friendship Centre of Calgary (AFCC)',
            'category': 'Indigenous Services - Calgary',
            'contact': '403-270-7379, 101-427 51 Ave SE, afccalgary.org',
            'description': 'Referrals, Elders, youth wellness',
            'process': ['Walk in to 101-427 51 Ave SE or call 403-270-7379', 'Meet with staff for referrals', 'Access Elder support', 'Participate in youth wellness programs', 'Connect with community'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - 101-427 51 Ave SE',
            'eligibility': 'Indigenous peoples',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Niitoiyis Family Support Society',
            'category': 'Indigenous Services - Calgary',
            'contact': '403-531-1972/1976 (24hr), niitoiyis.com',
            'description': 'Crisis lines, housing, family addiction services',
            'process': ['Call 403-531-1972 or 403-531-1976 (24hr)', 'Speak with Indigenous support worker', 'Access crisis support or housing services', 'Receive family addiction support', 'Get connected to culturally appropriate resources'],
            'waitTimes': 'Immediate for crisis, varies for programs',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Indigenous families',
            'hours_of_operation': '24/7 crisis line, programs vary'
        },
        {
            'name': 'Calgary Indigenous Sharing Network',
            'category': 'Indigenous Services - Calgary',
            'contact': 'cisn.ca/calgary',
            'description': 'Peer support, healing circles',
            'process': ['Visit cisn.ca/calgary', 'Find healing circle times', 'Attend peer support meetings', 'Share in culturally safe space', 'Build community connections'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Indigenous peoples in recovery',
            'hours_of_operation': 'Meeting times vary'
        },
        {
            'name': 'Walking Eagle / New Beginnings (Indigenous AA)',
            'category': 'Indigenous Services - Calgary',
            'contact': 'calgaryaa.org',
            'description': 'Indigenous AA meetings',
            'process': ['Visit calgaryaa.org for meeting times', 'Attend Indigenous-focused AA meeting', 'Participate in 12-step program', 'Build peer support network'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Indigenous peoples seeking AA support',
            'hours_of_operation': 'Meeting times vary'
        },
        {
            'name': 'Native Network Family Centre',
            'category': 'Indigenous Services - Calgary',
            'contact': '19 Erin Woods Dr SE, 403-240-4642 ext 303',
            'description': 'Indigenous/Métis family advocacy',
            'process': ['Call 403-240-4642 ext 303', 'Connect with family advocate', 'Access cultural support', 'Receive family services', 'Participate in programs'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary - 19 Erin Woods Dr SE',
            'eligibility': 'Indigenous and Métis families',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'AHS Indigenous Mental Health Program',
            'category': 'Indigenous Services - Calgary',
            'contact': '403-955-6645',
            'description': 'Self-referral available',
            'process': ['Call 403-955-6645', 'Self-refer for Indigenous mental health services', 'Complete cultural assessment', 'Begin culturally-informed treatment', 'Access ongoing support'],
            'waitTimes': 'Varies',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary',
            'eligibility': 'Indigenous peoples seeking mental health support',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Alpha House Wellbriety',
            'category': 'Indigenous Services - Calgary',
            'contact': '403-234-7388',
            'description': 'Sweat Lodge, drumming, sharing circles, Elder access (50-60% Indigenous clients)',
            'process': ['Call 403-234-7388', 'Inquire about Wellbriety program', 'Participate in Sweat Lodge ceremonies', 'Attend drumming and sharing circles', 'Connect with Elders'],
            'waitTimes': 'Schedule varies',
            'requiredDocs': [],
            'location': 'Calgary - 203-15 Ave SE',
            'eligibility': 'Indigenous peoples, all welcome',
            'hours_of_operation': 'Program schedule varies'
        },
    ]
    services.extend(indigenous_calgary)

    # ==================== INDIGENOUS SERVICES - PROVINCIAL ====================
    indigenous_provincial = [
        {
            'name': 'Hope for Wellness Helpline',
            'category': 'Indigenous Services - Provincial',
            'contact': '1-855-242-3310, hopeforwellness.ca',
            'description': '24/7 in Cree, Ojibway, Inuktitut, English, French',
            'process': ['Call 1-855-242-3310', 'Choose your language (Cree, Ojibway, Inuktitut, English, French)', 'Connect with culturally-informed counselor', 'Receive immediate support', 'Get referrals to local resources'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Canada-wide',
            'eligibility': 'Indigenous peoples',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Indigenous Support Line (AHS)',
            'category': 'Indigenous Services - Provincial',
            'contact': '1-844-944-4744',
            'description': 'Mon-Fri 10am-6pm',
            'process': ['Call 1-844-944-4744', 'Connect with Indigenous support worker', 'Receive culturally appropriate support', 'Get referrals to services'],
            'waitTimes': 'Same-day availability during hours',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Indigenous peoples',
            'hours_of_operation': 'Mon-Fri 10am-6pm'
        },
        {
            'name': 'NNADAP Referral',
            'category': 'Indigenous Services - Provincial',
            'contact': '1-780-495-2345',
            'description': 'National Native Alcohol and Drug Abuse Program referrals',
            'process': ['Call 1-780-495-2345', 'Inquire about NNADAP programs', 'Receive referral information', 'Connect to appropriate treatment'],
            'waitTimes': 'Immediate referral information',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Indigenous peoples seeking addiction treatment',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Poundmakers Lodge Treatment Centres',
            'category': 'Indigenous Services - Provincial',
            'contact': '780-458-1884, 1-866-458-1884, St Albert',
            'description': '42-day & 90-day culturally grounded addiction treatment',
            'process': ['Call 780-458-1884 or 1-866-458-1884', 'Complete cultural intake assessment', 'Apply for 42-day or 90-day program', 'Begin Indigenous-focused residential treatment', 'Participate in ceremonies and cultural healing'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'St Albert',
            'eligibility': 'Indigenous peoples 18+',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Bonnyville Indian Metis Rehabilitation Center',
            'category': 'Indigenous Services - Provincial',
            'contact': '780-826-3328, bimrc.ca',
            'description': '42-day 12-step Indigenous traditions',
            'process': ['Call 780-826-3328', 'Complete intake assessment', 'Apply for 42-day program', 'Begin 12-step program with Indigenous traditions', 'Participate in cultural activities'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Bonnyville',
            'eligibility': 'Indigenous peoples seeking addiction treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Akokatssini Medical Detox (Brocket)',
            'category': 'Indigenous Services - Provincial',
            'contact': '403-849-7544, aakomkiyiihealthservices.com',
            'description': 'Aakom-kiyii Health Services',
            'process': ['Call 403-849-7544', 'Complete intake for Indigenous detox', 'Arrange admission', 'Begin medically supervised detox', 'Receive cultural support'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Brocket',
            'eligibility': 'Indigenous peoples requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Nightwind Treatment Centre (Athabasca)',
            'category': 'Indigenous Services - Provincial',
            'contact': '780-698-2595, nightwind.ca',
            'description': 'Stony Creek, Kihew House, GMT House',
            'process': ['Call 780-698-2595', 'Complete cultural assessment', 'Apply for residential program', 'Begin Indigenous-focused treatment', 'Participate in land-based healing'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Athabasca area',
            'eligibility': 'Indigenous peoples seeking treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Okisikow Iskwew Center',
            'category': 'Indigenous Services - Provincial',
            'contact': 'Indigenous womens recovery',
            'description': 'Indigenous womens recovery',
            'process': ['Contact for intake information', 'Complete women-specific assessment', 'Apply for program', 'Begin culturally-grounded healing', 'Participate in women-centered programming'],
            'waitTimes': 'Contact for information',
            'requiredDocs': ['Contact for requirements'],
            'location': 'Alberta',
            'eligibility': 'Indigenous women',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'Kainai Transition Centre Society',
            'category': 'Indigenous Services - Provincial',
            'contact': 'Kainaiwa Womens Wellness Lodge, 403-653-3946',
            'description': 'Womens wellness lodge',
            'process': ['Call 403-653-3946', 'Complete intake for women-specific program', 'Apply for wellness lodge', 'Begin cultural healing program', 'Engage in traditional wellness activities'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Contact for requirements'],
            'location': 'Blood Reserve',
            'eligibility': 'Indigenous women',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'Bringing the Spirit Home (BTSH)',
            'category': 'Indigenous Services - Provincial',
            'contact': 'Blood Tribe Department of Health',
            'description': 'Blood Tribe cultural healing program',
            'process': ['Contact Blood Tribe Department of Health', 'Inquire about BTSH program', 'Complete cultural intake', 'Begin healing journey', 'Access traditional supports'],
            'waitTimes': 'Contact for information',
            'requiredDocs': ['Contact for requirements'],
            'location': 'Blood Reserve',
            'eligibility': 'Blood Tribe members',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'Iikaisskini Indigenous Services Lethbridge',
            'category': 'Indigenous Services - Provincial',
            'contact': 'ulethbridge.ca/indigenous',
            'description': 'Land-based healing, Elder access',
            'process': ['Visit ulethbridge.ca/indigenous', 'Connect with Indigenous services', 'Access Elder support', 'Participate in land-based healing', 'Engage in cultural programming'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Lethbridge',
            'eligibility': 'Indigenous students and community',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Wellbriety Program Red Deer (Safe Harbour)',
            'category': 'Indigenous Services - Provincial',
            'contact': 'safeharboursociety.org',
            'description': 'Medicine wheel-based recovery',
            'process': ['Visit safeharboursociety.org or call', 'Inquire about Wellbriety program', 'Complete cultural intake', 'Begin medicine wheel-based healing', 'Participate in ceremonies'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Red Deer',
            'eligibility': 'Indigenous peoples seeking recovery',
            'hours_of_operation': 'Program schedule varies'
        },
        {
            'name': 'Aboriginal Counseling Services Association',
            'category': 'Indigenous Services - Provincial',
            'contact': '780-242-4357, aboriginalcounseling.com',
            'description': 'Indigenous counseling services',
            'process': ['Call 780-242-4357', 'Request culturally-informed counseling', 'Complete intake', 'Begin counseling sessions', 'Access ongoing support'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Indigenous peoples',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Métis Nation of Alberta Health',
            'category': 'Indigenous Services - Provincial',
            'contact': 'health@metis.org',
            'description': 'Up to 12 sessions, $225/session',
            'process': ['Email health@metis.org', 'Inquire about counseling benefits', 'Complete Métis Nation registration', 'Access up to 12 sessions', 'Receive $225 per session coverage'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Métis Nation membership'],
            'location': 'Alberta-wide',
            'eligibility': 'Métis Nation of Alberta members',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Jordans Principle',
            'category': 'Indigenous Services - Provincial',
            'contact': 'For First Nations children - Covers psychological care',
            'description': 'First Nations children health coverage',
            'process': ['Contact your First Nations health office', 'Inquire about Jordans Principle coverage', 'Submit application for psychological services', 'Receive approval', 'Access care'],
            'waitTimes': 'Application processing time varies',
            'requiredDocs': ['First Nations status', 'Service request documentation'],
            'location': 'Canada-wide',
            'eligibility': 'First Nations children',
            'hours_of_operation': 'Contact local office'
        },
    ]
    services.extend(indigenous_provincial)

    # ==================== EDMONTON SERVICES ====================
    edmonton_services = [
        {
            'name': 'Access 24/7 Edmonton',
            'category': 'Edmonton Services',
            'contact': '13211 Fort Rd NW, 780-424-2424',
            'description': 'Open 7 days 8am-10pm, one-stop adult intake',
            'process': ['Walk in to 13211 Fort Rd NW or call 780-424-2424', 'Complete intake assessment', 'Receive same-day mental health or addiction support', 'Get referrals to ongoing services', 'Book follow-up appointments'],
            'waitTimes': 'Same-day appointments available',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Edmonton - 13211 Fort Rd NW',
            'eligibility': 'Adults 18+ needing mental health or addiction services',
            'hours_of_operation': '7 days 8am-10pm'
        },
        {
            'name': 'CMHA Edmonton',
            'category': 'Edmonton Services',
            'contact': 'edmonton.cmha.ca',
            'description': 'Mental health programs, housing, peer support, Brite Line',
            'process': ['Visit edmonton.cmha.ca or call', 'Explore available programs', 'Register for services', 'Access peer support or housing programs', 'Connect with Brite Line for LGBTQ2S+ support'],
            'waitTimes': 'Varies by program',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone seeking mental health support',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Mobile Crisis Adults Edmonton',
            'category': 'Edmonton Services',
            'contact': '780-342-7777',
            'description': 'Adult mobile crisis response',
            'process': ['Call 780-342-7777', 'Describe crisis situation', 'Mobile team dispatched if appropriate', 'Receive on-site crisis support', 'Get connected to follow-up services'],
            'waitTimes': 'Variable response time',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Adults in mental health crisis',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Mobile Crisis Children Edmonton',
            'category': 'Edmonton Services',
            'contact': '780-413-4733',
            'description': 'Child and youth mobile crisis',
            'process': ['Call 780-413-4733', 'Describe youth crisis situation', 'Mobile team responds', 'Receive crisis intervention', 'Connect to appropriate services'],
            'waitTimes': 'Variable response time',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Children and youth in crisis',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'George Spady Society Detox',
            'category': 'Edmonton Services',
            'contact': '780-424-8335',
            'description': 'Medically supported detox 18+',
            'process': ['Call 780-424-8335', 'Complete phone screening', 'Arrange admission', 'Begin medically supported detox', 'Transition to ongoing treatment'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Edmonton',
            'eligibility': 'Adults 18+ requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Boyle Street Community Services',
            'category': 'Edmonton Services',
            'contact': '780-424-4106',
            'description': 'Harm reduction, wraparound addiction support',
            'process': ['Walk in or call 780-424-4106', 'Access harm reduction supplies', 'Connect with addiction support worker', 'Receive wraparound services', 'Access ongoing programs'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone needing harm reduction or addiction support',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Managed Alcohol Program',
            'category': 'Edmonton Services',
            'contact': '780-990-5912',
            'description': 'For those experiencing homelessness',
            'process': ['Call 780-990-5912', 'Complete assessment', 'Determine eligibility', 'Begin managed alcohol program', 'Receive housing and health support'],
            'waitTimes': 'Depends on space availability',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Individuals experiencing homelessness with alcohol dependency',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'Hope Mission Edmonton',
            'category': 'Edmonton Services',
            'contact': '780-422-2018',
            'description': 'Faith-based residential recovery, emergency shelter',
            'process': ['Call 780-422-2018 or walk in', 'Access emergency shelter or inquire about programs', 'Complete intake for residential recovery', 'Begin faith-based program', 'Participate in recovery activities'],
            'waitTimes': 'Shelter immediate, programs have waitlist',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Adults seeking faith-based recovery',
            'hours_of_operation': '24/7 shelter, programs vary'
        },
        {
            'name': 'Breakout Recovery Community',
            'category': 'Edmonton Services',
            'contact': '780-422-2018 x312',
            'description': 'Men 18-60',
            'process': ['Call 780-422-2018 x312', 'Complete intake assessment', 'Apply for mens program', 'Begin residential recovery', 'Participate in community activities'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['ID'],
            'location': 'Edmonton',
            'eligibility': 'Men 18-60 seeking recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Wellspring by Hope Mission',
            'category': 'Edmonton Services',
            'contact': '780-422-2018 x203',
            'description': 'Women 18+, 1-year program',
            'process': ['Call 780-422-2018 x203', 'Complete women-specific intake', 'Apply for 1-year program', 'Begin residential recovery', 'Engage in long-term healing'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['ID'],
            'location': 'Edmonton',
            'eligibility': 'Women 18+ seeking long-term recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Jellinek Society',
            'category': 'Edmonton Services',
            'contact': '780-488-1160',
            'description': 'Men 18+ alcoholism recovery',
            'process': ['Call 780-488-1160', 'Complete intake for alcoholism treatment', 'Apply for mens program', 'Begin residential recovery', 'Participate in recovery programming'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Edmonton',
            'eligibility': 'Men 18+ with alcoholism',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'McDougall House',
            'category': 'Edmonton Services',
            'contact': '780-426-1409',
            'description': 'Women 18+ residential treatment',
            'process': ['Call 780-426-1409', 'Complete womens intake assessment', 'Apply for residential program', 'Begin treatment', 'Access women-specific support'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Edmonton',
            'eligibility': 'Women 18+ seeking addiction treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Our House Edmonton',
            'category': 'Edmonton Services',
            'contact': '780-474-8945, ourhouseedmonton.com',
            'description': '1-year mens residential (one of few in Canada)',
            'process': ['Call 780-474-8945', 'Complete comprehensive assessment', 'Apply for 1-year program', 'Begin long-term residential recovery', 'Participate in intensive programming'],
            'waitTimes': 'Significant waitlist',
            'requiredDocs': ['Alberta Health Care card', 'ID', 'Criminal record check'],
            'location': 'Edmonton',
            'eligibility': 'Men seeking long-term intensive recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Recovery Acres Society',
            'category': 'Edmonton Services',
            'contact': '780-471-2996',
            'description': 'Men 16+ substance use recovery',
            'process': ['Call 780-471-2996', 'Complete intake', 'Apply for program', 'Begin residential recovery', 'Engage in peer support'],
            'waitTimes': 'Variable',
            'requiredDocs': ['ID'],
            'location': 'Edmonton',
            'eligibility': 'Men 16+ seeking recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Urban Manor Housing Society',
            'category': 'Edmonton Services',
            'contact': '780-425-5901',
            'description': 'Supportive housing for hard-to-house men',
            'process': ['Call 780-425-5901', 'Complete housing assessment', 'Apply for supportive housing', 'Move into supportive environment', 'Access ongoing support services'],
            'waitTimes': 'Depends on availability',
            'requiredDocs': ['ID'],
            'location': 'Edmonton',
            'eligibility': 'Hard-to-house men',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'YWCA Edmonton Counselling',
            'category': 'Edmonton Services',
            'contact': 'counselling@ywcaedm.org',
            'description': 'Sliding scale $5-$200/session',
            'process': ['Email counselling@ywcaedm.org', 'Inquire about sliding scale counselling', 'Complete intake', 'Discuss fee based on income', 'Schedule sessions'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Proof of income for sliding scale'],
            'location': 'Edmonton',
            'eligibility': 'Anyone needing affordable counselling',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'The Family Centre',
            'category': 'Edmonton Services',
            'contact': '780-423-2831',
            'description': 'First session free then sliding scale',
            'process': ['Call 780-423-2831', 'Book first free session', 'Complete intake', 'Discuss sliding scale fees for ongoing sessions', 'Begin counselling'],
            'waitTimes': 'Typically within 2 weeks',
            'requiredDocs': ['Proof of income for sliding scale'],
            'location': 'Edmonton',
            'eligibility': 'Individuals and families',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Pride Centre of Edmonton',
            'category': 'Edmonton Services',
            'contact': 'pridecentreofedmonton.ca',
            'description': 'LGBTQ2S+ resources, counselling',
            'process': ['Visit pridecentreofedmonton.ca or call', 'Access LGBTQ2S+ resources', 'Connect with counselling services', 'Participate in community programs', 'Find peer support'],
            'waitTimes': 'Varies by service',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'LGBTQ2S+ community',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'CASA Mental Health Edmonton',
            'category': 'Edmonton Services',
            'contact': 'casamentalhealth.org',
            'description': 'Children/youth, Indigenous programs, classroom support',
            'process': ['Visit casamentalhealth.org', 'Inquire about programs', 'Complete intake for child/youth', 'Access appropriate services', 'Receive classroom support if applicable'],
            'waitTimes': 'Varies by program',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Edmonton',
            'eligibility': 'Children, youth, and families',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'YESS',
            'category': 'Edmonton Services',
            'contact': 'yess.org',
            'description': 'Youth shelter, ages 15-24',
            'process': ['Visit yess.org or walk in', 'Complete youth intake', 'Access emergency shelter', 'Receive support services', 'Connect with housing programs'],
            'waitTimes': 'Immediate for emergency shelter',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Youth 15-24',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Henwood Treatment Centre',
            'category': 'Edmonton Services',
            'contact': '18750 18 St NW, Edmonton',
            'description': 'Adult residential treatment (AHS)',
            'process': ['Contact AHS for referral', 'Complete assessment', 'Apply for admission', 'Begin residential treatment', 'Participate in programming'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Edmonton - 18750 18 St NW',
            'eligibility': 'Adults requiring residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Edmonton Navigation and Support Centre',
            'category': 'Edmonton Services',
            'contact': 'Provincial referrals, multi-service hub',
            'description': 'Multi-service hub',
            'process': ['Walk in to Navigation Centre', 'Meet with navigator', 'Access multiple services in one location', 'Receive referrals', 'Get connected to supports'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone needing social services',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Edmontons Food Bank',
            'category': 'Edmonton Services',
            'contact': '11508 120 St NW, 780-425-4190',
            'description': '43,000+ people monthly, Beyond Food program',
            'process': ['Call 780-425-4190 or visit 11508 120 St NW', 'Register for food bank services', 'Receive monthly hamper', 'Access Beyond Food programs', 'Get additional support services'],
            'waitTimes': 'Registration same-day',
            'requiredDocs': ['ID', 'Proof of address'],
            'location': 'Edmonton - 11508 120 St NW',
            'eligibility': 'Low-income individuals and families',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Envision Mind Care',
            'category': 'Edmonton Services',
            'contact': 'envisionmindcare.com',
            'description': 'Psychedelic-assisted therapy, ketamine, TMS (first in Alberta)',
            'process': ['Visit envisionmindcare.com', 'Complete online inquiry', 'Book consultation', 'Discuss treatment options (ketamine, TMS, psychedelic-assisted)', 'Begin innovative therapy'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card for some services'],
            'location': 'Edmonton',
            'eligibility': 'Adults seeking innovative mental health treatment',
            'hours_of_operation': 'By appointment'
        },
        {
            'name': 'WIN House Edmonton',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-479-0058, winhouse.org',
            'description': 'Womens emergency shelter - 3 locations serving Edmonton',
            'process': ['Call 780-479-0058', 'Speak with crisis worker', 'Access emergency shelter', 'Receive safety planning', 'Connect with ongoing support'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Edmonton - 3 locations',
            'eligibility': 'Women fleeing domestic violence',
            'hours_of_operation': '24/7',
            'gender_restriction': 'women_only',
            'service_type': 'emergency_shelter'
        },
        {
            'name': 'Lurana Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-424-5875, cssalberta.ca',
            'description': '24/7 domestic violence shelter for women and children',
            'process': ['Call 780-424-5875', 'Speak with intake worker', 'Access emergency shelter', 'Receive meals and transport', 'Get child support services'],
            'waitTimes': 'Immediate access',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7',
            'gender_restriction': 'women_only',
            'service_type': 'emergency_shelter'
        },
    ]
    services.extend(edmonton_services)

    # ==================== LETHBRIDGE SERVICES ====================
    lethbridge_services = [
        {
            'name': 'Lethbridge Train Station (Recovery Alberta)',
            'category': 'Lethbridge Services',
            'contact': '801 1 Ave S, 403-381-5260',
            'description': 'Outpatient addiction/mental health, self-referral',
            'process': ['Walk in to 801 1 Ave S or call 403-381-5260', 'Self-refer for services', 'Complete intake assessment', 'Begin outpatient treatment', 'Attend ongoing appointments'],
            'waitTimes': 'Typically within 1 week',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Lethbridge - 801 1 Ave S',
            'eligibility': 'Anyone needing addiction or mental health services',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Lethbridge Provincial Building',
            'category': 'Lethbridge Services',
            'contact': '200 5 Ave S',
            'description': 'Community addiction services, psychiatric services',
            'process': ['Walk in to 200 5 Ave S', 'Complete intake', 'Access addiction or psychiatric services', 'Begin treatment', 'Receive ongoing care'],
            'waitTimes': 'Varies by service',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Lethbridge - 200 5 Ave S',
            'eligibility': 'Anyone needing addiction or psychiatric services',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'CMHA Lethbridge',
            'category': 'Lethbridge Services',
            'contact': 'lethbridge.cmha.ca',
            'description': 'Crisis Intervention Team, DOT outreach, 403-328-5465 (328-LINK)',
            'process': ['Call 403-328-5465 or visit lethbridge.cmha.ca', 'Access crisis intervention or outreach', 'Complete intake', 'Receive mental health support', 'Connect with ongoing programs'],
            'waitTimes': 'Crisis: immediate, Programs: variable',
            'requiredDocs': [],
            'location': 'Lethbridge',
            'eligibility': 'Anyone needing mental health support',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Alpha House Lethbridge Shelter',
            'category': 'Lethbridge Services',
            'contact': 'Shelter services, substance use support',
            'description': 'Emergency shelter with substance use support',
            'process': ['Walk in to Alpha House Lethbridge', 'Complete intake', 'Access shelter bed', 'Receive substance use support', 'Connect with services'],
            'waitTimes': 'Same-day access',
            'requiredDocs': [],
            'location': 'Lethbridge',
            'eligibility': 'Anyone experiencing homelessness',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Lethbridge Wellness Shelter - Stabilization Unit',
            'category': 'Lethbridge Services',
            'contact': 'Licensed facility',
            'description': 'Stabilization services',
            'process': ['Contact for admission', 'Complete assessment', 'Access stabilization unit', 'Receive support services', 'Transition to ongoing care'],
            'waitTimes': 'Depends on availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Lethbridge',
            'eligibility': 'Adults needing stabilization',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Lethbridge Recovery Centre',
            'category': 'Lethbridge Services',
            'contact': 'Adult detoxification services',
            'description': 'Detoxification services',
            'process': ['Call for intake', 'Complete assessment', 'Arrange admission', 'Begin detox program', 'Transition to treatment'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Lethbridge',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Fresh Start Recovery Lethbridge',
            'category': 'Lethbridge Services',
            'contact': '14-week residential for men (3 sites)',
            'description': '14-week mens residential program',
            'process': ['Contact Fresh Start Recovery', 'Complete intake assessment', 'Apply for 14-week program', 'Begin residential treatment', 'Participate in recovery activities'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Lethbridge - 3 sites',
            'eligibility': 'Men seeking residential recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Central Alberta Womens Emergency Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '1-888-346-5643, cawes.com',
            'description': '24/7 domestic violence shelter serving Red Deer and Central Alberta',
            'process': ['Call 1-888-346-5643', 'Speak with crisis worker', 'Access emergency shelter', 'Receive safety planning', 'Connect with support services'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Red Deer / Central Alberta',
            'eligibility': 'Women fleeing domestic violence',
            'hours_of_operation': '24/7',
            'gender_restriction': 'women_only',
            'service_type': 'emergency_shelter'
        },
        {
            'name': 'Iikaisskini Indigenous Services',
            'category': 'Lethbridge Services',
            'contact': 'ulethbridge.ca/indigenous',
            'description': 'Land-based healing',
            'process': ['Visit ulethbridge.ca/indigenous', 'Connect with Indigenous services', 'Access land-based healing programs', 'Meet with Elders', 'Participate in cultural activities'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Lethbridge',
            'eligibility': 'Indigenous peoples',
            'hours_of_operation': 'Business hours'
        },
    ]
    services.extend(lethbridge_services)

    # ==================== MEDICINE HAT SERVICES ====================
    medicine_hat_services = [
        {
            'name': 'Medicine Hat Provincial Building',
            'category': 'Medicine Hat Services',
            'contact': '346 3 St SE, 403-529-3500',
            'description': 'Outpatient addiction/mental health',
            'process': ['Walk in to 346 3 St SE or call 403-529-3500', 'Complete intake', 'Access outpatient services', 'Begin treatment', 'Attend ongoing appointments'],
            'waitTimes': 'Typically within 1 week',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Medicine Hat - 346 3 St SE',
            'eligibility': 'Anyone needing addiction or mental health services',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Medicine Hat Child/Youth Services',
            'category': 'Medicine Hat Services',
            'contact': '403-529-3582',
            'description': 'Child and youth mental health services',
            'process': ['Call 403-529-3582', 'Complete intake for child/youth', 'Schedule assessment', 'Begin treatment', 'Receive family support'],
            'waitTimes': 'Varies',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Medicine Hat',
            'eligibility': 'Children and youth',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Intensive Outreach & Diversion',
            'category': 'Medicine Hat Services',
            'contact': 'RCC Building, 631 Prospect Dr SW, 403-502-8617',
            'description': 'Intensive outreach services',
            'process': ['Call 403-502-8617', 'Request outreach services', 'Complete assessment', 'Receive intensive support', 'Access diversion programs'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Medicine Hat - 631 Prospect Dr SW',
            'eligibility': 'High-risk individuals',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Medicine Hat Recovery Centre',
            'category': 'Medicine Hat Services',
            'contact': 'Adult residential treatment, detoxification',
            'description': 'Residential treatment and detox',
            'process': ['Contact for intake', 'Complete assessment', 'Apply for admission', 'Begin residential treatment or detox', 'Participate in programming'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Medicine Hat',
            'eligibility': 'Adults requiring residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Medicine Hat Opioid Dependency Program',
            'category': 'Medicine Hat Services',
            'contact': '564 S Railway St',
            'description': 'OAT, no fees',
            'process': ['Walk in to 564 S Railway St', 'Complete intake for OAT', 'Begin medication-assisted treatment', 'Receive counselling', 'Attend regular appointments'],
            'waitTimes': 'Typically same-week',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Medicine Hat - 564 S Railway St',
            'eligibility': 'Adults with opioid dependency',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': '24-Hour Help Line',
            'category': 'Medicine Hat Services',
            'contact': '1-866-332-2322',
            'description': '24/7 addiction helpline',
            'process': ['Call 1-866-332-2322', 'Speak with counselor', 'Receive support and referrals', 'Get connected to local services'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone seeking addiction support',
            'hours_of_operation': '24/7'
        },
    ]
    services.extend(medicine_hat_services)

    # ==================== GRANDE PRAIRIE & NORTHERN ALBERTA ====================
    grande_prairie_northern = [
        {
            'name': 'Grande Prairie AHS Addiction & Mental Health',
            'category': 'Grande Prairie & Northern Alberta',
            'contact': 'Community services, outreach',
            'description': 'Community addiction and mental health services',
            'process': ['Contact AHS Grande Prairie', 'Complete intake', 'Access community services', 'Begin treatment', 'Receive outreach support if needed'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Grande Prairie',
            'eligibility': 'Anyone needing services',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Northern Addictions Centre',
            'category': 'Grande Prairie & Northern Alberta',
            'contact': 'Adult detox and residential treatment',
            'description': 'Detox and residential treatment',
            'process': ['Contact for intake', 'Complete assessment', 'Apply for admission', 'Begin detox or residential program', 'Participate in treatment'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Northern Alberta',
            'eligibility': 'Adults requiring treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Peace River Regional Womens Shelter',
            'category': 'Grande Prairie & Northern Alberta',
            'contact': '1-877-624-3466',
            'description': 'Womens emergency shelter',
            'process': ['Call 1-877-624-3466', 'Speak with crisis worker', 'Access emergency shelter', 'Receive safety planning', 'Connect with support services'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Peace River region',
            'eligibility': 'Women fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Grande Cache Transition House',
            'category': 'Grande Prairie & Northern Alberta',
            'contact': '780-827-3776, 1-866-957-3776',
            'description': 'Transition house services',
            'process': ['Call 780-827-3776 or 1-866-957-3776', 'Speak with worker', 'Access transition housing', 'Receive support services', 'Plan for next steps'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Grande Cache',
            'eligibility': 'Women and families in transition',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Northern Haven Support Society',
            'category': 'Grande Prairie & Northern Alberta',
            'contact': '780-849-4418, 1-877-214-4418',
            'description': 'Support services',
            'process': ['Call 780-849-4418 or 1-877-214-4418', 'Inquire about services', 'Complete intake', 'Access support programs', 'Receive ongoing assistance'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Northern Alberta',
            'eligibility': 'Individuals and families needing support',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Fort McMurray Recovery Centre',
            'category': 'Grande Prairie & Northern Alberta',
            'contact': 'Adult residential treatment',
            'description': 'Residential addiction treatment',
            'process': ['Contact for intake', 'Complete assessment', 'Apply for admission', 'Begin residential program', 'Participate in recovery activities'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Fort McMurray',
            'eligibility': 'Adults seeking residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'High Prairie services',
            'category': 'Grande Prairie & Northern Alberta',
            'contact': 'Available through AHS',
            'description': 'AHS addiction and mental health services',
            'process': ['Contact AHS High Prairie', 'Complete intake', 'Access available services', 'Begin treatment', 'Receive ongoing care'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'High Prairie',
            'eligibility': 'Anyone needing services',
            'hours_of_operation': 'Business hours'
        },
    ]
    services.extend(grande_prairie_northern)

    # ==================== RED DEER & CENTRAL ALBERTA ====================
    red_deer_central = [
        {
            'name': 'Red Deer Recovery Community by EHN Canada',
            'category': 'Red Deer & Central Alberta',
            'contact': '1-877-875-8890',
            'description': 'Medical detox, 42-90 day programs',
            'process': ['Call 1-877-875-8890', 'Complete comprehensive assessment', 'Choose 42-day or 90-day program', 'Begin medical detox if needed', 'Participate in residential treatment'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Red Deer',
            'eligibility': 'Adults seeking residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Red Deer Dream Centre',
            'category': 'Red Deer & Central Alberta',
            'contact': 'Faith-based residential recovery',
            'description': 'Faith-based recovery program',
            'process': ['Contact Red Deer Dream Centre', 'Complete faith-based intake', 'Apply for program', 'Begin residential recovery', 'Participate in faith-based activities'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['ID'],
            'location': 'Red Deer',
            'eligibility': 'Individuals seeking faith-based recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Red Deer Medically Supported Detox',
            'category': 'Red Deer & Central Alberta',
            'contact': '403-347-0181',
            'description': 'Medically supported detox',
            'process': ['Call 403-347-0181', 'Complete phone assessment', 'Arrange admission', 'Begin medically supported detox', 'Transition to ongoing treatment'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Red Deer',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Safe Harbour Society Red Deer',
            'category': 'Red Deer & Central Alberta',
            'contact': 'safeharboursociety.org',
            'description': 'Wellbriety, medically supported detox',
            'process': ['Visit safeharboursociety.org or call', 'Inquire about Wellbriety or detox', 'Complete cultural intake if applicable', 'Begin appropriate program', 'Participate in medicine wheel-based healing'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Red Deer',
            'eligibility': 'Anyone seeking recovery, Indigenous-inclusive',
            'hours_of_operation': 'Variable by program'
        },
        {
            'name': 'Central Zone PChAD',
            'category': 'Red Deer & Central Alberta',
            'contact': 'Protection of Children Abusing Drugs',
            'description': 'Youth protection program',
            'process': ['Contact AHS Central Zone', 'Report youth substance abuse concerns', 'Complete assessment', 'Access protection services', 'Receive family support'],
            'waitTimes': 'Priority based on risk',
            'requiredDocs': [],
            'location': 'Central Alberta',
            'eligibility': 'Youth under 18 with substance abuse issues',
            'hours_of_operation': 'Business hours with emergency response'
        },
        {
            'name': 'CAPS (Central Alberta Pride Society)',
            'category': 'Red Deer & Central Alberta',
            'contact': 'LGBTQ+ awareness & support',
            'description': 'LGBTQ+ community support',
            'process': ['Contact CAPS', 'Access LGBTQ+ resources', 'Attend support groups', 'Participate in community events', 'Connect with peer support'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Central Alberta',
            'eligibility': 'LGBTQ+ community and allies',
            'hours_of_operation': 'Variable'
        },
    ]
    services.extend(red_deer_central)

    # ==================== PEER-BASED RECOVERY SUPPORT ====================
    peer_recovery = [
        {
            'name': 'UCalgary Recovery Community (UCRC)',
            'category': 'Peer-Based Recovery Support',
            'contact': 'ucalgary.ca/safer-substance-use/ucrc',
            'description': 'Inclusive peer-driven space',
            'process': ['Visit ucalgary.ca/safer-substance-use/ucrc', 'Find meeting times and location', 'Attend drop-in recovery community', 'Connect with peers', 'Access campus support'],
            'waitTimes': 'No waitlist - drop-in',
            'requiredDocs': [],
            'location': 'University of Calgary',
            'eligibility': 'UCalgary students, staff, faculty in recovery',
            'hours_of_operation': 'Check website for hours'
        },
        {
            'name': 'Alcoholics Anonymous Calgary',
            'category': 'Peer-Based Recovery Support',
            'contact': 'calgaryaa.org',
            'description': '12-step meetings',
            'process': ['Visit calgaryaa.org', 'Find meeting near you', 'Attend your first AA meeting', 'Find a sponsor if desired', 'Work the 12 steps'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Calgary - multiple locations',
            'eligibility': 'Anyone with desire to stop drinking',
            'hours_of_operation': 'Multiple meetings daily'
        },
        {
            'name': 'Alcoholics Anonymous Alberta',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-424-5900',
            'description': '12-step meetings province-wide',
            'process': ['Call 780-424-5900 or find meetings online', 'Locate meeting in your area', 'Attend meeting', 'Connect with fellowship', 'Begin recovery journey'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone with desire to stop drinking',
            'hours_of_operation': 'Multiple meetings daily across Alberta'
        },
        {
            'name': 'Narcotics Anonymous Calgary',
            'category': 'Peer-Based Recovery Support',
            'contact': 'calgaryna.org',
            'description': '12-step meetings for addiction',
            'process': ['Visit calgaryna.org', 'Find meeting schedule', 'Attend your first NA meeting', 'Find sponsor if desired', 'Work the 12 steps'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Calgary - multiple locations',
            'eligibility': 'Anyone with desire to stop using',
            'hours_of_operation': 'Multiple meetings daily'
        },
        {
            'name': 'Narcotics Anonymous Edmonton',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-421-4429',
            'description': '12-step meetings for addiction',
            'process': ['Call 780-421-4429', 'Find meeting location and time', 'Attend meeting', 'Connect with NA community', 'Begin recovery'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Edmonton - multiple locations',
            'eligibility': 'Anyone with desire to stop using',
            'hours_of_operation': 'Multiple meetings daily'
        },
        {
            'name': 'SMART Recovery Calgary',
            'category': 'Peer-Based Recovery Support',
            'contact': 'smartrecoverycalgary.com',
            'description': 'Science-based mutual support',
            'process': ['Visit smartrecoverycalgary.com', 'Find meeting time', 'Attend SMART Recovery meeting', 'Learn cognitive-behavioral tools', 'Build self-empowerment'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone seeking science-based recovery',
            'hours_of_operation': 'Weekly meetings'
        },
        {
            'name': 'SMART Recovery Alberta',
            'category': 'Peer-Based Recovery Support',
            'contact': 'smartrecoveryalberta.org',
            'description': 'Science-based mutual support',
            'process': ['Visit smartrecoveryalberta.org', 'Find meetings across Alberta', 'Attend meeting', 'Use SMART tools', 'Track your progress'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone seeking science-based recovery',
            'hours_of_operation': 'Multiple meetings across province'
        },
        {
            'name': 'Crystal Meth Anonymous',
            'category': 'Peer-Based Recovery Support',
            'contact': '1-855-638-4373',
            'description': '12-step for crystal meth',
            'process': ['Call 1-855-638-4373', 'Find meeting information', 'Attend CMA meeting', 'Connect with peers in recovery', 'Work the steps'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone seeking recovery from crystal meth',
            'hours_of_operation': 'Check for meeting times'
        },
        {
            'name': 'Cocaine Anonymous',
            'category': 'Peer-Based Recovery Support',
            'contact': 'ca.org',
            'description': '12-step for cocaine addiction',
            'process': ['Visit ca.org', 'Find local meetings', 'Attend CA meeting', 'Work with sponsor', 'Build recovery network'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone seeking recovery from cocaine',
            'hours_of_operation': 'Check website for times'
        },
        {
            'name': 'Al-Anon Family Groups Edmonton (24/7)',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-443-6000',
            'description': 'Support for families of alcoholics',
            'process': ['Call 780-443-6000', 'Find meeting near you', 'Attend Al-Anon meeting', 'Share your experience', 'Learn coping tools'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Edmonton area',
            'eligibility': 'Family and friends affected by someones drinking',
            'hours_of_operation': '24/7 helpline, multiple meetings'
        },
        {
            'name': 'Gamblers Anonymous Edmonton',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-463-0892',
            'description': '12-step for gambling',
            'process': ['Call 780-463-0892', 'Find meeting location', 'Attend GA meeting', 'Share your story', 'Work toward recovery'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone with gambling problem',
            'hours_of_operation': 'Weekly meetings'
        },
        {
            'name': 'Problem Gambling Resources Network',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-461-1259',
            'description': 'Gambling support resources',
            'process': ['Call 780-461-1259', 'Access gambling resources', 'Get referrals to treatment', 'Connect with support', 'Begin recovery'],
            'waitTimes': 'Immediate information',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone affected by gambling',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Sex Addicts Anonymous',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-394-3709',
            'description': '12-step for sex addiction',
            'process': ['Call 780-394-3709', 'Find meeting information', 'Attend SAA meeting', 'Work with sponsor', 'Maintain sobriety'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone seeking recovery from sex addiction',
            'hours_of_operation': 'Check for meeting times'
        },
        {
            'name': 'Overeaters Anonymous',
            'category': 'Peer-Based Recovery Support',
            'contact': 'oa-southernalberta.com',
            'description': '12-step for food addiction',
            'process': ['Visit oa-southernalberta.com', 'Find meeting near you', 'Attend OA meeting', 'Work the 12 steps', 'Find food serenity'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Southern Alberta',
            'eligibility': 'Anyone with compulsive eating issues',
            'hours_of_operation': 'Multiple meetings weekly'
        },
        {
            'name': 'Food Addicts in Recovery',
            'category': 'Peer-Based Recovery Support',
            'contact': 'foodaddicts.org',
            'description': '12-step for food addiction',
            'process': ['Visit foodaddicts.org', 'Find local meetings', 'Attend FA meeting', 'Follow food plan', 'Work with sponsor'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone seeking food addiction recovery',
            'hours_of_operation': 'Check website for times'
        },
        {
            'name': 'Anorexics and Bulimics Anonymous',
            'category': 'Peer-Based Recovery Support',
            'contact': 'aba12steps.org',
            'description': '12-step for eating disorders',
            'process': ['Visit aba12steps.org', 'Find meeting information', 'Attend ABA meeting', 'Share your experience', 'Work toward recovery'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone with eating disorder',
            'hours_of_operation': 'Check website for times'
        },
        {
            'name': 'Clean Scene (Youth 14-29)',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-488-0036',
            'description': 'Youth peer support',
            'process': ['Call 780-488-0036', 'Inquire about youth programs', 'Attend peer support activities', 'Connect with youth in recovery', 'Build healthy relationships'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Youth 14-29',
            'hours_of_operation': 'Program hours vary'
        },
        {
            'name': 'Alano Club 12-Step Meetings',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-423-1807',
            'description': 'Recovery community center',
            'process': ['Call 780-423-1807 or drop in', 'Find meeting schedule', 'Attend 12-step meetings', 'Connect with sober community', 'Participate in events'],
            'waitTimes': 'No waitlist - drop-in',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone in recovery',
            'hours_of_operation': 'Multiple meetings daily'
        },
        {
            'name': 'Parents Empowering Parents (PEP)',
            'category': 'Peer-Based Recovery Support',
            'contact': '780-293-0737',
            'description': 'Parent peer support',
            'process': ['Call 780-293-0737', 'Join parent support group', 'Share experiences', 'Learn from other parents', 'Access resources'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Edmonton area',
            'eligibility': 'Parents of youth with substance use issues',
            'hours_of_operation': 'Meeting times vary'
        },
    ]
    services.extend(peer_recovery)

    # ==================== UNIVERSITY/COLLEGE CAMPUS SERVICES ====================
    campus_services = [
        {
            'name': 'University of Calgary Wellness Services',
            'category': 'University/College Campus Services',
            'contact': '403-210-9355, ucalgary.ca/wellness-services',
            'description': 'Free counselling, psychiatry, walk-in Mon-Thu',
            'process': ['Call 403-210-9355 or visit ucalgary.ca/wellness-services', 'Book counselling appointment or walk-in Mon-Thu', 'Meet with counselor or psychiatrist', 'Access free mental health care', 'Get referrals if needed'],
            'waitTimes': 'Walk-in available Mon-Thu, appointments vary',
            'requiredDocs': ['Student ID'],
            'location': 'University of Calgary',
            'eligibility': 'UCalgary students',
            'hours_of_operation': 'Business hours, walk-in Mon-Thu'
        },
        {
            'name': 'UCalgary Writing Symbols Lodge',
            'category': 'University/College Campus Services',
            'contact': 'ucalgary.ca/student-services/writing-symbols',
            'description': 'Indigenous academic/cultural support, Elders',
            'process': ['Visit ucalgary.ca/student-services/writing-symbols', 'Connect with Indigenous support staff', 'Access Elder support', 'Participate in cultural programming', 'Receive academic assistance'],
            'waitTimes': 'Drop-in available',
            'requiredDocs': [],
            'location': 'University of Calgary',
            'eligibility': 'Indigenous students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'UCalgary Harm Reduction Support',
            'category': 'University/College Campus Services',
            'contact': 'naomi.denhaan@ucalgary.ca',
            'description': 'Substance use advising',
            'process': ['Email naomi.denhaan@ucalgary.ca', 'Schedule confidential meeting', 'Discuss substance use concerns', 'Access harm reduction resources', 'Get connected to support'],
            'waitTimes': 'Typically within 1 week',
            'requiredDocs': [],
            'location': 'University of Calgary',
            'eligibility': 'UCalgary students',
            'hours_of_operation': 'By appointment'
        },
        {
            'name': 'UCalgary Crisis (24/7)',
            'category': 'University/College Campus Services',
            'contact': 'Distress Centre 403-266-4357, Woods Homes after-hours',
            'description': '24/7 crisis support for students',
            'process': ['Call Distress Centre 403-266-4357', 'Identify as UCalgary student', 'Receive immediate crisis support', 'Get connected to campus resources', 'Access after-hours support'],
            'waitTimes': 'Immediate - 24/7',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'UCalgary students',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'University of Alberta Counselling',
            'category': 'University/College Campus Services',
            'contact': '780-492-5205, ualberta.ca/current-students/counselling',
            'description': 'Free confidential, extended hours Tue/Wed',
            'process': ['Call 780-492-5205 or visit ualberta.ca/current-students/counselling', 'Book counselling appointment', 'Attend sessions', 'Access crisis support if needed', 'Get referrals'],
            'waitTimes': 'Variable, extended hours available',
            'requiredDocs': ['Student ID'],
            'location': 'University of Alberta',
            'eligibility': 'U of A students',
            'hours_of_operation': 'Extended hours Tue/Wed'
        },
        {
            'name': 'U of A Psychiatry',
            'category': 'University/College Campus Services',
            'contact': 'Covered with Alberta Health Care',
            'description': 'Psychiatric services for students',
            'process': ['Contact U of A Wellness Centre', 'Request psychiatry referral', 'Complete assessment', 'See psychiatrist', 'Receive treatment plan'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'Student ID'],
            'location': 'University of Alberta',
            'eligibility': 'U of A students',
            'hours_of_operation': 'By appointment'
        },
        {
            'name': 'U of A First Peoples House',
            'category': 'University/College Campus Services',
            'contact': 'Indigenous student support',
            'description': 'Indigenous student support',
            'process': ['Visit First Peoples House', 'Connect with Indigenous advisors', 'Access cultural support', 'Participate in programming', 'Meet with Elders'],
            'waitTimes': 'Drop-in available',
            'requiredDocs': [],
            'location': 'University of Alberta',
            'eligibility': 'Indigenous students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'U of A The Landing',
            'category': 'University/College Campus Services',
            'contact': 'Gender & sexual diversity support, peer mentorship',
            'description': 'LGBTQ2S+ student support',
            'process': ['Visit The Landing', 'Connect with peer mentors', 'Access LGBTQ2S+ resources', 'Participate in events', 'Join support groups'],
            'waitTimes': 'Drop-in available',
            'requiredDocs': [],
            'location': 'University of Alberta',
            'eligibility': 'LGBTQ2S+ students and allies',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'U of A Empower Me',
            'category': 'University/College Campus Services',
            'contact': '24/7 confidential support (student health plan)',
            'description': '24/7 phone/online counselling',
            'process': ['Call Empower Me number (on student ID)', 'Connect with counselor', 'Receive immediate support', 'Access resources', 'Get referrals if needed'],
            'waitTimes': 'Immediate - 24/7',
            'requiredDocs': ['Student ID number'],
            'location': 'Virtual - available to U of A students',
            'eligibility': 'U of A students with health plan',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Mount Royal University Wellness',
            'category': 'University/College Campus Services',
            'contact': '403-440-6960, mtroyal.ca/WellnessServices',
            'description': 'Campus wellness services',
            'process': ['Call 403-440-6960 or visit mtroyal.ca/WellnessServices', 'Book wellness appointment', 'Access counselling', 'Get health services', 'Receive support'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'Mount Royal University',
            'eligibility': 'MRU students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'MRU Iniskim Centre',
            'category': 'University/College Campus Services',
            'contact': 'Indigenous student support',
            'description': 'Indigenous student support',
            'process': ['Visit Iniskim Centre', 'Connect with Indigenous support staff', 'Access cultural programming', 'Meet with Elders', 'Receive academic support'],
            'waitTimes': 'Drop-in available',
            'requiredDocs': [],
            'location': 'Mount Royal University',
            'eligibility': 'Indigenous students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'MacEwan University Wellness & Psychological Services',
            'category': 'University/College Campus Services',
            'contact': 'Wellness and counselling',
            'description': 'Campus counselling services',
            'process': ['Contact MacEwan Wellness Centre', 'Book counselling appointment', 'Access mental health support', 'Get referrals if needed'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'MacEwan University',
            'eligibility': 'MacEwan students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'NAIT Student Counselling',
            'category': 'University/College Campus Services',
            'contact': 'nait.ca/student-services',
            'description': 'Student counselling services',
            'process': ['Visit nait.ca/student-services', 'Book counselling appointment', 'Meet with counselor', 'Access support services'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'NAIT',
            'eligibility': 'NAIT students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'SAIT Student Development & Counselling',
            'category': 'University/College Campus Services',
            'contact': 'Student counselling',
            'description': 'Counselling and development services',
            'process': ['Contact SAIT Student Services', 'Book counselling appointment', 'Access mental health support', 'Receive career counselling'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'SAIT',
            'eligibility': 'SAIT students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Lethbridge College Counselling',
            'category': 'University/College Campus Services',
            'contact': 'Campus counselling',
            'description': 'Student counselling services',
            'process': ['Contact Lethbridge College Student Services', 'Book appointment', 'Access counselling', 'Get support'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'Lethbridge College',
            'eligibility': 'Lethbridge College students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'U of Lethbridge Counselling Services',
            'category': 'University/College Campus Services',
            'contact': 'Student counselling',
            'description': 'Campus mental health services',
            'process': ['Contact U of L Counselling Services', 'Book appointment', 'Meet with counselor', 'Access ongoing support'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'University of Lethbridge',
            'eligibility': 'U of L students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Red Deer Polytechnic Counselling',
            'category': 'University/College Campus Services',
            'contact': 'Student counselling',
            'description': 'Campus counselling services',
            'process': ['Contact RDP Student Services', 'Book counselling appointment', 'Access mental health support'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'Red Deer Polytechnic',
            'eligibility': 'RDP students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'NorQuest College Student Wellness',
            'category': 'University/College Campus Services',
            'contact': 'Wellness services',
            'description': 'Student wellness support',
            'process': ['Contact NorQuest Student Wellness', 'Access wellness programs', 'Book counselling if needed', 'Get health resources'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'NorQuest College',
            'eligibility': 'NorQuest students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Bow Valley College Learner Success',
            'category': 'University/College Campus Services',
            'contact': 'Student support services',
            'description': 'Academic and wellness support',
            'process': ['Contact Learner Success Centre', 'Access support services', 'Book counselling appointment', 'Get academic help'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Student ID'],
            'location': 'Bow Valley College',
            'eligibility': 'BVC students',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Campus Food Banks',
            'category': 'University/College Campus Services',
            'contact': 'U of A, U of C, NorQuest, U of Lethbridge',
            'description': 'Campus-based food banks for students',
            'process': ['Visit your campus food bank', 'Show student ID', 'Register for food bank services', 'Receive food hamper', 'Access regularly as needed'],
            'waitTimes': 'Same-day access',
            'requiredDocs': ['Student ID'],
            'location': 'Multiple campuses across Alberta',
            'eligibility': 'Students at participating institutions',
            'hours_of_operation': 'Varies by campus'
        },
    ]
    services.extend(campus_services)

    # ==================== LGBTQ2S+ SERVICES ====================
    lgbtq_services = [
        {
            'name': 'Camp fYrefly',
            'category': 'LGBTQ2S+ Services',
            'contact': '403-283-5580, fyrefly.ca',
            'description': 'Leadership retreat ages 14-24 (Calgary/Edmonton)',
            'process': ['Visit fyrefly.ca', 'Register for camp', 'Attend leadership retreat', 'Build skills and community', 'Connect with mentors'],
            'waitTimes': 'Registration opens seasonally',
            'requiredDocs': [],
            'location': 'Calgary and Edmonton',
            'eligibility': 'LGBTQ2S+ youth ages 14-24',
            'hours_of_operation': 'Seasonal retreat'
        },
        {
            'name': 'Calgary Outlink',
            'category': 'LGBTQ2S+ Services',
            'contact': 'calgaryoutlink.ca',
            'description': 'Support, education, Inside Out Youth Group (13-18)',
            'process': ['Visit calgaryoutlink.ca', 'Join Inside Out Youth Group or programs', 'Attend events', 'Access peer support', 'Participate in advocacy'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'LGBTQ2S+ community, youth 13-18 for Inside Out',
            'hours_of_operation': 'Program times vary'
        },
        {
            'name': 'Skipping Stone',
            'category': 'LGBTQ2S+ Services',
            'contact': 'skippingstone.ca',
            'description': 'Trans/gender-diverse youth & adults Calgary',
            'process': ['Visit skippingstone.ca', 'Access trans resources', 'Join support groups', 'Get peer support', 'Attend community events'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Trans and gender-diverse individuals',
            'hours_of_operation': 'Check website for programs'
        },
        {
            'name': 'Centre for Sexuality Calgary',
            'category': 'LGBTQ2S+ Services',
            'contact': 'centreforsexuality.ca',
            'description': 'Education, Camp fYrefly',
            'process': ['Visit centreforsexuality.ca', 'Access sexual health education', 'Register for programs', 'Attend workshops', 'Get resources'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'All ages, LGBTQ2S+ inclusive',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Aura Housing Calgary',
            'category': 'LGBTQ2S+ Services',
            'contact': '587-779-5015',
            'description': 'LGBTQ2S+ youth housing 14-24',
            'process': ['Call 587-779-5015', 'Complete intake for youth housing', 'Apply for housing', 'Move into supportive environment', 'Access wraparound services'],
            'waitTimes': 'Depends on availability',
            'requiredDocs': ['ID'],
            'location': 'Calgary',
            'eligibility': 'LGBTQ2S+ youth 14-24',
            'hours_of_operation': 'Contact for intake hours'
        },
        {
            'name': 'Pride Centre of Edmonton',
            'category': 'LGBTQ2S+ Services',
            'contact': 'pridecentreofedmonton.ca',
            'description': 'Queer Joy programs, resources',
            'process': ['Visit pridecentreofedmonton.ca', 'Access LGBTQ2S+ resources', 'Join Queer Joy programs', 'Attend community events', 'Get peer support'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'LGBTQ2S+ community',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Rainbow Alliance for Youth Edmonton',
            'category': 'LGBTQ2S+ Services',
            'contact': 'Ages 12-24',
            'description': 'Youth LGBTQ2S+ support',
            'process': ['Contact Rainbow Alliance for Youth', 'Join youth programs', 'Attend peer support groups', 'Participate in activities', 'Build community'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'LGBTQ2S+ youth 12-24',
            'hours_of_operation': 'Program times vary'
        },
        {
            'name': 'CHEW Project OUTpost',
            'category': 'LGBTQ2S+ Services',
            'contact': 'Crisis/drop-in 2SLGBTQIA+ youth 14-29, mental health, housing',
            'description': 'LGBTQ2S+ youth crisis and drop-in',
            'process': ['Drop in to CHEW OUTpost', 'Access crisis support', 'Get mental health services', 'Connect with housing support', 'Build peer connections'],
            'waitTimes': 'Drop-in available',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': '2SLGBTQIA+ youth 14-29',
            'hours_of_operation': 'Drop-in hours vary'
        },
        {
            'name': 'Youth Health Centre Calgary',
            'category': 'LGBTQ2S+ Services',
            'contact': '403-520-6270',
            'description': 'Health/social care ages 12-24',
            'process': ['Call 403-520-6270', 'Book appointment', 'Access health and social services', 'Receive LGBTQ2S+-inclusive care', 'Get referrals if needed'],
            'waitTimes': 'Typically within 1-2 weeks',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary',
            'eligibility': 'Youth 12-24',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Youth Health Bus Calgary',
            'category': 'LGBTQ2S+ Services',
            'contact': '403-689-9196',
            'description': 'Visits high schools',
            'process': ['Check schedule at 403-689-9196', 'Visit bus at your school', 'Access health services', 'Get confidential care', 'Receive resources'],
            'waitTimes': 'Walk-up available when bus visits',
            'requiredDocs': [],
            'location': 'Calgary high schools',
            'eligibility': 'High school students',
            'hours_of_operation': 'School visit schedule'
        },
        {
            'name': 'HOME Central Alberta',
            'category': 'LGBTQ2S+ Services',
            'contact': 'Two-Spirit, Indigenous, Queer-led safe spaces',
            'description': 'Two-Spirit and Queer Indigenous spaces',
            'process': ['Contact HOME Central Alberta', 'Access Two-Spirit programs', 'Join community events', 'Find safe space', 'Connect with peers'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Central Alberta',
            'eligibility': 'Two-Spirit, Indigenous, Queer community',
            'hours_of_operation': 'Program times vary'
        },
        {
            'name': 'altView Foundation',
            'category': 'LGBTQ2S+ Services',
            'contact': 'Strathcona County gender/sexual minority resources',
            'description': 'LGBTQ2S+ resources',
            'process': ['Contact altView Foundation', 'Access LGBTQ2S+ resources', 'Join support programs', 'Attend events', 'Get peer support'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Strathcona County',
            'eligibility': 'LGBTQ2S+ community',
            'hours_of_operation': 'Check for program times'
        },
        {
            'name': 'Alberta GSA Network',
            'category': 'LGBTQ2S+ Services',
            'contact': 'albertagsanetwork.ca',
            'description': 'K-12 resources',
            'process': ['Visit albertagsanetwork.ca', 'Access GSA resources', 'Start or join school GSA', 'Get support materials', 'Connect with network'],
            'waitTimes': 'Immediate online access',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'K-12 students, educators, allies',
            'hours_of_operation': 'Online resources 24/7'
        },
        {
            'name': 'ShiftGrit LGBTQ+ Counselling',
            'category': 'LGBTQ2S+ Services',
            'contact': 'Calgary 587-352-6463, Edmonton 780-705-6463, shiftgrit.com',
            'description': 'LGBTQ2S+-affirming counselling',
            'process': ['Call 587-352-6463 (Calgary) or 780-705-6463 (Edmonton)', 'Book counselling appointment', 'Access LGBTQ2S+-affirming therapy', 'Work with specialized counselor', 'Receive ongoing support'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary and Edmonton',
            'eligibility': 'LGBTQ2S+ individuals',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'Outloud St. Albert / PFLAG St. Albert',
            'category': 'LGBTQ2S+ Services',
            'contact': 'Support groups all ages',
            'description': 'LGBTQ2S+ and family support',
            'process': ['Contact Outloud/PFLAG St. Albert', 'Join support groups', 'Attend meetings', 'Connect with families', 'Access resources'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'St. Albert',
            'eligibility': 'LGBTQ2S+ individuals and families',
            'hours_of_operation': 'Meeting times vary'
        },
        {
            'name': 'Centre for Newcomers',
            'category': 'LGBTQ2S+ Services',
            'contact': 'LGBTQ+ newcomer mental health, b.stojanovic@centrefornewcomers.ca',
            'description': 'LGBTQ2S+ newcomer support',
            'process': ['Email b.stojanovic@centrefornewcomers.ca', 'Access LGBTQ2S+ newcomer services', 'Get mental health support', 'Receive culturally appropriate care', 'Connect with community'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'LGBTQ2S+ newcomers',
            'hours_of_operation': 'Business hours'
        },
    ]
    services.extend(lgbtq_services)

    # ==================== DOMESTIC VIOLENCE & WOMEN'S SHELTERS ====================
    domestic_violence_shelters = [
        {
            'name': 'Calgary Womens Emergency Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '24/7 Crisis Line, calgarywomensshelter.com',
            'description': 'Trained counsellors',
            'process': ['Call 24/7 crisis line', 'Speak with trained counselor', 'Access emergency shelter', 'Receive safety planning', 'Connect with ongoing support'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Family Violence Info Line',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '310-1818',
            'description': '24/7 in 170+ languages',
            'process': ['Dial 310-1818', 'Request interpreter if needed', 'Speak with crisis worker', 'Receive safety planning', 'Get referrals to local services'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone experiencing family violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Calgary Communities Against Sexual Abuse (CCASA)',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '403-237-5888, calgarycasa.com',
            'description': 'Sexual abuse support services',
            'process': ['Call 403-237-5888', 'Speak with support worker', 'Access counselling', 'Receive crisis support', 'Get connected to resources'],
            'waitTimes': 'Crisis: immediate, Counselling: variable',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Survivors of sexual abuse and families',
            'hours_of_operation': 'Business hours with crisis line'
        },
        {
            'name': 'WIN House Edmonton (3 locations)',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-479-0058, winhouse.org',
            'description': '50+ years serving Edmonton',
            'process': ['Call 780-479-0058', 'Speak with intake worker', 'Access one of 3 shelter locations', 'Receive crisis intervention', 'Get ongoing support services'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Edmonton - 3 locations',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Lurana Shelter Edmonton',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-424-5875, cssalberta.ca',
            'description': '24/7, meals, transport, child support',
            'process': ['Call 780-424-5875', 'Access emergency shelter', 'Receive meals and transportation', 'Get child support services', 'Connect with counselling'],
            'waitTimes': 'Immediate access',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'WEAC Edmonton',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-423-5302',
            'description': 'Womens Emergency Accommodation, 18+',
            'process': ['Call 780-423-5302', 'Complete intake', 'Access emergency accommodation', 'Receive support services', 'Plan next steps'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Women 18+ in crisis',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'A Safe Place Sherwood Park',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-464-7233, 1-877-252-7233, asafeplace.ca',
            'description': '24/7 crisis',
            'process': ['Call 780-464-7233 or 1-877-252-7233', 'Speak with crisis worker', 'Access emergency shelter', 'Receive safety planning', 'Get ongoing support'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Sherwood Park',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'SAGE Seniors Safe House Edmonton',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-702-1520 (emergency), 780-426-3746',
            'description': 'Seniors 60+',
            'process': ['Call 780-702-1520 for emergency or 780-426-3746', 'Speak with senior services worker', 'Access senior-specific shelter', 'Receive age-appropriate support', 'Connect with elder abuse resources'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Seniors 60+ fleeing abuse',
            'hours_of_operation': '24/7 emergency line'
        },
        {
            'name': 'Central Alberta Womens Emergency Shelter (CAWES)',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '1-888-346-5643, cawes.com',
            'description': 'Red Deer 24/7',
            'process': ['Call 1-888-346-5643', 'Access emergency shelter', 'Receive crisis counselling', 'Get safety planning', 'Connect with legal support'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Red Deer',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Bow Valley Womens Emergency Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '403-760-3200',
            'description': 'Canmore area shelter',
            'process': ['Call 403-760-3200', 'Speak with crisis worker', 'Access emergency shelter', 'Receive support services', 'Plan for safety'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Bow Valley area',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Strathmore Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '403-934-6634, 1-877-934-6634',
            'description': 'Emergency shelter services',
            'process': ['Call 403-934-6634 or 1-877-934-6634', 'Access emergency shelter', 'Receive crisis support', 'Get safety planning'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Strathmore',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Pincher Creek Womens Emergency Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '403-627-2114',
            'description': 'Emergency shelter',
            'process': ['Call 403-627-2114', 'Access emergency shelter', 'Receive support services', 'Plan next steps'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Pincher Creek',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Mountain Rose Womens Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '1-877-845-4141',
            'description': 'Emergency shelter services',
            'process': ['Call 1-877-845-4141', 'Access emergency shelter', 'Receive crisis support', 'Get connected to resources'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Mountain region',
            'eligibility': 'Women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Ermineskin Womens Shelter Maskwacis',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '780-585-4444',
            'description': 'On-reserve',
            'process': ['Call 780-585-4444', 'Access on-reserve shelter', 'Receive culturally appropriate support', 'Connect with Elder support', 'Plan for safety'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Maskwacis',
            'eligibility': 'Indigenous women and children fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Eagles Nest Stoney Family Shelter',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '403-881-2000',
            'description': 'Stoney Nation family shelter',
            'process': ['Call 403-881-2000', 'Access family shelter', 'Receive cultural support', 'Get safety planning', 'Connect with services'],
            'waitTimes': 'Immediate for emergency',
            'requiredDocs': [],
            'location': 'Stoney Nation',
            'eligibility': 'Indigenous families fleeing violence',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Escaping Abuse Benefit',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': 'alberta.ca/family-violence-costs-leave',
            'description': 'Emergency funds',
            'process': ['Visit alberta.ca/family-violence-costs-leave', 'Apply for Escaping Abuse Benefit', 'Provide documentation of abuse', 'Receive emergency financial assistance', 'Use funds for safety needs'],
            'waitTimes': 'Application processing 1-2 weeks',
            'requiredDocs': ['ID', 'Proof of leaving abusive situation'],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone leaving abusive situation',
            'hours_of_operation': 'Online application 24/7'
        },
        {
            'name': 'Ruth House Society',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': '587-352-9422, ruthshouse.ca',
            'description': 'African-descent support',
            'process': ['Call 587-352-9422', 'Access culturally specific support', 'Receive crisis intervention', 'Connect with African community resources', 'Get ongoing support'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Women of African descent',
            'hours_of_operation': 'Contact for hours'
        },
        {
            'name': 'Alberta SPCA Pet Safekeeping',
            'category': 'Domestic Violence & Womens Shelters',
            'contact': 'Free temporary pet care for abuse survivors',
            'description': 'Temporary pet care program',
            'process': ['Contact Alberta SPCA', 'Arrange temporary pet care', 'Focus on your safety while pet is safe', 'Reunite with pet when stable'],
            'waitTimes': 'Contact for availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Domestic violence survivors with pets',
            'hours_of_operation': 'Contact for information'
        },
    ]
    services.extend(domestic_violence_shelters)

    # ==================== BABY & PARENTING RESOURCES ====================
    baby_parenting = [
        {
            'name': 'Calgary Pregnancy Care Centre',
            'category': 'Baby & Parenting Resources',
            'contact': '403-269-3110, pregcare.com',
            'description': 'Referrals, free baby/maternity clothing',
            'process': ['Call 403-269-3110 or visit pregcare.com', 'Schedule appointment', 'Access free baby and maternity clothing', 'Receive parenting resources', 'Get referrals to services'],
            'waitTimes': 'Typically within 1 week',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Pregnant individuals and new parents',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Best Beginning Program',
            'category': 'Baby & Parenting Resources',
            'contact': '403-228-8221, birthandbabies.com',
            'description': 'Pregnant teens/low-income, food, transport',
            'process': ['Call 403-228-8221', 'Complete intake for pregnant teens/low-income', 'Access food and transportation support', 'Receive prenatal education', 'Get ongoing support'],
            'waitTimes': 'Typically within 1 week',
            'requiredDocs': ['Proof of income or teen status'],
            'location': 'Calgary',
            'eligibility': 'Pregnant teens and low-income pregnant individuals',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Calgary Food Bank (Baby Items)',
            'category': 'Baby & Parenting Resources',
            'contact': '403-253-2055, calgaryfoodbank.com',
            'description': 'Formula, hygiene, request in advance',
            'process': ['Call 403-253-2055 in advance', 'Request baby items (formula, diapers, hygiene)', 'Pick up at food bank', 'Receive monthly if registered'],
            'waitTimes': 'Request in advance, typically 24-48 hours',
            'requiredDocs': ['Registration with food bank'],
            'location': 'Calgary - 5000 11 St SE',
            'eligibility': 'Food bank clients with babies',
            'hours_of_operation': 'Food bank hours'
        },
        {
            'name': 'Made by Momma',
            'category': 'Baby & Parenting Resources',
            'contact': 'madebymomma.org',
            'description': 'Mothers with young children in crisis, meals, essentials',
            'process': ['Visit madebymomma.org', 'Apply for support', 'Receive meals and baby essentials', 'Access crisis support', 'Connect with mom community'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Mothers with young children in crisis',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'Rise Calgary Healthy Babies',
            'category': 'Baby & Parenting Resources',
            'contact': '3303 17 Ave SE, 403-204-8280',
            'description': 'Monthly support for infants under 1',
            'process': ['Walk in to 3303 17 Ave SE or call 403-204-8280', 'Register for Healthy Babies program', 'Receive monthly baby supplies', 'Access parenting support', 'Connect with resources'],
            'waitTimes': 'Registration same-day',
            'requiredDocs': [],
            'location': 'Calgary - 3303 17 Ave SE',
            'eligibility': 'Parents with infants under 1 year',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Salvation Army (Infant Essentials)',
            'category': 'Baby & Parenting Resources',
            'contact': '100, 5115 17 Ave SE',
            'description': 'Infant essentials',
            'process': ['Walk in to 100, 5115 17 Ave SE', 'Request infant essentials', 'Access diapers, formula, clothing', 'Receive parenting resources'],
            'waitTimes': 'Same-day access',
            'requiredDocs': [],
            'location': 'Calgary - 100, 5115 17 Ave SE',
            'eligibility': 'Parents in need',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'WINS Community Resource Hubs',
            'category': 'Baby & Parenting Resources',
            'contact': '825-540-4717',
            'description': 'Baby items, hygiene',
            'process': ['Call 825-540-4717', 'Inquire about baby items', 'Visit Dover or Erin Woods hub', 'Access baby supplies and hygiene items', 'Receive parenting support'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - Dover (3525 26 Ave SE) and Erin Woods (701 Erin Woods Lane SE)',
            'eligibility': 'Families with babies',
            'hours_of_operation': 'Hub hours vary'
        },
        {
            'name': 'Childrens Cottage Society - Brendas House',
            'category': 'Baby & Parenting Resources',
            'contact': '1921 28 St SW, 403-242-8575',
            'description': 'Family emergency housing',
            'process': ['Call 403-242-8575', 'Request emergency family housing', 'Complete intake', 'Access safe housing with children', 'Receive family support services'],
            'waitTimes': 'Depends on availability',
            'requiredDocs': [],
            'location': 'Calgary - 1921 28 St SW',
            'eligibility': 'Families with children in crisis',
            'hours_of_operation': '24/7 crisis line'
        },
    ]
    services.extend(baby_parenting)

    # ==================== FREE FOOD RESOURCES - CALGARY ====================
    food_calgary = [
        {
            'name': 'Calgary Food Bank',
            'category': 'Free Food Resources - Calgary',
            'contact': '5000 11 St SE, 403-253-2055, calgaryfoodbank.com',
            'description': '7-day hampers, delivery available',
            'process': ['Call 403-253-2055 or visit 5000 11 St SE', 'Register for food bank (first time)', 'Receive 7-day hamper', 'Return monthly as needed', 'Request delivery if mobility issues'],
            'waitTimes': 'Registration and hamper same-day',
            'requiredDocs': ['ID', 'Proof of address', 'Proof of low income'],
            'location': 'Calgary - 5000 11 St SE',
            'eligibility': 'Low-income individuals and families',
            'hours_of_operation': 'Mon-Fri 9am-4pm'
        },
        {
            'name': 'The Alex Community Food Centre',
            'category': 'Free Food Resources - Calgary',
            'contact': '4920 17 Ave SE, 403-455-5792, thealexcfc.ca',
            'description': 'Drop-in meals, garden, low-cost market',
            'process': ['Walk in to 4920 17 Ave SE', 'Access free drop-in meals', 'Shop at low-cost market', 'Participate in community garden', 'Join cooking programs'],
            'waitTimes': 'Drop-in available',
            'requiredDocs': [],
            'location': 'Calgary - 4920 17 Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Check website for meal times'
        },
        {
            'name': 'Centre for the City Well Café',
            'category': 'Free Food Resources - Calgary',
            'contact': '3900 2 St NE, 403-293-3900',
            'description': 'Hot meals Mon/Wed, Food Bank depot',
            'process': ['Walk in to 3900 2 St NE on Mon or Wed', 'Access free hot meals', 'Use as Food Bank depot', 'Connect with community'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - 3900 2 St NE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Hot meals Mon/Wed'
        },
        {
            'name': 'Calgary Drop-In Centre',
            'category': 'Free Food Resources - Calgary',
            'contact': '1 Dermot Baldwin Way SE, 403-263-5707',
            'description': 'Daily breakfast, lunch, supper',
            'process': ['Walk in to 1 Dermot Baldwin Way SE', 'Access free meals (breakfast, lunch, supper)', 'Eat in dining hall', 'Connect with services'],
            'waitTimes': 'Walk-in available at meal times',
            'requiredDocs': [],
            'location': 'Calgary - 1 Dermot Baldwin Way SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Meal times daily'
        },
        {
            'name': 'Muslim Families Network (Halal)',
            'category': 'Free Food Resources - Calgary',
            'contact': '3961 52 Ave NE, 403-466-6367',
            'description': 'Halal hampers by appointment',
            'process': ['Call 403-466-6367', 'Book appointment for halal hamper', 'Visit 3961 52 Ave NE', 'Receive culturally appropriate food', 'Access monthly'],
            'waitTimes': 'By appointment',
            'requiredDocs': [],
            'location': 'Calgary - 3961 52 Ave NE',
            'eligibility': 'Muslim families needing halal food',
            'hours_of_operation': 'By appointment'
        },
        {
            'name': 'Salvation Army',
            'category': 'Free Food Resources - Calgary',
            'contact': '5115 17 Ave SE, 403-410-1160',
            'description': 'Monthly 2-day hampers, ID required',
            'process': ['Walk in to 5115 17 Ave SE', 'Show ID', 'Register for food hampers', 'Receive 2-day hamper monthly', 'Access additional services'],
            'waitTimes': 'Same-day hamper',
            'requiredDocs': ['ID'],
            'location': 'Calgary - 5115 17 Ave SE',
            'eligibility': 'Anyone with ID',
            'hours_of_operation': 'Food bank hours'
        },
        {
            'name': 'Rise Calgary',
            'category': 'Free Food Resources - Calgary',
            'contact': '3303 17 Ave SE, 403-204-8280',
            'description': 'Food/furniture referrals, drop-in Wed-Fri',
            'process': ['Walk in Wed-Fri to 3303 17 Ave SE or call 403-204-8280', 'Access food hampers', 'Get furniture referrals', 'Receive support services', 'Connect with programs'],
            'waitTimes': 'Drop-in Wed-Fri',
            'requiredDocs': [],
            'location': 'Calgary - 3303 17 Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Drop-in Wed-Fri'
        },
        {
            'name': 'Kerby Centre Thrive (50+)',
            'category': 'Free Food Resources - Calgary',
            'contact': '1133 7 Ave SW, 403-705-3222',
            'description': 'Free food for older adults, delivery',
            'process': ['Call 403-705-3222', 'Register for Thrive program', 'Receive free food for seniors', 'Request delivery if needed', 'Access monthly'],
            'waitTimes': 'Registration same-day',
            'requiredDocs': ['ID showing age 50+'],
            'location': 'Calgary - 1133 7 Ave SW',
            'eligibility': 'Adults 50+',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Jewish Family Service',
            'category': 'Free Food Resources - Calgary',
            'contact': '403-287-3510, jfsc.org',
            'description': 'Kosher & regular hampers by appointment',
            'process': ['Call 403-287-3510', 'Book appointment', 'Access kosher or regular hampers', 'Receive culturally appropriate food', 'Get ongoing support'],
            'waitTimes': 'By appointment',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone in need, kosher options available',
            'hours_of_operation': 'By appointment'
        },
        {
            'name': 'Community Kitchen Program of Calgary',
            'category': 'Free Food Resources - Calgary',
            'contact': 'ckpcalgary.ca',
            'description': 'Cooking skills, Spinz-A-Round food access',
            'process': ['Visit ckpcalgary.ca', 'Register for cooking programs', 'Learn cooking skills', 'Access Spinz-A-Round food program', 'Build community'],
            'waitTimes': 'Registration required',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone interested in food programs',
            'hours_of_operation': 'Program times vary'
        },
        {
            'name': 'Robert McClure United Church',
            'category': 'Free Food Resources - Calgary',
            'contact': '5510 26 Ave NE, 403-280-9500',
            'description': 'Thursday pantry',
            'process': ['Walk in Thursdays to 5510 26 Ave NE', 'Access food pantry', 'Receive food items', 'Connect with church community'],
            'waitTimes': 'Walk-in Thursdays',
            'requiredDocs': [],
            'location': 'Calgary - 5510 26 Ave NE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Thursdays'
        },
        {
            'name': 'Fish Creek United Church',
            'category': 'Free Food Resources - Calgary',
            'contact': '77 Deerpoint Rd SE, 403-278-8263',
            'description': 'Pantry Mon-Thu, bread Thu',
            'process': ['Walk in Mon-Thu to 77 Deerpoint Rd SE', 'Access food pantry', 'Get bread on Thursdays', 'Receive food support'],
            'waitTimes': 'Walk-in Mon-Thu',
            'requiredDocs': [],
            'location': 'Calgary - 77 Deerpoint Rd SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Mon-Thu, bread Thu'
        },
        {
            'name': 'Eastside Victory Outreach',
            'category': 'Free Food Resources - Calgary',
            'contact': '1840 38 St SE, 403-273-1050',
            'description': 'Hampers + hot lunch Tue/Thu',
            'process': ['Walk in Tue or Thu to 1840 38 St SE', 'Access food hampers', 'Receive hot lunch', 'Connect with support'],
            'waitTimes': 'Walk-in Tue/Thu',
            'requiredDocs': [],
            'location': 'Calgary - 1840 38 St SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Tue/Thu'
        },
        {
            'name': 'Ogden Victory Outreach',
            'category': 'Free Food Resources - Calgary',
            'contact': '7012 Ogden Rd SE, 403-273-1050',
            'description': 'Hampers + hot lunch Fri',
            'process': ['Walk in Fridays to 7012 Ogden Rd SE', 'Access food hampers', 'Receive hot lunch', 'Connect with community'],
            'waitTimes': 'Walk-in Fridays',
            'requiredDocs': [],
            'location': 'Calgary - 7012 Ogden Rd SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Fridays'
        },
        {
            'name': 'St. Marys Feed the Hungry',
            'category': 'Free Food Resources - Calgary',
            'contact': '221 18 Ave SW, 403-218-5532',
            'description': 'Free Sunday lunch',
            'process': ['Walk in Sundays to 221 18 Ave SW', 'Attend free Sunday lunch', 'Enjoy community meal', 'Connect with others'],
            'waitTimes': 'Walk-in Sundays',
            'requiredDocs': [],
            'location': 'Calgary - 221 18 Ave SW',
            'eligibility': 'Anyone',
            'hours_of_operation': 'Sundays'
        },
        {
            'name': 'Abundant Life Church',
            'category': 'Free Food Resources - Calgary',
            'contact': '3343 49 St SW, 403-246-1804',
            'description': 'Hampers west of 14 St, Thu by appointment',
            'process': ['Call 403-246-1804 for Thursday appointment', 'Must live west of 14 St', 'Pick up food hamper', 'Access monthly'],
            'waitTimes': 'By appointment Thursdays',
            'requiredDocs': ['Proof of address west of 14 St'],
            'location': 'Calgary - 3343 49 St SW',
            'eligibility': 'Residents west of 14 St',
            'hours_of_operation': 'Thu by appointment'
        },
    ]
    services.extend(food_calgary)

    # ==================== FREE FOOD RESOURCES - EDMONTON ====================
    food_edmonton = [
        {
            'name': 'Edmontons Food Bank',
            'category': 'Free Food Resources - Edmonton',
            'contact': '11508 120 St NW, 780-425-4190, edmontonsfoodbank.com',
            'description': '43,000+ monthly, Beyond Food free services',
            'process': ['Call 780-425-4190 or visit 11508 120 St NW', 'Register for food bank', 'Receive hamper', 'Access Beyond Food programs', 'Return monthly as needed'],
            'waitTimes': 'Registration and hamper same-day',
            'requiredDocs': ['ID', 'Proof of address'],
            'location': 'Edmonton - 11508 120 St NW',
            'eligibility': 'Low-income individuals and families',
            'hours_of_operation': 'Check website for hours'
        },
        {
            'name': 'Food Not Bombs Community Fridge',
            'category': 'Free Food Resources - Edmonton',
            'contact': 'Outside Earths General Store, Whyte Avenue',
            'description': 'Open access',
            'process': ['Visit community fridge outside Earths General Store on Whyte Avenue', 'Take what you need', 'Leave what you can', 'Access 24/7'],
            'waitTimes': 'No wait - 24/7 access',
            'requiredDocs': [],
            'location': 'Edmonton - Whyte Avenue',
            'eligibility': 'Anyone',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Gurdwara Siri Guru Singh Sabha Mill Woods',
            'category': 'Free Food Resources - Edmonton',
            'contact': 'Free vegetarian langar for all',
            'description': 'Free community meals',
            'process': ['Visit Gurdwara in Mill Woods', 'Access free vegetarian langar meal', 'All welcome regardless of background', 'Eat in community'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Edmonton - Mill Woods',
            'eligibility': 'Everyone welcome',
            'hours_of_operation': 'Check Gurdwara schedule'
        },
        {
            'name': 'West End Outreach Centre',
            'category': 'Free Food Resources - Edmonton',
            'contact': 'Free lunches Mon/Wed 12-1pm, community kitchen training',
            'description': 'Free meals and food skills',
            'process': ['Visit West End Outreach Mon or Wed 12-1pm', 'Access free lunch', 'Join community kitchen training', 'Learn cooking skills'],
            'waitTimes': 'Walk-in Mon/Wed',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Mon/Wed 12-1pm'
        },
    ]
    services.extend(food_edmonton)

    # ==================== PROVINCIAL FOOD RESOURCES ====================
    food_provincial = [
        {
            'name': 'Food Banks Alberta',
            'category': 'Provincial Food Resources',
            'contact': 'foodbanksalberta.ca',
            'description': '113 member food banks province-wide',
            'process': ['Visit foodbanksalberta.ca', 'Find food bank in your area', 'Contact local food bank', 'Register and access services'],
            'waitTimes': 'Varies by location',
            'requiredDocs': ['Contact local food bank for requirements'],
            'location': 'Alberta-wide - 113 locations',
            'eligibility': 'Low-income individuals and families',
            'hours_of_operation': 'Varies by location'
        },
        {
            'name': '211 Alberta Food Resources',
            'category': 'Provincial Food Resources',
            'contact': 'Dial 211',
            'description': 'Connect to local food banks',
            'process': ['Dial 211', 'Ask about food banks in your area', 'Receive referrals', 'Get contact information', 'Connect to services'],
            'waitTimes': 'Immediate - 24/7',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone needing food resources',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Alberta Health Services Food Map',
            'category': 'Provincial Food Resources',
            'contact': 'albertahealthservices.ca/nutrition/Page16163.aspx',
            'description': 'By health zone',
            'process': ['Visit albertahealthservices.ca/nutrition/Page16163.aspx', 'Select your health zone', 'View food resources in your area', 'Contact services directly'],
            'waitTimes': 'Immediate online access',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone',
            'hours_of_operation': 'Online 24/7'
        },
        {
            'name': 'Strathcona Food Bank',
            'category': 'Provincial Food Resources',
            'contact': '255 Kaska Rd, Sherwood Park, 780-449-6413',
            'description': 'Strathcona County food bank',
            'process': ['Call 780-449-6413 or visit 255 Kaska Rd', 'Register for food bank', 'Receive hamper', 'Access monthly'],
            'waitTimes': 'Same-day registration',
            'requiredDocs': ['ID', 'Proof of address'],
            'location': 'Sherwood Park - 255 Kaska Rd',
            'eligibility': 'Strathcona County residents',
            'hours_of_operation': 'Check for hours'
        },
        {
            'name': 'Red Deer Food Bank Society',
            'category': 'Provincial Food Resources',
            'contact': 'Red Deer food bank',
            'description': 'Food bank services',
            'process': ['Contact Red Deer Food Bank', 'Register for services', 'Receive food hamper', 'Access regularly'],
            'waitTimes': 'Registration same-day',
            'requiredDocs': ['ID', 'Proof of address'],
            'location': 'Red Deer',
            'eligibility': 'Red Deer area residents',
            'hours_of_operation': 'Check for hours'
        },
        {
            'name': 'Lethbridge Salvation Army Food Bank',
            'category': 'Provincial Food Resources',
            'contact': 'Lethbridge food bank',
            'description': 'Food bank services',
            'process': ['Contact Salvation Army Lethbridge', 'Register for food bank', 'Receive hamper', 'Access monthly'],
            'waitTimes': 'Same-day registration',
            'requiredDocs': ['ID'],
            'location': 'Lethbridge',
            'eligibility': 'Lethbridge area residents',
            'hours_of_operation': 'Check for hours'
        },
        {
            'name': 'Grande Prairie Salvation Army Food Bank',
            'category': 'Provincial Food Resources',
            'contact': 'Grande Prairie food bank',
            'description': 'Food bank services',
            'process': ['Contact Salvation Army Grande Prairie', 'Register for food bank', 'Receive food hamper', 'Access regularly'],
            'waitTimes': 'Same-day registration',
            'requiredDocs': ['ID'],
            'location': 'Grande Prairie',
            'eligibility': 'Grande Prairie area residents',
            'hours_of_operation': 'Check for hours'
        },
        {
            'name': 'Airdrie Food Bank',
            'category': 'Provincial Food Resources',
            'contact': 'Airdrie food bank',
            'description': 'Food bank services',
            'process': ['Contact Airdrie Food Bank', 'Register for services', 'Receive hamper', 'Access monthly'],
            'waitTimes': 'Same-day registration',
            'requiredDocs': ['ID', 'Proof of address'],
            'location': 'Airdrie',
            'eligibility': 'Airdrie area residents',
            'hours_of_operation': 'Check for hours'
        },
    ]
    services.extend(food_provincial)

    # ==================== BASIC NEEDS & COMMUNITY RESOURCES - CALGARY ====================
    basic_needs_calgary = [
        {
            'name': 'Fair Entry Calgary',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '800 Macleod Trail SE or Village Square Library',
            'description': 'Subsidized programs, call 311',
            'process': ['Visit 800 Macleod Trail SE or Village Square Library', 'Call 311 for Fair Entry info', 'Apply for subsidized programs', 'Get fee assistance for recreation and transit'],
            'waitTimes': 'Application processing varies',
            'requiredDocs': ['Proof of income', 'ID'],
            'location': 'Calgary - 800 Macleod Trail SE',
            'eligibility': 'Low-income Calgary residents',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Income Support Alberta',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '1-877-644-9992, applyincomesupport.alberta.ca',
            'description': 'Provincial income support',
            'process': ['Call 1-877-644-9992 or visit applyincomesupport.alberta.ca', 'Complete application', 'Provide required documents', 'Receive income support', 'Attend appointments'],
            'waitTimes': 'Application processing 1-2 weeks',
            'requiredDocs': ['ID', 'SIN', 'Bank info', 'Income documentation'],
            'location': 'Alberta-wide',
            'eligibility': 'Low-income Alberta residents meeting criteria',
            'hours_of_operation': 'Mon-Fri 8:15am-4:30pm'
        },
        {
            'name': 'Alberta Supports Contact Centre',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '1-877-644-9992',
            'description': 'Mon-Fri 8:15am-4:30pm',
            'process': ['Call 1-877-644-9992', 'Speak with support worker', 'Get information on programs', 'Receive referrals', 'Apply for benefits'],
            'waitTimes': 'Phone wait varies',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone needing information',
            'hours_of_operation': 'Mon-Fri 8:15am-4:30pm'
        },
        {
            'name': 'Jewish Family Services',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '6131 6 St SE, 403-287-3510, jfsc.org',
            'description': 'Housing, ESL, seniors, resettlement',
            'process': ['Call 403-287-3510 or visit 6131 6 St SE', 'Access housing support', 'Join ESL classes', 'Get senior services', 'Receive resettlement help'],
            'waitTimes': 'Variable by service',
            'requiredDocs': [],
            'location': 'Calgary - 6131 6 St SE',
            'eligibility': 'Anyone needing services, focus on Jewish community',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'The Mustard Seed Marlborough',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '#24, 6060 Memorial Dr NE, 1-833-448-4673',
            'description': 'Referrals, food, counselling, jobs',
            'process': ['Walk in to #24, 6060 Memorial Dr NE or call 1-833-448-4673', 'Access referrals to services', 'Get food support', 'Receive counselling', 'Get job assistance'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - #24, 6060 Memorial Dr NE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Rise Calgary Forest Lawn',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '3303 17 Ave SE, 403-204-8280',
            'description': 'Emergency food/clothing, tax help, housing',
            'process': ['Walk in to 3303 17 Ave SE or call 403-204-8280', 'Access emergency food and clothing', 'Get free tax help', 'Receive housing support', 'Connect with programs'],
            'waitTimes': 'Walk-in Wed-Fri',
            'requiredDocs': [],
            'location': 'Calgary - 3303 17 Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Wed-Fri'
        },
        {
            'name': 'Rise Project',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '#16, 2221 41 Ave NE, 403-680-1943',
            'description': 'Food, clothing, parenting, addiction, newcomers',
            'process': ['Walk in to #16, 2221 41 Ave NE or call 403-680-1943', 'Access food and clothing', 'Join parenting programs', 'Get addiction support', 'Receive newcomer services'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - #16, 2221 41 Ave NE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Salvation Army East',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '100, 5115 17 Ave SE, 403-410-1160',
            'description': 'Food, literacy, infant items',
            'process': ['Walk in to 100, 5115 17 Ave SE', 'Access food bank', 'Join literacy programs', 'Get infant items', 'Receive support services'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': ['ID for food bank'],
            'location': 'Calgary - 100, 5115 17 Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'WINS Community Hubs',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': 'Dover 3525 26 Ave SE, Erin Woods 701 Erin Woods Lane SE, 825-540-4717',
            'description': 'Support groups, youth, parenting',
            'process': ['Visit Dover (3525 26 Ave SE) or Erin Woods (701 Erin Woods Lane SE)', 'Join support groups', 'Access youth programs', 'Get parenting support', 'Connect with community'],
            'waitTimes': 'Walk-in for many programs',
            'requiredDocs': [],
            'location': 'Calgary - Dover and Erin Woods',
            'eligibility': 'Families and individuals',
            'hours_of_operation': 'Check hub hours'
        },
        {
            'name': 'West Dover Patch',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': '3203 31A Ave SE, 403-273-3984',
            'description': 'Jobs, basic needs, financial coaching',
            'process': ['Walk in to 3203 31A Ave SE or call 403-273-3984', 'Get job search help', 'Access basic needs support', 'Receive financial coaching', 'Build skills'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - 3203 31A Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Soap and Suds (Free Showers)',
            'category': 'Basic Needs & Community Resources - Calgary',
            'contact': 'Ernie Star Arena 4808 14 Ave SE',
            'description': 'Tue 10am-12pm',
            'process': ['Visit Ernie Star Arena at 4808 14 Ave SE on Tuesdays 10am-12pm', 'Access free showers', 'Get hygiene supplies', 'Receive dignity and respect'],
            'waitTimes': 'Walk-in Tuesdays',
            'requiredDocs': [],
            'location': 'Calgary - 4808 14 Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Tue 10am-12pm'
        },
    ]
    services.extend(basic_needs_calgary)

    # ==================== CLOTHING RESOURCES - CALGARY ====================
    clothing_calgary = [
        {
            'name': 'Hope Mission Church',
            'category': 'Clothing Resources - Calgary',
            'contact': '4869 Hubalta Rd SE, 403-474-3237',
            'description': 'Appointment-based low-cost clothing',
            'process': ['Call 403-474-3237', 'Book appointment', 'Visit 4869 Hubalta Rd SE', 'Shop low-cost clothing', 'Access what you need'],
            'waitTimes': 'By appointment',
            'requiredDocs': [],
            'location': 'Calgary - 4869 Hubalta Rd SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'By appointment'
        },
        {
            'name': 'SE Calgary Community Resource Centre',
            'category': 'Clothing Resources - Calgary',
            'contact': '2734 76 Ave SE, 403-720-3322',
            'description': 'Walk-in clothing room (2 bags)',
            'process': ['Walk in to 2734 76 Ave SE', 'Access clothing room', 'Take up to 2 bags of clothing', 'Get what you need'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Calgary - 2734 76 Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Check for hours'
        },
        {
            'name': 'Rise Calgary Clothing Room',
            'category': 'Clothing Resources - Calgary',
            'contact': '403-204-8280',
            'description': 'By appointment',
            'process': ['Call 403-204-8280', 'Book clothing room appointment', 'Visit Rise Calgary', 'Access free clothing', 'Take what you need'],
            'waitTimes': 'By appointment',
            'requiredDocs': [],
            'location': 'Calgary - 3303 17 Ave SE',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'By appointment'
        },
        {
            'name': 'WINS Hubs "House to Home"',
            'category': 'Clothing Resources - Calgary',
            'contact': '825-540-4717',
            'description': 'Clothing, furniture, household items',
            'process': ['Call 825-540-4717', 'Inquire about House to Home program', 'Visit Dover or Erin Woods hub', 'Access clothing, furniture, household items', 'Get what you need'],
            'waitTimes': 'By appointment or scheduled times',
            'requiredDocs': [],
            'location': 'Calgary - Dover and Erin Woods hubs',
            'eligibility': 'Families in need',
            'hours_of_operation': 'Check hub schedule'
        },
    ]
    services.extend(clothing_calgary)

    # ==================== DETOXIFICATION PROGRAMS ====================
    detox_programs = [
        {
            'name': 'Alpha House Calgary Detox',
            'category': 'Detoxification Programs',
            'contact': '203-15 Ave SE, 403-234-7388',
            'description': '42 beds, medically supervised, 24/7',
            'process': ['Call 403-234-7388', 'Complete phone screening', 'Arrange admission', 'Begin medically supervised detox', 'Transition to ongoing care'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 203-15 Ave SE',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Renfrew Recovery Centre Calgary',
            'category': 'Detoxification Programs',
            'contact': '1611 Remington Rd NE, 403-297-3337, 1-866-332-2322',
            'description': '24/7 adult detox',
            'process': ['Call 403-297-3337 or 1-866-332-2322', 'Complete assessment', 'Arrange admission', 'Begin supervised detox', 'Receive medical support'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary - 1611 Remington Rd NE',
            'eligibility': 'Adults 17+ requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'AHS Adult Detox (17+)',
            'category': 'Detoxification Programs',
            'contact': '780-342-5900',
            'description': 'Adult detox services',
            'process': ['Call 780-342-5900', 'Complete phone assessment', 'Arrange admission', 'Begin detox program', 'Access medical supervision'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Edmonton area',
            'eligibility': 'Adults 17+ requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'George Spady Society Edmonton',
            'category': 'Detoxification Programs',
            'contact': '780-424-8335',
            'description': 'Medically supported 18+',
            'process': ['Call 780-424-8335', 'Complete screening', 'Arrange admission', 'Begin medically supported detox', 'Transition to treatment'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Edmonton',
            'eligibility': 'Adults 18+',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Poundmakers Lodge Detox St. Albert',
            'category': 'Detoxification Programs',
            'contact': '780-458-1884',
            'description': '18+ Indigenous-focused',
            'process': ['Call 780-458-1884', 'Complete cultural intake', 'Arrange admission', 'Begin Indigenous-focused detox', 'Access Elder support'],
            'waitTimes': 'Depends on availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'St. Albert',
            'eligibility': 'Adults 18+, Indigenous-focused',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Red Deer Recovery Community Detox',
            'category': 'Detoxification Programs',
            'contact': '1-877-875-8890',
            'description': 'Medical detox',
            'process': ['Call 1-877-875-8890', 'Complete assessment', 'Arrange admission to medical detox', 'Begin supervised withdrawal', 'Transition to residential if desired'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Red Deer',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Safe Harbour Medically Supported Detox Red Deer',
            'category': 'Detoxification Programs',
            'contact': '403-347-0181',
            'description': 'Medically supported detox',
            'process': ['Call 403-347-0181', 'Complete intake', 'Arrange admission', 'Begin medically supported detox', 'Receive ongoing care'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Red Deer',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'M.I.T.A.A. Detox Centre',
            'category': 'Detoxification Programs',
            'contact': 'Licensed detox',
            'description': 'Licensed detox facility',
            'process': ['Contact for intake information', 'Complete assessment', 'Arrange admission', 'Begin detox program'],
            'waitTimes': 'Contact for information',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Alberta',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'Pastew Place Detox Centre',
            'category': 'Detoxification Programs',
            'contact': 'Licensed facility',
            'description': 'Licensed detox',
            'process': ['Contact for intake', 'Complete assessment', 'Arrange admission', 'Begin detox'],
            'waitTimes': 'Contact for information',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Alberta',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': 'Contact for information'
        },
        {
            'name': 'Fort Macleod Detox',
            'category': 'Detoxification Programs',
            'contact': '403-553-4466',
            'description': 'Detox services',
            'process': ['Call 403-553-4466', 'Complete intake', 'Arrange admission', 'Begin detox program'],
            'waitTimes': 'Variable',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Fort Macleod',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Lethbridge Recovery Centre Detox',
            'category': 'Detoxification Programs',
            'contact': 'Adult detoxification',
            'description': 'Detoxification services',
            'process': ['Contact Lethbridge Recovery Centre', 'Complete assessment', 'Arrange admission', 'Begin detox program'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Lethbridge',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Medicine Hat Recovery Centre Detox',
            'category': 'Detoxification Programs',
            'contact': 'Detoxification services',
            'description': 'Detox program',
            'process': ['Contact Medicine Hat Recovery Centre', 'Complete assessment', 'Arrange admission', 'Begin detox'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Medicine Hat',
            'eligibility': 'Adults requiring detox',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Akoka tssini Medical Detox Brocket',
            'category': 'Detoxification Programs',
            'contact': '403-849-7544',
            'description': 'Indigenous health services',
            'process': ['Call 403-849-7544', 'Complete Indigenous-focused intake', 'Arrange admission', 'Begin culturally appropriate detox', 'Access traditional supports'],
            'waitTimes': 'Depends on bed availability',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Brocket',
            'eligibility': 'Indigenous peoples requiring detox',
            'hours_of_operation': '24/7'
        },
    ]
    services.extend(detox_programs)

    # ==================== RESIDENTIAL TREATMENT PROGRAMS - LICENSED ALBERTA ====================
    residential_treatment = [
        {
            'name': 'Lander Treatment Centre (AHS)',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': '221 Fairway Dr, Claresholm, 403-625-5600',
            'description': '48-bed, 4-week adult',
            'process': ['Contact AHS for referral', 'Complete comprehensive assessment', 'Apply for admission', 'Begin 4-week residential program', 'Participate in intensive treatment'],
            'waitTimes': 'Significant waitlist',
            'requiredDocs': ['Alberta Health Care card', 'ID', 'AHS referral'],
            'location': 'Claresholm - 221 Fairway Dr',
            'eligibility': 'Adults requiring residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Teen Challenge Alberta Mens Centre',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': 'Faith-based long-term',
            'description': 'Faith-based long-term mens program',
            'process': ['Contact Teen Challenge Alberta', 'Complete faith-based intake', 'Apply for long-term program', 'Begin residential recovery', 'Participate in faith-based activities'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['ID'],
            'location': 'Alberta',
            'eligibility': 'Men seeking faith-based recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Adeara Recovery Centre',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': 'Women & children, faith-based, 1+ year',
            'description': 'Faith-based womens and children program',
            'process': ['Contact Adeara Recovery Centre', 'Complete intake for women and children', 'Apply for 1-year program', 'Begin family-centered recovery', 'Participate in faith-based healing'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['ID'],
            'location': 'Alberta',
            'eligibility': 'Women with children seeking faith-based recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Simon House Recovery Centre',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': '5807/5809/5811/5813/5819 locations',
            'description': 'Multiple recovery houses',
            'process': ['Contact Simon House', 'Complete intake assessment', 'Apply for house placement', 'Begin residential recovery', 'Participate in community program'],
            'waitTimes': 'Depends on house availability',
            'requiredDocs': ['ID'],
            'location': 'Multiple locations',
            'eligibility': 'Adults seeking recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Grace House Drumheller',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': 'Women only, 1-year',
            'description': 'Womens 1-year residential program',
            'process': ['Contact Grace House', 'Complete womens intake', 'Apply for 1-year program', 'Begin residential treatment', 'Engage in long-term recovery'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['ID'],
            'location': 'Drumheller',
            'eligibility': 'Women seeking long-term recovery',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Thorpe Recovery Centre Blackfoot',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': '780-875-8890',
            'description': 'Licensed residential',
            'process': ['Call 780-875-8890', 'Complete assessment', 'Apply for admission', 'Begin residential program', 'Participate in treatment'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Blackfoot',
            'eligibility': 'Adults seeking residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Shunda Creek Recovery Center',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': 'Licensed facility',
            'description': 'Licensed residential treatment',
            'process': ['Contact Shunda Creek', 'Complete assessment', 'Apply for admission', 'Begin residential program', 'Engage in recovery activities'],
            'waitTimes': 'Contact for information',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Alberta',
            'eligibility': 'Adults seeking residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Opportunity Home Treatment & Recovery Centre',
            'category': 'Residential Treatment Programs - Licensed Alberta',
            'contact': 'Licensed residential',
            'description': 'Licensed residential facility',
            'process': ['Contact Opportunity Home', 'Complete assessment', 'Apply for program', 'Begin residential treatment', 'Participate in recovery'],
            'waitTimes': 'Contact for information',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Alberta',
            'eligibility': 'Adults seeking residential treatment',
            'hours_of_operation': 'Residential program'
        },
    ]
    services.extend(residential_treatment)

    # ==================== YOUTH SERVICES ====================
    youth_services = [
        {
            'name': 'Kids Help Phone',
            'category': 'Youth Services',
            'contact': '1-800-668-6868, text CONNECT to 686868',
            'description': '24/7',
            'process': ['Call 1-800-668-6868 or text CONNECT to 686868', 'Connect with youth counselor', 'Share what youre going through', 'Receive immediate support', 'Get resources'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Canada-wide',
            'eligibility': 'Children and youth up to age 25',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'ConnecTeen',
            'category': 'Youth Services',
            'contact': '403-264-8336, text 587-333-2724',
            'description': 'Youth peer support Calgary',
            'process': ['Call 403-264-8336 or text 587-333-2724', 'Connect with peer volunteer', 'Share your concerns', 'Receive peer support', 'Get resources'],
            'waitTimes': 'Immediate availability',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Youth and young adults',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'The Summit (Sinneave Centre)',
            'category': 'Youth Services',
            'contact': '403-955-5437',
            'description': 'Walk-in mental health children/youth',
            'process': ['Walk in or call 403-955-5437', 'Complete youth intake', 'See mental health professional', 'Receive treatment plan', 'Access ongoing support'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary',
            'eligibility': 'Children and youth',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Hull Services Bridging the Gap',
            'category': 'Youth Services',
            'contact': '403-216-0660, text 403-216-0663',
            'description': 'Ages 16-24',
            'process': ['Call 403-216-0660 or text 403-216-0663', 'Connect with youth worker', 'Access age-appropriate services', 'Receive support', 'Build skills'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Youth 16-24',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Hull Services Calgary',
            'category': 'Youth Services',
            'contact': '403-251-8000',
            'description': 'Youth recovery, PChAD',
            'process': ['Call 403-251-8000', 'Complete youth assessment', 'Access appropriate program', 'Begin treatment', 'Receive family support'],
            'waitTimes': 'Varies by program',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary',
            'eligibility': 'Youth and families',
            'hours_of_operation': '24/7 crisis, programs vary'
        },
        {
            'name': 'YouthSMART',
            'category': 'Youth Services',
            'contact': 'youthsmart.ca',
            'description': 'Mental health education',
            'process': ['Visit youthsmart.ca', 'Access mental health resources', 'Learn about mental health', 'Get support tools', 'Reduce stigma'],
            'waitTimes': 'Immediate online access',
            'requiredDocs': [],
            'location': 'Alberta-wide (online)',
            'eligibility': 'Youth, educators, families',
            'hours_of_operation': '24/7 online'
        },
        {
            'name': 'Youth Substance Use Clinic Calgary',
            'category': 'Youth Services',
            'contact': '1005 17 St NW, 403-297-4664',
            'description': 'Ages 12-17',
            'process': ['Call 403-297-4664', 'Complete youth intake', 'Schedule assessment', 'Begin treatment for substance use', 'Receive family support'],
            'waitTimes': 'Typically within 2 weeks',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary - 1005 17 St NW',
            'eligibility': 'Youth 12-17 with substance use concerns',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Kickstand',
            'category': 'Youth Services',
            'contact': 'mykickstand.ca',
            'description': 'Free virtual/in-person ages 11-25, no waitlist',
            'process': ['Visit mykickstand.ca', 'Sign up for services', 'Choose virtual or in-person', 'Connect with counselor', 'Begin support immediately'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Ages 11-25',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': 'CASA Mental Health',
            'category': 'Youth Services',
            'contact': 'casamentalhealth.org',
            'description': 'Children & youth, classroom program',
            'process': ['Visit casamentalhealth.org', 'Inquire about programs', 'Complete intake', 'Access child/youth services', 'Receive classroom support if applicable'],
            'waitTimes': 'Varies by program',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary and Edmonton',
            'eligibility': 'Children, youth, and families',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Clean Scene Edmonton',
            'category': 'Youth Services',
            'contact': '780-488-0036',
            'description': 'Ages 14-29',
            'process': ['Call 780-488-0036', 'Join youth programs', 'Connect with peers in recovery', 'Access support activities', 'Build healthy lifestyle'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Youth 14-29',
            'hours_of_operation': 'Program hours vary'
        },
        {
            'name': 'AARC',
            'category': 'Youth Services',
            'contact': '403-253-5250, aarc.ab.ca',
            'description': 'Adolescent semi-residential 12-step',
            'process': ['Call 403-253-5250', 'Complete adolescent assessment', 'Apply for program', 'Begin 12-step semi-residential treatment', 'Participate in recovery'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Adolescents with addiction issues',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'Edmonton Youth Addiction Services',
            'category': 'Youth Services',
            'contact': 'Residential treatment, stabilization, PChAD',
            'description': 'Youth addiction services',
            'process': ['Contact AHS Edmonton Youth Addiction', 'Complete assessment', 'Access appropriate program', 'Begin treatment', 'Receive family support'],
            'waitTimes': 'Priority based on need',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Edmonton',
            'eligibility': 'Youth with addiction issues',
            'hours_of_operation': 'Varies by program'
        },
        {
            'name': 'Clear Hills Youth Treatment Centre',
            'category': 'Youth Services',
            'contact': 'Licensed residential',
            'description': 'Youth residential treatment',
            'process': ['Contact for intake', 'Complete youth assessment', 'Apply for admission', 'Begin residential treatment', 'Participate in programming'],
            'waitTimes': 'Contact for information',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Northern Alberta',
            'eligibility': 'Youth requiring residential treatment',
            'hours_of_operation': 'Residential program'
        },
        {
            'name': 'EHN Sandstone Recovery Calgary',
            'category': 'Youth Services',
            'contact': 'Ages 12-24 eating disorders',
            'description': 'Youth eating disorder treatment',
            'process': ['Contact EHN Sandstone', 'Complete eating disorder assessment', 'Apply for program', 'Begin specialized treatment', 'Receive family support'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Ages 12-24 with eating disorders',
            'hours_of_operation': 'Program hours vary'
        },
    ]
    services.extend(youth_services)

    # ==================== EATING DISORDERS ====================
    eating_disorders = [
        {
            'name': 'Eating Disorder Support Network of Alberta',
            'category': 'Eating Disorders',
            'contact': '780-729-3376',
            'description': 'Eating disorder support network',
            'process': ['Call 780-729-3376', 'Connect with support network', 'Access resources', 'Find support groups', 'Get referrals to treatment'],
            'waitTimes': 'Immediate information',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone affected by eating disorders',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Anorexics and Bulimics Anonymous',
            'category': 'Eating Disorders',
            'contact': 'aba12steps.org',
            'description': '12-step for eating disorders',
            'process': ['Visit aba12steps.org', 'Find meeting information', 'Attend ABA meeting', 'Work the 12 steps', 'Connect with peers in recovery'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone with eating disorder',
            'hours_of_operation': 'Check website for times'
        },
        {
            'name': 'AHS Access Mental Health',
            'category': 'Eating Disorders',
            'contact': '403-943-1500 or 780-424-2424',
            'description': 'Access eating disorder services',
            'process': ['Call 403-943-1500 (Calgary) or 780-424-2424 (Edmonton)', 'Request eating disorder services', 'Complete assessment', 'Receive referral to treatment', 'Begin care'],
            'waitTimes': 'Initial call same-day, treatment varies',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Calgary or Edmonton',
            'eligibility': 'Anyone with eating disorder',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'EHN Sandstone Recovery Centre Calgary',
            'category': 'Eating Disorders',
            'contact': 'Ages 12-24',
            'description': 'Youth eating disorder treatment',
            'process': ['Contact EHN Sandstone', 'Complete eating disorder assessment', 'Apply for specialized program', 'Begin treatment', 'Receive comprehensive care'],
            'waitTimes': 'Waitlist varies',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Calgary',
            'eligibility': 'Ages 12-24 with eating disorders',
            'hours_of_operation': 'Program hours vary'
        },
    ]
    services.extend(eating_disorders)

    # ==================== GAMBLING SUPPORT ====================
    gambling_support = [
        {
            'name': 'Alberta Gamblers Anonymous',
            'category': 'Gambling Support',
            'contact': '780-463-0892',
            'description': '12-step for gambling',
            'process': ['Call 780-463-0892', 'Find meeting near you', 'Attend GA meeting', 'Work the 12 steps', 'Connect with peers in recovery'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone with gambling problem',
            'hours_of_operation': 'Multiple meetings weekly'
        },
        {
            'name': 'Problem Gambling Resources Network',
            'category': 'Gambling Support',
            'contact': '780-461-1259',
            'description': 'Gambling support resources',
            'process': ['Call 780-461-1259', 'Access gambling resources', 'Get referrals to treatment', 'Find support groups', 'Begin recovery'],
            'waitTimes': 'Immediate information',
            'requiredDocs': [],
            'location': 'Alberta',
            'eligibility': 'Anyone affected by gambling',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'AHS QuitCore',
            'category': 'Gambling Support',
            'contact': '1-866-710-QUIT (7848)',
            'description': 'Gambling addiction support',
            'process': ['Call 1-866-710-7848', 'Speak with counselor', 'Access gambling addiction support', 'Receive treatment referrals', 'Begin recovery'],
            'waitTimes': 'Immediate phone support',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone with gambling addiction',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Lander Treatment Centre',
            'category': 'Gambling Support',
            'contact': 'Gambling addiction treatment',
            'description': 'Residential gambling treatment',
            'process': ['Contact AHS for referral', 'Complete assessment', 'Apply for Lander program', 'Begin residential treatment', 'Address gambling addiction'],
            'waitTimes': 'Significant waitlist',
            'requiredDocs': ['Alberta Health Care card', 'ID'],
            'location': 'Claresholm',
            'eligibility': 'Adults with gambling addiction',
            'hours_of_operation': 'Residential program'
        },
    ]
    services.extend(gambling_support)

    # ==================== SUPPORT FOR FAMILY MEMBERS AFFECTED BY ADDICTION ====================
    family_support = [
        {
            'name': 'Al-Anon Family Groups Edmonton (24/7)',
            'category': 'Support for Family Members Affected by Addiction',
            'contact': '780-443-6000',
            'description': 'Support for families of alcoholics',
            'process': ['Call 780-443-6000', 'Find meeting near you', 'Attend Al-Anon meeting', 'Share your experience', 'Learn coping strategies'],
            'waitTimes': 'No waitlist - open meetings',
            'requiredDocs': [],
            'location': 'Edmonton area',
            'eligibility': 'Family and friends affected by someones drinking',
            'hours_of_operation': '24/7 helpline, multiple meetings'
        },
        {
            'name': 'Parents Empowering Parents (PEP)',
            'category': 'Support for Family Members Affected by Addiction',
            'contact': '780-293-0737',
            'description': 'Parent peer support',
            'process': ['Call 780-293-0737', 'Join parent support group', 'Share experiences with other parents', 'Learn strategies', 'Access resources'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Edmonton area',
            'eligibility': 'Parents of youth with substance use issues',
            'hours_of_operation': 'Meeting times vary'
        },
        {
            'name': 'Bissell Centre FASD Services',
            'category': 'Support for Family Members Affected by Addiction',
            'contact': '780-423-2285 x157',
            'description': 'FASD family support',
            'process': ['Call 780-423-2285 x157', 'Access FASD services', 'Receive family support', 'Learn about FASD', 'Get connected to resources'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Families affected by FASD',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'Catholic Social Services FASD',
            'category': 'Support for Family Members Affected by Addiction',
            'contact': '780-975-4896',
            'description': 'FASD support services',
            'process': ['Call 780-975-4896', 'Access FASD programs', 'Receive family support', 'Get assessments', 'Connect with resources'],
            'waitTimes': 'Variable',
            'requiredDocs': [],
            'location': 'Edmonton area',
            'eligibility': 'Families affected by FASD',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'FASD Alberta Resource Hub',
            'category': 'Support for Family Members Affected by Addiction',
            'contact': 'fasd.typepad.com',
            'description': 'FASD resources',
            'process': ['Visit fasd.typepad.com', 'Access FASD information', 'Find local resources', 'Learn about supports', 'Connect with community'],
            'waitTimes': 'Immediate online access',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone affected by FASD',
            'hours_of_operation': '24/7 online'
        },
    ]
    services.extend(family_support)

    # ==================== HARM REDUCTION ====================
    harm_reduction = [
        {
            'name': 'Digital Overdose Response System (DORS)',
            'category': 'Harm Reduction',
            'contact': 'dorsapp.ca',
            'description': 'App to prevent fatal overdoses when using alone',
            'process': ['Download DORS app from dorsapp.ca', 'Create account', 'Activate app before using substances alone', 'App checks on you', 'Emergency services contacted if you dont respond'],
            'waitTimes': 'Immediate download',
            'requiredDocs': [],
            'location': 'Alberta-wide (mobile app)',
            'eligibility': 'Anyone using substances alone',
            'hours_of_operation': '24/7 app access'
        },
        {
            'name': 'Boyle Street Community Services Edmonton',
            'category': 'Harm Reduction',
            'contact': '780-424-4106',
            'description': 'Harm reduction services',
            'process': ['Walk in or call 780-424-4106', 'Access harm reduction supplies', 'Get naloxone kit', 'Receive education', 'Connect with support services'],
            'waitTimes': 'Walk-in available',
            'requiredDocs': [],
            'location': 'Edmonton',
            'eligibility': 'Anyone needing harm reduction supplies',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Virtual Opioid Dependency Program',
            'category': 'Harm Reduction',
            'contact': '1-844-383-7688, vodp.ca',
            'description': 'Same-day OAT anywhere in Alberta',
            'process': ['Call 1-844-383-7688 or visit vodp.ca', 'Complete phone assessment', 'Get same-day prescription', 'Pick up medication at pharmacy', 'Receive ongoing virtual support'],
            'waitTimes': 'Same-day access',
            'requiredDocs': ['Alberta Health Care card'],
            'location': 'Alberta-wide (virtual)',
            'eligibility': 'Alberta residents with opioid dependency',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Alpha House DOAP Team',
            'category': 'Harm Reduction',
            'contact': 'Downtown outreach, needle response, harm reduction',
            'description': 'Downtown outreach and harm reduction',
            'process': ['DOAP team provides street-level outreach', 'Access harm reduction supplies', 'Get medical assistance', 'Receive support', 'Connect to services'],
            'waitTimes': 'Mobile team availability',
            'requiredDocs': [],
            'location': 'Calgary downtown',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'Alpha House Needle Response & Ambassador Teams',
            'category': 'Harm Reduction',
            'contact': 'Overdose response, harm reduction supplies',
            'description': 'Needle response and overdose support',
            'process': ['Teams provide community outreach', 'Access harm reduction supplies', 'Receive overdose response', 'Get naloxone kits', 'Connect to services'],
            'waitTimes': 'Mobile team availability',
            'requiredDocs': [],
            'location': 'Calgary',
            'eligibility': 'Anyone in need',
            'hours_of_operation': 'Extended hours'
        },
        {
            'name': 'UCalgary Harm Reduction',
            'category': 'Harm Reduction',
            'contact': 'naomi.denhaan@ucalgary.ca',
            'description': 'Campus harm reduction support',
            'process': ['Email naomi.denhaan@ucalgary.ca', 'Schedule confidential meeting', 'Access harm reduction resources', 'Receive education', 'Get support'],
            'waitTimes': 'Typically within 1 week',
            'requiredDocs': [],
            'location': 'University of Calgary',
            'eligibility': 'UCalgary students',
            'hours_of_operation': 'By appointment'
        },
    ]
    services.extend(harm_reduction)

    # ==================== OTHER PROVINCIAL SERVICES ====================
    other_provincial = [
        {
            'name': 'Recovery Alberta',
            'category': 'Other Provincial Services',
            'contact': 'recoveryalberta.ca',
            'description': 'Provincial addiction/mental health agency ($1.13B budget)',
            'process': ['Visit recoveryalberta.ca', 'Explore provincial services', 'Find treatment programs', 'Access resources', 'Get connected to care'],
            'waitTimes': 'Immediate online information',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'All Albertans',
            'hours_of_operation': '24/7 online'
        },
        {
            'name': 'Recovery Access Alberta',
            'category': 'Other Provincial Services',
            'contact': 'recoveryaccessalberta.ca',
            'description': 'Match to treatment programs',
            'process': ['Visit recoveryaccessalberta.ca', 'Complete online matching tool', 'Find appropriate treatment programs', 'Get contact information', 'Connect with services'],
            'waitTimes': 'Immediate online matching',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone seeking treatment',
            'hours_of_operation': '24/7 online'
        },
        {
            'name': 'Find a Doctor Alberta',
            'category': 'Other Provincial Services',
            'contact': 'albertafindadoctor.ca',
            'description': 'Find accepting physicians',
            'process': ['Visit albertafindadoctor.ca', 'Search by location', 'Find doctors accepting patients', 'Contact doctors office', 'Register as patient'],
            'waitTimes': 'Immediate online search',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone needing family doctor',
            'hours_of_operation': '24/7 online'
        },
        {
            'name': 'Service Canada Calgary',
            'category': 'Other Provincial Services',
            'contact': '5401 Temple Dr NE Suite 116',
            'description': 'SIN, EI, grants',
            'process': ['Visit 5401 Temple Dr NE Suite 116', 'Bring required ID', 'Access SIN, EI, or grant services', 'Complete applications', 'Receive assistance'],
            'waitTimes': 'Variable, arrive early',
            'requiredDocs': ['ID', 'Varies by service'],
            'location': 'Calgary - 5401 Temple Dr NE Suite 116',
            'eligibility': 'Canadian residents',
            'hours_of_operation': 'Business hours'
        },
        {
            'name': 'BounceBack',
            'category': 'Other Provincial Services',
            'contact': 'bounceback.cmha.ca',
            'description': 'Free CBT program',
            'process': ['Visit bounceback.cmha.ca', 'Self-refer or get doctor referral', 'Complete phone assessment', 'Receive workbooks and coaching calls', 'Work through CBT program'],
            'waitTimes': 'Typically within 2 weeks',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Adults with mild to moderate depression or anxiety',
            'hours_of_operation': 'Phone coaching scheduled'
        },
        {
            'name': 'Counselling Alberta',
            'category': 'Other Provincial Services',
            'contact': 'Recovery Alberta - Affordable virtual/in-person, no waitlist',
            'description': 'Affordable provincial counselling',
            'process': ['Contact Recovery Alberta', 'Request Counselling Alberta info', 'Get matched to counselor', 'Choose virtual or in-person', 'Begin affordable counselling'],
            'waitTimes': 'No waitlist',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'All Albertans',
            'hours_of_operation': 'Flexible scheduling'
        },
        {
            'name': '211 Alberta',
            'category': 'Other Provincial Services',
            'contact': 'Dial 211, ab.211.ca',
            'description': 'Community services 24/7',
            'process': ['Dial 211 from any phone', 'Speak with information specialist', 'Describe what you need', 'Receive referrals to services', 'Get contact information'],
            'waitTimes': 'Immediate - 24/7 availability',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone needing information',
            'hours_of_operation': '24/7'
        },
        {
            'name': 'Alberta.ca Residential Treatment Lookup',
            'category': 'Other Provincial Services',
            'contact': 'alberta.ca/lookup/residential-addiction-treatment-service-providers.aspx',
            'description': 'Search licensed residential programs',
            'process': ['Visit alberta.ca/lookup/residential-addiction-treatment-service-providers.aspx', 'Search by location or program type', 'View licensed facilities', 'Get contact information', 'Contact programs directly'],
            'waitTimes': 'Immediate online search',
            'requiredDocs': [],
            'location': 'Alberta-wide',
            'eligibility': 'Anyone seeking residential treatment',
            'hours_of_operation': '24/7 online'
        },
    ]
    services.extend(other_provincial)

    return services


if __name__ == '__main__':
    # Test loading services
    services = load_alberta_services()
    print(f"\n✅ Loaded {len(services)} services")
    print("\nCategories:")
    categories = set(s['category'] for s in services)
    for cat in sorted(categories):
        count = len([s for s in services if s['category'] == cat])
        print(f"  - {cat}: {count} services")
