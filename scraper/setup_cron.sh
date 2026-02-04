#!/bin/bash
# Setup cron job for monthly unified scraper runs.
# NOTE: On Render, scheduling is handled via render.yaml cron service.
#       This script is for local/self-hosted setups only.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_PATH=$(which python3)
SCRAPER_SCRIPT="$SCRIPT_DIR/scraper.py"
LOG_FILE="$SCRIPT_DIR/logs/scraper.log"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Cron job to run on the 1st of every month at 2 AM
# Format: minute hour day month day-of-week command
CRON_SCHEDULE="0 2 1 * *"

# Full cron command — loads .env for DATABASE_URL and OPENAI key
CRON_COMMAND="cd $SCRIPT_DIR && $PYTHON_PATH $SCRAPER_SCRIPT >> $LOG_FILE 2>&1"

# Add to crontab (removes any previous entry for this script first)
(crontab -l 2>/dev/null | grep -v "$SCRAPER_SCRIPT"; echo "$CRON_SCHEDULE $CRON_COMMAND") | crontab -

echo "Cron job installed successfully!"
echo "Schedule: $CRON_SCHEDULE (1st of each month at 2 AM)"
echo "Script: $SCRAPER_SCRIPT (unified: reference + 211 + enrichment + websites)"
echo "Logs: $LOG_FILE"
echo ""
echo "To view cron jobs: crontab -l"
echo "To remove this job: crontab -e (then delete the line)"
