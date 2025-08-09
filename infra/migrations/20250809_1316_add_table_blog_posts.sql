-- Migration: Add blog_posts table
-- Generated: 2025-08-09T18:16:01.816Z
-- Description: Auto-generated from natural language specification

CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT,
  author_name TEXT,
  published BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_updated_at ON blog_posts(updated_at);
