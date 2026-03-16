/**
 * Search diagnosis — programmatic wrapper for the diagnose_query CLI tool.
 * Used by the admin search-test endpoint.
 */

import { search } from './index';
import { analyzeQuery } from './analyzer';

export async function diagnoseQuery(query: string, filters?: any) {
  const analysis = analyzeQuery(query);
  const startTime = Date.now();
  const response = await search({
    query,
    page: 1,
    pageSize: 20,
    debug: true,
    ...filters,
  });
  const searchTimeMs = Date.now() - startTime;
  return { analysis, response, searchTimeMs };
}
