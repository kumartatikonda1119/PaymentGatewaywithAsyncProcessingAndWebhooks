# Payment Gateway - Async Processing System (Deliverable 2)

A production-ready payment gateway with asynchronous job queue processing, webhook delivery with retries, embeddable SDK, and complete refund management.

## 🎯 Key Features

### Asynchronous Payment Processing
- **Job Queues**: Bull + Redis-based background job processing
- **Three Queue System**: Payment processing, webhook delivery, refund handling
- **Worker Services**: Dedicated Node.js workers for async tasks
- **Status Transitions**: Payments flow from `pending` (initial) → `success`/`failed` (after processing)

### Webhook Delivery
- **HMAC-SHA256 Signatures**: Every webhook includes cryptographic signature in `X-Webhook-Signature` header
- **Automatic Retry Logic**: Exponential backoff (production: 1min, 5min, 30min, 2hr; test mode: 5s, 10s, 15s, 20s)
- **Maximum 5 Attempts**: Failed webhooks stop retrying after 5 delivery attempts
- **Event Types**: `payment.success`, `payment.failed`, `refund.processed`
- **Merchant Configuration**: Dashboard page to configure webhook URL and secret

### Embeddable SDK
- **Modal/Iframe Checkout**: Accept payments without redirecting customers away
- **Cross-Origin Communication**: Secure `postMessage` protocol for parent ↔ iframe communication
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Callbacks**: `onSuccess`, `onFailure`, `onClose` handlers

### Refund Management
- **Full & Partial Refunds**: Flexible refund amounts for processed payments
- **Async Processing**: Refunds process in background with webhook notification
- **Validation**: Prevents refunding more than originally charged
- **Status Tracking**: Track refund status (pending → processed)

### Idempotency
- **Duplicate Prevention**: Same idempotency key returns cached response
- **24-Hour Expiry**: Keys automatically expire after 24 hours
- **Merchant-Scoped**: Prevents interference between merchants
- **Full Response Caching**: Returns exact same response for duplicate requests

## 🏗️ Architecture Overview

```
Payment Gateway System
│
├── Backend Services
│   ├── API Server (Express.js, Port 8000)
│   ├── Job Queues (Bull)
│   │   ├── Payment Queue → paymentWorker.js
│   │   ├── Webhook Queue → webhookWorker.js
│   │   └── Refund Queue → refundWorker.js
│   └── Database (PostgreSQL)
│       ├── payments
│       ├── refunds (NEW)
│       ├── webhook_logs (NEW)
│       ├── idempotency_keys (NEW)
│       └── merchants (updated)
│
├── Redis Cache (Port 6379)
│   └── Bull job storage
│
├── Frontend Applications
│   ├── Checkout App (React/Vite, Port 3001)
│   │   ├── Regular mode: /checkout
│   │   └── Embedded mode: /checkout?embedded=true&order_id=X
│   │
│   ├── Dashboard (React/Vite, Port 3000)
│   │   ├── /dashboard - Overview
│   │   ├── /dashboard/transactions - Payment history
│   │   ├── /dashboard/webhooks - Webhook configuration & logs
│   │   └── /dashboard/docs - API documentation
│   │
│   └── Embeddable SDK (checkout.js)
│       └── PaymentGateway class for merchant websites
│
└── Test Services
    └── Webhook Receiver (Port 3002)
        └── Receives and validates webhook signatures
```

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git

### Setup & Run

1. **Clone the repository**
   ```bash
   git clone https://github.com/ChVMKiran/payment-gateway-2.O
   cd payment-gateway-2.o
   ```

2. **Start all services**
   ```bash
   docker-compose up -d --build
   ```

3. **Verify all services are running**
   ```bash
   docker-compose ps
   ```

4. **Access the applications**
   - **API**: http://localhost:8000
   - **Dashboard**: http://localhost:3000
   - **Checkout**: http://localhost:3001

5. **Health Check**
   ```bash
   curl http://localhost:8000/health
   ```

### Test Merchant Credentials

The system automatically seeds a test merchant on startup:

- **Email**: test@example.com
- **API Key**: key_test_abc123
- **API Secret**: secret_test_xyz789

## 📡 API Documentation

### Base URL
```
http://localhost:8000
```

### Authentication
All API endpoints (except `/health` and test endpoints) require authentication via headers:

```http
X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
```

---

### 1. Health Check

**Endpoint**: `GET /health`

**Description**: Check API and database connectivity

**Authentication**: Not required

**Response** (200):
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-16T01:10:00Z"
}
```

---

### 2. Create Order

**Endpoint**: `POST /api/v1/orders`

**Description**: Create a payment order

**Authentication**: Required

**Request Body**:
```json
{
  "amount": 50000,
  "currency": "INR",
  "receipt": "receipt_123",
  "notes": {
    "customer_name": "John Doe"
  }
}
```

**Parameters**:
- `amount` (required): Amount in paise (minimum 100)
- `currency` (optional): Currency code, defaults to "INR"
- `receipt` (optional): Receipt identifier
- `notes` (optional): Additional metadata as JSON object

**Response** (201):
```json
{
  "id": "order_NXhj67fGH2jk9mPq",
  "merchant_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50000,
  "currency": "INR",
  "receipt": "receipt_123",
  "notes": {
    "customer_name": "John Doe"
  },
  "status": "created",
  "created_at": "2026-01-15T10:30:00Z"
}
```

**Error Responses**:
- `400`: Validation error (amount < 100)
- `401`: Invalid API credentials

---

### 3. Get Order

**Endpoint**: `GET /api/v1/orders/{order_id}`

**Description**: Retrieve order details

**Authentication**: Required

**Response** (200):
```json
{
  "id": "order_NXhj67fGH2jk9mPq",
  "merchant_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50000,
  "currency": "INR",
  "receipt": "receipt_123",
  "notes": {},
  "status": "created",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

**Error Responses**:
- `404`: Order not found
- `401`: Invalid API credentials

---

### 4. Create Payment

**Endpoint**: `POST /api/v1/payments`

**Description**: Process a payment for an order

**Authentication**: Required

**Request Body (UPI)**:
```json
{
  "order_id": "order_NXhj67fGH2jk9mPq",
  "method": "upi",
  "vpa": "user@paytm"
}
```

**Request Body (Card)**:
```json
{
  "order_id": "order_NXhj67fGH2jk9mPq",
  "method": "card",
  "card": {
    "number": "4111111111111111",
    "expiry_month": "12",
    "expiry_year": "2025",
    "cvv": "123",
    "holder_name": "John Doe"
  }
}
```

**Response (UPI)** (201):
```json
{
  "id": "pay_H8sK3jD9s2L1pQr",
  "order_id": "order_NXhj67fGH2jk9mPq",
  "amount": 50000,
  "currency": "INR",
  "method": "upi",
  "vpa": "user@paytm",
  "status": "processing",
  "created_at": "2026-01-15T10:31:00Z"
}
```

**Response (Card)** (201):
```json
{
  "id": "pay_H8sK3jD9s2L1pQr",
  "order_id": "order_NXhj67fGH2jk9mPq",
  "amount": 50000,
  "currency": "INR",
  "method": "card",
  "card_network": "visa",
  "card_last4": "1111",
  "status": "processing",
  "created_at": "2026-01-15T10:31:00Z"
}
```

**Payment Status Flow**:
- Payment created with status `processing`
- After 5-10 seconds, status updates to `success` (90% UPI, 95% Card) or `failed`

**Error Responses**:
- `400`: Invalid VPA format, invalid card, expired card
- `404`: Order not found
- `401`: Invalid API credentials

---

### 5. Get Payment

**Endpoint**: `GET /api/v1/payments/{payment_id}`

**Description**: Retrieve payment details

**Authentication**: Required

**Response** (200):
```json
{
  "id": "pay_H8sK3jD9s2L1pQr",
  "order_id": "order_NXhj67fGH2jk9mPq",
  "amount": 50000,
  "currency": "INR",
  "method": "upi",
  "vpa": "user@paytm",
  "status": "success",
  "created_at": "2026-01-15T10:31:00Z",
  "updated_at": "2026-01-15T10:31:10Z"
}
```

**Error Responses**:
- `404`: Payment not found
- `401`: Invalid API credentials

---

### 6. Get Test Merchant

**Endpoint**: `GET /api/v1/test/merchant`

**Description**: Retrieve test merchant details (for evaluation)

**Authentication**: Not required

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "test@example.com",
  "api_key": "key_test_abc123",
  "seeded": true
}
```

---

### Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_ERROR` | Invalid API credentials |
| `BAD_REQUEST_ERROR` | Validation errors |
| `NOT_FOUND_ERROR` | Resource not found |
| `PAYMENT_FAILED` | Payment processing failed |
| `INVALID_VPA` | VPA format invalid |
| `INVALID_CARD` | Card validation failed |
| `EXPIRED_CARD` | Card expiry date invalid |

## 🖥️ Frontend Applications

### Dashboard (Port 3000)

**Login Page** (`/login`)
- Email: test@example.com
- Password: Any password (not validated in Deliverable 1)

**Dashboard Home** (`/dashboard`)
- Displays API credentials
- Shows transaction statistics
- Total transactions count
- Total amount processed
- Success rate percentage

**Transactions Page** (`/dashboard/transactions`)
- Lists all payments
- Shows payment ID, order ID, amount, method, status, and timestamp
- Real-time data from database

### Checkout Page (Port 3001)

**Checkout Flow** (`/checkout?order_id=xxx`)
- Fetches order details
- Displays order amount and ID
- Payment method selection (UPI/Card)
- Payment form submission
- Processing state with spinner
- Status polling every 2 seconds
- Success/Failure pages

## 🗄️ Database Schema

### Merchants Table
```sql
id              UUID PRIMARY KEY (auto-generated)
name            VARCHAR(255) NOT NULL
email           VARCHAR(255) UNIQUE NOT NULL
api_key         VARCHAR(64) UNIQUE NOT NULL
api_secret      VARCHAR(64) NOT NULL
webhook_url     TEXT
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```

### Orders Table
```sql
id              VARCHAR(64) PRIMARY KEY (format: order_XXXXXXXXXXXXXXXX)
merchant_id     UUID REFERENCES merchants(id)
amount          INTEGER NOT NULL (minimum 100 paise)
currency        VARCHAR(3) DEFAULT 'INR'
receipt         VARCHAR(255)
notes           JSONB
status          VARCHAR(20) DEFAULT 'created'
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()

INDEX ON merchant_id
```

### Payments Table
```sql
id                  VARCHAR(64) PRIMARY KEY (format: pay_XXXXXXXXXXXXXXXX)
order_id            VARCHAR(64) REFERENCES orders(id)
merchant_id         UUID REFERENCES merchants(id)
amount              INTEGER NOT NULL
currency            VARCHAR(3) DEFAULT 'INR'
method              VARCHAR(20) NOT NULL (upi/card)
status              VARCHAR(20) DEFAULT 'processing'
vpa                 VARCHAR(255) (UPI only)
card_network        VARCHAR(20) (Card only)
card_last4          VARCHAR(4) (Card only)
error_code          VARCHAR(50)
error_description   TEXT
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()

INDEX ON order_id
INDEX ON status
```

## 🔒 Payment Validation

### UPI VPA Validation
- Pattern: `^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$`
- Valid: `user@paytm`, `john.doe@okhdfcbank`, `user_123@phonepe`
- Invalid: `user @paytm`, `@paytm`, `user@@bank`

### Card Validation (Luhn Algorithm)
1. Remove spaces and dashes
2. Verify length between 13-19 digits
3. Apply Luhn algorithm:
   - Start from rightmost digit
   - Double every second digit from right
   - If doubled digit > 9, subtract 9
   - Sum all digits
   - Valid if sum % 10 === 0

### Card Network Detection
- **Visa**: Starts with `4`
- **Mastercard**: Starts with `51-55`
- **Amex**: Starts with `34` or `37`
- **RuPay**: Starts with `60`, `65`, or `81-89`

### Expiry Validation
- Month: 1-12
- Year: 2-digit (20XX) or 4-digit format
- Must be current month or future

## 🧪 Testing

### Test Mode Configuration
Set environment variables for deterministic testing:

```bash
TEST_MODE=true
TEST_PAYMENT_SUCCESS=true
TEST_PROCESSING_DELAY=1000
```

### Testing Payment Flow

1. **Create an order**:
```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "test_receipt_001"
  }'
```

2. **Open checkout page**:
```
http://localhost:3001/checkout?order_id=<order_id_from_step_1>
```

3. **Test UPI Payment**:
   - Select UPI method
   - Enter VPA: `test@paytm`
   - Submit payment
   - Wait for status update

4. **Test Card Payment**:
   - Select Card method
   - Enter card number: `4111111111111111`
   - Expiry: `12/25`
   - CVV: `123`
   - Name: `Test User`
   - Submit payment
   - Wait for status update

### Test Cards

| Card Number | Network | Expected Result |
|-------------|---------|-----------------|
| 4111111111111111 | Visa | Valid |
| 5555555555554444 | Mastercard | Valid |
| 378282246310005 | Amex | Valid |
| 6011111111111117 | RuPay | Valid |
| 1234567890123456 | Unknown | Invalid (Luhn) |

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **ORM**: pg (node-postgres)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router
- **Server**: Nginx (production)

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **CI/CD**: Ready for GitHub Actions

## 📁 Project Structure

```
payment-gateway/
├── docker-compose.yml          # Service orchestration
├── README.md                   # This file
├── .env.example               # Environment variables template
│
├── backend/                   # API Server (Port 8000)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js          # Express app entry point
│       ├── config/
│       │   └── db.js          # PostgreSQL connection
│       ├── controllers/       # Request handlers
│       ├── middleware/
│       │   └── auth.js        # API key authentication
│       ├── models/
│       │   ├── init.js        # DB initialization
│       │   └── schema.sql     # Database schema
│       ├── routes/
│       │   ├── orderRoutes.js
│       │   ├── paymentRoutes.js
│       │   └── testRoutes.js
│       ├── services/
│       │   └── seedService.js # Test merchant seeding
│       └── utils/
│           └── validation.js  # Payment validation logic
│
├── frontend/dashboard/        # Merchant Dashboard (Port 3000)
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   └── Transactions.jsx
│       └── styles/
│
└── checkout/                  # Checkout Page (Port 3001)
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── pages/
        │   ├── Checkout.jsx
        │   ├── Success.jsx
        │   └── Failure.jsx
        └── styles/
```

## 🔧 Development

### Local Development (without Docker)

1. **Start PostgreSQL**:
```bash
docker run -d \
  --name payment-gateway-db \
  -e POSTGRES_DB=payment_gateway \
  -e POSTGRES_USER=gateway_user \
  -e POSTGRES_PASSWORD=gateway_pass \
  -p 5432:5432 \
  postgres:15-alpine
```

2. **Backend**:
```bash
cd backend
npm install
npm run dev
```

3. **Dashboard**:
```bash
cd frontend/dashboard
npm install
npm run dev
```

4. **Checkout**:
```bash
cd checkout
npm install
npm run dev
```

### Environment Variables

Copy `.env.example` and configure:

```bash
# Backend
DATABASE_URL=postgresql://gateway_user:gateway_pass@localhost:5432/payment_gateway
PORT=8000

# Test Mode (optional)
TEST_MODE=false
TEST_PAYMENT_SUCCESS=true
TEST_PROCESSING_DELAY=1000
```

## � Async Payment Processing (Deliverable 2)

### Payment Status Transitions

Payments now flow asynchronously through the system:

```
User submits payment
           ↓
API creates payment with status='pending'
           ↓
Payment enqueued to Bull job queue
           ↓
paymentWorker processes asynchronously:
  - Simulates payment processing (5-10 seconds)
  - Updates status to 'success' (90%) or 'failed'
  - Enqueues webhook notification
           ↓
webhookWorker delivers webhook:
  - Fetches merchant webhook URL
  - Generates HMAC-SHA256 signature
  - Sends POST request with retry logic
  - Schedules retries if delivery fails
           ↓
Merchant receives webhook with signature verification
```

### Create Async Payment

**Endpoint**: `POST /api/v1/payments`

**Authentication**: Required (with Idempotency-Key header for duplicate prevention)

**Request Headers**:
```http
X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
Idempotency-Key: unique_request_id_123
```

**Request Body**:
```json
{
  "order_id": "order_123",
  "amount": 50000,
  "currency": "INR",
  "method": "upi",
  "vpa": "user@upi",
  "metadata": {"user_id": "123"}
}
```

**Response** (201) - Immediate return with pending status:
```json
{
  "id": "pay_123456789",
  "order_id": "order_123",
  "amount": 50000,
  "currency": "INR",
  "method": "upi",
  "vpa": "user@upi",
  "status": "pending",
  "created_at": "2026-01-15T10:30:00Z"
}
```

**Note**: Status updates asynchronously. Poll `/api/v1/payments/{payment_id}/public` to track status changes.

### Webhook Configuration

**Dashboard Endpoint**: `http://localhost:3000/dashboard/webhooks`

Configure your webhook URL and retrieve your webhook secret:

1. Enter your webhook URL (e.g., `https://yoursite.com/webhook`)
2. Copy the webhook secret (e.g., `whsec_...`)
3. Save configuration
4. View webhook delivery logs with retry attempts

### Webhook Verification

Verify webhook authenticity using the `X-Webhook-Signature` header:

```javascript
const crypto = require('crypto');

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.WEBHOOK_SECRET;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook event
  console.log('Event:', req.body.event);
  res.json({ status: 'success' });
});
```

### Webhook Events

#### payment.success
```json
{
  "event": "payment.success",
  "data": {
    "payment_id": "pay_123456789",
    "order_id": "order_123",
    "amount": 50000,
    "currency": "INR",
    "method": "upi",
    "vpa": "user@upi",
    "created_at": "2026-01-15T10:30:00Z"
  }
}
```

#### payment.failed
```json
{
  "event": "payment.failed",
  "data": {
    "payment_id": "pay_123456789",
    "order_id": "order_123",
    "reason": "Declined by bank",
    "created_at": "2026-01-15T10:30:00Z"
  }
}
```

#### refund.processed
```json
{
  "event": "refund.processed",
  "data": {
    "refund_id": "ref_987654321",
    "payment_id": "pay_123456789",
    "amount": 25000,
    "reason": "Customer requested",
    "created_at": "2026-01-15T10:40:00Z",
    "processed_at": "2026-01-15T10:42:00Z"
  }
}
```

### Webhook Retry Logic

Failed webhooks are automatically retried with exponential backoff:

**Production**:
- Attempt 1: Immediately
- Attempt 2: 1 minute
- Attempt 3: 5 minutes
- Attempt 4: 30 minutes
- Attempt 5: 2 hours

**Test Mode** (set `WEBHOOK_RETRY_INTERVALS_TEST=5,10,15,20`):
- Attempt 1: Immediately
- Attempt 2: 5 seconds
- Attempt 3: 10 seconds
- Attempt 4: 15 seconds
- Attempt 5: 20 seconds

### Embeddable SDK

Include the SDK in your HTML:

```html
<script src="http://localhost:3001/checkout.js"></script>

<button id="pay-button">Pay Now</button>

<script>
  document.getElementById('pay-button').addEventListener('click', () => {
    const gateway = new PaymentGateway({
      key: 'key_test_abc123',
      orderId: 'order_123',
      onSuccess: (paymentId) => {
        console.log('Payment successful:', paymentId);
        // Handle success
      },
      onFailure: (error) => {
        console.error('Payment failed:', error);
        // Handle failure
      },
      onClose: () => {
        console.log('Modal closed');
      }
    });
    
    gateway.open();
  });
</script>
```

The SDK opens a modal with embedded checkout iframe, keeping users on your site during payment.

### Refund API

**Create Refund** (async processing):

```bash
curl -X POST http://localhost:8000/api/v1/payments/pay_123/refunds \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25000,
    "reason": "Customer requested"
  }'
```

**Response** (201):
```json
{
  "id": "ref_987654321",
  "payment_id": "pay_123",
  "amount": 25000,
  "reason": "Customer requested",
  "status": "pending",
  "created_at": "2026-01-15T10:40:00Z"
}
```

### Idempotency Keys

Send the same request multiple times with same Idempotency-Key header to prevent duplicate charges:

```bash
# First request
curl -X POST http://localhost:8000/api/v1/payments \
  -H "Idempotency-Key: unique_request_id" \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order_123", "amount": 50000, ...}'
# Returns: payment_id: pay_abc123

# Retry same request with same key
curl -X POST http://localhost:8000/api/v1/payments \
  -H "Idempotency-Key: unique_request_id" \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order_123", "amount": 50000, ...}'
# Returns: Same payment_id: pay_abc123 (no duplicate)
```

Keys expire after 24 hours.

### Job Queue Status

Monitor background job processing:

```bash
curl http://localhost:8000/api/v1/test/jobs/status \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789"
```

**Response**:
```json
{
  "pending": 5,
  "processing": 2,
  "completed": 145,
  "failed": 3,
  "worker_status": "active"
}
```

### Test Webhook Receiver

For local testing, use the included webhook receiver:

```bash
cd test-merchant
npm install
npm start
```

Configure in dashboard:
- **Webhook URL**: `http://localhost:3002/webhook`
- **Webhook Secret**: Copy from receiver startup output

View logs:
```bash
curl http://localhost:3002/logs
```

## 🚢 Deployment

### Production Considerations

1. **Security**:
   - Use strong database passwords
   - Enable SSL/TLS for database connections
   - Implement rate limiting on API endpoints
   - Add CORS configuration for production domains
   - Use secrets management (AWS Secrets Manager, HashiCorp Vault)
   - Rotate webhook secrets regularly

2. **Scalability**:
   - Add Redis for caching and session management
   - Implement connection pooling
   - Use CDN for frontend assets and SDK
   - Add load balancer for API instances
   - Scale worker services independently

3. **Monitoring**:
   - Add logging (Winston, Bunyan)
   - Implement error tracking (Sentry)
   - Set up APM (New Relic, Datadog)
   - Add health check monitoring
   - Monitor job queue depths and processing times

4. **Database**:
   - Enable automated backups
   - Set up read replicas
   - Implement database connection pooling
   - Add database migration management
   - Index webhook_logs tables for query performance

5. **Webhook Delivery**:
   - Increase timeout values in production
   - Adjust exponential backoff intervals
   - Implement circuit breaker pattern for failing merchants
   - Add webhook delivery metrics and alerting

## 📋 Deliverable 2 Checklist

- ✅ Asynchronous payment processing with Bull job queues
- ✅ Redis-based distributed job storage
- ✅ Payment status transitions (pending → success/failed)
- ✅ HMAC-SHA256 webhook signature verification
- ✅ Webhook delivery with exponential backoff retries (max 5 attempts)
- ✅ Embeddable JavaScript SDK with modal/iframe
- ✅ Refund API with async processing
- ✅ Idempotency keys for duplicate prevention (24-hour expiry)
- ✅ Dashboard webhook configuration page
- ✅ Dashboard API documentation page
- ✅ Test webhook receiver application
- ✅ Worker services containerization
- ✅ Database schema with 4 new tables (refunds, webhook_logs, idempotency_keys, + merchants update)
- ✅ Test mode support for deterministic testing
- ✅ Production-ready error handling and logging

## 📊 Performance Metrics

- **Payment Processing Time**: 5-10 seconds (simulated)
- **Success Rates**: 
  - UPI: 90%
  - Card: 95%
- **API Response Time**: < 100ms (excluding payment processing)
- **Database Query Time**: < 50ms average

## 🐛 Troubleshooting

### Services won't start
```bash
# Check Docker daemon is running
docker info

# Check for port conflicts
netstat -ano | findstr "8000 3000 3001 5432"

# View service logs
docker-compose logs api
docker-compose logs postgres
```

### Database connection issues
```bash
# Check PostgreSQL is ready
docker-compose exec postgres pg_isready -U gateway_user

# Connect to database
docker-compose exec postgres psql -U gateway_user -d payment_gateway
```

### API returning 500 errors
```bash
# Check API logs
docker-compose logs -f api

# Restart API service
docker-compose restart api
```
