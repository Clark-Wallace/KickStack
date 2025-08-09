# Basic Blog Template

A complete blog system with public posts and private comments.

## Features

- **Posts Table**: Publicly readable blog posts with public_read RLS policy
- **Comments Table**: Owner-only comments with RLS policy for data privacy
- **Notification Function**: Edge function that sends notifications when new comments are added
- **Realtime Updates**: WebSocket triggers for live comment updates

## Schema

### Posts
- `id` (UUID, PK): Unique post identifier
- `author_id` (UUID): Post author (references auth users)
- `title` (TEXT): Post title
- `content` (TEXT): Post content
- `slug` (TEXT): URL-friendly slug
- `published` (BOOLEAN): Publication status
- `created_at` (TIMESTAMPTZ): Creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

### Comments  
- `id` (UUID, PK): Unique comment identifier
- `user_id` (UUID): Comment author (references auth users)
- `post_id` (UUID): Associated post (FK to posts.id)
- `content` (TEXT): Comment content
- `created_at` (TIMESTAMPTZ): Creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

## Usage

```bash
# Install the template
kickstack template install blog-basic --apply

# Create a new post (authenticated)
curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Post",
    "content": "Hello, world!",
    "slug": "my-first-post",
    "published": true
  }'

# Read all posts (no auth required)
curl http://localhost:3000/posts

# Add a comment (authenticated)
curl -X POST http://localhost:3000/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "POST_UUID_HERE",
    "content": "Great post!"
  }'

# Read comments for a post (owner can see all their comments)
curl http://localhost:3000/comments?post_id=eq.POST_UUID_HERE \
  -H "Authorization: Bearer $TOKEN"
```

## Environment Variables

- `KICKSTACK_FN_WEBHOOK_URL`: Optional webhook URL for comment notifications

## Security

- **Posts**: Anyone can read, only authors can create/update/delete their posts
- **Comments**: Only authenticated users can create comments, users can only see/modify their own comments
- **Functions**: Notification function runs with system privileges but validates input

## Customization

After installation, you can:
1. Add additional fields to posts (tags, categories, etc.)
2. Modify RLS policies for different access patterns
3. Customize the notification function
4. Add more complex relationships (tags, categories, likes, etc.)