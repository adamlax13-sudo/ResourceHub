-- Vector Embeddings Migration
-- Adds pgvector extension and embedding column for semantic search
-- Uses OpenAI text-embedding-3-small (1536 dimensions)

-- ============= 1. ENABLE PGVECTOR EXTENSION =============
-- Note: On Render/Supabase/Neon, pgvector is pre-installed
-- For local PostgreSQL, run: CREATE EXTENSION vector;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============= 2. ADD EMBEDDING COLUMN =============
-- 1536 dimensions for text-embedding-3-small model
ALTER TABLE services ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ============= 3. CREATE VECTOR INDEX =============
-- IVFFlat index for approximate nearest neighbor search
-- lists = sqrt(n) where n is expected row count (we'll use 100 for ~10k services)
-- For smaller datasets, use HNSW instead (more accurate, works well < 1M rows)
CREATE INDEX IF NOT EXISTS idx_services_embedding ON services
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Alternative: HNSW index (better accuracy, higher memory)
-- CREATE INDEX IF NOT EXISTS idx_services_embedding_hnsw ON services
-- USING hnsw (embedding vector_cosine_ops);

-- ============= 4. EMBEDDING SEARCH FUNCTION =============
-- Returns services ordered by semantic similarity to query embedding
CREATE OR REPLACE FUNCTION semantic_search_services(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  category VARCHAR(255),
  description TEXT,
  location VARCHAR(500),
  contact TEXT,
  website_url TEXT,
  eligibility TEXT,
  process_steps JSONB,
  wait_times VARCHAR(255),
  required_docs JSONB,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.service_id,
    s.name,
    s.category,
    s.description,
    s.location,
    s.contact,
    s.website_url,
    s.eligibility,
    s.process_steps,
    s.wait_times,
    s.required_docs,
    s.phone,
    s.email,
    s.address,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM services s
  WHERE s.is_active = true
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============= 5. HYBRID SEARCH FUNCTION =============
-- Combines semantic similarity with full-text search for better results
CREATE OR REPLACE FUNCTION hybrid_search_services(
  query_embedding vector(1536),
  query_text TEXT,
  semantic_weight FLOAT DEFAULT 0.7,
  fulltext_weight FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  category VARCHAR(255),
  description TEXT,
  location VARCHAR(500),
  contact TEXT,
  website_url TEXT,
  eligibility TEXT,
  process_steps JSONB,
  wait_times VARCHAR(255),
  required_docs JSONB,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.service_id,
    s.name,
    s.category,
    s.description,
    s.location,
    s.contact,
    s.website_url,
    s.eligibility,
    s.process_steps,
    s.wait_times,
    s.required_docs,
    s.phone,
    s.email,
    s.address,
    (
      semantic_weight * COALESCE(1 - (s.embedding <=> query_embedding), 0) +
      fulltext_weight * COALESCE(ts_rank(s.search_vector, plainto_tsquery('english', query_text)), 0)
    ) AS combined_score
  FROM services s
  WHERE s.is_active = true
    AND (
      s.embedding IS NOT NULL
      OR s.search_vector @@ plainto_tsquery('english', query_text)
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============= 6. ADD EMBEDDING METADATA =============
-- Track when embeddings were last generated
ALTER TABLE services ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP;
