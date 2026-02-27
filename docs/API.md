# API Reference

Base URL: `https://recoveryoncampusalberta.ca` (production) or `http://localhost:5000` (development)

## Search

### POST /api/search

Search for services using natural language queries.

**Rate limit:** Strict (see `server/middleware/rateLimiter.ts`)

**Request body:**

```json
{
  "query": "food bank near Calgary",
  "location": "Calgary",
  "page": 1,
  "pageSize": 20,
  "debug": false,
  "hp": ""
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query (1-200 chars) |
| `location` | string | No | Location filter |
| `page` | number | No | Page number (default: 1) |
| `pageSize` | number | No | Results per page (1-50, default: 20) |
| `debug` | boolean | No | Include score explanations in response |
| `hp` | string | No | Honeypot field — must be empty |

**Response (200):**

```json
{
  "services": [
    {
      "id": "calgary-food-bank",
      "name": "Calgary Food Bank",
      "category": "Food & Basic Needs",
      "description": "Provides emergency food hampers...",
      "location": "Calgary",
      "waitTimes": "Same day"
    }
  ],
  "summary": "Found 12 food assistance services near Calgary.",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalResults": 12,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

When `debug: true`, each service includes a `scoreExplanation` array:

```json
{
  "scoreExplanation": [
    { "factor": "intent_match", "value": 1.5, "reason": "Category matches food_assistance intent" },
    { "factor": "name_match", "value": 2.0, "reason": "Query keyword 'food bank' found in service name" }
  ]
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid input (Zod validation) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Service Details

### GET /api/services/:id

Get full details for a specific service. Called when a user expands a search result card.

**Response (200):**

```json
{
  "id": "calgary-food-bank",
  "name": "Calgary Food Bank",
  "category": "Food & Basic Needs",
  "description": "Full description of the service...",
  "location": "Calgary, AB",
  "contact": "403-253-2059",
  "websiteUrl": "https://calgaryfoodbank.com",
  "eligibility": "Open to all Calgary residents in need",
  "process": ["Call to register", "Bring ID to pickup"],
  "waitTimes": "Same day",
  "requiredDocs": ["Photo ID", "Proof of address"],
  "phone": "403-253-2059",
  "email": "info@calgaryfoodbank.com",
  "address": "5000 11 Street SE, Calgary, AB"
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid service ID |
| 404 | Service not found |

---

## Feedback

### POST /api/feedback

Submit user feedback.

**Rate limit:** Feedback-specific (more restrictive)

**Request body:**

```json
{
  "name": "Jane",
  "email": "jane@example.com",
  "message": "The search results for mental health were very helpful!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Feedback text (1-2000 chars) |
| `name` | string | No | Submitter name |
| `email` | string | No | Submitter email |
| `hp` | string | No | Honeypot — must be empty |

**Response (200):** `{ "success": true, "id": 42 }`

---

## Click Tracking

### POST /api/track-click

Track when a user clicks a search result. Used to improve rankings over time.

**Request body:**

```json
{
  "serviceId": "calgary-food-bank",
  "query": "food bank",
  "position": 3
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serviceId` | string | Yes | ID of clicked service |
| `query` | string | Yes | Search query that produced this result |
| `position` | number | No | Position in results (1-indexed) |

**Response (200):** `{ "success": true }`

---

## Analytics

### GET /api/analytics/popular-searches

Get most popular search queries.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Max results (1-100) |

**Response (200):**

```json
{
  "success": true,
  "searches": [
    { "query": "food bank", "count": 145 },
    { "query": "mental health", "count": 98 }
  ]
}
```

---

## Admin Endpoints

All admin endpoints require the `X-Admin-Key` header matching the `ADMIN_API_KEY` environment variable.

### POST /api/admin/refresh-search

Refresh the materialized search view and clear the search cache. Call after marking services as inactive or making bulk data changes.

**Headers:** `X-Admin-Key: <ADMIN_API_KEY>`

**Response (200):** `{ "success": true, "message": "Search view refreshed and cache cleared" }`

### POST /api/admin/persist-enrichments

Copy AI enrichment data to the services table for empty fields only. Reduces future enrichment lookups.

**Headers:** `X-Admin-Key: <ADMIN_API_KEY>`

**Response (200):**

```json
{
  "success": true,
  "message": "Persisted enrichments to 15 services (42 fields total)",
  "servicesUpdated": 15,
  "totalFieldsUpdated": 42,
  "enrichmentsProcessed": 200
}
```

---

## Health Check

### GET /api/health

Returns application health status. Not rate limited.

---

## CSRF Protection

All non-GET requests require a CSRF token.

### GET /api/csrf-token

Returns a CSRF token to include in subsequent requests.

**Response (200):** `{ "csrfToken": "..." }`

Include the token in request headers or body for POST/PUT/DELETE requests.

---

## Error Format

All error responses follow this structure:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": "Technical detail (development only)",
  "errors": [{ "path": ["field"], "message": "Validation error" }]
}
```

The `error` field is only populated in development (`NODE_ENV !== 'production'`). The `errors` array is only present for Zod validation failures.
