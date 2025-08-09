#!/bin/bash

# PostgREST Schema Reload Script
# Reloads PostgREST schema cache after database changes

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

echo -e "${YELLOW}🔄 Reloading PostgREST schema cache...${NC}"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "$INFRA_DIR/docker-compose.yml" ]; then
    echo -e "${RED}❌ Cannot find docker-compose.yml. Run from KickStack root directory.${NC}"
    exit 1
fi

cd "$INFRA_DIR"

# Method 1: Try NOTIFY (fastest)
echo -e "${YELLOW}Trying NOTIFY reload...${NC}"
if docker-compose exec -T postgres psql -U kick -d kickstack -c "NOTIFY pgrst, 'reload schema';" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Schema reload notification sent${NC}"
    
    # Wait a moment for PostgREST to process
    sleep 2
    
    # Test if it's working
    if curl -s "http://localhost:${PGRST_PORT:-3050}/" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgREST is responding${NC}"
        exit 0
    fi
fi

# Method 2: Restart PostgREST service (more reliable)
echo -e "${YELLOW}Restarting PostgREST service...${NC}"
if docker-compose restart postgrest >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgREST service restarted${NC}"
    
    # Wait for service to be ready
    echo -e "${YELLOW}Waiting for PostgREST to be ready...${NC}"
    for i in {1..30}; do
        if curl -s "http://localhost:${PGRST_PORT:-3050}/" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgREST is ready!${NC}"
            exit 0
        fi
        sleep 1
    done
    
    echo -e "${RED}⚠️  PostgREST restarted but not responding on expected port${NC}"
    exit 1
else
    echo -e "${RED}❌ Failed to restart PostgREST${NC}"
    exit 1
fi