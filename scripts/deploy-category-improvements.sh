#!/bin/bash
# Deploy Category Improvements - Run this script with DATABASE_URL set
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/deploy-category-improvements.sh
#
# Or from Render shell:
#   ./scripts/deploy-category-improvements.sh

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is required"
  echo ""
  echo "Usage:"
  echo "  DATABASE_URL='postgresql://user:pass@host:5432/db' ./scripts/deploy-category-improvements.sh"
  echo ""
  echo "Or from Render shell (DATABASE_URL is auto-set):"
  echo "  ./scripts/deploy-category-improvements.sh"
  exit 1
fi

echo "🚀 Deploying Category Improvements"
echo "==================================="

# Run category improvements migration
echo ""
echo "📦 Step 1: Adding category improvement columns..."
psql "$DATABASE_URL" -f migrations/add_category_improvements.sql
echo "✓ Category improvements migration complete"

# Show summary of changes
echo ""
echo "📊 Step 2: Verifying new columns..."
psql "$DATABASE_URL" -c "
SELECT
  COUNT(*) as total_services,
  COUNT(service_type) as with_service_type,
  COUNT(gender_restriction) as with_gender_restriction,
  SUM(CASE WHEN is_24_7 THEN 1 ELSE 0 END) as is_24_7_count
FROM services
WHERE is_active = true;
"

echo ""
echo "📊 Service types distribution:"
psql "$DATABASE_URL" -c "
SELECT service_type, COUNT(*) as count
FROM services
WHERE is_active = true AND service_type IS NOT NULL
GROUP BY service_type
ORDER BY count DESC
LIMIT 10;
"

echo ""
echo "📊 Gender restrictions:"
psql "$DATABASE_URL" -c "
SELECT gender_restriction, COUNT(*) as count
FROM services
WHERE is_active = true AND gender_restriction IS NOT NULL
GROUP BY gender_restriction;
"

echo ""
echo "✅ Category improvements deployed!"
echo ""
echo "Next steps:"
echo "  1. Trigger scraper to populate new fields: Manually run cron job in Render dashboard"
echo "  2. Or run locally: cd scraper && python scraper.py --phases reference"
echo "  3. Verify with: npx tsx scripts/analyze-categories.ts"
