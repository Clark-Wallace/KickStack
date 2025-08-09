import type { KickContext, KickEvent } from "./types";

interface CommentPayload {
  post_id: string;
  content: string;
  user_id?: string;
}

interface NotificationPayload {
  type: 'new_comment';
  post_id: string;
  comment_preview: string;
  user_id: string;
  timestamp: string;
}

export default async function notifyComment(event: KickEvent, ctx: KickContext) {
  ctx.log('Processing comment notification');
  
  // Validate input
  const payload = event.body as CommentPayload;
  if (!payload.post_id || !payload.content) {
    return { 
      ok: false, 
      error: 'Missing required fields: post_id, content' 
    };
  }
  
  // Get webhook URL from environment
  const webhookUrl = ctx.env['KICKSTACK_FN_WEBHOOK_URL'];
  if (!webhookUrl) {
    ctx.log('No webhook URL configured, skipping notification');
    return { 
      ok: true, 
      message: 'Notification skipped - no webhook configured' 
    };
  }
  
  // Prepare notification payload
  const notification: NotificationPayload = {
    type: 'new_comment',
    post_id: payload.post_id,
    comment_preview: payload.content.substring(0, 100),
    user_id: ctx.user?.sub || 'anonymous',
    timestamp: new Date().toISOString()
  };
  
  try {
    // Send webhook notification
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KickStack-BlogTemplate/1.0'
      },
      body: JSON.stringify(notification)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }
    
    ctx.log(`Notification sent successfully to ${webhookUrl}`);
    
    return {
      ok: true,
      message: 'Comment notification sent',
      webhook_status: response.status,
      notification: {
        post_id: notification.post_id,
        preview: notification.comment_preview,
        sent_at: notification.timestamp
      }
    };
    
  } catch (error) {
    ctx.log(`Failed to send notification: ${error.message}`);
    
    return {
      ok: false,
      error: 'Failed to send notification',
      details: error.message,
      notification: notification
    };
  }
}