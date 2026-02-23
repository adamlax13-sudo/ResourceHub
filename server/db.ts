import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper limits and timeouts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool limits
  max: 20,                      // Maximum pool size (adjust based on DB limits)
  min: 2,                       // Minimum pool size to keep ready
  // Timeouts
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast on connection issues (5s)
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Log pool connection info in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    console.log('[DB] New client connected to pool');
  });
}

export const db = drizzle(pool, { schema });
