/**
 * Timeout utilities for database and API operations
 */

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param operation Name of the operation for error messages
 * @returns The result of the promise, or throws if timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string = 'Operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

/**
 * Wraps a promise with a timeout, returning a default value on timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param defaultValue Value to return on timeout
 * @param operation Name of the operation for logging
 * @returns The result of the promise, or defaultValue if timeout
 */
export async function withTimeoutDefault<T>(
  promise: Promise<T>,
  timeoutMs: number,
  defaultValue: T,
  operation: string = 'Operation'
): Promise<T> {
  try {
    return await withTimeout(promise, timeoutMs, operation);
  } catch (err) {
    if (err instanceof Error && err.message.includes('timed out')) {
      console.warn(`[Timeout] ${operation} timed out after ${timeoutMs}ms, using default`);
      return defaultValue;
    }
    throw err;
  }
}

// Default timeouts for different operations
export const TIMEOUTS = {
  // Database operations
  DATABASE_QUERY: 5000,      // 5 seconds for most queries
  DATABASE_SEARCH: 10000,    // 10 seconds for complex searches

  // External API calls
  OPENAI_EMBEDDING: 8000,    // 8 seconds for embeddings
  OPENAI_COMPLETION: 15000,  // 15 seconds for completions

  // Search operations
  SEARCH_TOTAL: 30000,       // 30 seconds total search timeout
  CACHE_LOOKUP: 2000,        // 2 seconds for cache operations
} as const;
