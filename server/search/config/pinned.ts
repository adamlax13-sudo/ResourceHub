/**
 * Pinned Service Configuration
 *
 * Crisis and priority service pinning configuration.
 * Defines which services get pinned to the top of results for specific query types
 * (988 crisis helpline, PCHAD, Al-Anon, Legal Aid, etc.)
 */

// === CRISIS (988 Suicide Crisis Helpline) ===

export const CRISIS_PINNED_SERVICE_ID = '988-suicide-crisis-helpline';

export const CRISIS_PINNED_SERVICE_LITE = {
  id: '988-suicide-crisis-helpline',
  name: '988 Suicide Crisis Helpline',
  category: '24/7 Crisis Line',
  description: 'Free, confidential 24/7 support for people in suicidal crisis or emotional distress. Call or text 988.',
  location: 'Canada-wide (available in Alberta)',
  waitTimes: 'Immediate - 24/7 availability',
  phone: '988',
  is24_7: true,
} as const;

export const CRISIS_PINNED_SERVICE_FULL = {
  id: '988-suicide-crisis-helpline',
  name: '988 Suicide Crisis Helpline',
  category: '24/7 Crisis Line',
  description: 'Free, confidential 24/7 support for people in suicidal crisis or emotional distress. Call or text 988 to connect with a trained crisis counselor immediately. Available in English and French.',
  location: 'Canada-wide (available in Alberta)',
  contact: 'Call or text 988',
  websiteUrl: '',
  eligibility: 'Anyone experiencing suicidal thoughts, emotional distress, or supporting someone in crisis',
  process: [
    'Call or text 988 from any phone - available 24/7',
    'You will be connected to a trained crisis counselor',
    'Share what you\'re going through at your own pace',
    'The counselor will provide immediate support and safety planning',
    'You may be connected to local resources for ongoing support',
  ],
  waitTimes: 'Immediate - 24/7 availability',
  requiredDocs: ['None - anonymous and confidential'],
  phone: '988',
  email: '',
  address: '',
} as const;

// === PCHAD (Protection of Children Abusing Drugs) ===

export const PCHAD_PINNED_SERVICE_ID = 'pchad-alberta';

export const PCHAD_PINNED_SERVICE_LITE = {
  id: 'pchad-alberta',
  name: 'PCHAD - Protection of Children Abusing Drugs Program',
  category: 'Youth Addiction Intervention',
  description: 'Alberta program allowing parents/guardians to get a court order to place their child (under 18) in a protective safe house for up to 5 days for addiction assessment and treatment planning. Available 24/7.',
  location: 'Alberta-wide',
  waitTimes: '24/7 availability - Immediate response',
  phone: '211',
  is24_7: true,
} as const;

export const PCHAD_PINNED_SERVICE_FULL = {
  id: 'pchad-alberta',
  name: 'PCHAD - Protection of Children Abusing Drugs Program',
  category: 'Youth Addiction Intervention',
  description: 'The Protection of Children Abusing Drugs (PCHAD) Act allows parents or guardians in Alberta to apply for a court order to confine their child (under 18 years old) in a protective safe house for up to 5 days. During this time, the child receives assessment, stabilization, and treatment planning for substance abuse. This program is designed for situations where a child\'s drug use poses a serious threat to their health and safety, and voluntary treatment has not been successful.',
  location: 'Alberta-wide',
  contact: 'Call 211 or contact Alberta Health Services',
  websiteUrl: 'https://www.alberta.ca/protection-of-children-abusing-drugs-act',
  eligibility: 'Parents or guardians of children under 18 years old who are abusing drugs or alcohol and whose substance use poses a serious risk to their safety',
  process: [
    'Contact a PCHAD coordinator through Alberta Health Services or call 211',
    'Discuss your situation and determine if PCHAD is appropriate',
    'If eligible, apply for a court order (can be done without the child present)',
    'Once granted, the child is taken to a protective safe house',
    'Child receives up to 5 days of assessment and stabilization',
    'Treatment plan and aftercare recommendations are developed',
    'Follow-up support and resources are provided to the family',
  ],
  waitTimes: '24/7 availability - Emergency applications can be processed quickly',
  requiredDocs: [
    'Proof of guardianship or parental status',
    'Information about the child\'s substance use history',
    'Any relevant medical or treatment records (if available)',
  ],
  phone: '211',
  email: '',
  address: 'Alberta-wide service - multiple locations',
} as const;
