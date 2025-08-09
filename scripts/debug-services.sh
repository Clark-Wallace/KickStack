#!/bin/bash

# KickStack Service Debugging Script
# Provides detailed diagnostics for troubleshooting service issues

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

# Load environment variables
if [ -f "$INFRA_DIR/.env" ]; then
    source "$INFRA_DIR/.env"
fi

echo -e "${BLUE}🔍 KickStack Service Debugging${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Helper functions
section_header() {
    echo -e "\n${PURPLE}━━━ $1 ━━━${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is available
if ! command -v docker >/dev/null 2>&1; then
    error "Docker is not installed"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    error "Docker is not running - please start Docker Desktop"
    exit 1
fi

cd "$INFRA_DIR"

section_header "Docker Compose Status"
if docker-compose ps; then
    success "Docker Compose status retrieved"
else
    error "Failed to get Docker Compose status"
fi

section_header "Service Health Checks"
services=$(docker-compose ps --services 2>/dev/null || echo "")
if [ -n "$services" ]; then
    for service in $services; do
        echo -e "\n${YELLOW}🔍 Debugging $service...${NC}"
        
        # Get container info
        container_id=$(docker-compose ps -q "$service" 2>/dev/null || echo "")
        
        if [ -n "$container_id" ]; then
            # Container status
            status=$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")
            echo "   Status: $status"
            
            # Resource usage
            if [ "$status" = "running" ]; then
                stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" "$container_id" 2>/dev/null | tail -1 || echo "N/A N/A")
                echo "   Resources: $stats"
                
                # Health check
                health=$(docker inspect -f '{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "none")
                if [ "$health" != "none" ]; then
                    echo "   Health: $health"
                fi
            fi
            
            # Recent logs (last 10 lines)
            echo "   Recent logs:"
            docker logs --tail 10 "$container_id" 2>/dev/null | sed 's/^/     /' || echo "     No logs available"
        else
            error "$service - container not found"
        fi
    done
else
    warning "No services found - run 'docker-compose up -d' to start services"
fi

section_header "Network Connectivity"
network_name="kickstack_kickstack-network"
if docker network ls | grep -q "$network_name"; then
    echo "Network: $network_name exists"
    
    # List containers on network
    containers=$(docker network inspect "$network_name" -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "")
    if [ -n "$containers" ]; then
        echo "Connected containers: $containers"
    fi
else
    warning "KickStack network not found"
fi

section_header "Port Binding Analysis"
echo "Checking port bindings for conflicts..."

check_port_binding() {
    local port=$1
    local service=$2
    local container_id=$3
    
    if [ -n "$container_id" ]; then
        port_binding=$(docker port "$container_id" 2>/dev/null | grep ":$port" || echo "")
        if [ -n "$port_binding" ]; then
            success "$service - port $port bound correctly: $port_binding"
        else
            error "$service - port $port not bound"
        fi
    fi
}

for service in $services; do
    container_id=$(docker-compose ps -q "$service" 2>/dev/null || echo "")
    case "$service" in
        "postgrest")
            check_port_binding "${PGRST_PORT:-3050}" "$service" "$container_id"
            ;;
        "gotrue")
            check_port_binding "${GOTRUE_PORT:-9999}" "$service" "$container_id"
            ;;
        "postgres")
            check_port_binding "${POSTGRES_PORT:-5432}" "$service" "$container_id"
            ;;
        "minio")
            check_port_binding "${MINIO_API_PORT:-9000}" "$service" "$container_id"
            check_port_binding "${MINIO_CONSOLE_PORT:-9001}" "$service" "$container_id"
            ;;
        "mailhog")
            check_port_binding "${MAILHOG_WEB_PORT:-8025}" "$service" "$container_id"
            ;;
    esac
done

section_header "API Endpoint Testing"
test_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
        if [ "$response" = "$expected_status" ]; then
            success "$name - responding with HTTP $response"
        else
            error "$name - HTTP $response (expected $expected_status) at $url"
            
            # Try to get more details
            if [ "$response" != "000" ]; then
                echo "     Response details:"
                curl -s --max-time 5 "$url" 2>/dev/null | head -3 | sed 's/^/       /' || echo "       No response body"
            fi
        fi
    else
        warning "curl not available - cannot test $name"
    fi
}

test_endpoint "http://localhost:${PGRST_PORT:-3050}/" "PostgREST API" 200
test_endpoint "http://localhost:${GOTRUE_PORT:-9999}/settings" "GoTrue Auth" 200
test_endpoint "http://localhost:${MINIO_CONSOLE_PORT:-9001}/minio/health/live" "MinIO Health" 200
test_endpoint "http://localhost:${MAILHOG_WEB_PORT:-8025}/" "MailHog Web" 200

section_header "Database Diagnostics"
postgres_container=$(docker-compose ps -q postgres 2>/dev/null || echo "")
if [ -n "$postgres_container" ]; then
    echo "Testing PostgreSQL connectivity..."
    
    # Test connection
    if docker-compose exec -T postgres pg_isready -U kick -d kickstack >/dev/null 2>&1; then
        success "PostgreSQL - accepting connections"
        
        # Get database info
        echo "Database information:"
        docker-compose exec -T postgres psql -U kick -d kickstack -c "
            SELECT 
                pg_database.datname as database_name,
                pg_size_pretty(pg_database_size(pg_database.datname)) as size,
                (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as table_count,
                version() as postgres_version;
        " 2>/dev/null | sed 's/^/   /' || echo "   Could not retrieve database info"
        
        # Check for common issues
        echo ""
        echo "Checking for common database issues..."
        
        # Check if anon role exists
        anon_exists=$(docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT 1 FROM pg_roles WHERE rolname = 'anon';" 2>/dev/null | tr -d '[:space:]' || echo "0")
        if [ "$anon_exists" = "1" ]; then
            success "anon role exists"
        else
            error "anon role missing - PostgREST API will not work"
        fi
        
        # Check if authenticated role exists  
        auth_exists=$(docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT 1 FROM pg_roles WHERE rolname = 'authenticated';" 2>/dev/null | tr -d '[:space:]' || echo "0")
        if [ "$auth_exists" = "1" ]; then
            success "authenticated role exists"
        else
            error "authenticated role missing - authentication will not work"
        fi
        
        # Check for tables without permissions
        echo ""
        echo "Checking table permissions..."
        docker-compose exec -T postgres psql -U kick -d kickstack -c "
            SELECT t.tablename, 
                   CASE WHEN p.grantee IS NOT NULL THEN '✅ Has permissions' 
                        ELSE '❌ No permissions' END as status
            FROM pg_tables t
            LEFT JOIN (
                SELECT DISTINCT grantee, table_name 
                FROM information_schema.role_table_grants 
                WHERE grantee IN ('anon', 'authenticated')
            ) p ON t.tablename = p.table_name
            WHERE t.schemaname = 'public'
            ORDER BY t.tablename;
        " 2>/dev/null | sed 's/^/   /' || echo "   Could not check permissions"
        
    else
        error "PostgreSQL - not accepting connections"
    fi
else
    error "PostgreSQL container not found"
fi

section_header "Environment Configuration Issues"
echo "Checking environment configuration..."

# Check JWT_SECRET
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "changeme" ]; then
    error "JWT_SECRET not properly configured"
    echo "   Generate with: openssl rand -hex 32"
else
    success "JWT_SECRET is configured"
fi

# Check MinIO credentials
if [ -z "$MINIO_ROOT_USER" ] || [ "$MINIO_ROOT_USER" = "minioadmin" ]; then
    warning "MinIO credentials using defaults (not secure for production)"
else
    success "MinIO credentials configured"
fi

section_header "Volume and Data Persistence"
volumes=$(docker volume ls -f "name=kickstack" --format "{{.Name}}" 2>/dev/null || echo "")
if [ -n "$volumes" ]; then
    echo "KickStack volumes found:"
    for volume in $volumes; do
        size=$(docker system df -v | grep "$volume" | awk '{print $3}' || echo "unknown")
        echo "   $volume - $size"
    done
else
    warning "No KickStack volumes found - data may not be persisted"
fi

section_header "Quick Fix Recommendations"
echo "Based on the diagnostics above, here are recommended fixes:"
echo ""

# Generate fixes based on findings
if ! docker-compose ps >/dev/null 2>&1; then
    echo "• Start services: ${BLUE}docker-compose up -d${NC}"
fi

if [ "$JWT_SECRET" = "changeme" ] || [ -z "$JWT_SECRET" ]; then
    echo "• Generate JWT secret: ${BLUE}openssl rand -hex 32${NC}"
fi

# Check if any services are not running
for service in $services; do
    status=$(docker-compose ps -q "$service" 2>/dev/null | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not found")
    if [ "$status" != "running" ] && [ "$status" != "not found" ]; then
        echo "• Restart $service: ${BLUE}docker-compose restart $service${NC}"
    fi
done

echo ""
echo -e "${BLUE}💡 For more help, run:${NC}"
echo "   • ${BLUE}./validate-setup.sh${NC} - Full setup validation"
echo "   • ${BLUE}docker-compose logs <service>${NC} - View service logs"
echo "   • ${BLUE}./reload-postgrest.sh${NC} - Reload PostgREST after DB changes"