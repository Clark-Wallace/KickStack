-- Apply owner RLS policy to comments table
-- Users can only see and modify their own comments

-- Owner-only select policy - users can only see their own comments
DROP POLICY IF EXISTS comments_select_own ON comments;
CREATE POLICY comments_select_own ON comments
  FOR SELECT
  USING (user_id = auth.uid());

-- Owner-only insert policy - users can only insert comments they own
DROP POLICY IF EXISTS comments_insert_own ON comments;
CREATE POLICY comments_insert_own ON comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Owner-only update policy - users can only update their own comments
DROP POLICY IF EXISTS comments_update_own ON comments;
CREATE POLICY comments_update_own ON comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owner-only delete policy - users can only delete their own comments
DROP POLICY IF EXISTS comments_delete_own ON comments;
CREATE POLICY comments_delete_own ON comments
  FOR DELETE
  USING (user_id = auth.uid());