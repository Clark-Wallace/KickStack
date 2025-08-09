# Basic E-commerce Template

A complete e-commerce system with public products and private orders.

## Features

- **Products Table**: Publicly readable product catalog with public_read RLS policy
- **Orders Table**: Private orders with owner RLS policy for customer privacy
- **Order Items Table**: Individual line items within orders
- **Payment Webhook**: Stripe-compatible webhook for payment processing
- **Realtime Updates**: WebSocket triggers for inventory and order updates

## Schema

### Products
- `id` (UUID, PK): Unique product identifier
- `name` (TEXT): Product name
- `description` (TEXT): Product description
- `price` (DECIMAL): Product price in cents
- `currency` (TEXT): Price currency (default: USD)
- `inventory` (INTEGER): Stock quantity
- `sku` (TEXT): Stock keeping unit
- `active` (BOOLEAN): Product availability
- `created_at` (TIMESTAMPTZ): Creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

### Orders
- `id` (UUID, PK): Unique order identifier
- `customer_id` (UUID): Customer (references auth users)
- `status` (TEXT): Order status (pending, paid, shipped, delivered, cancelled)
- `total_amount` (DECIMAL): Total order amount in cents
- `currency` (TEXT): Order currency
- `payment_intent_id` (TEXT): Stripe payment intent ID
- `shipping_address` (JSONB): Shipping address details
- `created_at` (TIMESTAMPTZ): Creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

### Order Items
- `id` (UUID, PK): Unique order item identifier
- `order_id` (UUID): Associated order (FK to orders.id)
- `product_id` (UUID): Associated product (FK to products.id)
- `quantity` (INTEGER): Item quantity
- `unit_price` (DECIMAL): Price per unit at time of order
- `total_price` (DECIMAL): Total price for this line item

## Usage

```bash
# Install the template
kickstack template install ecommerce-basic --apply

# Browse products (no auth required)
curl http://localhost:3000/products

# Create an order (authenticated)
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "total_amount": 2999,
    "currency": "USD",
    "shipping_address": {
      "name": "John Doe",
      "line1": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "postal_code": "12345",
      "country": "US"
    }
  }'

# Add items to order
curl -X POST http://localhost:3000/order_items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER_UUID_HERE",
    "product_id": "PRODUCT_UUID_HERE",
    "quantity": 2,
    "unit_price": 1499,
    "total_price": 2998
  }'

# View customer orders (owner only)
curl http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN"
```

## Environment Variables

- `KICKSTACK_FN_STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `KICKSTACK_FN_ADMIN_EMAIL`: Email for order notifications

## Payment Webhook

The payment webhook handles Stripe payment events:

```bash
# Configure webhook endpoint in Stripe dashboard
curl -X POST http://localhost:8787/fn/payment_webhook \
  -H "Stripe-Signature: STRIPE_SIGNATURE_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_webhook",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test_123",
        "status": "succeeded",
        "amount": 2999
      }
    }
  }'
```

## Security

- **Products**: Public read access, admin-only create/update/delete
- **Orders**: Private to customer, full CRUD for order owners
- **Order Items**: Private to customer, linked to orders
- **Webhooks**: Signature verification required for payment processing

## Customization

After installation, you can:
1. Add product categories, images, and variants
2. Implement shopping cart functionality
3. Add customer reviews and ratings
4. Integrate with inventory management systems
5. Add shipping calculations and tax handling