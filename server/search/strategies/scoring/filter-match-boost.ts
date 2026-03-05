/**
 * Filter Match Boosting
 *
 * Boosts services that explicitly match UI filter values above
 * compatible-but-untagged services. Applied after hard filtering.
 */

import type { SearchFilters } from '@shared/routes';
import type { LiteService, LiteServiceWithDebug, ScoreExplanation } from '../../types';
import type { BoostOptions } from './name-match';
import { searchLog } from '../../logger';

const EXPLICIT_MATCH_MULTIPLIER = 1.8;

interface FilterMatchConfig {
  filterKey: keyof SearchFilters;
  getServiceValue: (svc: LiteService) => string | null | undefined;
  isExplicitMatch: (filterValue: any, serviceValue: string | null | undefined) => boolean;
  label: string;
}

const FILTER_MATCH_CONFIGS: FilterMatchConfig[] = [
  {
    filterKey: 'genderRestriction',
    getServiceValue: (svc) => svc.genderRestriction,
    isExplicitMatch: (filterVal, svcVal) => svcVal === filterVal,
    label: 'gender',
  },
  {
    filterKey: 'ageGroup',
    getServiceValue: (svc) => svc.ageGroup,
    isExplicitMatch: (filterVal, svcVal) => {
      if (svcVal === filterVal) return true;
      if (svcVal === 'youth_and_adult' && (filterVal === 'youth' || filterVal === 'adult')) return true;
      return false;
    },
    label: 'age',
  },
  {
    filterKey: 'serviceFormat',
    getServiceValue: (svc) => svc.serviceFormat?.toLowerCase() ?? null,
    isExplicitMatch: (filterVal, svcVal) => svcVal === filterVal?.toLowerCase(),
    label: 'format',
  },
];

export function applyFilterMatchBoosts(
  services: LiteService[],
  filters: SearchFilters,
  options?: BoostOptions,
): LiteService[] {
  const activeConfigs = FILTER_MATCH_CONFIGS.filter(c => {
    const val = filters[c.filterKey];
    if (val === undefined || val === null) return false;
    if (val === 'all' || val === 'all_ages') return false;
    return true;
  });

  if (activeConfigs.length === 0) return services;

  const trackExplanations = options?.trackExplanations ?? false;
  let boostCount = 0;

  const boosted = services.map(svc => {
    let multiplier = 1.0;
    const explanations: ScoreExplanation[] = [];

    for (const config of activeConfigs) {
      const svcVal = config.getServiceValue(svc);
      const filterVal = filters[config.filterKey];

      if (config.isExplicitMatch(filterVal, svcVal)) {
        multiplier *= EXPLICIT_MATCH_MULTIPLIER;
        if (trackExplanations) {
          explanations.push({
            factor: `filterMatch.${config.label}`,
            value: EXPLICIT_MATCH_MULTIPLIER,
            reason: `Explicit ${config.label} match (${EXPLICIT_MATCH_MULTIPLIER}x)`,
          });
        }
      }
    }

    if (multiplier === 1.0) return svc;

    boostCount++;
    const newScore = (svc.rrfScore ?? 0) * multiplier;
    const result: LiteService = { ...svc, rrfScore: newScore };

    if (trackExplanations && explanations.length > 0) {
      const withDebug = result as LiteServiceWithDebug;
      withDebug.scoreExplanation = [
        ...((svc as LiteServiceWithDebug).scoreExplanation ?? []),
        ...explanations,
      ];
    }

    return result;
  });

  boosted.sort((a, b) => (b.rrfScore ?? 0) - (a.rrfScore ?? 0));

  searchLog.debug(`[FilterMatchBoost] Boosted ${boostCount}/${services.length} services`);

  return boosted;
}
