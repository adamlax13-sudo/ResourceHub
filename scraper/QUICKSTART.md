# Quick Start Guide

Get the scraper running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd scraper
pip install -r requirements.txt
```

## Step 2: Configure Database

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and set your database URL:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/recovery_hub
```

## Step 3: Initialize Database

The scraper will automatically create tables on first run:

```bash
python scraper.py
```

Or use the SQL migration:

```bash
psql $DATABASE_URL -f init_db.sql
```

## Step 4: Test Run

```bash
python scraper.py
```

You should see output like:

```
INFO - Starting scraper run
INFO - Created new service: 211 Alberta
INFO - Created new service: 988 Suicide Crisis Helpline
...
INFO - Scraper completed: 7 checked, 7 created, 0 updated, 0 errors
```

## Step 5: Setup Monthly Cron

```bash
chmod +x setup_cron.sh
./setup_cron.sh
```

Verify it's installed:

```bash
crontab -l
```

You should see:

```
0 2 1 * * cd /path/to/scraper && python scraper.py >> logs/scraper.log 2>&1
```

## Done! ✅

Your scraper is now running monthly. Check logs:

```bash
tail -f logs/scraper.log
```

## Query Your Data

```sql
-- View all services
SELECT name, category, last_checked FROM services;

-- View recent changes
SELECT
    s.name,
    sh.change_type,
    sh.changed_fields,
    sh.recorded_at
FROM service_history sh
JOIN services s ON sh.service_id = s.service_id
ORDER BY sh.recorded_at DESC
LIMIT 10;

-- Scraper statistics
SELECT * FROM scraper_logs ORDER BY started_at DESC LIMIT 1;
```

## Next Steps

1. **Customize Reference Data**: Edit `reference_data.py` to add more services
2. **Adjust Schedule**: Edit cron schedule in `setup_cron.sh`
3. **Monitor**: Check `logs/scraper.log` regularly
4. **Query History**: Use SQL queries to analyze changes over time

## Troubleshooting

**Database connection failed?**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**Cron not running?**
```bash
# Check cron logs
grep CRON /var/log/syslog | tail -20
```

**Scraping failing?**
```bash
# Run with verbose logging
python -u scraper.py 2>&1 | tee logs/debug.log
```

## Support

See [README.md](README.md) for full documentation.
