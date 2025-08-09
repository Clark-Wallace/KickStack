#!/bin/bash

# KickStack Quick Start Script
# Sets up KickStack with all services, validation, and optional demo data

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
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${PURPLE}🚀 KickStack Quick Start${NC}"
echo -e "${PURPLE}=======================${NC}"
echo ""

# Helper functions
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

section() {
    echo -e "\n${PURPLE}━━━ $1 ━━━${NC}"
}

# Parse command line options
SEED_DEMO_DATA="true"
VALIDATE_SETUP="true"
SKIP_BUILD="false"
FORCE_RESTART="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-seed)
            SEED_DEMO_DATA="false"
            shift
            ;;
        --no-validate)
            VALIDATE_SETUP="false"
            shift
            ;;
        --skip-build)
            SKIP_BUILD="true"
            shift
            ;;
        --restart)
            FORCE_RESTART="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --no-seed      Skip seeding demo data"
            echo "  --no-validate  Skip setup validation"
            echo "  --skip-build   Skip building CLI (use existing)"
            echo "  --restart      Force restart all services"
            echo "  --help         Show this help message"
            echo ""
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

section "Environment Check"

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    error "Docker is not installed. Please install Docker Desktop first."
    echo "   Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

success "Docker is running"

# Check if we're in the right directory
if [ ! -f "$INFRA_DIR/docker-compose.yml" ]; then
    error "Please run this script from the KickStack project root directory"
    exit 1
fi

success "Project structure validated"

section "Services Management"

cd "$INFRA_DIR"

if [ "$FORCE_RESTART" = "true" ]; then
    info "Force restarting all services..."
    docker-compose down
fi

# Check if services are already running
if docker-compose ps | grep -q "Up"; then
    info "Some services are already running"
    if [ "$FORCE_RESTART" = "false" ]; then
        warning "Use --restart flag to force restart all services"
    fi
else
    info "Starting KickStack services..."
    docker-compose up -d
fi

# Wait for services to be ready
info "Waiting for services to be ready..."
sleep 10

# Check service health
services_ready=0
max_attempts=30
attempt=1

while [ $services_ready -eq 0 ] && [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U kick -d kickstack >/dev/null 2>&1; then
        services_ready=1
        success "Services are ready!"
    else
        info "Waiting for services... (attempt $attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    fi
done

if [ $services_ready -eq 0 ]; then
    error "Services failed to start properly. Check logs with: docker-compose logs"
    exit 1
fi

section "CLI Setup"

cd "$PROJECT_ROOT"

if [ "$SKIP_BUILD" = "false" ]; then
    info "Building KickStack CLI..."
    cd ai/cli
    
    if [ ! -d "node_modules" ]; then
        info "Installing CLI dependencies..."
        npm install
    fi
    
    info "Building CLI..."
    npm run build
    
    cd "$PROJECT_ROOT"
    success "CLI built successfully"
else
    info "Skipping CLI build (--skip-build specified)"
fi

section "Setup Validation"

if [ "$VALIDATE_SETUP" = "true" ]; then
    info "Running comprehensive setup validation..."
    
    if [ -f "$SCRIPT_DIR/validate-setup.sh" ]; then
        if "$SCRIPT_DIR/validate-setup.sh"; then
            success "Setup validation passed!"
        else
            warning "Setup validation found issues. Review output above."
            echo "   Run manually: ./scripts/validate-setup.sh"
        fi
    else
        warning "Validation script not found, skipping validation"
    fi
else
    info "Skipping setup validation (--no-validate specified)"
fi

section "Demo Data Seeding"

if [ "$SEED_DEMO_DATA" = "true" ]; then
    info "Seeding demo data..."
    
    if [ -f "$SCRIPT_DIR/seed-demo-data.sh" ]; then
        if "$SCRIPT_DIR/seed-demo-data.sh" --type all; then
            success "Demo data seeded successfully!"
        else
            warning "Demo data seeding encountered issues. This is optional."
            echo "   Run manually: ./scripts/seed-demo-data.sh"
        fi
    else
        warning "Demo seeding script not found"
        echo "   You can seed data manually with: npm run kickstack seed"
    fi
else
    info "Skipping demo data seeding (--no-seed specified)"
fi

section "Quick Start Complete!"

echo ""
success "KickStack is now running and ready to use!"
echo ""

# Show service URLs
info "Service URLs:"
echo "   🌐 REST API:      http://localhost:${PGRST_PORT:-3050}"
echo "   🔐 Auth Service:  http://localhost:${GOTRUE_PORT:-9999}/settings"
echo "   📦 MinIO Console: http://localhost:${MINIO_CONSOLE_PORT:-9001}"
echo "   📧 Email Test:    http://localhost:${MAILHOG_WEB_PORT:-8025}"
echo "   📊 Dashboard:     http://localhost:${DASHBOARD_PORT:-3001}"
echo ""

info "Quick commands to try:"
echo "   • List tables:     curl http://localhost:${PGRST_PORT:-3050}/"
echo "   • Create table:    npm run kickstack add-table \"tasks with title, status\""
echo "   • Generate token:  npm run kickstack generate-token user"
echo "   • Add policies:    npm run kickstack add-policy owner tasks"
echo "   • View help:       npm run kickstack --help"
echo ""

info "Next steps:"
echo "   • Read the documentation: README.md"
echo "   • Try the tutorials in demos/"
echo "   • Install templates: npm run kickstack template list"
echo "   • Run validation anytime: ./scripts/validate-setup.sh"
echo ""

info "Need help? Check:"
echo "   • Debug services: ./scripts/debug-services.sh"
echo "   • View logs: docker-compose logs <service-name>"
echo "   • Community docs: https://github.com/yourusername/kickstack"
echo ""

success "Happy building with KickStack! 🎉"