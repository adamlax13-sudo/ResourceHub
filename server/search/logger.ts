/**
 * Search debug logger — silent in production unless DEBUG_SEARCH is set.
 */
const isDebug = process.env.DEBUG_SEARCH === '1' || process.env.DEBUG_SEARCH === 'true';

export const searchLog = {
  debug: (...args: unknown[]) => {
    if (isDebug) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDebug) console.warn(...args);
  },
};
