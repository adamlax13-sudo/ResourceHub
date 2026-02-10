/**
 * Base Search Strategy
 *
 * Interface that all search strategies must implement.
 */

import type { QueryAnalysis, SearchInput, SearchResult } from '../types';

/**
 * Abstract interface for search strategies.
 * Each strategy (fast, comprehensive) implements this interface.
 */
export interface SearchStrategy {
  /**
   * Execute the search with the given query analysis
   *
   * @param analysis - Parsed query information
   * @param input - Original search input (for pagination, etc.)
   * @returns Search results with services and metadata
   */
  search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult>;

  /**
   * Name of the strategy for logging
   */
  readonly name: string;
}

/**
 * Base class with shared utilities that strategies can extend
 */
export abstract class BaseSearchStrategy implements SearchStrategy {
  abstract readonly name: string;
  abstract search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult>;

  /**
   * Truncate description to a maximum length for lite results
   */
  protected truncateDescription(desc: string | null, maxLength: number = 150): string {
    if (!desc) return '';
    return desc.length > maxLength ? desc.slice(0, maxLength - 3) + '...' : desc;
  }

  /**
   * Build a summary string for the results
   */
  protected buildSummary(count: number, query: string, location?: string | null): string {
    const locationPhrase = location
      ? ` in ${this.formatLocationName(location)} and province-wide`
      : '';
    return `Found ${count} service${count === 1 ? '' : 's'} matching "${query}"${locationPhrase}`;
  }

  /**
   * Format location name with proper capitalization
   */
  protected formatLocationName(loc: string): string {
    return loc.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
