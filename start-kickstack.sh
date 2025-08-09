#!/bin/bash

# KickStack Quick Start Script
# This script starts all KickStack services and verifies they're running

set -e

echo "🚀 KickStack Quick Start"
echo "========================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
check_docker() {
    if docker info >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Docker is running"
        return 0
    else
        echo -e "${RED}✗${NC} Docker is not running"
        echo ""
        echo "Please start Docker Desktop and try again."
        echo "On macOS: Open Docker from Applications or run: open -a Docker"
        echo "On Linux: sudo systemctl start docker"
        exit 1
    fi
}

# Navigate to infrastructure directory
cd "$(dirname "$0")/infra"

echo "Step 1: Checking Docker..."
check_docker

echo ""
echo "Step 2: Starting KickStack services..."
echo "--------------------------------------"

# Start services
docker-compose up -d

echo ""
echo "Step 3: Waiting for services to be ready..."
echo "-------------------------------------------"

# Wait for PostgreSQL
echo -n "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U kick -d kickstack >/dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Wait for PostgREST
echo -n "Waiting for PostgREST API..."
for i in {1..30}; do
    if curl -s http://localhost:3050/ >/dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Wait for GoTrue
echo -n "Waiting for Auth service..."
for i in {1..30}; do
    if curl -s http://localhost:9999/settings >/dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "Step 4: Service Status"
echo "----------------------"

# Check all services
docker-compose ps

echo ""
echo -e "${GREEN}✅ KickStack is ready!${NC}"
echo ""
echo "Service URLs:"
echo "  • REST API:    http://localhost:3050"
echo "  • Auth:        http://localhost:9999"
echo "  • Dashboard:   http://localhost:3001 (run: npm run web:dev)"
echo "  • WebSocket:   ws://localhost:8081 (run: npm run realtime:dev)"
echo "  • MinIO:       http://localhost:9001 (admin/changeme123)"
echo "  • MailHog:     http://localhost:8025"
echo ""
echo "Quick Test:"
echo "  curl http://localhost:3050/"
echo ""
echo "To stop services:"
echo "  cd infra && docker-compose down"
echo ""
echo "To view logs:"
echo "  cd infra && docker-compose logs -f [service-name]"