# Blog Demo - KickStack

A full-featured blogging platform demonstrating KickStack's core capabilities.

## Features

### 🔐 Security
- **Public Read Posts**: Anyone can read published posts
- **Author-Only Editing**: Only post authors can edit/delete their content
- **Owner-Based Comments**: Users can only modify their own comments
- **JWT Authentication**: Secure user sessions

### 📡 Real-Time
- **Live Updates**: WebSocket broadcasting for new posts/comments
- **View Counter**: Track post popularity with rate limiting
- **Instant Notifications**: Email alerts for new comments

### 🎯 Functionality
- **Rich Content**: Markdown support for posts
- **Tagging System**: JSON-based tags for categorization
- **SEO-Friendly URLs**: Auto-generated slugs
- **Like System**: Users can like/unlike posts
- **Comment Moderation**: Approval workflow for comments

## Quick Start

### Install Locally

```bash
# Install the blog demo
npm run kickstack demo up blog

# Or with sample data
npm run kickstack demo up blog --with-seed
```

### Manual Setup

```bash
# 1. Apply migrations
cd demos/blog
psql -U kick -d kickstack -f migrations/001_blog_schema.sql
psql -U kick -d kickstack -f migrations/002_blog_rls.sql

# 2. Apply RLS policies
npm run kickstack add-policy public_read blog_posts --owner-col author_id
npm run kickstack add-policy owner blog_comments --owner-col user_id
npm run kickstack add-policy owner blog_likes --owner-col user_id

# 3. Deploy functions
npm run kickstack new-fn notify_comment
npm run kickstack new-fn increment_views
# Copy function code from functions/ directory

# 4. Enable realtime
npm run kickstack add-realtime blog_posts
npm run kickstack add-realtime blog_comments

# 5. (Optional) Load sample data
psql -U kick -d kickstack -f seed/blog_seed.sql
```

## API Endpoints

### Posts
```bash
# Get all published posts
GET /blog_posts?published=eq.true

# Get post by slug
GET /blog_posts?slug=eq.getting-started-with-kickstack

# Create post (requires auth)
POST /blog_posts
{
  "title": "My New Post",
  "body": "Post content here...",
  "author_id": "YOUR_USER_ID",
  "author_name": "Your Name",
  "tags": ["tutorial", "api"],
  "published": true
}

# Update post (author only)
PATCH /blog_posts?id=eq.POST_ID
{
  "title": "Updated Title",
  "body": "Updated content..."
}
```

### Comments
```bash
# Get comments for a post
GET /blog_comments?post_id=eq.POST_ID&approved=eq.true

# Add comment (requires auth)
POST /blog_comments
{
  "post_id": "POST_ID",
  "user_id": "YOUR_USER_ID",
  "user_name": "Your Name",
  "body": "Great post!"
}
```

### Likes
```bash
# Get likes for a post
GET /blog_likes?post_id=eq.POST_ID

# Like a post (requires auth)
POST /blog_likes
{
  "post_id": "POST_ID",
  "user_id": "YOUR_USER_ID"
}

# Unlike a post
DELETE /blog_likes?post_id=eq.POST_ID&user_id=eq.YOUR_USER_ID
```

### Functions
```bash
# Send comment notification
POST /fn/notify_comment
{
  "post_id": "POST_ID",
  "post_title": "Post Title",
  "post_author_email": "author@example.com",
  "comment_author": "Commenter Name",
  "comment_body": "Comment text"
}

# Increment view count
POST /fn/increment_views
{
  "post_id": "POST_ID"
}
```

## Testing

### Generate Test Tokens
```bash
# Author token
npm run kickstack generate-token user \
  --user-id 11111111-1111-1111-1111-111111111111 \
  --email jane@example.com

# Reader token
npm run kickstack generate-token user \
  --user-id 33333333-3333-3333-3333-333333333333 \
  --email alice@example.com
```

### Test Scenarios

1. **Public Reading**: Access posts without authentication
2. **Author Privileges**: Create/edit posts with author token
3. **Comment System**: Add comments with reader token
4. **Like System**: Like/unlike posts
5. **Realtime Updates**: Open WebSocket connection and watch for changes

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend  │────▶│  PostgREST   │────▶│  PostgreSQL  │
│  (Your App) │     │     API      │     │   Database   │
└─────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       │                    │                     │
       ▼                    ▼                     ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Functions  │     │   Realtime   │     │     RLS      │
│   Gateway   │     │  WebSocket   │     │   Policies   │
└─────────────┘     └──────────────┘     └──────────────┘
```

## Customization

### Extend the Schema
- Add categories table for post organization
- Add author profiles with bio and avatar
- Add comment threading for nested discussions
- Add draft/scheduled post functionality

### Add Features
- Search functionality with full-text search
- RSS feed generation
- Social sharing integration
- Analytics dashboard

### Integrate Services
- CDN for images
- Email service for notifications
- Cache layer for performance
- Search engine (Elasticsearch/Algolia)

## Deployment

### Deploy to Fly.io
```bash
npm run kickstack demo deploy blog
```

### Environment Variables
```env
# Required for production
DATABASE_URL=postgres://...
JWT_SECRET=your-secret-here
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=your-password
```

## Live Demo

🚀 **Try it live**: [https://kickstack-blog-demo.fly.dev](https://kickstack-blog-demo.fly.dev)

- Read-only API access
- Sample data pre-loaded
- WebSocket updates enabled

## Learn More

- [KickStack Documentation](../../README.md)
- [RLS Policies Guide](../../docs/rls-policies.md)
- [Functions Guide](../../docs/functions.md)
- [Realtime Guide](../../docs/realtime.md)