/**
 * Specialized Service Pinning
 *
 * Ensures critical services appear in results for specific query types.
 * Similar to how 988 is pinned for crisis queries.
 */

import type { LiteService } from './types';

// Al-Anon service for family addiction support queries
const ALANON_SERVICE: LiteService = {
  id: 'al-anon-family-groups-edmonton-24-7-edmonton-area',
  name: 'Al-Anon Family Groups Edmonton (24/7)',
  category: 'Recovery & Peer Support',
  description: 'Al-Anon Family Groups Edmonton provides support for family members and friends of alcoholics, helping them share their experiences and find hope in dealing with the challenges posed by a loved one\'s drinking. The organization emphasizes that alcoholism is a family illness and offers a fellowship for those affected to connect and support each other.',
  location: 'Edmonton area',
  waitTimes: '24/7 availability',
  phone: '(780) 443-6000',
  is24_7: true,
};

// Edmonton Community Legal Centre for tenant/eviction legal queries
const LEGAL_AID_SERVICE: LiteService = {
  id: 'edmonton-community-legal-centre-10020-100-street-nw-edmonton-ab-t5j-0n3',
  name: 'Edmonton Community Legal Centre',
  category: 'Legal Aid',
  description: 'The Edmonton Community Legal Centre (ECLC) is a non-profit organization dedicated to providing free legal services to individuals with low income in Edmonton and Northern Alberta. Their focus areas include Family Law, Landlord and Tenant issues, Employment, Human Rights, Debt, Small Claims, Immigration, and Income Supports.',
  location: '10020 100 Street NW, Edmonton, AB',
  waitTimes: 'Appointments available',
  phone: '(780) 702-1725',
};

/**
 * Detect if a query is about living with/supporting someone with addiction
 */
export function isFamilyAddictionQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return (
    /\b(al-?anon|nar-?anon)\b/i.test(lower) ||
    /\bliving with.*(addict|alcoholic|someone who)\b/i.test(lower) ||
    /\b(my|our).*(spouse|husband|wife|partner|parent|child|son|daughter|family|loved one).*(addict|alcoholi[cs]|alcohol|drug|drinking|using)/i.test(lower) ||
    /\b(loved one|family member|someone i (know|love|care)).*(addict|alcoholi[cs]|alcohol|drug)/i.test(lower) ||
    /\b(codependent|family.*addict|addict.*family)\b/i.test(lower)
  );
}

/**
 * Detect if a query is about custody/access/visitation disputes (legal, not DV)
 */
export function isCustodyLegalQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return (
    /\b(custody|visitation|access|parenting time|parenting order)\b/i.test(lower) ||
    /\b(ex|partner|husband|wife|spouse).*(?:won'?t|will not|refuse|denied|keeping|not allow).*(?:see|visit|take|have).*(?:kids?|children|son|daughter)\b/i.test(lower) ||
    /(?:won'?t|can'?t|not allowed).*(?:see|visit).*(?:my\s+)?(?:kids?|children|son|daughter)\b/i.test(lower)
  );
}

/**
 * Detect if a query is about tenant rights/eviction legal help
 */
export function isTenantLegalQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return (
    /\b(tenant|eviction|evicted|getting evicted|being evicted)\b/i.test(lower) &&
    /\b(rights|legal|help|lawyer|law)\b/i.test(lower)
  );
}

/**
 * Pin Al-Anon service to the top of results for family addiction queries
 */
export function pinAlAnonService(services: LiteService[]): LiteService[] {
  // Remove any existing Al-Anon entries to avoid duplicates
  const filtered = services.filter(s =>
    !s.id?.includes('al-anon') && !s.name?.toLowerCase().includes('al-anon')
  );

  // Prepend the pinned Al-Anon service
  filtered.unshift({ ...ALANON_SERVICE });

  // Update the original array in place
  services.length = 0;
  services.push(...filtered);

  return services;
}

/**
 * Ensure legal aid service is in results for tenant/eviction queries
 * Doesn't pin to top (crisis is more important), but ensures it's included
 */
export function ensureLegalAidInResults(services: LiteService[]): LiteService[] {
  // Check if any legal aid service is already in results
  const hasLegalAid = services.some(s =>
    /legal.*centre|legal.*aid|pro bono|student legal/i.test(s.name || '')
  );

  if (!hasLegalAid) {
    // Add legal aid service near the top (position 2 to allow crisis services first)
    services.splice(Math.min(1, services.length), 0, LEGAL_AID_SERVICE);
  }

  return services;
}

/**
 * Check if a service ID is Al-Anon
 */
export function isAlAnonServiceId(serviceId: string): boolean {
  return serviceId === 'al-anon-family-groups-edmonton-24-7-edmonton-area';
}

/**
 * Check if a service ID is the legal aid service
 */
export function isLegalAidServiceId(serviceId: string): boolean {
  return serviceId === 'edmonton-community-legal-centre-10020-100-street-nw-edmonton-ab-t5j-0n3';
}
