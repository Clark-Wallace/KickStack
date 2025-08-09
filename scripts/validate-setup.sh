#!/bin/bash

# KickStack Setup Validation Script
# Comprehensive checks for all services and common issues

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$INFRA_DIR/.env" ]; then
    source "$INFRA_DIR/.env"
fi

# Default ports
PGRST_PORT=${PGRST_PORT:-3050}
GOTRUE_PORT=${GOTRUE_PORT:-9999}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
MINIO_API_PORT=${MINIO_API_PORT:-9000}
MINIO_CONSOLE_PORT=${MINIO_CONSOLE_PORT:-9001}
MAILHOG_WEB_PORT=${MAILHOG_WEB_PORT:-8025}
DASHBOARD_PORT=${DASHBOARD_PORT:-3001}

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

echo -e "${BLUE}🔍 KickStack Setup Validation${NC}"
echo -e "${BLUE}=============================${NC}"
echo ""

# Helper functions
pass_check() {
    echo -e "   ${GREEN}✅ $1${NC}"
    ((CHECKS_PASSED++))
}

fail_check() {
    echo -e "   ${RED}❌ $1${NC}"
    ((CHECKS_FAILED++))
}

warn_check() {
    echo -e "   ${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

info_check() {
    echo -e "   ${BLUE}ℹ️  $1${NC}"
}

# Check 1: Docker availability
echo -e "${YELLOW}🐳 Checking Docker...${NC}"
if command -v docker >/dev/null 2>&1; then
    pass_check "Docker is installed"
    
    if docker info >/dev/null 2>&1; then
        pass_check "Docker is running"
    else
        fail_check "Docker is not running - please start Docker Desktop"
    fi
else
    fail_check "Docker is not installed"
fi

# Check 2: Docker Compose
if command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1; then
    pass_check "Docker Compose is available"
else
    fail_check "Docker Compose is not available"
fi

# Check 3: Project structure
echo -e "\n${YELLOW}📁 Checking project structure...${NC}"
if [ -f "$INFRA_DIR/docker-compose.yml" ]; then
    pass_check "docker-compose.yml found"
else
    fail_check "docker-compose.yml not found at $INFRA_DIR"
fi

if [ -f "$INFRA_DIR/.env" ]; then
    pass_check ".env file found"
else
    warn_check ".env file not found - using defaults"
fi

# Check 4: Port conflicts
echo -e "\n${YELLOW}🔌 Checking port conflicts...${NC}"
check_port() {
    local port=$1
    local service=$2
    if command -v lsof >/dev/null 2>&1; then
        if lsof -i ":$port" >/dev/null 2>&1; then
            local process=$(lsof -i ":$port" -t 2>/dev/null | head -1)
            if [ -n "$process" ]; then
                local cmd=$(ps -p "$process" -o comm= 2>/dev/null || echo "unknown")
                if [[ "$cmd" == *"docker"* ]] || [[ "$cmd" == *"kickstack"* ]]; then
                    pass_check "Port $port ($service) - used by Docker/KickStack"
                else
                    warn_check "Port $port ($service) - used by: $cmd"
                fi
            fi
        else
            pass_check "Port $port ($service) - available"
        fi
    else
        info_check "lsof not available - cannot check port $port ($service)"
    fi
}

check_port $PGRST_PORT "PostgREST API"
check_port $GOTRUE_PORT "GoTrue Auth"
check_port $POSTGRES_PORT "PostgreSQL"
check_port $MINIO_API_PORT "MinIO API"
check_port $MINIO_CONSOLE_PORT "MinIO Console"
check_port $MAILHOG_WEB_PORT "MailHog Web"

# Check 5: Docker services
echo -e "\n${YELLOW}🏃 Checking Docker services...${NC}"
cd "$INFRA_DIR"

if docker-compose ps >/dev/null 2>&1; then
    # Get service status
    services=$(docker-compose ps --services 2>/dev/null || echo "")
    if [ -n "$services" ]; then
        for service in $services; do
            status=$(docker-compose ps -q "$service" 2>/dev/null | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not found")
            case "$status" in
                "running")
                    pass_check "$service - running"
                    ;;
                "exited")
                    fail_check "$service - exited"
                    ;;
                "restarting")
                    warn_check "$service - restarting"
                    ;;
                "not found")
                    fail_check "$service - not found"
                    ;;
                *)
                    warn_check "$service - status: $status"
                    ;;
            esac
        done
    else
        info_check "No services found - run 'docker-compose up -d' to start"
    fi
else
    info_check "Services not started - run 'docker-compose up -d'"
fi

# Check 6: API endpoints
echo -e "\n${YELLOW}🌐 Testing API endpoints...${NC}"
test_endpoint() {
    local url=$1
    local name=$2
    local timeout=${3:-5}
    
    if command -v curl >/dev/null 2>&1; then
        if curl -s --max-time "$timeout" "$url" >/dev/null 2>&1; then
            pass_check "$name - responding"
        else
            fail_check "$name - not responding at $url"
        fi
    else
        info_check "curl not available - cannot test $name"
    fi
}

test_endpoint "http://localhost:$PGRST_PORT/" "PostgREST API"
test_endpoint "http://localhost:$GOTRUE_PORT/settings" "GoTrue Auth"
test_endpoint "http://localhost:$MINIO_CONSOLE_PORT/minio/health/live" "MinIO"
test_endpoint "http://localhost:$MAILHOG_WEB_PORT/" "MailHog"

# Check 7: Database connectivity
echo -e "\n${YELLOW}🗄️  Testing database...${NC}"
if docker-compose exec -T postgres pg_isready -U kick -d kickstack >/dev/null 2>&1; then
    pass_check "PostgreSQL - accepting connections"
    
    # Test basic query
    if docker-compose exec -T postgres psql -U kick -d kickstack -c "SELECT 1;" >/dev/null 2>&1; then
        pass_check "PostgreSQL - queries working"
    else
        fail_check "PostgreSQL - cannot execute queries"
    fi
    
    # Check tables exist
    table_count=$(docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | tr -d '[:space:]' || echo "0")
    if [ "$table_count" -gt 0 ]; then
        pass_check "Database - $table_count tables found"
    else
        warn_check "Database - no tables found (run migrations)"
    fi
else
    fail_check "PostgreSQL - not accepting connections"
fi

# Check 8: Environment configuration
echo -e "\n${YELLOW}⚙️  Checking configuration...${NC}"
if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "changeme" ]; then
    pass_check "JWT_SECRET - configured"
else
    warn_check "JWT_SECRET - using default (change for production)"
fi

if [ -n "$MINIO_ROOT_USER" ] && [ "$MINIO_ROOT_USER" != "minioadmin" ]; then
    pass_check "MinIO credentials - configured"
else
    warn_check "MinIO credentials - using defaults (change for production)"
fi

# Check 9: CLI availability
echo -e "\n${YELLOW}🔧 Checking CLI...${NC}"
if [ -f "$PROJECT_ROOT/ai/cli/package.json" ]; then
    pass_check "CLI directory found"
    
    if [ -f "$PROJECT_ROOT/ai/cli/node_modules/.package-lock.json" ] || [ -f "$PROJECT_ROOT/ai/cli/node_modules/package-lock.json" ]; then
        pass_check "CLI dependencies installed"
    else
        warn_check "CLI dependencies not installed (run 'npm install' in ai/cli)"
    fi
else
    fail_check "CLI directory not found"
fi

# Check 10: Common issues
echo -e "\n${YELLOW}🐛 Checking common issues...${NC}"

# Check for permission issues
if [ -w "$PROJECT_ROOT" ]; then
    pass_check "Project directory - writable"
else
    warn_check "Project directory - permission issues may occur"
fi

# Check disk space
if command -v df >/dev/null 2>&1; then
    available_space=$(df -h . | awk 'NR==2 {print $4}' | sed 's/[^0-9.]//g' || echo "0")
    if [ "${available_space%.*}" -gt 1 ]; then
        pass_check "Disk space - sufficient (${available_space}GB available)"
    else
        warn_check "Disk space - low (${available_space}GB available)"
    fi
fi

# Final summary
echo -e "\n${BLUE}📊 Validation Summary${NC}"
echo -e "${BLUE}===================${NC}"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warnings - review recommendations above${NC}"
    fi
else
    echo -e "${RED}❌ $CHECKS_FAILED checks failed${NC}"
fi

echo -e "${GREEN}✅ $CHECKS_PASSED checks passed${NC}"

# Quick start suggestions
if [ $CHECKS_FAILED -gt 0 ] || [ $WARNINGS -gt 0 ]; then
    echo -e "\n${YELLOW}🚀 Quick Fixes:${NC}"
    
    if ! docker info >/dev/null 2>&1; then
        echo -e "   • Start Docker Desktop"
    fi
    
    if ! docker-compose ps >/dev/null 2>&1; then
        echo -e "   • Start services: ${BLUE}cd infra && docker-compose up -d${NC}"
    fi
    
    if [ "$JWT_SECRET" == "changeme" ]; then
        echo -e "   • Generate JWT secret: ${BLUE}openssl rand -hex 32${NC}"
    fi
    
    echo -e "   • For detailed setup: ${BLUE}./start-kickstack.sh${NC}"
fi

echo -e "\n${BLUE}🔗 Useful URLs:${NC}"
echo -e "   • REST API:     http://localhost:$PGRST_PORT"
echo -e "   • Auth:         http://localhost:$GOTRUE_PORT/settings"
echo -e "   • MinIO Console: http://localhost:$MINIO_CONSOLE_PORT"
echo -e "   • Email Test:   http://localhost:$MAILHOG_WEB_PORT"
echo -e "   • Dashboard:    http://localhost:$DASHBOARD_PORT"

exit $CHECKS_FAILED