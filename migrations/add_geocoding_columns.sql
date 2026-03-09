-- Migration: Add geocoding columns for location services
-- Adds latitude/longitude coordinates, geocoding source tracking, and spatial index

ALTER TABLE services ADD COLUMN IF NOT EXISTS latitude REAL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS longitude REAL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS geocode_source VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP;

-- Partial index: only index rows that have coordinates
CREATE INDEX IF NOT EXISTS idx_services_lat_lng
  ON services(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Verification:
-- SELECT COUNT(*) FROM services WHERE latitude IS NOT NULL;
-- Should be 0 until batch geocoding script runs
