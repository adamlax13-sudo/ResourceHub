import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Render.com requires SSL but doesn't provide a CA cert for verification.
// drizzle-kit's URL-based credentials don't accept an ssl property,
// so we append sslmode=require to the connection string instead.
const url = process.env.DATABASE_URL;
const isLocal = url.includes('localhost');
const dbUrl = isLocal || url.includes('sslmode=')
  ? url
  : `${url}${url.includes('?') ? '&' : '?'}sslmode=require`;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
