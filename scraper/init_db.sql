-- Initialize database for service scraper
-- Run this if you prefer SQL over SQLAlchemy migrations

-- Services table (current data)
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    category VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    contact TEXT,
    eligibility TEXT,
    process_steps JSONB,
    wait_times VARCHAR(255),
    required_docs JSONB,
    hours_of_operation VARCHAR(500),
    languages_supported JSONB,
    service_format VARCHAR(100),
    website_url TEXT,
    booking_url TEXT,
    data_source VARCHAR(255),
    confidence_score INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags JSONB,
    notes TEXT
);

-- Service history table (change tracking)
CREATE TABLE IF NOT EXISTS service_history (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(255) NOT NULL REFERENCES services(service_id),
    name VARCHAR(500) NOT NULL,
    category VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    contact TEXT,
    eligibility TEXT,
    process_steps JSONB,
    wait_times VARCHAR(255),
    required_docs JSONB,
    hours_of_operation VARCHAR(500),
    languages_supported JSONB,
    service_format VARCHAR(100),
    website_url TEXT,
    booking_url TEXT,
    changed_fields JSONB,
    change_type VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_source VARCHAR(255),
    confidence_score INTEGER DEFAULT 100
);

-- Scraper logs table
CREATE TABLE IF NOT EXISTS scraper_logs (
    id SERIAL PRIMARY KEY,
    run_id VARCHAR(100) UNIQUE NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50),
    services_checked INTEGER DEFAULT 0,
    services_updated INTEGER DEFAULT 0,
    services_created INTEGER DEFAULT 0,
    services_deactivated INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    errors JSONB,
    duration_seconds INTEGER
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_service_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_last_checked ON services(last_checked);
CREATE INDEX IF NOT EXISTS idx_service_id ON services(service_id);

CREATE INDEX IF NOT EXISTS idx_history_service_id ON service_history(service_id);
CREATE INDEX IF NOT EXISTS idx_history_recorded_at ON service_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_history_service_recorded ON service_history(service_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_scraper_log_started ON scraper_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_scraper_log_run_id ON scraper_logs(run_id);

-- Useful queries

-- View all services
-- SELECT * FROM services WHERE is_active = TRUE ORDER BY category, name;

-- View recent changes
-- SELECT s.name, sh.change_type, sh.changed_fields, sh.recorded_at
-- FROM service_history sh
-- JOIN services s ON sh.service_id = s.service_id
-- ORDER BY sh.recorded_at DESC
-- LIMIT 20;

-- View scraper statistics
-- SELECT
--     run_id,
--     started_at,
--     status,
--     services_checked,
--     services_updated,
--     services_created,
--     duration_seconds
-- FROM scraper_logs
-- ORDER BY started_at DESC
-- LIMIT 10;

-- Services that haven't been checked in 30+ days
-- SELECT name, category, last_checked
-- FROM services
-- WHERE last_checked < CURRENT_TIMESTAMP - INTERVAL '30 days'
-- ORDER BY last_checked ASC;

-- Most frequently updated services
-- SELECT
--     service_id,
--     COUNT(*) as update_count,
--     MAX(recorded_at) as last_update
-- FROM service_history
-- WHERE change_type = 'updated'
-- GROUP BY service_id
-- ORDER BY update_count DESC
-- LIMIT 10;
