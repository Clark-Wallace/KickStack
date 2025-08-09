-- Blog Demo Schema Migration
-- Creates tables for posts, comments, and likes with appropriate RLS policies

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    body TEXT NOT NULL,
    featured_image TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for blog_posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published, published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON public.blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON public.blog_posts USING gin(tags);

-- Create blog_comments table
CREATE TABLE IF NOT EXISTS public.blog_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    body TEXT NOT NULL,
    approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for blog_comments
CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON public.blog_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_blog_comments_user ON public.blog_comments(user_id);

-- Create blog_likes table
CREATE TABLE IF NOT EXISTS public.blog_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at 
    BEFORE UPDATE ON public.blog_posts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blog_comments_updated_at ON public.blog_comments;
CREATE TRIGGER update_blog_comments_updated_at 
    BEFORE UPDATE ON public.blog_comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'
            ),
            '-+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate slug if not provided
CREATE OR REPLACE FUNCTION auto_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug = generate_slug(NEW.title) || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_generate_blog_post_slug ON public.blog_posts;
CREATE TRIGGER auto_generate_blog_post_slug
    BEFORE INSERT ON public.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_slug();

-- Grant permissions
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blog_likes TO authenticated;