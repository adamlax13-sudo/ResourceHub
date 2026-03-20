/**
 * Storage entry point — re-exports from the storage/ directory.
 *
 * All existing `import { storage } from "../storage"` paths continue
 * to work unchanged. The implementation lives in storage/storage-impl.ts,
 * orchestrated by the facade in storage/index.ts.
 */
export { storage, DatabaseStorage } from './storage/index';
export type { IStorage, SemanticSearchResult, FastSearchResult, EnrichmentData } from './storage/index';
