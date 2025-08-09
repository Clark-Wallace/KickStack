-- Apply public_read RLS policy to posts table
-- Anyone can read all posts, only authors can modify their posts

-- Public read policy - anyone can select all posts
DROP POLICY IF EXISTS posts_select_public ON posts;
CREATE POLICY posts_select_public ON posts
  FOR SELECT
  USING (true);

-- Owner-only insert policy - users can only insert posts they own
DROP POLICY IF EXISTS posts_insert_own ON posts;
CREATE POLICY posts_insert_own ON posts
  FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- Owner-only update policy - users can only update their own posts
DROP POLICY IF EXISTS posts_update_own ON posts;
CREATE POLICY posts_update_own ON posts
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Owner-only delete policy - users can only delete their own posts
DROP POLICY IF EXISTS posts_delete_own ON posts;
CREATE POLICY posts_delete_own ON posts
  FOR DELETE
  USING (author_id = auth.uid());