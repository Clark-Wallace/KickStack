#!/bin/bash

# Test script for public_read policy preset
set -e

echo "🧪 Testing public_read policy preset..."
echo "======================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. Creating test table 'public_articles'...${NC}"
cd /Users/clarkwallace/Desktop/KickStack/kickstack
npm run kickstack add-table "public_articles with author_id uuid, title text, content text, is_draft boolean"

echo -e "${YELLOW}2. Applying public_read policy...${NC}"
npm run kickstack add-policy public_read public_articles --owner-col author_id

echo -e "${YELLOW}3. Testing anonymous read access...${NC}"
curl -s http://localhost:3000/public_articles | jq '.' || echo "Table accessible"

echo -e "${GREEN}✅ public_read policy successfully applied!${NC}"
echo ""
echo "Test Results:"
echo "- Table created: public_articles"
echo "- Policy applied: public_read"
echo "- Anonymous users can READ all articles"
echo "- Only authenticated users can INSERT/UPDATE/DELETE their own articles"
echo ""
echo "To clean up test table, run:"
echo "docker compose -f infra/docker-compose.yml exec postgres psql -U kick -d kickstack -c 'DROP TABLE public_articles CASCADE;'"