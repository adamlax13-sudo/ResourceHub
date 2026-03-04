# Query-Location Dropdown Sync — Design

**Date:** 2026-03-03
**Status:** Approved

## Problem

When a user has a city selected in the location dropdown (e.g., "Calgary") but types a query mentioning a different city (e.g., "shelters in Edmonton"), the backend ignores the query-detected location because the dropdown value always takes priority. The user gets Calgary results, which is confusing.

## Solution

On search submit, run a lightweight location extraction on the query text (frontend-side). If a location is detected and the dropdown currently shows a different city, auto-update the dropdown to the detected city before firing the search.

**Approach:** Frontend-only detection. No backend changes needed.

## Implementation Details

### New utility: `client/src/lib/extract-query-location.ts`

A small function that mirrors the backend's `extractLocationContext` logic. It checks the query string against:

1. The `ALBERTA_LOCATIONS` dropdown values (22 cities)
2. A subset of common aliases (airport codes, short forms like "fort mac", "med hat", etc.)

Returns the matched dropdown value (e.g., `"edmonton"`) or `null` if no location found.

### Modified: `Hero.tsx` `handleSubmit`

Before submitting:
1. Call `extractQueryLocation(query)`
2. If a location is detected AND it differs from the current dropdown value:
   - Call `onLocationChange(detectedLocation)` to sync the dropdown
   - Pass the updated location array to `onSearch`
3. If no location detected, or it matches the dropdown → proceed as normal

### Edge Cases

- **City not in dropdown** (e.g., "wetaskiwin"): No dropdown update. Backend still detects it via its own broader location set.
- **Province-wide terms** ("Alberta", "province-wide"): Set dropdown to "All of Alberta" (empty string) if it isn't already.
- **Multiple cities** in query: Use the first match (same as backend behavior).
- **Voice search**: Same path — voice transcripts go through `onSearch` too.

### What does NOT change

- Backend logic — still works identically
- If the dropdown already matches the query location, nothing happens
- If no location is in the query, dropdown stays as-is
- Location text is NOT stripped from the query (backend handles it fine)
