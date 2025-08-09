// Blog Demo: Increment Views Function
// Tracks post views with rate limiting per IP

interface ViewRequest {
  post_id: string;
  ip?: string;
}

// Simple in-memory cache for rate limiting (per deployment)
const viewCache = new Map<string, number>();
const RATE_LIMIT_MS = 60000; // 1 minute per IP/post combination

export async function handler(req: Request): Promise<Response> {
  try {
    const data: ViewRequest = await req.json();
    
    if (!data.post_id) {
      return new Response(
        JSON.stringify({ error: 'post_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
    const cacheKey = `${clientIp}:${data.post_id}`;
    
    // Check rate limit
    const lastView = viewCache.get(cacheKey);
    const now = Date.now();
    
    if (lastView && (now - lastView) < RATE_LIMIT_MS) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'View already counted recently',
          next_allowed: new Date(lastView + RATE_LIMIT_MS).toISOString()
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update cache
    viewCache.set(cacheKey, now);
    
    // Clean old entries periodically (simple cleanup)
    if (viewCache.size > 1000) {
      const cutoff = now - RATE_LIMIT_MS;
      for (const [key, time] of viewCache.entries()) {
        if (time < cutoff) {
          viewCache.delete(key);
        }
      }
    }

    // In a real implementation, this would update the database
    // UPDATE blog_posts SET views = views + 1 WHERE id = $1
    const updateResult = {
      post_id: data.post_id,
      views_incremented: true,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        ...updateResult
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('View increment error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to increment views' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}