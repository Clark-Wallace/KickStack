-- Blog Demo RLS Policies
-- Implements public_read for posts and owner policies for comments/likes

-- Enable RLS on all tables
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_likes ENABLE ROW LEVEL SECURITY;

-- Blog Posts Policies (public_read preset)
-- Anyone can read published posts
CREATE POLICY blog_posts_select_public ON public.blog_posts
    FOR SELECT
    USING (published = true OR author_id = auth_uid());

-- Only authors can insert their own posts
CREATE POLICY blog_posts_insert_own ON public.blog_posts
    FOR INSERT
    WITH CHECK (author_id = auth_uid());

-- Only authors can update their own posts
CREATE POLICY blog_posts_update_own ON public.blog_posts
    FOR UPDATE
    USING (author_id = auth_uid())
    WITH CHECK (author_id = auth_uid());

-- Only authors can delete their own posts
CREATE POLICY blog_posts_delete_own ON public.blog_posts
    FOR DELETE
    USING (author_id = auth_uid());

-- Blog Comments Policies (owner preset)
-- Authenticated users can see all approved comments or their own
CREATE POLICY blog_comments_select ON public.blog_comments
    FOR SELECT
    USING (approved = true OR user_id = auth_uid());

-- Users can only insert comments as themselves
CREATE POLICY blog_comments_insert_own ON public.blog_comments
    FOR INSERT
    WITH CHECK (user_id = auth_uid());

-- Users can only update their own comments
CREATE POLICY blog_comments_update_own ON public.blog_comments
    FOR UPDATE
    USING (user_id = auth_uid())
    WITH CHECK (user_id = auth_uid());

-- Users can only delete their own comments
CREATE POLICY blog_comments_delete_own ON public.blog_comments
    FOR DELETE
    USING (user_id = auth_uid());

-- Blog Likes Policies (owner preset)
-- Anyone can see likes
CREATE POLICY blog_likes_select_all ON public.blog_likes
    FOR SELECT
    USING (true);

-- Users can only insert likes as themselves
CREATE POLICY blog_likes_insert_own ON public.blog_likes
    FOR INSERT
    WITH CHECK (user_id = auth_uid());

-- Users can only delete their own likes
CREATE POLICY blog_likes_delete_own ON public.blog_likes
    FOR DELETE
    USING (user_id = auth_uid());