// Blog Demo: Comment Notification Function
// Sends email notification when a new comment is posted

interface CommentNotificationRequest {
  post_id: string;
  post_title: string;
  post_author_email: string;
  comment_author: string;
  comment_body: string;
}

export async function handler(req: Request): Promise<Response> {
  try {
    // Parse request body
    const data: CommentNotificationRequest = await req.json();
    
    // Validate required fields
    if (!data.post_id || !data.post_author_email || !data.comment_body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In production, this would send an actual email
    // For demo, we'll simulate the email
    const emailData = {
      to: data.post_author_email,
      subject: `New comment on "${data.post_title}"`,
      body: `
        You have a new comment on your blog post "${data.post_title}".
        
        From: ${data.comment_author}
        Comment: ${data.comment_body}
        
        View the comment: https://your-blog.com/posts/${data.post_id}#comments
      `,
      sent_at: new Date().toISOString()
    };

    // Log the notification (in production, send via SMTP)
    console.log('[Email Notification]', emailData);

    // You could also store notifications in a database table
    // await db.insert('notifications', { ...emailData, type: 'comment' });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent',
        email: emailData 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send notification' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}