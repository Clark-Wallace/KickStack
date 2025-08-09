# KickStack

[![CI](https://github.com/Clark-Wallace/KickStack/actions/workflows/kickstack-ci.yml/badge.svg)](https://github.com/Clark-Wallace/KickStack/actions/workflows/kickstack-ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**"Just Kick it"** - A local-first, AI-powered backend platform.

## 🚀 Demo Showcase

See KickStack in action with ready-made apps you can run locally or deploy in minutes.

### Available Demos

#### 📝 Blog Platform
Full-featured blogging with public posts, private comments, and realtime updates.
- Public read posts with author-only editing
- Comment system with owner permissions
- Email notifications and view tracking
- Realtime WebSocket updates

```bash
npm run kickstack demo up blog --with-seed
```

#### 🛒 E-commerce Store
Complete online store with products, orders, and payment processing.
- Public product catalog with inventory
- Multi-vendor support with team scope
- Shopping cart and order management
- Payment webhook integration

```bash
npm run kickstack demo up ecommerce --with-seed
```

#### 💼 Multi-Tenant CRM
Enterprise CRM with organization isolation and admin controls.
- Contact and lead management
- Deal pipeline tracking
- Admin override for support
- API keys for integrations

```bash
npm run kickstack demo up crm --with-seed
```

### Quick Demo Commands

#### CLI Installation
```bash
# List all available demos
npm run kickstack demo list

# Install a demo locally
npm run kickstack demo up <demo-name>

# Deploy demo to cloud
npm run kickstack demo deploy <demo-name>
```

#### Dashboard Installation
Visit **Dashboard → Demos** to install demos through the UI:
1. Start the dashboard: `npm run web:dev`
2. Navigate to http://localhost:3001/demos
3. Browse available demos with search and filters
4. Click any demo to view details and README
5. Choose **Install** with options:
   - **Apply Now** or **Stage Only**
   - **Include Sample Data** checkbox
6. After installation, use quick-links to:
   - Open tables in Table Explorer
   - Run verification tests
   - View API endpoints

[View Demo Documentation →](./demos/)

## Quick Start

### 🚀 One-Command Setup
```bash
# Clone, setup, and start everything with validation
git clone https://github.com/Clark-Wallace/KickStack.git
cd KickStack
./scripts/quick-start.sh
```

This will:
- ✅ Check Docker and dependencies
- ✅ Start all services
- ✅ Build the CLI
- ✅ Validate setup
- ✅ Seed demo data (optional)
- ✅ Show service URLs and next steps

### Prerequisites
- Docker and Docker Compose installed
- Node.js 20 LTS and npm installed
- Port availability: 3050 (API), 3001 (Dashboard), 5432 (PostgreSQL), and others
- For AI features, one of:
  - Ollama installed and running (https://ollama.ai)
  - OpenAI API key set as `OPENAI_API_KEY` environment variable

### ⚠️ Security Warning

**IMPORTANT:** Before deploying to production:
- Change all default passwords in `/infra/.env`
- Generate a secure `JWT_SECRET`
- Update MinIO access credentials
- Review the security configuration in `CONTRIBUTING.md`

### Setup Instructions

1. **Clone and install:**
   ```bash
   git clone https://github.com/Clark-Wallace/KickStack.git
   cd KickStack
   npm run cli:install
   npm run web:install
   ```

2. **Configure environment (first time only):**
   ```bash
   cp infra/.env.example infra/.env
   # Edit infra/.env to change default passwords
   ```

3. **Start the infrastructure stack:**
   ```bash
   cd infra
   docker-compose up -d
   ```

4. **Verify setup and troubleshoot:**
   ```bash
   # Comprehensive validation
   ./scripts/validate-setup.sh
   
   # Debug services if needed
   ./scripts/debug-services.sh
   
   # Reload PostgREST after schema changes
   ./scripts/reload-postgrest.sh
   ```

5. **Seed demo data (optional):**
   ```bash
   # Seed all demo data
   ./scripts/seed-demo-data.sh --type all
   
   # Or use the CLI
   npm run kickstack seed --type all
   ```

6. **Start the web dashboard (optional):**
   ```bash
   npm run web:dev
   ```
   Then open http://localhost:3001 in your browser.

### Deploy to Fly.io

For production deployment:
```bash
npm run kickstack deploy fly --profile cloud
```

See the [deployment guide](docs/deployment.md) for detailed instructions.

### Service Access Points

| Service | Purpose | Local URL | Cloud Route | Default Credentials |
|---------|---------|-----------|-------------|---------------------|
| **Web Dashboard** | KickStack UI | http://localhost:3001 | `/` | Use GoTrue auth |
| **PostgREST API** | REST API | http://localhost:3050 | `/api/*` | JWT required |
| **Functions Gateway** | Edge functions | http://localhost:8787 | `/fn/*` | JWT optional |
| **GoTrue Auth** | Authentication | http://localhost:9999 | `/auth/*` | - |
| **Realtime WS** | WebSocket service | ws://localhost:8081 | `/realtime` | - |
| **PostgreSQL** | Primary database | localhost:5432 | - | See .env |
| **MinIO Console** | Object storage UI | http://localhost:9001 | - | See .env |
| **MinIO S3 API** | S3-compatible API | http://localhost:9000 | `/storage/*` | See .env |
| **MailHog** | Email testing UI | http://localhost:8025 | - | - |

### API Endpoints

#### Authentication (GoTrue)
- **Sign Up:** `POST http://localhost:9999/signup`
- **Sign In:** `POST http://localhost:9999/token?grant_type=password`
- **Verify:** `GET http://localhost:9999/verify`
- **User Info:** `GET http://localhost:9999/user` (requires auth token)

#### Database API (PostgREST)
- **Projects:** `http://localhost:3050/projects`
- **Tasks:** `http://localhost:3050/tasks`
- **Files:** `http://localhost:3050/files`

### Example Usage

#### 1. Create a new user:
```bash
curl -X POST http://localhost:9999/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

#### 2. Sign in and get JWT token:
```bash
curl -X POST http://localhost:9999/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

#### 3. Access PostgREST API with JWT:
```bash
curl http://localhost:3050/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 4. Access MinIO Console:
1. Open http://localhost:9001 in your browser
2. Login with credentials from your `.env` file
3. Create buckets and manage files through the UI

### Stopping the Stack

```bash
docker-compose down
```

To also remove volumes (database data):
```bash
docker-compose down -v
```

### Environment Variables

Configure in `infra/.env`:
- `JWT_SECRET`: Shared secret for JWT signing (PostgREST & GoTrue)
- `MINIO_ROOT_USER`: MinIO admin username
- `MINIO_ROOT_PASSWORD`: MinIO admin password
- `KICKSTACK_PG_URI`: PostgreSQL connection string (optional override)

**⚠️ Security Note:** Change all default credentials before deploying to production!

### Database Architecture

KickStack uses **PostgreSQL 16** as its primary database, enabling:
- **Row-Level Security (RLS)** for fine-grained access control
- **PostgREST** automatic REST API generation
- **JSONB** support for flexible data structures
- **UUID** primary keys for distributed systems
- **Trigger-based** change capture for realtime updates


### Project Structure

```
kickstack/
├── infra/              # Infrastructure configuration
│   ├── docker-compose.yml
│   ├── .env
│   ├── postgrest.conf
│   ├── init.sql
│   └── migrations/     # Database migrations
├── api/                # API services (future)
├── web/                # Web frontend (future)
├── ai/                 # AI services
│   └── cli/            # KickStack CLI tool
└── package.json        # Root package scripts
```

### Troubleshooting

#### 🔧 Diagnostic Tools
```bash
# Comprehensive setup validation
./scripts/validate-setup.sh

# Debug service issues
./scripts/debug-services.sh

# Reload PostgREST after schema changes
./scripts/reload-postgrest.sh

# View service logs
docker-compose logs [service-name]
```

#### Common Issues & Fixes

1. **Port conflicts:** 
   - Default PostgREST port changed to 3050 (was 3000)
   - All ports configurable in `infra/.env`
   - Check with: `lsof -i :PORT_NUMBER`

2. **Database connection issues:** 
   - Run validation: `./scripts/validate-setup.sh`
   - Check PostgreSQL: `docker-compose ps postgres`
   - Test connection: `docker-compose exec postgres pg_isready`

3. **Tables not accessible via API:**
   - Auto-permissions now enabled for new tables
   - Reload PostgREST: `./scripts/reload-postgrest.sh`
   - Check permissions: `curl http://localhost:3050/`

4. **Auth issues:** 
   - GoTrue may need configuration fixes
   - Verify JWT_SECRET matches in `.env`
   - Check logs: `docker-compose logs gotrue`

5. **Email testing:** 
   - MailHog UI: http://localhost:8025
   - All emails captured locally (no actual sending)

### Development Notes

- PostgreSQL database persists in Docker volume `postgres-data`
- MinIO data persists in Docker volume `minio-data`
- All emails in development are captured by MailHog (no actual sending)
- CORS is enabled for all origins in development mode

## AI-Powered CLI

KickStack includes an AI-powered CLI that can generate database tables from natural language descriptions.

### CLI Setup

1. **Install Ollama (recommended):**
   ```bash
   # macOS
   brew install ollama
   ollama serve  # Run in separate terminal
   ollama pull llama3.2:3b  # Pull a model
   ```

   **OR set OpenAI API key:**
   ```bash
   export OPENAI_API_KEY=your-api-key-here
   ```

2. **Install CLI dependencies:**
   ```bash
   npm run cli:install
   ```

### Creating Tables with AI

Use natural language to create database tables:

```bash
# From the kickstack root directory
npm run kickstack add-table "contacts with name, email, phone"

# Or with more complex schema
npm run kickstack add-table "products with name, description, price, category, stock_quantity"

# Or with relationships
npm run kickstack add-table "orders with customer_name, total_amount, status, order_date"
```

### How It Works

1. **Natural Language Processing:** Your description is sent to an AI model (Ollama or OpenAI)
2. **SQL Generation:** The AI generates a proper CREATE TABLE statement with:
   - UUID primary key (`id UUID DEFAULT gen_random_uuid()`)
   - `created_at` and `updated_at` timestamps (TIMESTAMPTZ)
   - PostgreSQL-native data types
   - Indexes for performance
3. **Migration Creation:** SQL is saved to `infra/migrations/` with timestamp
4. **Database Update:** Migration is applied via psql to PostgreSQL
5. **Automatic Permissions:** Tables automatically get API access permissions
6. **Schema Reload:** PostgREST automatically picks up new tables
7. **API Ready:** Table is immediately available via PostgREST API with RLS support

### Example Workflow

```bash
# Create a new table
npm run kickstack add-table "customers with full_name, email, phone, address, city, country"

# Output shows:
# ✓ Table created: customers
# ✓ Migration saved: infra/migrations/20240109_1430_add_table_customers.sql
# ✓ API endpoints ready:
#   GET    http://localhost:3050/customers
#   POST   http://localhost:3050/customers
#   PATCH  http://localhost:3050/customers?id=eq.1
#   DELETE http://localhost:3050/customers?id=eq.1

# Test the new API
curl http://localhost:3050/customers

# Insert data
curl -X POST http://localhost:3050/customers \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA"
  }'
```

### CLI Troubleshooting

1. **"No AI model available" error:**
   - Ensure Ollama is running: `ollama serve`
   - Or set OpenAI API key: `export OPENAI_API_KEY=...`

2. **"Table already exists" error:**
   - Table names must be unique
   - Check existing tables: `curl http://localhost:3050/`

3. **PostgREST not detecting new tables:**
   - Restart PostgREST: `docker-compose -f infra/docker-compose.yml restart postgrest`

4. **Database connection errors:**
   - Ensure Docker stack is running: `cd infra && docker-compose ps`
   - Check PostgreSQL container is running: `docker-compose ps postgres`

## 🆕 Recent Improvements

### Infrastructure Enhancements
- **🔧 Automatic Permissions:** New tables automatically get API access permissions via event triggers
- **🔄 Schema Auto-Reload:** PostgREST automatically picks up schema changes without manual restart
- **🎯 Port Configuration:** All service ports now configurable via environment variables (PostgREST now defaults to 3050)
- **✅ Setup Validation:** Comprehensive validation script checks Docker, services, ports, and configuration
- **🐛 Service Diagnostics:** Debug script provides detailed health checks and troubleshooting
- **📊 Demo Data Seeding:** Rich sample data system for testing (organizations, users, projects, blog, chat)

### Developer Experience
- **🚀 Quick Start Script:** One-command setup with `./scripts/quick-start.sh`
- **📝 Better Error Handling:** Categorized errors with specific fix suggestions
- **🔍 Enhanced CLI:** Fixed TypeScript compilation issues and improved error messages
- **🌱 Data Seeding Command:** `npm run kickstack seed` for easy demo data population
- **♻️ PostgREST Reload:** `./scripts/reload-postgrest.sh` for instant schema updates

### CLI Commands
```bash
# New seeding command
npm run kickstack seed --type all

# Quick validation
./scripts/validate-setup.sh

# Debug services
./scripts/debug-services.sh

# Reload schema
./scripts/reload-postgrest.sh
```

## Web Dashboard (v0)

KickStack includes a minimal web dashboard for managing your data and monitoring services.

### Dashboard Features

- **Authentication:** Login/logout using GoTrue (email/password)
- **Table Explorer:** Browse, add, and delete rows in any table
- **Demo Showcase:** Install and manage demo applications through the UI
- **Template Browser:** Search and install community templates
- **Status Panel:** Monitor service health (API, Auth, MinIO)
- **Quick Links:** Access all services from one place

### Getting Started with Dashboard

1. **First, create a user account:**
   ```bash
   curl -X POST http://localhost:9999/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "securepassword123"
     }'
   ```

2. **Start the web dashboard:**
   ```bash
   npm run web:dev
   ```

3. **Open your browser:**
   Navigate to http://localhost:3001

4. **Login:**
   Use the email and password you created in step 1

### Using the Table Explorer

1. **Enter a table name** (e.g., "contacts", "products", "tasks")
2. **Click "Load Table"** to view existing data
3. **Add new rows** using JSON format:
   ```json
   {
     "name": "John Doe",
     "email": "john@example.com",
     "phone": "+1234567890"
   }
   ```
4. **Delete rows** using the delete button (requires an `id` column)

### Dashboard Troubleshooting

1. **CORS errors:**
   - PostgREST is configured with `CORS: *` by default
   - If issues persist, check browser console for specific errors

2. **Login fails:**
   - Verify GoTrue is running: `docker-compose ps`
   - Check MailHog for confirmation emails: http://localhost:8025
   - Ensure you've created a user account first

3. **Table not loading:**
   - Verify you're logged in (token stored in localStorage)
   - Check the table exists: `curl http://localhost:3050/<table_name>`
   - Restart PostgREST if you just created the table

4. **Status shows services offline:**
   - Ensure Docker stack is running
   - Check individual service logs: `docker-compose logs <service_name>`

### Development Notes

- The dashboard uses Next.js 14 with TypeScript
- Authentication tokens are stored in localStorage
- All API requests include the JWT token when authenticated
- The UI is built with Tailwind CSS for styling

## Realtime Updates

KickStack supports realtime data synchronization through WebSocket broadcasting.

### How It Works

1. **Change Capture:** Database triggers capture INSERT/UPDATE/DELETE operations to `kickstack_changes` table
2. **WebSocket Service:** Polls changes every 500ms and broadcasts to connected clients
3. **Live Updates:** Dashboard automatically updates when data changes

### Setting Up Realtime

1. **Apply the changes table migration:**
   ```bash
   cd infra
   docker-compose exec postgres psql -U kick -d kickstack -f /migrations/00000000_0000_kickstack_changes.sql
   ```

2. **Start the realtime service:**
   ```bash
   npm run realtime:install  # First time only
   npm run realtime:dev
   ```

3. **Enable realtime for a table:**
   
   **Option A: When creating a new table (automatic):**
   ```bash
   npm run kickstack add-table "products with name, price, stock"
   # Triggers are added automatically
   ```
   
   **Option B: For existing tables:**
   ```bash
   npm run kickstack add-realtime contacts
   ```

### Testing Realtime

1. **Open the dashboard:**
   ```bash
   npm run web:dev
   # Open http://localhost:3001
   ```

2. **Load a table with realtime enabled:**
   - Login and navigate to Table Explorer
   - Enter table name and click "Load Table"
   - Look for the green "LIVE" indicator

3. **Test live updates in another terminal:**
   ```bash
   # Insert a new record
   curl -X POST http://localhost:3050/contacts \
     -H "Content-Type: application/json" \
     -d '{"name": "Jane Doe", "email": "jane@example.com"}'
   
   # The dashboard will update automatically within ~1 second
   ```

### WebSocket API

Connect directly to the realtime service:

```javascript
// Connect to realtime service
const ws = new WebSocket('ws://localhost:8081?table=contacts,products');

// Handle messages
ws.onmessage = (event) => {
  const change = JSON.parse(event.data);
  if (change.type === 'change') {
    console.log(`${change.op} on ${change.table}:`, change.id);
  }
};
```

### Message Format

```json
{
  "type": "change",
  "table": "contacts",
  "op": "insert|update|delete",
  "id": 123,
  "ts": 1712345678901,
  "changeId": 456
}
```

### CLI Commands

- **Add realtime to existing table:**
  ```bash
  npm run kickstack add-realtime <table_name>
  ```

- **Create table with realtime (default):**
  ```bash
  npm run kickstack add-table "table_spec"
  ```

- **Create table without realtime:**
  ```bash
  npm run kickstack add-table "table_spec" --no-realtime
  ```

### Architecture Notes

- Trigger-based change capture (no WAL dependency)
- Lightweight polling service (500ms interval)
- Automatic reconnection with exponential backoff
- Last 10,000 changes retained (configurable)
- Multiple table subscriptions per connection

### Troubleshooting Realtime

1. **"LIVE" indicator not showing:**
   - Ensure realtime service is running: `npm run realtime:dev`
   - Check browser console for WebSocket errors
   - Verify port 8081 is not blocked

2. **Changes not appearing:**
   - Verify triggers exist in PostgreSQL
   - Check kickstack_changes table for recent entries

3. **WebSocket connection fails:**
   - Check realtime service logs
   - Ensure PostgreSQL is accessible
   - Verify no firewall blocking port 8081

## Row-Level Security (RLS)

KickStack provides built-in Row-Level Security to control data access at the database level.

### Why RLS?

- **Security at the database level** - Even direct database access respects policies
- **Simplified application logic** - No need for complex permission checks in code
- **Performance** - PostgreSQL optimizes queries with RLS policies
- **Multi-tenant ready** - Easily isolate data between users/organizations

### Owner Policy Preset

The "owner" preset ensures users can only access their own data:

```bash
# Create a table with an owner column
npm run kickstack add-table "contacts with user_id uuid, name text, email text"

# Apply owner-based RLS
npm run kickstack add-policy owner contacts --owner-col user_id
```

This creates four policies:
- **select_own** - Users see only their rows
- **insert_own** - Users can only insert rows they own
- **update_own** - Users can only update their rows
- **delete_own** - Users can only delete their rows

### How It Works

1. **Auth Helpers** - Database functions that extract user ID from JWT:
   - `auth_uid()` - Returns current user's UUID
   - `auth_role()` - Returns user's role (anon/authenticated)
   - `is_authenticated()` - Boolean check for auth status

2. **Policy Application** - Each operation checks if `user_id = auth_uid()`

3. **Token Validation** - PostgREST validates JWT and sets claims

### Example Workflow

```bash
# 1. Create a user table with owner column
npm run kickstack add-table "tasks with user_id uuid, title text, completed boolean"

# 2. Enable RLS with owner policy
npm run kickstack add-policy owner tasks --owner-col user_id

# 3. Get a JWT token (after signup/login)
TOKEN=$(curl -X POST http://localhost:9999/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.access_token')

# 4. Create a task (automatically owned by you)
curl -X POST http://localhost:3050/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My secure task", "completed": false}'

# 5. Only you can see your tasks
curl http://localhost:3050/tasks \
  -H "Authorization: Bearer $TOKEN"
```

### Adding Owner Column

If your table doesn't have an owner column:

```bash
# Option 1: Add column automatically
npm run kickstack add-policy owner contacts --owner-col user_id --add-owner-col

# Option 2: Use existing column
npm run kickstack add-policy owner orders --owner-col customer_id
```

### Testing RLS

Run the test suite to verify RLS is working:

```bash
cd ai/cli
npm test:integration
```

The integration tests verify:
- Users can only see their own rows
- Users cannot modify other users' data
- Anonymous users are blocked
- JWT claims are properly validated

### Public Read Policy Preset

The "public_read" preset allows anyone to read data, but only owners can modify:

```bash
npm run kickstack add-policy public_read blog_posts --owner-col author_id
```

This creates:
- **select_public** - Anyone can read all rows (including anonymous users)
- **insert_own** - Only authenticated users can insert (as owners)
- **update_own** - Users can only update their own rows
- **delete_own** - Users can only delete their own rows

### Multi-Tenancy with Team Scope

The "team_scope" preset provides organization-based data isolation:

```bash
# Apply team scope to a table
npm run kickstack add-policy team_scope projects --org-col org_id --owner-col created_by

# Or add org column if it doesn't exist
npm run kickstack add-policy team_scope documents --add-org-col
```

#### How Team Scope Works

1. **Organization Isolation** - Users see only data from their organization
2. **Owner Restrictions** - Within an org, users can only modify their own rows (optional)
3. **JWT Claims** - Uses `org` or `org_id` claim from JWT token
4. **Admin Bypass** - Admins can access all organizations

#### Team Scope Policies

- **team_select** - See all rows in your organization
- **team_insert** - Create rows for your org (owner-restricted if owner column exists)
- **team_update** - Update rows in your org (owner-restricted if owner column exists)
- **team_delete** - Delete rows in your org (owner-restricted if owner column exists)

### Admin Override Policy

The "admin_override" preset grants full access to admin and service tokens:

```bash
# Add admin bypass to existing policies
npm run kickstack add-policy admin_override sensitive_data
```

This adds:
- **admin_select** - Admins can read all rows
- **admin_insert** - Admins can insert any rows
- **admin_update** - Admins can update any rows
- **admin_delete** - Admins can delete any rows

**Note:** Admin override should be applied AFTER other policies. PostgreSQL combines policies with OR logic, so admins will have access even if other policies would deny it.

### Generating JWT Tokens for Testing

KickStack includes a token generator for testing different access scenarios:

```bash
# Generate a user token
npm run kickstack generate-token user --email user@example.com --org-id <uuid>

# Generate an admin token
npm run kickstack generate-token admin --email admin@example.com

# Generate a service token (for server-side operations)
npm run kickstack generate-token service --expires-in 365d

# Custom claims
npm run kickstack generate-token user --claims '{"custom_field":"value"}'
```

Token options:
- `--user-id <uuid>` - Set specific user ID
- `--org-id <uuid>` - Set organization ID for multi-tenancy
- `--email <email>` - Set email claim
- `--expires-in <duration>` - Set expiration (e.g., 24h, 7d, 60m)
- `--claims <json>` - Add custom JWT claims

### Multi-Tenancy Example

Complete workflow for setting up multi-tenant application:

```bash
# 1. Create a table with organization scope
npm run kickstack add-table "projects with name text, status text, budget numeric"

# 2. Add org and owner columns if needed
npm run kickstack add-policy team_scope projects --add-org-col --add-owner-col

# 3. Generate tokens for different organizations
ORG1_TOKEN=$(npm run kickstack generate-token user --org-id 11111111-1111-1111-1111-111111111111 --email user1@org1.com)
ORG2_TOKEN=$(npm run kickstack generate-token user --org-id 22222222-2222-2222-2222-222222222222 --email user2@org2.com)
ADMIN_TOKEN=$(npm run kickstack generate-token admin)

# 4. Org1 user creates a project (only visible to Org1)
curl -X POST http://localhost:3050/projects \
  -H "Authorization: Bearer $ORG1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Org1 Project", "status": "active", "budget": 50000}'

# 5. Org2 user cannot see Org1's project
curl http://localhost:3050/projects \
  -H "Authorization: Bearer $ORG2_TOKEN"
# Returns: []

# 6. Admin can see all projects
curl http://localhost:3050/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Returns: All projects from all organizations
```

### Testing Multi-Tenancy

Run the multi-tenancy test suite:

```bash
cd ai/cli
npm run test:unit tests/policies   # Unit tests for policy generation
npm run test:integration            # Integration tests with real database
```

### Security Best Practices

1. **Always use RLS for user data** - Apply policies to any table containing user-specific data
2. **Test with different users** - Verify isolation between user accounts
3. **Use team_scope for SaaS apps** - Provides organization-level data isolation
4. **Limit admin tokens** - Only use admin/service tokens for server-side operations
5. **Monitor policy performance** - Use `EXPLAIN` to check query plans
6. **Keep policies simple** - Complex policies can impact performance
7. **Rotate service tokens** - Regularly rotate long-lived tokens
8. **Never expose service tokens** - Keep them server-side only

## Edge Functions (v0)

KickStack includes serverless-style edge functions that run locally with full auth context and hot-reload support.

### Quick Start

1. **Create a new function:**
   ```bash
   npm run kickstack new-fn hello
   ```

2. **Start the Functions Gateway:**
   ```bash
   npm run fngw:install  # First time only
   npm run fngw:dev
   ```

3. **Call your function:**
   ```bash
   # Without authentication (public function)
   curl -X POST http://localhost:8787/fn/hello \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, World!"}'
   
   # With authentication (JWT from GoTrue)
   curl -X POST http://localhost:8787/fn/hello \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, authenticated user!"}'
   ```

### Function Structure

Each function exports a default async handler:

```typescript
import type { KickContext, KickEvent } from "./types";

export default async function handler(event: KickEvent, ctx: KickContext) {
  // Access user info from JWT
  if (ctx.user) {
    ctx.log("Authenticated user:", ctx.user.sub);
  }
  
  // Access environment variables (KICKSTACK_FN_* prefix)
  const apiKey = ctx.env['KICKSTACK_FN_API_KEY'];
  
  // Return JSON response
  return {
    ok: true,
    user: ctx.user,
    received: event.body,
    timestamp: new Date().toISOString()
  };
}
```

### Context & Event Objects

**KickContext:**
- `user`: Decoded JWT with `sub` (user ID) and `role`, or `null` if not authenticated
- `env`: Environment variables with `KICKSTACK_FN_` prefix
- `log`: Logging function with function name prefix

**KickEvent:**
- `name`: Function name
- `method`: Always "POST" in v0
- `query`: Query string parameters
- `headers`: Request headers
- `body`: Parsed JSON body

### Creating Functions with Secrets

Add environment variables for your functions:

```bash
# Create function with secret hint
npm run kickstack new-fn payment --with-secret STRIPE_KEY

# Add to /infra/.env
KICKSTACK_FN_STRIPE_KEY=sk_test_...

# Access in function
const stripeKey = ctx.env['KICKSTACK_FN_STRIPE_KEY'];
```

### Authentication

Functions automatically receive auth context from JWT tokens:

1. **Public functions**: Work without authentication (`ctx.user = null`)
2. **Protected functions**: Check `ctx.user` and return error if missing
3. **Role-based**: Check `ctx.user.role` for specific permissions

Example protected function:
```typescript
export default async function handler(event: KickEvent, ctx: KickContext) {
  if (!ctx.user) {
    return { ok: false, error: "Authentication required" };
  }
  
  if (ctx.user.role !== 'admin') {
    return { ok: false, error: "Admin access required" };
  }
  
  // Admin-only logic here
  return { ok: true, data: "Secret admin data" };
}
```

### Web Dashboard Integration

The KickStack dashboard includes a Functions card for testing:

1. Open http://localhost:3001
2. Find the "Edge Functions" card
3. Enter function name and JSON body
4. Click "Call Function" (uses your auth token if logged in)

### Development Features

- **Hot Reload**: Functions automatically reload on file changes in dev mode
- **TypeScript Support**: Full type safety with `.ts` files
- **Error Handling**: Graceful error responses with helpful messages
- **CORS Enabled**: Works with local web development

### Functions Gateway API

- **Port**: 8787
- **Health Check**: `GET /health`
- **Function Call**: `POST /fn/:name`
- **Response Format**: Always returns JSON

### Testing Functions

```bash
# Run unit tests
npm run fngw:test

# Integration test (requires Docker stack running)
cd api/fngw
RUN_INTEGRATION_TESTS=true npm test
```

### Deployment Notes

For production deployment:
1. Build functions: `npm run fngw:build`
2. Set `NODE_ENV=production`
3. Configure proper JWT secret
4. Use process manager (PM2, systemd, etc.)
5. Add rate limiting and monitoring

### Examples

**Data Processing Function:**
```typescript
export default async function processData(event: KickEvent, ctx: KickContext) {
  const data = event.body as { items: any[] };
  
  ctx.log(`Processing ${data.items.length} items`);
  
  const processed = data.items.map(item => ({
    ...item,
    processedAt: new Date().toISOString(),
    processedBy: ctx.user?.sub || 'system'
  }));
  
  return { ok: true, processed };
}
```

**Webhook Handler:**
```typescript
export default async function webhook(event: KickEvent, ctx: KickContext) {
  const secret = ctx.env['KICKSTACK_FN_WEBHOOK_SECRET'];
  const signature = event.headers['x-webhook-signature'];
  
  if (signature !== secret) {
    return { ok: false, error: "Invalid signature" };
  }
  
  // Process webhook payload
  ctx.log("Webhook received:", event.body);
  
  return { ok: true, message: "Webhook processed" };
}
```

## AI Orchestration (Full-Stack Generation)

KickStack's AI Orchestrator can generate entire full-stack applications from natural language requirements. It creates a complete plan, stages all artifacts, and applies them safely with automatic verification.

### Quick Start

Generate a complete blog system:

```bash
# Generate plan (safe, no changes applied)
npm run kickstack gen "I need a blog: posts(public read) with title, body; comments(owner) with post_id ref posts; a function to notify on new comment"

# Review the generated plan file
cat plans/YYYYMMDD_HHMM_generated.yaml

# Apply the plan (creates tables, policies, functions)
npm run kickstack apply --file plans/YYYYMMDD_HHMM_generated.yaml

# If something goes wrong, rollback
npm run kickstack rollback --last
```

### Three-Phase Workflow

**1. PLAN** → Generate and stage artifacts (safe, no changes)
**2. APPLY** → Apply migrations and create functions
**3. VERIFY** → Automatic testing and validation

### Commands

#### Generate from Natural Language

```bash
# Create a complete e-commerce system
kickstack gen "e-commerce with products(public_read), orders(owner), and payment webhook function"

# Generate with custom name
kickstack gen "user management system" --name user_system
```

#### Work with Plan Files

```bash
# Load existing plan and stage artifacts
kickstack plan --file plans/my_plan.yaml

# Apply staged plan
kickstack apply --file plans/my_plan.yaml

# Force overwrite existing files
kickstack apply --file plans/my_plan.yaml --force

# Skip verification after apply
kickstack apply --file plans/my_plan.yaml --no-verify
```

#### Emergency Rollback

```bash
# Restore database to previous snapshot
kickstack rollback --last
```

### Plan File Format

Plans are stored as YAML files in the `/plans/` directory:

```yaml
version: 1
summary: "Blog system with posts and comments"
steps:
  - kind: table
    name: posts
    columns:
      - { name: id, type: uuid, pk: true, default: gen_random_uuid() }
      - { name: author_id, type: uuid, nullable: false }
      - { name: title, type: text, nullable: false }
      - { name: body, type: text, nullable: false }
      - { name: created_at, type: timestamptz, default: now() }
    policy:
      preset: public_read
      owner_col: author_id
    realtime: true
  - kind: table
    name: comments
    columns:
      - { name: id, type: uuid, pk: true, default: gen_random_uuid() }
      - { name: user_id, type: uuid, nullable: false }
      - { name: post_id, type: uuid, nullable: false, ref: "posts(id)" }
      - { name: body, type: text, nullable: false }
      - { name: created_at, type: timestamptz, default: now() }
    policy:
      preset: owner
      owner_col: user_id
  - kind: function
    name: notify_new_comment
    runtime: edge
    path: /api/functions/notify_new_comment.ts
    env: [KICKSTACK_FN_WEBHOOK_URL]
verification:
  smoke:
    - { method: GET, path: "/posts", expect: 200 }
    - { method: POST, path: "/comments", body: {"user_id":"$USER_A","post_id":"$POST_ID","body":"test"}, expect: 201, token: "$TOKEN_A" }
notes: "Generated by AI orchestrator"
```

### What Gets Generated

**Database Schema:**
- PostgreSQL tables with proper types (UUID PKs, TIMESTAMPTZ timestamps)
- Indexes for performance
- Foreign key relationships

**Security Policies:**
- Row-Level Security (RLS) with presets (`owner`, `public_read`)
- Proper grants for anonymous and authenticated users

**Edge Functions:**
- TypeScript functions with full type safety
- JWT authentication context
- Environment variable access
- Optional database triggers

**Realtime Features:**
- WebSocket triggers for live updates
- Change capture and broadcasting

### Safety Features

**Staging System:**
- All artifacts staged in `_staged/` directories before apply
- No database changes until explicit apply command
- Review generated SQL and code before deployment

**Schema Snapshots:**
- Automatic schema backup before each apply
- Rollback capability to previous state
- Keeps last 5 snapshots for safety

**Verification:**
- Automatic connectivity checks (API, Auth, Functions)
- RLS policy validation with test data
- Function smoke tests
- Custom verification checks from plan

### Advanced Usage

**Custom Verification:**
Add verification checks to your plan:
```yaml
verification:
  smoke:
    - method: GET
      path: "/api/health"
      expect: 200
    - method: POST
      path: "/posts"
      body: {"title": "Test", "body": "Content"}
      token: "$TOKEN_A"
      expect: 201
```

**Environment Variables:**
Functions can access environment variables:
```yaml
- kind: function
  name: payment_handler
  env: [KICKSTACK_FN_STRIPE_KEY, KICKSTACK_FN_WEBHOOK_SECRET]
```

Add to `/infra/.env`:
```bash
KICKSTACK_FN_STRIPE_KEY=sk_test_...
KICKSTACK_FN_WEBHOOK_SECRET=whsec_...
```

### Example Generations

**Blog System:**
```bash
kickstack gen "blog with posts(public read, title, content), comments(owner, post_id ref), author profiles(public read)"
```

**E-commerce:**
```bash
kickstack gen "shop with products(public read, name, price), orders(owner, total), payment webhook function"
```

**Task Management:**
```bash
kickstack gen "task app: projects(owner), tasks(owner, project_id ref, status), team members(owner)"
```

**Social Feed:**
```bash
kickstack gen "social feed: posts(public read, content), likes(owner, post_id ref), follow relationships(owner)"
```

### Troubleshooting

**Generation fails:**
- Ensure Ollama is running or OpenAI API key is set
- Check the natural language requirement is clear
- Review error messages for specific issues

**Apply fails:**
- Check database connectivity
- Ensure no conflicting table names
- Use `--force` to overwrite existing files
- Check PostgreSQL logs for detailed errors

**Verification fails:**
- Ensure all services are running (docker-compose ps)
- Check individual service logs
- Use `rollback --last` to restore previous state

**Rollback fails:**
- Check snapshot directory exists: `.kickstack/snapshots/`
- Ensure PostgreSQL is accessible
- Manual recovery may be needed in extreme cases

### Performance Tips

- Keep requirements focused and specific
- Break large systems into multiple plans
- Use `--no-verify` for faster applies in development
- Review generated SQL before applying to production

### Integration with Other Tools

The orchestrator works seamlessly with existing KickStack features:
- Generated tables appear in the Web Dashboard
- Functions are available via the Functions Gateway
- RLS policies work with existing auth system
- Realtime updates work with the WebSocket service

## Deploy to Fly.io

KickStack provides seamless deployment to Fly.io with a single command. Deploy your entire stack (PostgreSQL + PostgREST + GoTrue + Realtime + Functions Gateway) behind a single HTTPS domain.

### Prerequisites

1. **Install flyctl:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Create Fly Postgres database:**
   ```bash
   fly pg create --name kickstack-db
   ```

3. **Configure your environment:**
   ```bash
   # Copy the cloud environment template
   cp infra/env/cloud.env.example .env.cloud.local
   
   # Edit .env.cloud.local with your actual values:
   # - Replace 'your-app-name' with your unique Fly.io app name
   # - Set JWT_SECRET (generate with: openssl rand -base64 32)
   # - Update database URLs from 'fly pg show kickstack-db'
   ```

### Quick Deploy

Deploy your entire KickStack with one command:

```bash
# Generate, build, and deploy to Fly.io
kickstack deploy fly --profile cloud

# Alternative: Manual steps
npm run build:cloud
kickstack env push --profile cloud
npm run deploy:fly
```

### Step-by-Step Deployment

**1. Initialize Fly App:**
```bash
# Update fly.toml with your app name
sed -i 's/kickstack-yourhandle/your-unique-app-name/g' infra/fly/fly.toml

# Create the app (optional - deploy will create it)
fly launch --copy-config --dockerfile infra/fly/Dockerfile
```

**2. Configure Environment:**
```bash
# Edit your cloud environment file
nano .env.cloud.local

# Required variables:
FLY_APP_NAME=your-unique-app-name
JWT_SECRET=your-jwt-secret-here
PGRST_DB_URI=postgres://user:pass@your-postgres.fly.dev:5432/kickstack
GOTRUE_DB_DATABASE_URL=postgres://user:pass@your-postgres.fly.dev:5432/kickstack?sslmode=require
```

**3. Push Environment and Deploy:**
```bash
# Push environment variables as Fly secrets
kickstack env push --profile cloud

# Build and deploy
npm run build:cloud
fly deploy -c infra/fly/fly.toml
```

**4. Verify Deployment:**
```bash
# Run automated validation
infra/fly/scripts/validate-deployment.sh

# Check status
fly status

# View logs
fly logs

# Open in browser
kickstack open
```

### Environment Management

**Push/Pull Environment Variables:**
```bash
# Push local .env.cloud.local to Fly secrets
kickstack env push --profile cloud

# Pull Fly secrets to local file
kickstack env pull --profile cloud
```

**Environment Profiles:**
- **Local**: `infra/env/local.env` (Docker Compose)
- **Cloud**: `.env.cloud.local` (Fly.io secrets)

### What Gets Deployed

**Single Fly.io App with Multiple Processes:**
- **Caddy Proxy** (port 80/443) → Routes traffic to services
- **PostgREST** (port 3000) → Automatic REST API from PostgreSQL
- **GoTrue** (port 9999) → Authentication service
- **Functions Gateway** (port 8787) → Edge functions runtime
- **Realtime** (port 8081) → WebSocket service for live updates
- **Web Dashboard** (port 3001) → Management interface

**URL Routing:**
- `https://your-app.fly.dev/` → PostgREST API
- `https://your-app.fly.dev/auth/` → GoTrue Auth
- `https://your-app.fly.dev/fn/` → Edge Functions
- `https://your-app.fly.dev/realtime` → WebSocket (WSS)
- `https://your-app.fly.dev/health` → Health check

### Testing Your Deployment

**Basic Health Check:**
```bash
curl https://your-app.fly.dev/health
```

**Test Authentication:**
```bash
# Sign up
curl -X POST https://your-app.fly.dev/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Sign in
curl -X POST https://your-app.fly.dev/auth/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Test API (if you have tables):**
```bash
# Public read table (no auth required)
curl https://your-app.fly.dev/your-table-name

# Owner table (auth required)
curl https://your-app.fly.dev/your-private-table \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Test Edge Functions:**
```bash
# Call function without auth
curl -X POST https://your-app.fly.dev/fn/hello \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from production!"}'

# Call function with auth
curl -X POST https://your-app.fly.dev/fn/protected-function \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":"secret"}'
```

### Comprehensive RLS Testing

Run the automated RLS test suite:

```bash
# Test Row-Level Security with real data
infra/fly/scripts/test-rls.sh your-app.fly.dev test_posts

# Manual RLS verification
# 1. Create test users via auth API
# 2. Insert data with different user tokens
# 3. Verify isolation between users
```

### Storage Options

**Option A: Self-hosted MinIO (default)**
```bash
# MinIO runs in the same Fly app with persistent volume
# Data stored in /data volume (configured in fly.toml)
```

**Option B: External S3-compatible storage**
```bash
# Add to .env.cloud.local:
KICKSTACK_S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
KICKSTACK_S3_BUCKET=kickstack
KICKSTACK_S3_ACCESS_KEY=your-access-key
KICKSTACK_S3_SECRET_KEY=your-secret-key

# Disable MinIO process in fly.toml
```

### Scaling and Performance

**Scale Vertically:**
```bash
# Increase memory/CPU
fly scale vm shared-cpu-2x --memory 1024

# Scale to dedicated CPU
fly scale vm dedicated-cpu-1x
```

**Scale Horizontally:**
```bash
# Add more instances
fly scale count 2

# Scale specific processes
fly scale show
```

**Performance Monitoring:**
```bash
# View metrics
fly dashboard your-app

# Check resource usage
fly ssh console -C "htop"

# Database performance
fly pg connect -a kickstack-db
```

### Troubleshooting

**Deployment Issues:**

```bash
# Check build logs
fly logs --app your-app

# SSH into container
fly ssh console

# Restart specific processes
fly ssh console -C "supervisorctl restart postgrest"

# Check service status inside container
fly ssh console -C "supervisorctl status"
```

**Database Connection Issues:**
```bash
# Test database connectivity
fly pg connect -a kickstack-db

# Check PostgreSQL logs
fly logs --app kickstack-db

# Verify connection string
fly ssh console -C "psql \$PGRST_DB_URI -c 'SELECT version();'"
```

**Authentication Problems:**
```bash
# Check JWT secret consistency
fly secrets list | grep JWT_SECRET

# Test GoTrue directly
fly ssh console -C "curl localhost:9999/health"

# Verify PostgREST auth
fly ssh console -C "curl localhost:3050/ -H 'Authorization: Bearer TOKEN'"
```

**Function Issues:**
```bash
# Check Functions Gateway
fly ssh console -C "curl localhost:8787/health"

# Test function directly
fly ssh console -C "curl localhost:8787/fn/hello -X POST -d '{}'"

# Check function logs
fly logs | grep fngw
```

### Security Best Practices

**Production Checklist:**
- [ ] Changed default JWT secret
- [ ] Using strong passwords for database
- [ ] Configured proper CORS origins
- [ ] Set up SSL/TLS (automatic with Fly.io)
- [ ] Enabled database SSL mode
- [ ] Configured proper backups
- [ ] Set up monitoring and alerts

**Secrets Management:**
```bash
# Rotate JWT secret
openssl rand -base64 32 | fly secrets set JWT_SECRET=-

# Update database password
fly pg update kickstack-db --password

# List all secrets (values hidden)
fly secrets list
```

### Custom Domains

```bash
# Add custom domain
fly certs create your-domain.com

# Verify DNS setup
fly certs show your-domain.com

# Update environment variables
fly secrets set GOTRUE_SITE_URL=https://your-domain.com
```

### Backup and Recovery

**Database Backups:**
```bash
# Manual backup
fly pg export kickstack-db > backup.sql

# Restore from backup
fly pg import kickstack-db < backup.sql

# Point-in-time recovery
fly pg create --name kickstack-db-restored --fork-from kickstack-db
```

**Application Backup:**
```bash
# Export configuration
fly config export > fly-config-backup.toml

# Export secrets (values not included for security)
fly secrets list > secrets-backup.txt
```

### Cost Optimization

**Free Tier Usage:**
- **Fly Apps**: 3 shared-CPU-1x VMs (2,340 hours/month)
- **Fly Postgres**: Free tier with shared CPU
- **Bandwidth**: 100GB/month included

**Cost-Effective Setup:**
```bash
# Use minimal resources for development
fly scale vm shared-cpu-1x --memory 256

# Use development Postgres
fly pg create --name kickstack-dev --vm-size shared-cpu-1x
```

**Production Scaling:**
```bash
# Production-ready configuration
fly scale vm dedicated-cpu-1x --memory 1024
fly pg create --name kickstack-prod --vm-size dedicated-cpu-2x
```

### Integration with Local Development

**Sync Data from Production:**
```bash
# Export production data
fly ssh console -C "pg_dump \$PGRST_DB_URI" > prod-data.sql

# Import to local
docker-compose -f infra/docker-compose.yml exec postgres \
  psql -U kick -d kickstack < prod-data.sql
```

**Hybrid Development:**
```bash
# Use production database with local services
export PGRST_DB_URI="postgres://user:pass@your-postgres.fly.dev:5432/kickstack"
cd infra && docker-compose up postgrest gotrue
```

**CI/CD Integration:**
```bash
# GitHub Actions example
- name: Deploy to Fly
  run: |
    fly auth docker
    fly deploy --remote-only
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## CI/CD Automation

KickStack includes comprehensive GitHub Actions workflows for automated testing, deployment, and rollback operations.

### GitHub Actions Workflows

**🔄 Pull Request CI** (`.github/workflows/kickstack-ci.yml`)
- Runs on every pull request to `main`
- Comprehensive test suite across all components
- Linting, type checking, and security scanning
- Integration tests with Docker Compose
- Automated security audit and secret scanning

**🚀 Staging Deployment** (`.github/workflows/kickstack-staging.yml`)
- Triggers on push to `main` branch
- Deploys to staging environment on Fly.io
- Runs validation and RLS security tests
- Provides deployment status and URLs

**🏭 Production Deployment** (`.github/workflows/kickstack-production.yml`)
- Manual trigger with approval gate
- Requires typing "DEPLOY" to confirm
- Pre-deployment safety checks
- Optional database migrations
- Comprehensive post-deployment validation
- Emergency rollback instructions

**🔄 Emergency Rollback** (`.github/workflows/kickstack-rollback.yml`)
- Quick rollback to previous stable version
- Supports both staging and production
- Requires typing "ROLLBACK" to confirm
- Automated validation after rollback
- Detailed post-rollback analysis

### Setup CI/CD

**1. Configure GitHub Secrets:**
```bash
# Required secrets in your GitHub repo
FLY_API_TOKEN=your-fly-api-token
PRODUCTION_APP_NAME=kickstack-production
STAGING_APP_NAME=kickstack-staging
```

**2. Create Fly.io Apps:**
```bash
# Create staging app
fly apps create kickstack-staging

# Create production app  
fly apps create kickstack-production

# Create shared database
fly pg create --name kickstack-db
```

**3. Configure App Secrets:**
```bash
# Set secrets for staging
fly secrets set JWT_SECRET=your-jwt-secret -a kickstack-staging
fly secrets set PGRST_DB_URI=postgres://... -a kickstack-staging

# Set secrets for production
fly secrets set JWT_SECRET=your-jwt-secret -a kickstack-production  
fly secrets set PGRST_DB_URI=postgres://... -a kickstack-production
```

### Workflow Features

**Pull Request Testing:**
- Tests all workspace components (CLI, orchestrator, functions, web)
- Sets up PostgreSQL test database with auth functions
- Runs linting, type checking, and unit tests
- Integration tests with Docker Compose
- Security scanning with TruffleHog
- Build verification for all components

**Staging Deployment:**
- Automatic deployment on main branch changes
- Creates staging-specific configuration
- Comprehensive validation testing
- RLS security verification
- Provides staging URLs and status

**Production Deployment:**
- Manual trigger with safety confirmations
- Pre-deployment health checks
- Optional database migration support
- Rolling deployment strategy
- Post-deployment validation suite
- Detailed success/failure notifications

**Emergency Rollback:**
- Fast rollback to previous release
- Supports version specification or auto-detection
- Health checks after rollback
- Post-rollback analysis and recommendations

### Commands Reference

**Root Package Scripts:**
```bash
# Development
npm run dev                 # Start Docker stack
npm run dev:down           # Stop Docker stack
npm run dev:build          # Rebuild and start

# Testing
npm run test               # Run all tests
npm run test:cli          # Test AI CLI
npm run test:orchestrator # Test orchestrator  
npm run test:fngw         # Test functions gateway
npm run test:web          # Test web dashboard

# Building
npm run build             # Build all components
npm run lint              # Lint all code
npm run typecheck         # Type check all TypeScript

# Deployment
npm run deploy:staging    # Deploy to staging
npm run deploy:production # Deploy to production

# Validation
npm run validate:staging     # Validate staging deployment
npm run validate:production  # Validate production deployment
npm run test:rls:staging    # Test RLS on staging
npm run test:rls:production # Test RLS on production

# Setup
npm run setup              # Install all dependencies
npm run clean             # Clean all build artifacts
```

**CI/CD Best Practices:**
- All tests must pass before deployment
- Staging environment mirrors production
- Automatic rollback on validation failures
- Comprehensive security scanning
- Database migrations are opt-in for production
- Detailed logging and notifications
- Emergency procedures documented

**Monitoring & Alerts:**
- GitHub Actions provide deployment notifications
- Fly.io metrics available through dashboard  
- Custom health checks validate all services
- RLS testing ensures security compliance
- Automatic rollback on critical failures

**Security Features:**
- Secrets scanning in CI pipeline
- Dependency vulnerability checking  
- RLS policy validation
- JWT token verification
- CORS and auth endpoint testing
- Production deployment approval gates

## Templates & Module Marketplace

KickStack includes a comprehensive template marketplace that lets you discover, share, and install prebuilt components with one command. Accelerate development with community-vetted schemas, RLS policies, edge functions, and complete application blueprints.

### Quick Start

```bash
# Search for templates
kickstack template search blog

# Get detailed info about a template
kickstack template info blog-basic

# Install and apply a template
kickstack template install blog-basic --apply

# List installed templates
kickstack template list
```

### Available Templates

KickStack includes several verified templates to get you started:

**📝 Blog Basic** - Complete blog system with public posts and private comments
- Tables: `posts` (public_read), `comments` (owner)  
- Functions: Comment notification webhook
- Perfect for content sites, documentation, news

**🛒 E-commerce Basic** - Full e-commerce setup with products and orders
- Tables: `products` (public_read), `orders` + `order_items` (owner)
- Functions: Stripe payment webhook
- Perfect for online stores, marketplaces, subscriptions

### Template Structure

Templates are packaged as `.tar.gz` files with this structure:

```
template-name/
├── manifest.yaml          # Template metadata and requirements
├── migrations/            # SQL migration files
│   ├── 001_create_tables.sql
│   └── 002_policies.sql
├── functions/             # Edge functions (TypeScript)
│   └── webhook.ts
├── assets/               # Additional resources
│   └── README.md
└── README.md             # Template documentation
```

### Manifest Format

Every template includes a `manifest.yaml` file:

```yaml
version: 1
name: blog-basic
display_name: "Basic Blog"
description: "Posts (public_read) and Comments (owner) with notifications"
category: application
tags: [blog, public_read, owner, demo]
author: "@kickstack"
license: MIT
verified: true
kickstack_min_version: 1.0.0

contents:
  tables: [posts, comments]
  policies: [public_read, owner]  
  functions: [notify_comment]

dependencies: []
env_vars:
  - KICKSTACK_FN_WEBHOOK_URL
```

### Template Commands

#### Search and Discovery

```bash
# Search all templates
kickstack template search

# Search by keyword
kickstack template search "blog"
kickstack template search "ecommerce"

# Filter by category
kickstack template search --category application

# Filter by tag  
kickstack template search --tag public_read

# Show only verified templates
kickstack template search --verified-only
```

#### Template Information

```bash
# Get detailed template info
kickstack template info blog-basic

# Preview installation (dry run)
kickstack template install blog-basic --dry-run
```

#### Installation

```bash
# Install template (stages files for review)
kickstack template install blog-basic

# Install and apply immediately
kickstack template install blog-basic --apply

# Force installation (skip confirmations)
kickstack template install blog-basic --force

# Review staged files before applying
ls infra/migrations/_staged/
ls api/functions/_staged/

# Apply staged template manually
kickstack apply --staged
```

#### Template Management

```bash
# List installed templates
kickstack template list

# Update template index cache
kickstack template update-index

# Add custom template registry
kickstack template update-index --add-index https://my-templates.com/index.json
```

### Creating Your Own Templates

#### 1. Template Structure

Create a new template directory:

```bash
mkdir my-template
cd my-template

# Required structure
mkdir migrations functions assets
touch manifest.yaml README.md
```

#### 2. Write the Manifest

Create `manifest.yaml`:

```yaml
version: 1
name: my-template
display_name: "My Awesome Template"
description: "Description of what this template provides"
category: application  # application, utility, demo
tags: [tag1, tag2, tag3]
author: "@yourusername"
license: MIT
kickstack_min_version: 1.0.0

contents:
  tables: [users, posts]
  policies: [owner, public_read]
  functions: [webhook]

env_vars:
  - KICKSTACK_FN_MY_SECRET
```

#### 3. Add Migrations

Create SQL files in `migrations/`:

```sql
-- migrations/001_create_users.sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

#### 4. Add Functions (Optional)

Create TypeScript files in `functions/`:

```typescript
// functions/webhook.ts
import type { KickContext, KickEvent } from "./types";

export default async function webhook(event: KickEvent, ctx: KickContext) {
  const secret = ctx.env['KICKSTACK_FN_MY_SECRET'];
  
  return {
    ok: true,
    message: 'Webhook processed',
    user: ctx.user?.sub
  };
}
```

#### 5. Document Your Template

Write a comprehensive `README.md` with:
- What the template provides
- Usage examples
- Environment variables needed
- Customization instructions

#### 6. Package and Test

```bash
# Validate template structure
kickstack template package ./my-template --validate-only

# Create package
kickstack template package ./my-template

# Test locally
kickstack template install ./my-template.tar.gz --apply
```

### AI Orchestrator Integration

Templates integrate seamlessly with KickStack's AI orchestrator:

```bash
# AI suggests matching templates during generation
kickstack gen "I need a blog with posts and comments"

# Output includes template suggestions:
# 💡 Found 1 matching template(s) that could help:
#    • Basic Blog: Posts (public_read) and Comments (owner) schema
# 
# Generated plan can reference templates in notes section
```

### Template Security & Trust

**Verified Templates** ✅
- Reviewed by KickStack maintainers
- Digitally signed for authenticity  
- Follow security best practices
- Safe for production use

**Unverified Templates** ⚠️
- Community contributions
- Warning shown before installation
- Review contents before applying
- Use `--force` to skip prompts in CI

```bash
# Security features
- SHA256 checksum verification
- Digital signature validation (verified templates)
- Manual review prompts for unverified templates
- Staged installation (review before apply)
```

### Template Categories

**Applications** - Complete app blueprints
- Blog systems, e-commerce, CMS, forums
- Multi-table schemas with relationships
- Includes functions and policies

**Components** - Reusable building blocks
- Authentication flows, notification systems
- Single-purpose functions
- Common RLS patterns

**Utilities** - Development helpers
- Database utilities, migration templates
- Testing frameworks, development tools

### Environment Variables

Templates can specify required environment variables:

```bash
# Add to infra/.env for local development
KICKSTACK_FN_STRIPE_SECRET=sk_test_...
KICKSTACK_FN_WEBHOOK_URL=https://example.com/webhook

# Production secrets via Fly.io
fly secrets set KICKSTACK_FN_STRIPE_SECRET=sk_live_...
```

### Template Publishing

Share your templates with the community:

```bash
# Package your template
kickstack template package ./my-template

# Publish to marketplace (future feature)
kickstack template publish my-template.tar.gz

# Sign for verification (requires keys)
kickstack template publish my-template.tar.gz --verify
```

### Best Practices

**Template Design:**
- Keep templates focused and single-purpose
- Include comprehensive documentation
- Follow KickStack naming conventions
- Test with multiple scenarios

**Security:**
- Never include secrets in templates
- Use environment variables for configuration
- Apply appropriate RLS policies
- Validate all inputs in functions

**Documentation:**
- Provide clear usage examples
- Document all environment variables
- Explain customization options
- Include troubleshooting tips

### Template Registry

Templates are distributed through the official KickStack registry at `https://templates.kickstack.dev`. You can also host your own private registries for internal templates.

**Registry Features:**
- JSON-based index for fast searching
- CDN distribution for fast downloads
- Version management and updates
- Custom registry support

### Troubleshooting Templates

**Installation Issues:**
```bash
# Check template info
kickstack template info template-name

# Validate before installing
kickstack template install template-name --dry-run

# Check template index
kickstack template update-index
```

**Template Development:**
```bash
# Validate template structure
kickstack template package ./my-template --validate-only

# Check manifest syntax
# Ensure all declared directories exist
# Test packaging before distribution
```

### Integration with Existing Features

Templates work seamlessly with all KickStack features:

- **Web Dashboard** - Installed tables appear automatically
- **Realtime Updates** - Template triggers work with WebSocket service
- **Row-Level Security** - Template policies integrate with auth system
- **Edge Functions** - Template functions deploy through functions gateway
- **CI/CD** - Templates can be installed in deployment pipelines

## Dashboard Template Browser

KickStack includes a beautiful web UI for browsing and installing templates directly from the dashboard, without needing to use the CLI.

### Accessing the Template Browser

1. **Start the dashboard:**
   ```bash
   npm run web:dev
   ```

2. **Navigate to templates:**
   - Open http://localhost:3001
   - Click "Browse Templates" or navigate to http://localhost:3001/templates

3. **Start the Dashboard API (required for template features):**
   ```bash
   cd api/dashboard
   npm install
   npm run dev
   ```

### Dashboard Features

**🔍 Search & Discovery**
- Full-text search across template names, descriptions, and tags
- Filter by category (application, utility, demo, component)
- Filter by tags (blog, ecommerce, auth, etc.)
- Verified-only filter to show only reviewed templates
- Real-time result updates as you type

**📋 Template Details**
- **Overview Tab**: Template metadata, author, license, version
- **README Tab**: Full markdown documentation with syntax highlighting
- **Contents Tab**: Lists all tables, policies, and functions included

**🚀 One-Click Installation**
- **Stage Mode**: Downloads templates to `_staged/` directories for review
- **Apply Mode**: Immediately applies migrations and deploys functions
- **Force Overwrite**: Option to replace existing files
- Authentication required for installation (uses your dashboard login)

**✅ Verification & Security**
- Green checkmark badge for verified templates
- Yellow warning banner for unverified templates
- Confirmation modal for apply operations
- Clear security warnings before installation

**📦 Installed Templates View**
- Switch to "Installed" tab to see all installed templates
- Shows installation date, version, and path
- Quick reference for what's already in your project

### Template Card Information

Each template card displays:
- **Icon**: Category-specific emoji (🎯 application, 🛠️ utility, etc.)
- **Name & Description**: Clear identification and purpose
- **Verification Badge**: ✅ for verified templates
- **Tags**: Color-coded tags for quick categorization
- **Contents Summary**: Count of tables, policies, and functions
- **Metadata**: Author, license, and version information

### Installation Workflow

1. **Browse & Search**
   - Use filters to find templates matching your needs
   - Click on a template card to view details

2. **Review Template**
   - Read the README for usage instructions
   - Check the Contents tab to see what will be installed
   - Note any required environment variables

3. **Choose Installation Mode**
   - **Stage Only**: Safe option to preview changes
   - **Apply Immediately**: For trusted templates

4. **Configure Options**
   - Toggle "Force overwrite" if updating existing files
   - Review security warnings for unverified templates

5. **Install**
   - Click "Install Template" button
   - Confirm in modal if applying immediately
   - View success message with installed file paths

### Dashboard API Configuration

The template browser requires the Dashboard API service:

```bash
# Environment variables (optional)
DASHBOARD_API_PORT=8787  # API port (default: 8787)
JWT_SECRET=your-secret    # Must match your GoTrue configuration

# Start the Dashboard API
cd api/dashboard
npm install
npm run dev
```

The Dashboard API provides:
- `GET /api/templates/index` - Fetch template catalog
- `GET /api/templates/search` - Search with filters
- `GET /api/templates/:name` - Get template details
- `POST /api/templates/install` - Install a template
- `GET /api/templates/installed` - List installed templates
- `POST /api/templates/refresh-index` - Update cache

### Security Considerations

**Authentication Required**
- Template installation requires a valid JWT token
- Login through the dashboard's AuthPanel component
- Token is stored in localStorage and sent with install requests

**Verified Templates** (✅)
- Reviewed by KickStack maintainers
- Safe for production use
- No additional warnings shown

**Unverified Templates** (⚠️)
- Community contributions
- Yellow warning banner in drawer
- Confirmation required before installation
- Review contents carefully

### UI Components

The template browser is built with modular React components:

- **TemplateBrowser**: Main container with search, filters, and tabs
- **TemplateCard**: Individual template display in grid
- **TemplateDrawer**: Slide-out panel with full template details
- **InstalledList**: Display of installed templates with metadata

### Styling & UX

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Tailwind CSS**: Consistent with KickStack dashboard aesthetic
- **Loading States**: Spinners during async operations
- **Error Handling**: Clear error messages with recovery options
- **Success Feedback**: Green confirmation messages after installation

### Integration with CLI

Templates installed via the dashboard are identical to CLI installations:
- Same staging directories (`infra/migrations/_staged/`, `api/functions/_staged/`)
- Same installation tracking (`.kickstack/installed.json`)
- Can be managed with CLI commands after dashboard installation

### Troubleshooting Dashboard Templates

**Templates not loading:**
- Ensure Dashboard API is running on port 8787
- Check browser console for network errors
- Click "Refresh Index" to update cache

**Installation fails:**
- Verify you're logged in (check AuthPanel)
- Ensure Dashboard API can access template files
- Check filesystem permissions for staging directories

**Template not appearing after install:**
- Refresh the page to see newly installed tables
- Check `_staged/` directories if using stage mode
- Run `kickstack apply --staged` to apply staged templates

### Development & Testing

**Run tests:**
```bash
cd web
npm test
```

**Test coverage includes:**
- Template filtering and search
- Installation workflow
- Error handling
- Security warnings
- Component rendering

### Future Enhancements

Planned improvements for the template browser:
- Template ratings and reviews
- Version update notifications
- Template dependency resolution
- Custom template upload
- Template creation wizard
- AI-powered template recommendations based on project analysis