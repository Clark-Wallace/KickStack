# KickStack 🚀

[![CI](https://github.com/Clark-Wallace/KickStack/actions/workflows/kickstack-ci.yml/badge.svg)](https://github.com/Clark-Wallace/KickStack/actions/workflows/kickstack-ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**An experimental AI-powered backend generator** that creates PostgreSQL schemas, REST APIs, and authentication from natural language. Built as an exploration of what's possible when combining AI with traditional backend tools.

> ⚠️ **Status: Experimental/Educational** - This project was an ambitious experiment in AI-driven development. While functional for prototypes and learning, it's not recommended for production use. Feel free to fork, learn from, or build upon it!

## What Is KickStack?

KickStack started as an attempt to create a "better Supabase" and pivoted to become an AI-first backend builder. It combines:
- 🤖 Natural language to SQL schema generation
- 🗄️ PostgreSQL with PostgREST for instant REST APIs
- 🔐 JWT authentication with GoTrue
- 📦 Docker Compose for local-first development
- ⚡ Edge functions support
- 🔄 Realtime subscriptions via WebSockets

## The Journey & Lessons Learned

This project was an exploration that revealed important insights:

1. **The Vision**: Create a tool where you could describe your backend in plain English and get a complete, production-ready system
2. **The Reality**: The problem space is vastly more complex than anticipated
3. **The Learning**: AI can assist with schema generation, but the gap between "generated scaffold" and "production system" is massive

### What Works Well ✅
- Natural language to basic schema generation
- Local development environment setup
- PostgreSQL + PostgREST integration
- Template-based fallbacks when AI isn't available
- Basic CRUD API generation

### What's Missing for Production ⚠️
- Complex business logic handling
- Migration safety and rollback strategies  
- Collaborative development workflows
- Performance optimization
- Comprehensive testing
- API documentation generation
- Cost management for AI calls
- Production deployment patterns

## Quick Start (For Experimentation)

```bash
# Clone and setup
git clone https://github.com/Clark-Wallace/KickStack.git
cd kickstack
npm install

# Start the infrastructure
cd infra
docker-compose up -d

# Try the AI features (OpenAI API key optional)
export OPENAI_API_KEY="sk-..." # Optional - falls back to templates

# Generate a backend from natural language
npm run kickstack new "blog with posts and comments" --dry-run

# Create tables the traditional way
npm run kickstack add-table "users with name, email, role"
```

## Architecture

```
kickstack/
├── ai/
│   ├── cli/              # KickStack CLI with AI integration
│   └── orchestrator/     # AI planning and SQL generation
├── infra/
│   ├── docker-compose.yml # PostgreSQL, PostgREST, Auth, MinIO
│   └── migrations/        # Database migrations
├── web/                   # Next.js dashboard
├── functions/            # Edge functions
└── templates/            # Pre-built app templates
```

## Interesting Code to Explore

If you're learning or building something similar, check out:

1. **AI Plan Compiler** (`/ai/orchestrator/src/plan-compiler.ts`)
   - Converts natural language plans to SQL migrations
   - Generates TypeScript types from schemas
   - Creates React hooks automatically

2. **Policy Generators** (`/ai/cli/src/policies/`)
   - Row-level security patterns
   - Multi-tenancy with team scope
   - Owner-based access control

3. **Template System** (`/ai/cli/src/lib/template-manager.ts`)
   - Fallback when AI isn't available
   - Pre-built patterns for common apps

4. **Schema Evolution** (`/ai/orchestrator/src/manifest.ts`)
   - Tracks schema changes over time
   - Project state management

## Use Cases Where It Might Help

Despite its limitations, KickStack could be useful for:

- **Hackathons**: Get a backend running in minutes
- **Learning**: See how different backend pieces fit together
- **Prototypes**: Quickly test ideas without manual setup
- **Demos**: Generate example schemas for presentations

## If You Want to Fork This

Here's where you might take it:

### Option 1: Simplify Drastically
Remove the AI parts and focus on being a simpler, local-first Supabase alternative.

### Option 2: Focus on Learning
Turn it into an educational tool that explains backend concepts as it generates code.

### Option 3: Extract Components
The individual pieces might be useful:
- The CLI structure for database management
- The Docker Compose setup for local development
- The policy generators for RLS patterns
- The template system for scaffolding

### Option 4: AI Training Data
The patterns and templates could be useful for training more specialized AI models.

## Technologies Used

- **Database**: PostgreSQL 15 with PostgREST
- **Authentication**: GoTrue (Supabase's auth service)
- **Storage**: MinIO (S3-compatible)
- **AI**: OpenAI GPT-4 (optional) with template fallbacks
- **Frontend**: Next.js 14 with TypeScript
- **CLI**: Commander.js with TypeScript
- **Infrastructure**: Docker Compose

## Why It's Not Production Ready

Being transparent about limitations:

1. **AI Unpredictability**: Natural language is ambiguous; generated schemas might not match intentions
2. **No Migration Safety**: No proper testing of migrations against existing data
3. **Limited Business Logic**: Only generates schemas, not complex workflows
4. **Missing Collaboration**: No team features, review processes, or change management
5. **Performance**: Generated queries aren't optimized; no smart indexing
6. **Documentation**: No automatic API docs or data dictionary generation
7. **Cost**: OpenAI API calls can get expensive quickly
8. **Testing**: Limited test coverage and no production battle-testing

## Contributing

This project is open source and available for anyone to fork, modify, or learn from. If you do something interesting with it, I'd love to hear about it!

Some ideas for contributions:
- Better AI prompts for specific domains
- Visual schema designer
- Migration safety checks
- API documentation generator
- Performance optimizations
- Additional templates

## License

Apache 2.0 - Use it however you'd like!

## Acknowledgments

This project builds on excellent open source tools:
- [PostgREST](https://postgrest.org/) for instant REST APIs
- [Supabase](https://supabase.com/) for auth inspiration and GoTrue
- [MinIO](https://min.io/) for object storage
- [OpenAI](https://openai.com/) for GPT-4 access

## Final Thoughts

KickStack was an ambitious experiment in pushing the boundaries of AI-assisted development. While it didn't achieve the dream of "natural language to production backend," it revealed important lessons about the complexity of real-world systems and the current limits of AI in software development.

Sometimes the best outcome of a project isn't a successful product, but the knowledge gained along the way. If you're thinking about building something similar, hopefully this code and these lessons save you some time.

**Remember**: Not every project needs to become a business. Sometimes building something ambitious and learning from it is success enough. 🌟

---

*"Just Kick it... into the ocean of open source projects, where it might inspire or help someone else's journey."*