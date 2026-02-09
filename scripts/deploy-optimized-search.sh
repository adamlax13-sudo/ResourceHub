#!/bin/bash
# Deploy Optimized Search - Run this script with DATABASE_URL set
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/deploy-optimized-search.sh
#
# Or from Render shell:
#   ./scripts/deploy-optimized-search.sh

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is required"
  echo ""
  echo "Usage:"
  echo "  DATABASE_URL='postgresql://user:pass@host:5432/db' ./scripts/deploy-optimized-search.sh"
  echo ""
  echo "Or from Render shell (DATABASE_URL is auto-set):"
  echo "  ./scripts/deploy-optimized-search.sh"
  exit 1
fi

echo "🚀 Deploying Optimized Search Infrastructure"
echo "============================================="

# Run vector embeddings migration
echo ""
echo "📦 Step 1: Adding pgvector extension and embedding column..."
psql "$DATABASE_URL" -f migrations/add_vector_embeddings.sql
echo "✓ Vector embeddings migration complete"

# Run optimized search migration
echo ""
echo "📦 Step 2: Creating optimized search functions and indexes..."
psql "$DATABASE_URL" -f migrations/add_optimized_search.sql
echo "✓ Optimized search migration complete"

# Refresh materialized view
echo ""
echo "🔄 Step 3: Refreshing materialized view..."
psql "$DATABASE_URL" -c "SELECT refresh_search_view();" 2>/dev/null || echo "⚠️ Materialized view refresh skipped (may not exist yet)"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Generate embeddings: cd scraper && python generate_embeddings.py"
echo "  2. Test search: curl -X POST http://localhost:5000/api/search -H 'Content-Type: application/json' -d '{\"query\":\"mental health\"}'"
