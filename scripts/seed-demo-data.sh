#!/bin/bash

# KickStack Demo Data Seeding Script
# Seeds the database with sample data for testing and demos

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

echo -e "${BLUE}🌱 KickStack Demo Data Seeding${NC}"
echo -e "${BLUE}===============================${NC}"
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

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running - please start Docker Desktop"
        exit 1
    fi
    
    # Check if PostgreSQL is running
    cd "$INFRA_DIR"
    if ! docker-compose exec -T postgres pg_isready -U kick -d kickstack >/dev/null 2>&1; then
        error "PostgreSQL is not running. Start with: docker-compose up -d postgres"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Execute SQL file
execute_sql_file() {
    local sql_file=$1
    local description=$2
    
    if [ ! -f "$sql_file" ]; then
        warning "SQL file not found: $sql_file"
        return 1
    fi
    
    info "Executing: $description"
    cd "$INFRA_DIR"
    
    if docker-compose exec -T postgres psql -U kick -d kickstack -f - < "$sql_file" >/dev/null 2>&1; then
        success "$description completed"
        return 0
    else
        error "$description failed"
        return 1
    fi
}

# Create sample organizations
seed_organizations() {
    local sql_file="$PROJECT_ROOT/tmp_org_seed.sql"
    
    cat > "$sql_file" << 'EOF'
-- Create sample organizations for multi-tenancy testing
INSERT INTO organizations (id, name, slug, settings, created_at) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Acme Corporation', 'acme', '{"plan": "enterprise"}', NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', 'StartupCo', 'startupco', '{"plan": "startup"}', NOW()),
    ('550e8400-e29b-41d4-a716-446655440002', 'FreelanceCorp', 'freelancecorp', '{"plan": "freelancer"}', NOW())
ON CONFLICT (id) DO NOTHING;
EOF
    
    execute_sql_file "$sql_file" "Organizations data"
    rm -f "$sql_file"
}

# Create sample users
seed_users() {
    local sql_file="$PROJECT_ROOT/tmp_users_seed.sql"
    
    cat > "$sql_file" << 'EOF'
-- Create sample users across organizations
INSERT INTO users (id, org_id, email, name, role, is_admin, metadata, created_at) VALUES
    ('user-550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'admin@acme.com', 'Alice Admin', 'admin', true, '{"department": "IT"}', NOW()),
    ('user-550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'bob@acme.com', 'Bob Builder', 'user', false, '{"department": "Engineering"}', NOW()),
    ('user-550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'carol@acme.com', 'Carol Customer', 'user', false, '{"department": "Sales"}', NOW()),
    ('user-550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'dave@startupco.com', 'Dave Developer', 'admin', true, '{"skills": ["React", "Node.js"]}', NOW()),
    ('user-550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'eve@startupco.com', 'Eve Engineer', 'user', false, '{"skills": ["Python", "PostgreSQL"]}', NOW()),
    ('user-550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 'frank@freelancecorp.com', 'Frank Freelancer', 'admin', true, '{"specialties": ["Design", "Frontend"]}', NOW())
ON CONFLICT (id) DO NOTHING;
EOF
    
    execute_sql_file "$sql_file" "Users data"
    rm -f "$sql_file"
}

# Create sample projects
seed_projects() {
    local sql_file="$PROJECT_ROOT/tmp_projects_seed.sql"
    
    cat > "$sql_file" << 'EOF'
-- Create sample projects for different organizations
INSERT INTO projects (id, org_id, name, description, status, owner_id, settings, created_at) VALUES
    ('proj-550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'Enterprise CRM', 'Customer relationship management system', 'active', 'user-550e8400-e29b-41d4-a716-446655440000', '{"budget": 50000}', NOW()),
    ('proj-550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Mobile App', 'iOS and Android mobile application', 'planning', 'user-550e8400-e29b-41d4-a716-446655440001', '{"platforms": ["iOS", "Android"]}', NOW()),
    ('proj-550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'MVP Website', 'Minimum viable product website', 'active', 'user-550e8400-e29b-41d4-a716-446655440003', '{"tech_stack": ["React", "Node.js", "PostgreSQL"]}', NOW()),
    ('proj-550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'API Gateway', 'Microservices API gateway', 'completed', 'user-550e8400-e29b-41d4-a716-446655440004', '{"services": 12}', NOW()),
    ('proj-550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'Portfolio Site', 'Personal portfolio website', 'active', 'user-550e8400-e29b-41d4-a716-446655440005', '{"technologies": ["Next.js", "TailwindCSS"]}', NOW())
ON CONFLICT (id) DO NOTHING;
EOF
    
    execute_sql_file "$sql_file" "Projects data"
    rm -f "$sql_file"
}

# Create sample blog posts
seed_blog_posts() {
    local sql_file="$PROJECT_ROOT/tmp_blog_seed.sql"
    
    cat > "$sql_file" << 'EOF'
-- Create sample blog posts
INSERT INTO posts (id, title, content, author_id, status, tags, view_count, created_at, published_at) VALUES
    ('post-550e8400-e29b-41d4-a716-446655440000', 'Getting Started with KickStack', 'KickStack is a revolutionary platform for rapid backend development...', 'user-550e8400-e29b-41d4-a716-446655440000', 'published', ARRAY['tutorial', 'getting-started'], 342, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
    ('post-550e8400-e29b-41d4-a716-446655440001', 'Building Your First API', 'In this tutorial, we will walk through creating your first REST API...', 'user-550e8400-e29b-41d4-a716-446655440001', 'published', ARRAY['tutorial', 'api', 'rest'], 189, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    ('post-550e8400-e29b-41d4-a716-446655440002', 'Advanced Database Patterns', 'Learn about advanced PostgreSQL patterns for scalable applications...', 'user-550e8400-e29b-41d4-a716-446655440003', 'published', ARRAY['database', 'postgresql', 'advanced'], 156, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    ('post-550e8400-e29b-41d4-a716-446655440003', 'Real-time Features with WebSockets', 'Implementing real-time functionality in your applications...', 'user-550e8400-e29b-41d4-a716-446655440004', 'draft', ARRAY['realtime', 'websockets'], 0, NOW() - INTERVAL '1 day', NULL),
    ('post-550e8400-e29b-41d4-a716-446655440004', 'Deployment Best Practices', 'Best practices for deploying KickStack applications to production...', 'user-550e8400-e29b-41d4-a716-446655440005', 'published', ARRAY['deployment', 'production', 'ops'], 267, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;
EOF
    
    execute_sql_file "$sql_file" "Blog posts data"
    rm -f "$sql_file"
}

# Create sample comments
seed_comments() {
    local sql_file="$PROJECT_ROOT/tmp_comments_seed.sql"
    
    cat > "$sql_file" << 'EOF'
-- Create sample comments on blog posts
INSERT INTO comments (id, post_id, author_id, content, status, created_at) VALUES
    ('comment-550e8400-e29b-41d4-a716-446655440000', 'post-550e8400-e29b-41d4-a716-446655440000', 'user-550e8400-e29b-41d4-a716-446655440001', 'Great tutorial! Very helpful for getting started.', 'approved', NOW() - INTERVAL '6 days'),
    ('comment-550e8400-e29b-41d4-a716-446655440001', 'post-550e8400-e29b-41d4-a716-446655440000', 'user-550e8400-e29b-41d4-a716-446655440002', 'Thanks for this. Looking forward to trying it out!', 'approved', NOW() - INTERVAL '5 days'),
    ('comment-550e8400-e29b-41d4-a716-446655440002', 'post-550e8400-e29b-41d4-a716-446655440001', 'user-550e8400-e29b-41d4-a716-446655440003', 'The API examples are really clear. More of this please!', 'approved', NOW() - INTERVAL '4 days'),
    ('comment-550e8400-e29b-41d4-a716-446655440003', 'post-550e8400-e29b-41d4-a716-446655440002', 'user-550e8400-e29b-41d4-a716-446655440000', 'Advanced patterns indeed. This saved me hours of research.', 'approved', NOW() - INTERVAL '2 days'),
    ('comment-550e8400-e29b-41d4-a716-446655440004', 'post-550e8400-e29b-41d4-a716-446655440004', 'user-550e8400-e29b-41d4-a716-446655440001', 'Deployment can be tricky. These tips are gold!', 'approved', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
EOF
    
    execute_sql_file "$sql_file" "Comments data"
    rm -f "$sql_file"
}

# Create sample chat data
seed_chat_data() {
    local sql_file="$PROJECT_ROOT/tmp_chat_seed.sql"
    
    cat > "$sql_file" << 'EOF'
-- Create sample chat rooms and messages
INSERT INTO chat_rooms (id, name, description, type, created_by, created_at) VALUES
    ('room-550e8400-e29b-41d4-a716-446655440000', 'General Discussion', 'Main chat room for general topics', 'public', 'user-550e8400-e29b-41d4-a716-446655440000', NOW() - INTERVAL '10 days'),
    ('room-550e8400-e29b-41d4-a716-446655440001', 'Technical Support', 'Get help with technical issues', 'public', 'user-550e8400-e29b-41d4-a716-446655440000', NOW() - INTERVAL '8 days'),
    ('room-550e8400-e29b-41d4-a716-446655440002', 'Feature Requests', 'Discuss new feature ideas', 'public', 'user-550e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, room_id, user_id, message, created_at) VALUES
    ('msg-550e8400-e29b-41d4-a716-446655440000', 'room-550e8400-e29b-41d4-a716-446655440000', 'user-550e8400-e29b-41d4-a716-446655440000', 'Welcome to KickStack chat! 👋', NOW() - INTERVAL '10 days'),
    ('msg-550e8400-e29b-41d4-a716-446655440001', 'room-550e8400-e29b-41d4-a716-446655440000', 'user-550e8400-e29b-41d4-a716-446655440001', 'Thanks! Excited to be here!', NOW() - INTERVAL '10 days' + INTERVAL '5 minutes'),
    ('msg-550e8400-e29b-41d4-a716-446655440002', 'room-550e8400-e29b-41d4-a716-446655440001', 'user-550e8400-e29b-41d4-a716-446655440002', 'How do I set up my first table?', NOW() - INTERVAL '8 days'),
    ('msg-550e8400-e29b-41d4-a716-446655440003', 'room-550e8400-e29b-41d4-a716-446655440001', 'user-550e8400-e29b-41d4-a716-446655440000', 'Try: kickstack add-table "users with name, email"', NOW() - INTERVAL '8 days' + INTERVAL '2 minutes'),
    ('msg-550e8400-e29b-41d4-a716-446655440004', 'room-550e8400-e29b-41d4-a716-446655440002', 'user-550e8400-e29b-41d4-a716-446655440003', 'Would love to see GraphQL support in the future!', NOW() - INTERVAL '6 days'),
    ('msg-550e8400-e29b-41d4-a716-446655440005', 'room-550e8400-e29b-41d4-a716-446655440000', 'user-550e8400-e29b-41d4-a716-446655440004', 'The realtime features are amazing! 🚀', NOW() - INTERVAL '2 days'),
    ('msg-550e8400-e29b-41d4-a716-446655440006', 'room-550e8400-e29b-41d4-a716-446655440000', 'user-550e8400-e29b-41d4-a716-446655440005', 'Just deployed my first KickStack app to production!', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
EOF
    
    execute_sql_file "$sql_file" "Chat data"
    rm -f "$sql_file"
}

# Main seeding function
seed_all_data() {
    local seed_type=${1:-"all"}
    
    info "Starting data seeding (type: $seed_type)..."
    
    case "$seed_type" in
        "organizations" | "orgs")
            seed_organizations
            ;;
        "users")
            seed_users
            ;;
        "projects")
            seed_projects
            ;;
        "blog")
            seed_blog_posts
            seed_comments
            ;;
        "chat")
            seed_chat_data
            ;;
        "all")
            # Check if tables exist before seeding
            cd "$INFRA_DIR"
            
            # Seed organizations if table exists
            if docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organizations');" 2>/dev/null | grep -q 't'; then
                seed_organizations
            else
                info "Skipping organizations (table doesn't exist)"
            fi
            
            # Seed users if table exists
            if docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');" 2>/dev/null | grep -q 't'; then
                seed_users
            else
                info "Skipping users (table doesn't exist)"
            fi
            
            # Seed projects if table exists
            if docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects');" 2>/dev/null | grep -q 't'; then
                seed_projects
            else
                info "Skipping projects (table doesn't exist)"
            fi
            
            # Seed blog data if tables exist
            if docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'posts');" 2>/dev/null | grep -q 't'; then
                seed_blog_posts
                
                if docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'comments');" 2>/dev/null | grep -q 't'; then
                    seed_comments
                fi
            else
                info "Skipping blog data (posts table doesn't exist)"
            fi
            
            # Seed chat data if tables exist
            if docker-compose exec -T postgres psql -U kick -d kickstack -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_rooms');" 2>/dev/null | grep -q 't'; then
                seed_chat_data
            else
                info "Skipping chat data (chat_rooms table doesn't exist)"
            fi
            ;;
        *)
            error "Unknown seed type: $seed_type"
            echo "Available types: all, organizations, users, projects, blog, chat"
            exit 1
            ;;
    esac
    
    success "Data seeding completed!"
}

# Parse command line arguments
SEED_TYPE="all"
CLEAN_FIRST="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            SEED_TYPE="$2"
            shift 2
            ;;
        --clean)
            CLEAN_FIRST="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --type <type>   Seed specific data type (all, organizations, users, projects, blog, chat)"
            echo "  --clean         Clean existing demo data first"
            echo "  --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Seed all demo data"
            echo "  $0 --type blog        # Seed only blog data"
            echo "  $0 --clean --type all # Clean and reseed all data"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Clean existing demo data if requested
if [ "$CLEAN_FIRST" = "true" ]; then
    warning "Cleaning existing demo data..."
    
    cat > "$PROJECT_ROOT/tmp_clean_seed.sql" << 'EOF'
-- Clean demo data (be careful with this!)
DELETE FROM comments WHERE id LIKE 'comment-550e8400%';
DELETE FROM chat_messages WHERE id LIKE 'msg-550e8400%';
DELETE FROM chat_rooms WHERE id LIKE 'room-550e8400%';
DELETE FROM posts WHERE id LIKE 'post-550e8400%';
DELETE FROM projects WHERE id LIKE 'proj-550e8400%';
DELETE FROM users WHERE id LIKE 'user-550e8400%';
DELETE FROM organizations WHERE id LIKE '550e8400%';
EOF
    
    execute_sql_file "$PROJECT_ROOT/tmp_clean_seed.sql" "Clean existing demo data"
    rm -f "$PROJECT_ROOT/tmp_clean_seed.sql"
fi

# Main execution
check_prerequisites
seed_all_data "$SEED_TYPE"

echo ""
info "Demo data seeding completed successfully!"
info "You can now:"
echo "   • Test the REST API at http://localhost:${PGRST_PORT:-3050}"
echo "   • View data in the dashboard at http://localhost:${DASHBOARD_PORT:-3001}"
echo "   • Generate tokens with: npm run kickstack generate-token user"
echo ""