-- Migration: Add rls_public_read_blog_posts table
-- Generated: 2025-08-09T18:16:17.359Z
-- Description: Auto-generated from natural language specification


-- Add owner column if it doesn't exist
ALTER TABLE public."blog_posts"
  ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL DEFAULT auth_uid();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id 
  ON public."blog_posts"("user_id");

-- Enable Row Level Security on blog_posts
ALTER TABLE public."blog_posts" ENABLE ROW LEVEL SECURITY;

-- Policy: select_public - Anyone can read all rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'blog_posts' 
    AND policyname = 'select_public'
  ) THEN
    CREATE POLICY select_public ON public."blog_posts"
      FOR SELECT
      USING (TRUE);
  END IF;
END $$;

COMMENT ON POLICY select_public ON public."blog_posts" IS 
  'Allow public read access - anyone can view all rows';

-- Policy: insert_own - Users can only insert rows they own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'blog_posts' 
    AND policyname = 'insert_own'
  ) THEN
    CREATE POLICY insert_own ON public."blog_posts"
      FOR INSERT
      WITH CHECK ("user_id" = auth_uid());
  END IF;
END $$;

COMMENT ON POLICY insert_own ON public."blog_posts" IS 
  'Users can only insert rows where user_id matches their auth_uid()';

-- Policy: update_own - Users can only update their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'blog_posts' 
    AND policyname = 'update_own'
  ) THEN
    CREATE POLICY update_own ON public."blog_posts"
      FOR UPDATE
      USING ("user_id" = auth_uid())
      WITH CHECK ("user_id" = auth_uid());
  END IF;
END $$;

COMMENT ON POLICY update_own ON public."blog_posts" IS 
  'Users can only update rows where user_id matches their auth_uid()';

-- Policy: delete_own - Users can only delete their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'blog_posts' 
    AND policyname = 'delete_own'
  ) THEN
    CREATE POLICY delete_own ON public."blog_posts"
      FOR DELETE
      USING ("user_id" = auth_uid());
  END IF;
END $$;

COMMENT ON POLICY delete_own ON public."blog_posts" IS 
  'Users can only delete rows where user_id matches their auth_uid()';

-- Grant permissions
-- Anonymous users can only SELECT (public read)
GRANT SELECT ON public."blog_posts" TO anon;
REVOKE INSERT, UPDATE, DELETE ON public."blog_posts" FROM anon;

-- Authenticated users get full CRUD (policies will filter)
GRANT SELECT, INSERT, UPDATE, DELETE ON public."blog_posts" TO authenticated;


-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rls_public_read_blog_posts_created_at ON rls_public_read_blog_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_rls_public_read_blog_posts_updated_at ON rls_public_read_blog_posts(updated_at);
