/**
 * Server helper utilities
 */

export * from './locations';
export * from './keywords';
export * from './pii';

/** Truncate a service name for log output. */
export function truncName(name: string, len = 40): string {
  return name.substring(0, len);
}
