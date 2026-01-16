# Payment Gateway - Async Processing & Webhooks (Deliverable 2)

A production-ready payment gateway system featuring asynchronous job processing, webhook delivery with retry mechanisms, HMAC signature verification, embeddable JavaScript SDK, and comprehensive refund management.

## 📋 Project Overview

This is an advanced implementation of a payment processing system that demonstrates enterprise-grade patterns including:

- **Asynchronous Processing**: Background job queues using Redis + Bull for scalable payment processing
- **Webhook System**: Event-driven architecture with automatic retry logic and exponential backoff
- **Security**: HMAC-SHA256 signature verification, API key authentication, idempotency keys
- **Embeddable SDK**: Cross-origin iframe-based payment modal for seamless merchant integration
- **Reliability**: Comprehensive error handling, retry strategies, and state persistence

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15
- Redis 7

### Installation

```bash
# Clone or download the project
cd payment-gateway-2.o

# Start all services
docker-compose up -d

# Wait for services to be healthy (10-15 seconds)
docker-compose ps
```

### Verify Setup

```bash
# Check all services
curl http://localhost:8000/health
curl http://localhost:3000/
curl http://localhost:3001/
curl http://localhost:8000/api/v1/test/merchant
curl http://localhost:8000/api/v1/test/jobs/status
```

All services should respond successfully.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Client Application                     │
│  (Browser / Mobile)                                     │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    ┌───▼───┐      ┌─────▼────┐     ┌──────▼──────┐
    │ SDK   │      │Dashboard │     │   API       │
    │:3001  │      │  :3000   │     │   :8000     │
    └───┬───┘      └─────┬────┘     └──────┬──────┘
        │                │                  │
        └────────────────┼──────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼────┐      ┌────▼─────┐     ┌────▼────┐
    │PostgreSQL       │  Redis   │     │ Bull    │
    │Database         │ Cache    │     │ Queue   │
    └────────┘        └────────┬─┘     └────┬────┘
                              │         │
                    ┌─────────┴─────────┴──┐
                    │                      │
                ┌───▼───┐          ┌──────▼──┐
                │Payment │          │Webhook  │
                │Worker  │          │Worker   │
                └────────┘          └────┬────┘
                    │                    │
                    │              ┌─────▼─────┐
                    │              │Refund     │
                    │              │Worker     │
                    │              └───────────┘
                    │
            ┌───────┴──────────┐
            │                  │
        ┌───▼──┐          ┌────▼────┐
        │Merchant         │Merchant  │
        │Webhook Endpoint │Dashboard │
        └──────┘          └──────────┘
```

## 📚 API Documentation

### Authentication

All authenticated endpoints require headers:

```
X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
```

Test merchant credentials (seeded automatically):

- **Email**: test@example.com
- **API Key**: key_test_abc123
- **API Secret**: secret_test_xyz789
- **Webhook Secret**: whsec_test_abc123

### Core Endpoints

#### 1. Create Payment (Async)

```bash
POST /api/v1/payments
Headers:
  X-Api-Key: key_test_abc123
  X-Api-Secret: secret_test_xyz789
  Idempotency-Key: unique-key-123 (optional)

Body:
{
  "order_id": "order_123",
  "method": "upi",
  "vpa": "user@paytm"
}

Response (201):
{
  "id": "pay_abc123xyz",
  "order_id": "order_123",
  "amount": 50000,
  "status": "pending",  // Will transition to success/failed
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Key Features**:

- Status starts as `pending`, updates asynchronously
- Idempotency keys prevent duplicate charges (24-hour expiry)
- Worker processes in background, emits webhooks

#### 2. Get Payment Status

```bash
GET /api/v1/payments/:paymentId
# or without authentication:
GET /api/v1/payments/:paymentId/public

Response (200):
{
  "id": "pay_abc123xyz",
  "status": "success",  // or "failed"
  "method": "upi",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:05Z"
}
```

#### 3. Capture Payment

```bash
POST /api/v1/payments/:paymentId/capture
Headers:
  X-Api-Key: key_test_abc123
  X-Api-Secret: secret_test_xyz789

Body:
{
  "amount": 50000
}

Response (200):
{
  "id": "pay_abc123xyz",
  "captured": true,
  "updated_at": "2024-01-15T10:32:00Z"
}
```

#### 4. Create Refund (Async)

```bash
POST /api/v1/payments/:paymentId/refunds
Headers:
  X-Api-Key: key_test_abc123
  X-Api-Secret: secret_test_xyz789

Body:
{
  "amount": 25000,
  "reason": "Customer requested refund"
}

Response (201):
{
  "id": "rfnd_xyz123abc",
  "payment_id": "pay_abc123xyz",
  "amount": 25000,
  "status": "pending",  // Will transition to "processed"
  "created_at": "2024-01-15T10:33:00Z"
}
```

**Refund Rules**:

- Only refund successful payments
- Support full and partial refunds
- Sum of all refunds cannot exceed payment amount
- Processed asynchronously by refund worker
- Triggers `refund.processed` webhook on completion

#### 5. List Webhook Logs

```bash
GET /api/v1/webhooks?limit=10&offset=0
Headers:
  X-Api-Key: key_test_abc123
  X-Api-Secret: secret_test_xyz789

Response (200):
{
  "data": [
    {
      "id": "wh_log_123",
      "event": "payment.success",
      "status": "success",
      "attempts": 1,
      "response_code": 200,
      "created_at": "2024-01-15T10:31:10Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

#### 6. Retry Webhook

```bash
POST /api/v1/webhooks/:webhookId/retry
Headers:
  X-Api-Key: key_test_abc123
  X-Api-Secret: secret_test_xyz789

Response (200):
{
  "id": "wh_log_123",
  "status": "pending",
  "message": "Webhook retry scheduled"
}
```

#### 7. Configure Webhooks

```bash
PUT /api/v1/webhooks
Headers:
  X-Api-Key: key_test_abc123
  X-Api-Secret: secret_test_xyz789

Body:
{
  "webhook_url": "https://yoursite.com/webhook",
  "webhook_secret": "whsec_newSecretKey"
}

Response (200):
{
  "webhook_url": "https://yoursite.com/webhook",
  "webhook_secret": "whsec_new***"
}
```

#### 8. Job Queue Status (Test Endpoint)

```bash
GET /api/v1/test/jobs/status
No authentication required

Response (200):
{
  "pending": 2,
  "processing": 1,
  "completed": 100,
  "failed": 0,
  "worker_status": "running"
}
```

## 🔄 Asynchronous Job Processing

### Job Queues

The system uses three job queues powered by Bull + Redis:

#### 1. Payment Processing Queue

```javascript
Process Flow:
1. API creates payment with status="pending"
2. Job queued to payment-processing queue
3. PaymentWorker picks up job
4. Simulates processing (5-10 seconds)
5. Updates payment status to success/failed
6. Enqueues webhook delivery job
```

**Configuration**:

- Success Rate: UPI 90%, Card 95%
- Test Mode: Set `TEST_PAYMENT_SUCCESS=true|false`
- Processing Delay: Random 5-10s (production) or `TEST_PROCESSING_DELAY` (test)

#### 2. Webhook Delivery Queue

```javascript
Process Flow:
1. Event created (payment.success, refund.processed, etc.)
2. Job queued to webhook-delivery queue
3. WebhookWorker retrieves merchant webhook URL & secret
4. Generates HMAC-SHA256 signature
5. POST request with signature header to merchant URL
6. Logs attempt in webhook_logs table
7. On failure: Schedule retry or mark as failed

Retry Schedule (Production):
- Attempt 1: Immediate
- Attempt 2: 1 minute
- Attempt 3: 5 minutes
- Attempt 4: 30 minutes
- Attempt 5: 2 hours
```

**Test Mode**:
Set `WEBHOOK_RETRY_INTERVALS_TEST=true` to use shorter intervals:

```
- Attempt 1: Immediate
- Attempt 2: 5 seconds
- Attempt 3: 10 seconds
- Attempt 4: 15 seconds
- Attempt 5: 20 seconds
```

#### 3. Refund Processing Queue

```javascript
Process Flow:
1. Refund created with status="pending"
2. Job queued to refund-processing queue
3. RefundWorker validates refund eligibility
4. Simulates processing (3-5 seconds)
5. Updates refund status to "processed"
6. Sets processed_at timestamp
7. Enqueues webhook for refund.processed event
```

### Worker Health

The system runs three separate worker processes (containerized):

```bash
# View worker logs
docker-compose logs -f gateway_worker

# Check worker status via API
curl http://localhost:8000/api/v1/test/jobs/status
```

Worker automatically:

- Processes jobs from all queues
- Handles retries for failed jobs
- Scales horizontally (add more worker containers)
- Gracefully shuts down (SIGTERM/SIGINT)

## 🔐 Webhook Security

### HMAC-SHA256 Signature Verification

Every webhook includes an `X-Webhook-Signature` header with an HMAC-SHA256 signature.

**Signature Generation (Server)**:

```javascript
const crypto = require('crypto');
const payload = JSON.stringify({ event: 'payment.success', ... });
const signature = crypto
  .createHmac('sha256', 'whsec_secret')
  .update(payload)
  .digest('hex');
```

**Signature Verification (Merchant)**:

```javascript
const crypto = require("crypto");

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  return signature === expectedSignature;
}

// In webhook receiver
app.post("/webhook", (req, res) => {
  const signature = req.headers["x-webhook-signature"];

  if (!verifyWebhook(req.body, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Process webhook
});
```

### Webhook Events

Supported events:

- `payment.created` - When payment record is created
- `payment.pending` - When payment enters pending state
- `payment.success` - When payment succeeds (most common)
- `payment.failed` - When payment fails
- `refund.created` - When refund is initiated
- `refund.processed` - When refund completes

### Webhook Payload Format

```json
{
  "event": "payment.success",
  "timestamp": 1705315870,
  "data": {
    "payment": {
      "id": "pay_abc123xyz",
      "order_id": "order_123",
      "amount": 50000,
      "currency": "INR",
      "method": "upi",
      "vpa": "user@paytm",
      "status": "success",
      "created_at": "2024-01-15T10:31:00Z"
    }
  }
}
```

## 💳 Embeddable SDK

### Installation

Add to your HTML:

```html
<script src="http://localhost:3001/checkout.js"></script>
```

### Usage

```javascript
const checkout = new PaymentGateway({
  key: "key_test_abc123",
  orderId: "order_xyz_123",
  onSuccess: function (response) {
    console.log("Payment successful!", response);
    console.log("Payment ID:", response.paymentId);
    // Handle success: update UI, send confirmation, etc.
  },
  onFailure: function (error) {
    console.error("Payment failed:", error);
    // Handle failure: show error message
  },
  onClose: function () {
    console.log("Payment modal closed");
    // Handle modal close
  },
});

// Open payment modal
const button = document.getElementById("pay-button");
button.addEventListener("click", () => {
  checkout.open();
});
```

### SDK Features

- **Modal-based UI**: No page redirects
- **Cross-origin Safe**: Uses postMessage for iframe communication
- **Responsive**: Works on desktop, tablet, mobile
- **Minimal Dependencies**: No external libraries required
- **Error Handling**: Graceful failure handling with callbacks

### How It Works

1. SDK creates a modal overlay with embedded iframe
2. Iframe loads checkout page from port 3001
3. User selects payment method and enters details
4. Checkout page sends payment creation request to API
5. API creates payment and enqueues job
6. Checkout page polls for payment status
7. When status changes, iframe notifies parent via postMessage
8. Parent closes modal and calls onSuccess/onFailure callback

### HTML Structure (Auto-generated)

```html
<div id="payment-gateway-modal" data-test-id="payment-modal">
  <div class="modal-overlay">
    <div class="modal-content">
      <iframe
        data-test-id="payment-iframe"
        src="http://localhost:3001/checkout?order_id=xxx&embedded=true"
      ></iframe>
      <button data-test-id="close-modal-button" class="close-button">×</button>
    </div>
  </div>
</div>
```

## 🔑 Idempotency

### Problem

Network failures can cause duplicate payment attempts if clients retry.

### Solution

Idempotency keys prevent duplicate charges.

**Usage**:

```bash
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Idempotency-Key: request_123_unique_key" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order_123",
    "method": "upi",
    "vpa": "user@paytm"
  }'
```

**How it works**:

1. First request: Creates payment, stores response with idempotency key
2. Same request again: Returns cached response (same payment ID)
3. Different idempotency key: Creates new payment (different payment ID)
4. Expiry: Keys expire after 24 hours

**Database Storage**:

```sql
SELECT * FROM idempotency_keys
WHERE key='request_123_unique_key' AND merchant_id='merchant_uuid'
AND expires_at > NOW();
```

## 📊 Dashboard

Access the merchant dashboard at: **http://localhost:3000**

### Features

#### Transactions Page

- View all payments for your merchant
- Filter by status (pending, success, failed)
- See real-time payment status updates
- View payment details and method

#### Webhook Configuration Page

- Configure webhook URL (where you want to receive events)
- View/regenerate webhook secret
- Test webhook delivery
- View webhook delivery logs with retry history
- Manually retry failed webhook deliveries

#### API Documentation Page

- Create Order API reference
- SDK Integration guide
- Webhook Verification code samples
- Webhook Event types and retry logic

#### Test Merchant

The system seeds a test merchant automatically:

- **Merchant ID**: UUID (visible in Dashboard)
- **Email**: test@example.com
- **API Key**: key_test_abc123
- **API Secret**: secret_test_xyz789
- **Webhook URL**: (configurable)
- **Webhook Secret**: whsec_test_abc123

## 🧪 Testing

### Test Modes

#### Payment Processing Test Mode

```bash
# Deterministic payment outcomes
docker-compose exec gateway_api bash -c \
  'TEST_MODE=true TEST_PAYMENT_SUCCESS=true TEST_PROCESSING_DELAY=1000 npm start'
```

#### Webhook Retry Test Mode

```bash
# Fast retry intervals (5s, 10s, 15s, 20s) instead of (1m, 5m, 30m, 2h)
docker-compose exec gateway_api bash -c \
  'WEBHOOK_RETRY_INTERVALS_TEST=true npm start'
```

### Manual Testing

#### 1. Create an Order

```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "receipt_123"
  }'
```

#### 2. Create Payment

```bash
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order_xxx",
    "method": "upi",
    "vpa": "user@paytm"
  }'

# Response will have status "pending"
# After 5-10 seconds, worker updates status to "success" or "failed"
```

#### 3. Check Payment Status

```bash
# After job is processed
curl http://localhost:8000/api/v1/payments/pay_abc123xyz/public
# Status should be "success" or "failed"
```

#### 4. Test Webhook Delivery

```bash
# Configure webhook URL in dashboard
# Then check webhook logs:
curl -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  http://localhost:8000/api/v1/webhooks
```

#### 5. Test Idempotency

```bash
# First request
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Idempotency-Key: test_idempotency_1" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order_123", "method": "upi", "vpa": "user@paytm"}'
# Responses: payment_id = "pay_abc123"

# Second request (same idempotency key)
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Idempotency-Key: test_idempotency_1" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order_123", "method": "upi", "vpa": "user@paytm"}'
# Responses: payment_id = "pay_abc123" (same, cached)
```

### Test Merchant Webhook Receiver

For local development, run the test webhook receiver:

```bash
cd test-merchant
node webhook-receiver.js
```

Then configure webhook URL in dashboard to: `http://host.docker.internal:4000/webhook`

The receiver will:

- Verify HMAC signature
- Log all webhook events
- Store logs in `webhook-logs.json`
- Display delivery history

## 🐳 Docker Compose Services

### Services

1. **postgres** (Port 5432)

   - Database: payment_gateway
   - User: gateway_user
   - Password: gateway_pass

2. **redis** (Port 6379)

   - Job queue cache
   - Stores Bull job data
   - TTL: Auto-cleanup

3. **api** (Port 8000)

   - Express.js server
   - API endpoints
   - Health check: /health

4. **worker** (No external port)

   - Processes payment queue
   - Processes webhook queue
   - Processes refund queue
   - Connects to Redis and PostgreSQL

5. **dashboard** (Port 3000)

   - React admin dashboard
   - Webhook configuration
   - API documentation

6. **checkout** (Port 3001)
   - React checkout page
   - Embeddable SDK (checkout.js)
   - Payment form UI

### Useful Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f                    # All services
docker-compose logs -f gateway_api       # API only
docker-compose logs -f gateway_worker    # Worker only
docker-compose logs -f redis_gateway     # Redis only

# Access services
docker-compose ps                         # View status
docker-compose exec gateway_api bash     # SSH into API
docker-compose exec postgres psql -U gateway_user -d payment_gateway  # SQL

# Clean up
docker-compose down -v                    # Remove volumes too
```

## 📈 Performance & Scaling

### Current Setup

- Single worker process (handles payment, webhook, refund queues)
- Redis (single node)
- PostgreSQL (single node)
- Handles ~100 payments/second (with current random delays)

### Scaling Strategies

#### Horizontal Scaling (Workers)

```yaml
# In docker-compose.yml
worker1: ...
worker2: ...
worker3: ...
```

#### Queue-specific Workers

```yaml
worker_payments:
  build: ./backend
  environment:
    QUEUE_TYPE: payments

worker_webhooks:
  build: ./backend
  environment:
    QUEUE_TYPE: webhooks
```

#### Database Optimization

- Add indexes (already present for refunds, webhook_logs)
- Use connection pooling
- Archive old webhook logs periodically
- Prune expired idempotency keys

#### Redis Optimization

- Use Redis Cluster for high availability
- Implement persistence (RDB/AOF)
- Monitor memory usage

## 🔧 Environment Variables

### Backend Configuration

```bash
# Database
DATABASE_URL=postgresql://gateway_user:gateway_pass@postgres:5432/payment_gateway

# Redis
REDIS_URL=redis://redis:6379

# API Server
PORT=8000
NODE_ENV=production

# Payment Processing
TEST_MODE=false                              # Enable deterministic testing
TEST_PROCESSING_DELAY=1000                   # ms, used when TEST_MODE=true
TEST_PAYMENT_SUCCESS=true                    # Outcome when TEST_MODE=true

# Webhook Retry
WEBHOOK_RETRY_INTERVALS_TEST=false           # Use fast intervals (for testing)
WEBHOOK_RETRY_INTERVALS=60,300,1800,7200     # Production intervals (minutes)
```

## 📁 Project Structure

```
payment-gateway-2.o/
├── backend/
│   ├── src/
│   │   ├── server.js                # Main API server
│   │   ├── worker.js                # Worker process entry
│   │   ├── config/
│   │   │   ├── db.js               # PostgreSQL connection
│   │   │   └── queue.js            # Bull queue setup
│   │   ├── models/
│   │   │   ├── init.js             # DB initialization
│   │   │   └── schema.sql          # Database schema
│   │   ├── routes/
│   │   │   ├── paymentRoutes.js    # Payment & refund endpoints
│   │   │   ├── webhookRoutes.js    # Webhook endpoints
│   │   │   ├── orderRoutes.js      # Order endpoints
│   │   │   └── testRoutes.js       # Test/health endpoints
│   │   ├── workers/
│   │   │   ├── paymentWorker.js    # Payment processor
│   │   │   ├── webhookWorker.js    # Webhook deliverer
│   │   │   └── refundWorker.js     # Refund processor
│   │   ├── services/
│   │   │   └── seedService.js      # Test data seeding
│   │   ├── middleware/
│   │   │   └── auth.js             # API key authentication
│   │   └── utils/
│   │       └── validation.js        # Input validation
│   ├── package.json
│   ├── Dockerfile
│   └── Dockerfile.worker
│
├── checkout/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Checkout.jsx        # Payment form UI
│   │   │   ├── Success.jsx
│   │   │   └── Failure.jsx
│   │   ├── sdk/
│   │   │   ├── PaymentGateway.js   # Embeddable SDK
│   │   │   └── styles.css
│   │   └── styles/
│   │       └── global.css
│   ├── build-sdk.js               # SDK bundler
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── frontend/dashboard/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Home page
│   │   │   ├── Transactions.jsx    # Payment list
│   │   │   ├── Webhooks.jsx        # Webhook config & logs
│   │   │   ├── Docs.jsx            # API docs
│   │   │   └── Login.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── styles/
│   │       ├── global.css
│   │       ├── dashboard.css
│   │       └── transactions.css
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── test-merchant/
│   ├── webhook-receiver.js         # Test webhook endpoint
│   ├── package.json
│   └── webhook-logs.json
│
├── docker-compose.yml              # Multi-container setup
├── submission.yml                  # Automated evaluation config
└── README.md                        # This file
```

## 🎯 Key Implementation Details

### Payment Status Lifecycle

```
API Creates      Worker        Webhook       Final Status
    │            Process       Delivery         │
    ▼              ▼              ▼             ▼
  pending  →  processing   →  emit event   →  success/failed

Timing: ~1-15 seconds total
```

### Webhook Retry Lifecycle

```
Initial         Failed              Scheduled          Success
Delivery        Attempt 1           Attempt N          Delivery
    │               │                   │                 │
    ▼               ▼                   ▼                 ▼
  POST URL  →  Response 500/timeout  → Calculate    →  Response 200
                                      next_retry_at
                                      Store in DB
                                      Re-enqueue job
```

### Refund Processing

```
API Creates     Validation      Worker         Webhook        Status
Refund          Checks        Processing       Delivery       Updated
   │              │              │               │              │
   ▼              ▼              ▼               ▼              ▼
pending   →   Check payment  → process    →  emit refund   → processed
            ✓ Is success?     simulate       .processed
            ✓ Amount ok?      delay
            ✓ Not double?
```

## 🔍 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs gateway_api
docker-compose logs gateway_worker

# Verify Redis connectivity
docker-compose exec redis_gateway redis-cli ping

# Verify Database
docker-compose exec postgres psql -U gateway_user -d payment_gateway -c "SELECT 1;"
```

### Payments Stuck in "pending"

```bash
# Check worker logs
docker-compose logs gateway_worker

# Check job queue status
curl http://localhost:8000/api/v1/test/jobs/status

# Check Redis
docker-compose exec redis_gateway redis-cli info stats
```

### Webhooks Not Delivering

```bash
# Check webhook configuration
curl -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  http://localhost:8000/api/v1/webhooks

# Check webhook logs
# (Check dashboard or database)

# Verify webhook URL is accessible
curl -v https://yourwebhookurl.com/webhook
```

### Database Connection Error

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check DATABASE_URL
docker-compose exec gateway_api env | grep DATABASE_URL

# Test connection
docker-compose exec postgres psql -U gateway_user -d payment_gateway -c "SELECT 1;"
```

## 📝 License

This project is provided as-is for educational and commercial purposes.

## 👨‍💼 Support

For issues or questions:

1. Check the API Documentation (/dashboard/docs)
2. Review webhook logs (/dashboard/webhooks)
3. Check system health (GET /health)
4. Review docker logs for errors

---

**Made for production-grade payment processing systems** 🎯
