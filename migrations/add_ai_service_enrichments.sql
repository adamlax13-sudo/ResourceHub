-- Migration: Add AI Service Enrichments table
-- Stores OpenAI-generated service details so future searches can reuse them
-- without calling the API again. Searches get faster over time as more
-- services accumulate enrichments from previous queries.

CREATE TABLE IF NOT EXISTS ai_service_enrichments (
  id SERIAL PRIMARY KEY,
  service_id VARCHAR(255) NOT NULL UNIQUE,
  service_name VARCHAR(500) NOT NULL,
  ai_description TEXT NOT NULL,
  ai_category VARCHAR(255),
  ai_process_steps JSONB NOT NULL DEFAULT '[]',
  ai_eligibility TEXT,
  ai_wait_times VARCHAR(255),
  ai_required_docs JSONB DEFAULT '[]',
  ai_location TEXT,
  ai_contact TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
