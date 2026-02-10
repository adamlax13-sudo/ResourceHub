-- Add normalized contact fields for better search functionality
-- These fields contain extracted, structured data from the contact column
-- The original contact column remains unchanged for display purposes

-- Add phone number column (extracted from contact)
ALTER TABLE services ADD COLUMN IF NOT EXISTS phone VARCHAR(100);

-- Add email column (extracted from contact)
ALTER TABLE services ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add address column (for structured location data)
ALTER TABLE services ADD COLUMN IF NOT EXISTS address TEXT;

-- Add search_text column - concatenated searchable text for full-text search
ALTER TABLE services ADD COLUMN IF NOT EXISTS search_text TEXT;

-- Create indexes for faster searching
CREATE INDEX IF NOT EXISTS idx_services_phone ON services(phone);
CREATE INDEX IF NOT EXISTS idx_services_email ON services(email);
CREATE INDEX IF NOT EXISTS idx_services_search_text ON services USING gin(to_tsvector('english', COALESCE(search_text, '')));

-- Create a function to normalize phone numbers for searching
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT) RETURNS TEXT AS $$
BEGIN
    IF phone IS NULL THEN
        RETURN NULL;
    END IF;
    -- Remove all non-digit characters for consistent searching
    RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create index on normalized phone for flexible phone search
CREATE INDEX IF NOT EXISTS idx_services_phone_normalized ON services(normalize_phone(phone));
