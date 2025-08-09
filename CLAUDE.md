# CLAUDE.md - Project Context for AI Assistants

## Project Overview
KickStack is a local-first, AI-powered backend platform that provides instant API generation with PostgreSQL, authentication, realtime updates, and serverless functions.

## Tech Stack
- **Database**: PostgreSQL 15 with PostgREST for instant REST APIs
- **Authentication**: GoTrue (JWT-based auth service)
- **Storage**: MinIO (S3-compatible object storage)
- **Realtime**: WebSocket service for live updates
- **Functions**: Edge functions gateway with hot-reload
- **Frontend**: Next.js 14 dashboard with TypeScript
- **AI**: Ollama/OpenAI for schema generation
- **Deployment**: Docker Compose locally, Fly.io for cloud

## Project Structure
```
kickstack/
├── infra/                 # Infrastructure & Docker configs
│   ├── docker-compose.yml # All services definition
│   ├── migrations/        # Database migrations
│   └── .env              # Environment configuration
├── ai/cli/               # KickStack CLI tool
│   ├── src/
│   │   ├── commands/     # CLI commands
│   │   ├── policies/     # RLS policy generators
│   │   └── services/     # Database & AI services
│   └── tests/           # Unit & integration tests
├── web/dashboard/        # Next.js admin dashboard
├── functions/            # Edge functions
├── realtime/            # WebSocket service
└── templates/           # Project templates
```

## Key Commands
```bash
# CLI Commands
npm run kickstack add-table "users with name, email, status"
npm run kickstack add-policy team_scope projects --add-org-col
npm run kickstack add-realtime <table>
npm run kickstack new-fn <function-name>
npm run kickstack generate-token admin --org-id <uuid>
npm run kickstack template install blog-basic
npm run kickstack seed --type all     # Seed demo data

# Setup & Validation
./scripts/quick-start.sh             # Complete setup with validation
./scripts/validate-setup.sh          # Comprehensive validation
./scripts/debug-services.sh          # Service diagnostics
./scripts/seed-demo-data.sh --type all # Demo data seeding
./scripts/reload-postgrest.sh        # Reload PostgREST schema

# Development
npm run web:dev          # Start dashboard on :3001
npm run fngw:dev         # Start functions gateway on :8787
npm run realtime:dev     # Start WebSocket service on :8081

# Deployment
npm run kickstack deploy fly --profile cloud
```

## Current Features
1. **AI-Powered Schema Generation**: Natural language to PostgreSQL tables
2. **Row-Level Security (RLS)**: Multiple policy presets (owner, public_read, team_scope, admin_override)
3. **Multi-Tenancy**: Organization-based data isolation with JWT claims
4. **Template Marketplace**: Install pre-built project templates
5. **Realtime Updates**: WebSocket broadcasting for live data
6. **Edge Functions**: Serverless functions with auth context
7. **Web Dashboard**: Admin UI with auth, table explorer, and service monitoring
8. **CI/CD**: GitHub Actions for testing and Fly.io deployment

## Security Considerations
- All tables should have RLS policies applied
- JWT secrets must be changed from defaults before production
- MinIO credentials must be updated in production
- Use team_scope policy for multi-tenant SaaS applications
- Service tokens should only be used server-side
- Admin tokens bypass all RLS policies

## Testing Strategy
- Unit tests for policy generators in `ai/cli/tests/policies/`
- Integration tests for multi-tenancy in `ai/cli/tests/integration/`
- Run tests with `npm run test:unit` and `npm run test:integration`

## Common Tasks

### Quick Setup & Validation
```bash
# One-command setup with validation
./scripts/quick-start.sh

# Validate setup anytime
./scripts/validate-setup.sh

# Debug service issues
./scripts/debug-services.sh
```

### Creating Tables & Policies
```bash
# Create table with AI
npm run kickstack add-table "blog_posts with title, content, author_name, published boolean"

# Add RLS policies
npm run kickstack add-policy public_read blog_posts --add-owner-col

# Create table with org scope for multi-tenancy
npm run kickstack add-table "projects with name, status"
npm run kickstack add-policy team_scope projects --add-org-col --add-owner-col
```

### Data Seeding & Testing
```bash
# Seed all demo data
npm run kickstack seed --type all

# Seed specific data types
npm run kickstack seed --type blog
npm run kickstack seed --type users
npm run kickstack seed --type projects

# Clean and reseed
./scripts/seed-demo-data.sh --clean --type all
```

### Schema Management
```bash
# Reload PostgREST after changes
./scripts/reload-postgrest.sh

# Add realtime triggers
npm run kickstack add-realtime <table-name>
npm run realtime:dev
```

### Generating Test Tokens
```bash
# User token for org
npm run kickstack generate-token user --org-id <uuid> --email user@org.com

# Admin token
npm run kickstack generate-token admin

# Service token for backend
npm run kickstack generate-token service --expires-in 365d
```

## Environment Variables
Key environment variables in `/infra/.env`:
- `POSTGRES_USER/PASSWORD`: Database credentials
- `JWT_SECRET`: Must be changed for production
- `MINIO_ROOT_USER/PASSWORD`: Object storage credentials
- `OPENAI_API_KEY` or `OLLAMA_HOST`: For AI features
- `FLY_API_TOKEN`: For deployment

## Recent Updates (Relay 17-18)

### Session Summary
This session focused on implementing systematic improvements to KickStack based on lessons learned from building a chat application demo. The work addressed critical issues that would impact new users and improved the overall developer experience.

### Major Improvements Completed (8/8 Tasks)
1. **✅ Fixed CLI TypeScript compilation errors** - Resolved all type issues, added generateSQL method to adapters
2. **✅ Automatic permissions system** - Event triggers grant API access to new tables automatically
3. **✅ Port configuration** - All ports configurable via .env, PostgREST now defaults to 3050 to avoid conflicts
4. **✅ Schema auto-reload** - PostgREST reloads automatically after database changes
5. **✅ Setup validation** - Comprehensive script checks Docker, services, ports, database connectivity
6. **✅ Service diagnostics** - Debug script provides detailed health checks and troubleshooting
7. **✅ Demo data seeding** - Rich sample data for testing (organizations, users, projects, blog, chat)
8. **✅ Better error handling** - Categorized errors with specific fix suggestions

### New Scripts Created
- `scripts/quick-start.sh` - One-command setup with validation and demo data
- `scripts/validate-setup.sh` - Comprehensive setup validation (30+ checks)
- `scripts/debug-services.sh` - Deep diagnostics for troubleshooting
- `scripts/reload-postgrest.sh` - Auto-reload PostgREST schema
- `scripts/seed-demo-data.sh` - Populate test data

### Bug Fixes
- Fixed trigger functions using uppercase operations (INSERT→insert) causing constraint violations
- Fixed environment validation to be more flexible with working directories
- Fixed TypeScript rootDir configuration for CLI and orchestrator
- Fixed apply command parameter types in demo.ts
- Added missing type assertions throughout for error handling
- Fixed auto_grant_table_permissions migration for automatic API access

### Testing & Validation
- Successfully created tables with natural language CLI
- Verified automatic permissions work for new tables
- Tested PostgREST API with filtering, ordering, and column selection
- Demonstrated RLS policies (public_read pattern)
- Validated demo data seeding across multiple table types
- Confirmed schema reloading works without manual intervention

## Previous Updates (Relay 13-14)
- Added multi-tenancy support with team_scope and admin_override policies
- Created auth helper functions (auth_org(), is_admin())
- Added JWT token generator for testing
- Fixed README to reflect PostgreSQL (removed SQLite references)
- Added security warnings and .env.example
- Added Apache 2.0 license and community files
- Updated to Node.js 20 LTS requirement

## Infrastructure Architecture

### Service Ports (All Configurable)
- **PostgREST API**: 3050 (changed from 3000 to avoid conflicts)
- **GoTrue Auth**: 9999
- **PostgreSQL**: 5432
- **MinIO API**: 9000
- **MinIO Console**: 9001
- **MailHog Web**: 8025
- **Dashboard**: 3001
- **Functions**: 8787
- **Realtime**: 8081

### Automatic Features
- **Table Permissions**: Event trigger `auto_grant_table_permissions()` grants API access on CREATE TABLE
- **Schema Reload**: PostgREST NOTIFY trigger reloads schema cache automatically
- **Realtime Triggers**: Tables created with `--no-realtime` flag to skip, otherwise auto-enabled
- **Error Recovery**: Comprehensive error categorization with specific fix suggestions

### Validation & Diagnostics
- `validate-setup.sh`: Checks Docker, services, ports, database, permissions, environment
- `debug-services.sh`: Deep service health checks, resource usage, logs, configuration
- `reload-postgrest.sh`: Forces schema reload via NOTIFY or service restart
- `seed-demo-data.sh`: Populates test data for organizations, users, projects, blog, chat
- `quick-start.sh`: Complete setup with validation and optional demo data

## Known Issues & TODOs
- **GoTrue authentication**: Still needs configuration fixes for reliable startup
- Template marketplace needs more templates
- Dashboard could use more features (logs viewer, metrics)
- Need comprehensive API documentation
- Could add more policy presets (time-based, geo-based)
- WebSocket integration for real-time chat features

## Deployment Notes
- Use `kickstack deploy fly --profile cloud` for Fly.io deployment
- Ensure all environment variables are set in Fly.io secrets
- Database runs as a Fly.io Postgres cluster in production
- Edge functions deploy as separate Fly.io apps

## Contributing
See CONTRIBUTING.md for development setup and guidelines.
Pull requests welcome! Focus areas:
- More templates for the marketplace
- Additional RLS policy presets
- Dashboard UI improvements
- Documentation improvements