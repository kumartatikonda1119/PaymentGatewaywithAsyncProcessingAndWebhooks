const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Store webhook logs in memory (for testing)
const webhookLogs = [];
const logsFile = path.join(__dirname, 'webhook-logs.json');

// Load logs on startup if they exist
if (fs.existsSync(logsFile)) {
  try {
    const data = fs.readFileSync(logsFile, 'utf-8');
    webhookLogs.push(...JSON.parse(data));
  } catch (err) {
    console.error('Failed to load webhook logs:', err.message);
  }
}

// Webhook secret from environment (should match the one from your merchant account)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_test_abc123';

/**
 * Verify webhook signature
 * @param {string} payload - Raw JSON payload
 * @param {string} signature - X-Webhook-Signature header value
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhookSignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}

/**
 * POST /webhook
 * Receives and processes webhooks from the payment gateway
 */
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  console.log('\n========================================');
  console.log('Webhook Received');
  console.log('========================================');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Signature:', signature);
  console.log('Payload:', req.body);

  // Verify signature
  if (!signature) {
    console.log('❌ Missing X-Webhook-Signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  if (!verifyWebhookSignature(payload, signature)) {
    console.log('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  console.log('✅ Signature verified');

  // Process webhook
  const event = req.body.event || 'unknown';
  const data = req.body.data || {};

  const logEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    event,
    data,
    signature,
    verified: true
  };

  webhookLogs.push(logEntry);

  // Persist logs to file
  fs.writeFileSync(logsFile, JSON.stringify(webhookLogs, null, 2));

  // Handle different event types
  switch (event) {
    case 'payment.success':
      console.log('💰 Payment Success Event');
      console.log(`   Payment ID: ${data.payment_id}`);
      console.log(`   Amount: ${data.amount} ${data.currency}`);
      console.log(`   Order ID: ${data.order_id}`);
      break;

    case 'payment.failed':
      console.log('❌ Payment Failed Event');
      console.log(`   Payment ID: ${data.payment_id}`);
      console.log(`   Reason: ${data.reason || 'Unknown'}`);
      break;

    case 'refund.processed':
      console.log('↩️  Refund Processed Event');
      console.log(`   Refund ID: ${data.refund_id}`);
      console.log(`   Payment ID: ${data.payment_id}`);
      console.log(`   Amount: ${data.amount}`);
      break;

    default:
      console.log('❓ Unknown event type:', event);
  }

  console.log('========================================\n');

  // Always respond with 200 OK to prevent retries
  res.json({ 
    status: 'success',
    message: 'Webhook processed',
    log_id: logEntry.id
  });
});

/**
 * GET /logs
 * Returns all received webhooks (for testing/debugging)
 */
app.get('/logs', (req, res) => {
  res.json({
    count: webhookLogs.length,
    logs: webhookLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  });
});

/**
 * GET /logs/:id
 * Returns a specific webhook log
 */
app.get('/logs/:id', (req, res) => {
  const log = webhookLogs.find(l => l.id === req.params.id);
  
  if (!log) {
    return res.status(404).json({ error: 'Log not found' });
  }

  res.json(log);
});

/**
 * DELETE /logs
 * Clears all webhook logs (for testing)
 */
app.delete('/logs', (req, res) => {
  const count = webhookLogs.length;
  webhookLogs.length = 0;
  
  // Clear logs file
  fs.writeFileSync(logsFile, JSON.stringify([], null, 2));

  res.json({ 
    message: `Cleared ${count} webhook logs`
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    webhook_secret: WEBHOOK_SECRET.substring(0, 10) + '***',
    logs_count: webhookLogs.length
  });
});

/**
 * GET /
 * Returns simple info page
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Gateway - Test Webhook Receiver</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
        .endpoint { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #007bff; }
        .method { font-weight: bold; color: #007bff; }
        table { border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
      </style>
    </head>
    <body>
      <h1>🔔 Payment Gateway - Test Webhook Receiver</h1>
      
      <p>This service receives and logs webhooks from the Payment Gateway backend for testing and debugging.</p>
      
      <h2>Configuration</h2>
      <p>Webhook Secret: <code>${WEBHOOK_SECRET}</code></p>
      
      <h2>API Endpoints</h2>
      
      <div class="endpoint">
        <span class="method">POST</span> <code>/webhook</code>
        <p>Receives webhooks from the payment gateway. Requires valid <code>X-Webhook-Signature</code> header.</p>
      </div>
      
      <div class="endpoint">
        <span class="method">GET</span> <code>/logs</code>
        <p>Returns all received webhook logs.</p>
      </div>
      
      <div class="endpoint">
        <span class="method">GET</span> <code>/logs/:id</code>
        <p>Returns a specific webhook log by ID.</p>
      </div>
      
      <div class="endpoint">
        <span class="method">DELETE</span> <code>/logs</code>
        <p>Clears all webhook logs.</p>
      </div>
      
      <div class="endpoint">
        <span class="method">GET</span> <code>/health</code>
        <p>Health check endpoint.</p>
      </div>
      
      <h2>Testing</h2>
      <p>To configure this as your webhook receiver in the Payment Gateway:</p>
      <ol>
        <li>Ensure this service is running on <code>http://localhost:3002</code></li>
        <li>In the dashboard, set your Webhook URL to <code>http://localhost:3002/webhook</code></li>
        <li>Copy the Webhook Secret from this page into the dashboard</li>
        <li>Process a payment - you should see logs appear in <code>/logs</code></li>
      </ol>
      
      <h2>Status</h2>
      <p>Logs received: ${webhookLogs.length}</p>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Test Webhook Receiver running on http://localhost:${PORT}`);
  console.log(`📝 Webhook Secret: ${WEBHOOK_SECRET}`);
  console.log(`📊 API Docs: http://localhost:${PORT}/`);
  console.log(`🔍 View logs: http://localhost:${PORT}/logs`);
});
