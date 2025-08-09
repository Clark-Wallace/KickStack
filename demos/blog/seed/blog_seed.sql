-- Blog Demo Seed Data
-- Creates sample posts, comments, and likes for testing

-- Sample author IDs (would be real user IDs in production)
DO $$
DECLARE
    author1_id UUID := '11111111-1111-1111-1111-111111111111';
    author2_id UUID := '22222222-2222-2222-2222-222222222222';
    user1_id UUID := '33333333-3333-3333-3333-333333333333';
    user2_id UUID := '44444444-4444-4444-4444-444444444444';
    post1_id UUID;
    post2_id UUID;
    post3_id UUID;
BEGIN
    -- Insert sample blog posts
    INSERT INTO public.blog_posts (id, author_id, author_name, title, slug, excerpt, body, featured_image, tags, published, published_at, views)
    VALUES 
    (
        gen_random_uuid(),
        author1_id,
        'Jane Developer',
        'Getting Started with KickStack',
        'getting-started-with-kickstack',
        'Learn how to build production-ready backends in minutes with KickStack''s AI-powered platform.',
        E'# Getting Started with KickStack\n\nKickStack is a local-first, AI-powered backend platform that helps you build production-ready APIs in minutes.\n\n## Key Features\n\n- **AI-Powered Schema Generation**: Describe your tables in natural language\n- **Instant REST APIs**: PostgreSQL + PostgREST = instant endpoints\n- **Built-in Authentication**: JWT-based auth with GoTrue\n- **Row-Level Security**: Multiple policy presets for different use cases\n- **Realtime Updates**: WebSocket broadcasting for live data\n\n## Quick Start\n\n```bash\nnpm run kickstack add-table "users with name, email, role"\n```\n\nThat''s it! You now have a fully functional users API with authentication and security.',
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6',
        '["tutorial", "getting-started", "backend", "api"]'::jsonb,
        true,
        NOW() - INTERVAL '5 days',
        234
    ) RETURNING id INTO post1_id;

    INSERT INTO public.blog_posts (id, author_id, author_name, title, slug, excerpt, body, featured_image, tags, published, published_at, views)
    VALUES 
    (
        gen_random_uuid(),
        author1_id,
        'Jane Developer',
        'Building Multi-Tenant SaaS with KickStack',
        'building-multi-tenant-saas',
        'Implement organization-based data isolation using KickStack''s team_scope policies.',
        E'# Building Multi-Tenant SaaS with KickStack\n\nMulti-tenancy is a crucial pattern for SaaS applications. KickStack makes it easy with built-in support for organization-based data isolation.\n\n## Team Scope Policies\n\nThe `team_scope` policy preset provides:\n- Organization-level data isolation\n- Owner restrictions within orgs\n- Admin override capabilities\n- JWT-based org claims\n\n## Implementation\n\n```bash\n# Create a table with org scope\nnpm run kickstack add-table "projects with name, budget"\n\n# Apply team scope policy\nnpm run kickstack add-policy team_scope projects --add-org-col\n```\n\n## Testing\n\nGenerate tokens for different organizations:\n\n```bash\nnpm run kickstack generate-token user --org-id <uuid>\n```',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
        '["saas", "multi-tenancy", "security", "tutorial"]'::jsonb,
        true,
        NOW() - INTERVAL '3 days',
        567
    ) RETURNING id INTO post2_id;

    INSERT INTO public.blog_posts (id, author_id, author_name, title, slug, excerpt, body, featured_image, tags, published, published_at, views)
    VALUES 
    (
        gen_random_uuid(),
        author2_id,
        'Bob Builder',
        'Deploying KickStack to Production',
        'deploying-kickstack-production',
        'Step-by-step guide to deploying your KickStack application to Fly.io.',
        E'# Deploying KickStack to Production\n\nReady to go live? This guide walks you through deploying your KickStack app to Fly.io.\n\n## Prerequisites\n\n- Fly.io account and CLI\n- Environment variables configured\n- Database migrations tested\n\n## Deployment Steps\n\n### 1. Configure Environment\n\n```bash\ncp infra/.env.example infra/.env.production\n# Edit with production values\n```\n\n### 2. Deploy to Fly.io\n\n```bash\nnpm run kickstack deploy fly --profile cloud\n```\n\n### 3. Verify Deployment\n\n```bash\nflyctl status\nflyctl logs\n```\n\n## Post-Deployment\n\n- Set up monitoring\n- Configure backups\n- Enable SSL\n- Set up custom domain',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
        '["deployment", "production", "fly.io", "devops"]'::jsonb,
        true,
        NOW() - INTERVAL '1 day',
        892
    ) RETURNING id INTO post3_id;

    -- Insert sample comments
    INSERT INTO public.blog_comments (post_id, user_id, user_name, body, approved, created_at)
    VALUES 
    (post1_id, user1_id, 'Alice User', 'Great tutorial! This really helped me get started quickly.', true, NOW() - INTERVAL '4 days'),
    (post1_id, user2_id, 'Charlie Coder', 'The AI schema generation is amazing. Saved me hours of work!', true, NOW() - INTERVAL '3 days'),
    (post2_id, user1_id, 'Alice User', 'Perfect timing! I was just looking for multi-tenancy solutions.', true, NOW() - INTERVAL '2 days'),
    (post2_id, author1_id, 'Jane Developer', 'Thanks! Let me know if you have any questions about implementation.', true, NOW() - INTERVAL '2 days'),
    (post3_id, user2_id, 'Charlie Coder', 'Fly.io deployment was smooth. Any plans for AWS support?', true, NOW() - INTERVAL '12 hours');

    -- Insert sample likes
    INSERT INTO public.blog_likes (post_id, user_id, created_at)
    VALUES 
    (post1_id, user1_id, NOW() - INTERVAL '4 days'),
    (post1_id, user2_id, NOW() - INTERVAL '3 days'),
    (post1_id, author2_id, NOW() - INTERVAL '3 days'),
    (post2_id, user1_id, NOW() - INTERVAL '2 days'),
    (post2_id, user2_id, NOW() - INTERVAL '1 day'),
    (post3_id, user1_id, NOW() - INTERVAL '12 hours'),
    (post3_id, author1_id, NOW() - INTERVAL '6 hours');

    -- Insert a draft post (not published)
    INSERT INTO public.blog_posts (author_id, author_name, title, slug, excerpt, body, tags, published)
    VALUES 
    (
        author2_id,
        'Bob Builder',
        'Advanced KickStack Patterns',
        'advanced-kickstack-patterns',
        'Deep dive into advanced patterns and best practices.',
        'Work in progress...',
        '["advanced", "patterns", "architecture"]'::jsonb,
        false
    );

END $$;