// E-commerce Demo: Payment Processing Webhook
// Handles payment confirmations from payment providers (Stripe example)

interface PaymentWebhookRequest {
  event_type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  payment_id: string;
  order_id: string;
  amount: number;
  currency: string;
  customer_email: string;
  metadata?: Record<string, any>;
  signature?: string; // For webhook signature verification
}

export async function handler(req: Request): Promise<Response> {
  try {
    const data: PaymentWebhookRequest = await req.json();
    
    // In production, verify webhook signature
    const signature = req.headers.get('stripe-signature');
    if (signature && process.env.STRIPE_WEBHOOK_SECRET) {
      // Verify signature with Stripe SDK
      // const event = stripe.webhooks.constructEvent(body, signature, secret);
    }

    // Process based on event type
    let orderUpdate: any = {
      payment_id: data.payment_id,
      updated_at: new Date().toISOString()
    };

    switch (data.event_type) {
      case 'payment.succeeded':
        orderUpdate.payment_status = 'paid';
        orderUpdate.status = 'processing';
        break;
      
      case 'payment.failed':
        orderUpdate.payment_status = 'failed';
        orderUpdate.status = 'cancelled';
        break;
      
      case 'payment.refunded':
        orderUpdate.payment_status = 'refunded';
        orderUpdate.status = 'refunded';
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown event type' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // In production, update the database
    // await db.update('orders', { id: data.order_id }, orderUpdate);

    // Send confirmation email
    if (data.event_type === 'payment.succeeded') {
      // await sendOrderConfirmation(data.customer_email, data.order_id);
    }

    // Log for monitoring
    console.log('[Payment Webhook]', {
      event: data.event_type,
      order_id: data.order_id,
      amount: data.amount,
      currency: data.currency
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Payment ${data.event_type} processed`,
        order_update: orderUpdate
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process payment webhook' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}