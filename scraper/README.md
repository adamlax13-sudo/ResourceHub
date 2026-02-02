# Alberta Services Web Scraper

Automated web scraper that runs monthly to keep service information up-to-date in the PostgreSQL database.

## Features

- 🔄 Monthly automated scraping of service information
- 📊 Tracks changes over time in `service_history` table
- 🕒 Updates `last_checked` timestamp when no changes detected
- 📝 Comprehensive logging and error tracking
- 🛡️ Respectful scraping with delays and proper user agents

## Database Schema

### `services` Table
Stores current service information:
- Service identification (name, category, ID)
- Contact details (phone, email, website)
- Process steps and requirements
- Operational details (hours, languages)
- Tracking (last_checked, last_updated)

### `service_history` Table
Historical snapshots of service changes:
- Complete data snapshot at each change
- List of changed fields
- Change type (created, updated, deactivated)
- Timestamp of each change

### `scraper_logs` Table
Logs of scraper runs:
- Run statistics
- Error tracking
- Performance metrics

## Installation

### 1. Install Dependencies

```bash
cd scraper
pip install -r requirements.txt
```

### 2. Configure Database

Set your database connection in environment variable:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/recovery_hub"
```

Or create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/recovery_hub
```

### 3. Initialize Database

```bash
python scraper.py
```

This will create the necessary tables on first run.

## Usage

### Manual Run

```bash
python scraper.py
```

### Setup Monthly Cron Job

The scraper is designed to run on the 1st of every month at 2 AM:

```bash
chmod +x setup_cron.sh
./setup_cron.sh
```

**Cron Schedule:**
```
0 2 1 * * cd /path/to/scraper && python scraper.py >> logs/scraper.log 2>&1
```

This translates to:
- `0` = minute 0
- `2` = hour 2 (2 AM)
- `1` = day 1 (1st of month)
- `*` = every month
- `*` = any day of week

### Alternative Cron Schedules

**Weekly (every Sunday at 2 AM):**
```bash
0 2 * * 0 cd /path/to/scraper && python scraper.py
```

**Daily at 3 AM:**
```bash
0 3 * * * cd /path/to/scraper && python scraper.py
```

**Every 2 weeks:**
```bash
0 2 1,15 * * cd /path/to/scraper && python scraper.py
```

## How It Works

### 1. Data Loading
- Loads service data from `reference_data.py`
- Parses ALBERTA_SERVICES_REFERENCE from your routes.ts

### 2. Web Scraping
- For each service with a website URL:
  - Fetches the webpage
  - Extracts contact info, hours, description
  - Updates data with scraped information
  - Respects rate limits (1 second delay between requests)

### 3. Change Detection
- Compares scraped data with database
- Calculates which fields changed
- Creates hash for quick comparison

### 4. Database Sync
- **New Service:** Creates service record + history entry
- **Changed Service:** Updates record + creates history snapshot
- **Unchanged Service:** Only updates `last_checked` timestamp

### 5. Logging
- Tracks statistics (checked, updated, created)
- Records errors for debugging
- Measures performance

## sync_service_data() Function

The core function that handles data synchronization:

```python
sync_service_data(service_data, session, scraper=None)
```

**Parameters:**
- `service_data`: Dictionary with service information
- `session`: SQLAlchemy database session
- `scraper`: Optional ServiceScraper instance for tracking

**Returns:**
- `'created'`: New service was created
- `'updated'`: Existing service was updated
- `'unchanged'`: No changes detected

**Logic:**
1. Generate unique service ID from name + location
2. Check if service exists in database
3. If new: create service + history entry
4. If existing:
   - Compare all tracked fields
   - If changed: update service + create history snapshot
   - If unchanged: only update `last_checked`

## Monitoring

### View Scraper Logs

```bash
tail -f logs/scraper.log
```

### Query Scraper Runs

```sql
-- Recent scraper runs
SELECT * FROM scraper_logs
ORDER BY started_at DESC
LIMIT 10;

-- Services updated in last run
SELECT s.name, s.category, s.last_updated
FROM services s
WHERE s.last_updated > (
    SELECT started_at FROM scraper_logs
    ORDER BY started_at DESC
    LIMIT 1
);
```

### View Change History

```sql
-- Changes for a specific service
SELECT
    sh.recorded_at,
    sh.change_type,
    sh.changed_fields
FROM service_history sh
WHERE sh.service_id = 'alpha-house-society-calgary'
ORDER BY sh.recorded_at DESC;

-- Services with most changes
SELECT
    service_id,
    COUNT(*) as change_count
FROM service_history
WHERE change_type = 'updated'
GROUP BY service_id
ORDER BY change_count DESC
LIMIT 10;
```

## Customization

### Adding More Services

Update `reference_data.py` to include more services from your routes.ts:

```python
def parse_alberta_services():
    services = [
        {
            'name': 'Service Name',
            'category': 'Category',
            'contact': 'Phone, website',
            'description': 'Description',
            'process': ['Step 1', 'Step 2'],
            'waitTimes': 'Wait time info',
            'requiredDocs': ['Doc 1', 'Doc 2'],
            'location': 'Location',
            'eligibility': 'Eligibility'
        },
        # ... more services
    ]
    return services
```

### Adjusting Scraping Logic

Modify methods in `ServiceScraper` class in `scraper.py`:
- `_extract_contact_info()`: Change contact extraction logic
- `_extract_hours()`: Modify hours detection patterns
- `_extract_description()`: Adjust description extraction

### Changing Tracked Fields

Edit `detect_changes()` function to add/remove tracked fields:

```python
tracked_fields = [
    'name', 'description', 'contact',
    # Add your custom fields here
]
```

## Troubleshooting

### Database Connection Errors

```bash
# Test connection
python -c "from scraper import engine; print(engine.connect())"
```

### Scraping Failures

- Check if website requires authentication
- Verify user agent is not blocked
- Increase timeout in `_scrape_website()`
- Add retry logic for failed requests

### Cron Not Running

```bash
# Check if cron service is running
sudo systemctl status cron

# View cron logs
grep CRON /var/log/syslog

# Test script manually
cd /path/to/scraper && python scraper.py
```

## Production Deployment

### Using Render

Add to your `render.yaml`:

```yaml
services:
  - type: cron
    name: service-scraper
    runtime: python
    schedule: "0 2 1 * *"  # 1st of each month at 2 AM
    buildCommand: cd scraper && pip install -r requirements.txt
    startCommand: cd scraper && python scraper.py
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: recovery-hub-db
          property: connectionString
```

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app/scraper

COPY scraper/requirements.txt .
RUN pip install -r requirements.txt

COPY scraper/ .

CMD ["python", "scraper.py"]
```

## License

Same as main project.
