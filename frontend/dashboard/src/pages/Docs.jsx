export default function Docs() {
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>API Documentation</h1>

      <section data-test-id="section-create-order" style={{ marginBottom: '40px' }}>
        <h2>Create a Payment</h2>
        <p>Accept payments via the Payment Creation API.</p>

        <h3>Endpoint</h3>
        <code style={{ display: 'block', backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
          POST /api/v1/payments
        </code>

        <h3>Authentication</h3>
        <p>Include your API credentials in the request headers:</p>
        <code
          data-test-id="code-snippet-create-order"
          style={{
            display: 'block',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '13px',
            overflow: 'auto'
          }}
        >
{`curl -X POST http://localhost:8000/api/v1/payments \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "order_id": "order_123",
    "amount": 50000,
    "currency": "INR",
    "method": "upi",
    "vpa": "user@upi",
    "metadata": {"user_id": "123"}
  }'`}
        </code>

        <h3>Parameters</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Field</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>order_id</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>string</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Unique order identifier (required)</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>amount</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>number</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Amount in smallest currency unit (paise for INR)</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>currency</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>string</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Currency code (INR, USD)</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>method</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>string</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Payment method: upi, card, wallet</td>
            </tr>
          </tbody>
        </table>

        <h3>Response</h3>
        <code
          style={{
            display: 'block',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            marginTop: '12px',
            fontSize: '13px',
            overflow: 'auto'
          }}
        >
{`{
  "id": "pay_123456789",
  "order_id": "order_123",
  "merchant_id": "merch_test",
  "amount": 50000,
  "currency": "INR",
  "method": "upi",
  "vpa": "user@upi",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}`}
        </code>
      </section>

      <section data-test-id="section-sdk-integration" style={{ marginBottom: '40px' }}>
        <h2>SDK Integration (Embeddable Checkout)</h2>
        <p>Accept payments without leaving your website using the Payment Gateway SDK.</p>

        <h3>Installation</h3>
        <p>Add the SDK to your HTML:</p>
        <code
          data-test-id="code-snippet-sdk"
          style={{
            display: 'block',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '13px',
            overflow: 'auto'
          }}
        >
{`<!-- Add to your HTML -->
<script src="http://localhost:3001/checkout.js"></script>

<!-- In your JavaScript -->
<script>
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
      console.log('Payment modal closed');
      // Handle close
    }
  });

  // Open the payment modal
  gateway.open();
</script>`}
        </code>

        <h3>Constructor Options</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Option</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>key</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>string</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Your API key (required)</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>orderId</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>string</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Order ID for the payment (required)</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>onSuccess</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>function</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Callback when payment succeeds</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>onFailure</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>function</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Callback when payment fails</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>onClose</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>function</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Callback when modal is closed</td>
            </tr>
          </tbody>
        </table>

        <h3>Methods</h3>
        <ul>
          <li><strong>open():</strong> Opens the payment modal</li>
          <li><strong>close():</strong> Closes the payment modal</li>
        </ul>
      </section>

      <section data-test-id="section-webhook-verification" style={{ marginBottom: '40px' }}>
        <h2>Webhook Signature Verification</h2>
        <p>Verify webhook authenticity by checking the HMAC-SHA256 signature in the X-Webhook-Signature header.</p>

        <h3>Verification Code (Node.js)</h3>
        <code
          data-test-id="code-snippet-webhook"
          style={{
            display: 'block',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            marginTop: '12px',
            fontSize: '13px',
            overflow: 'auto'
          }}
        >
{`const crypto = require('crypto');
const express = require('express');
const app = express();

app.post('/webhook', express.json(), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.WEBHOOK_SECRET; // From dashboard
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process the webhook
  console.log('Event:', req.body.event);
  console.log('Data:', req.body.data);
  
  res.json({ status: 'success' });
});`}
        </code>

        <h3>Webhook Events</h3>
        <ul>
          <li><strong>payment.success:</strong> Payment completed successfully</li>
          <li><strong>payment.failed:</strong> Payment failed or was declined</li>
          <li><strong>refund.processed:</strong> Refund has been processed</li>
        </ul>

        <h3>Webhook Retry Logic</h3>
        <p>Failed webhooks are automatically retried with exponential backoff:</p>
        <ul>
          <li>Attempt 1: Immediately</li>
          <li>Attempt 2: 1 minute later</li>
          <li>Attempt 3: 5 minutes later</li>
          <li>Attempt 4: 30 minutes later</li>
          <li>Attempt 5: 2 hours later</li>
        </ul>
        <p>If all retries fail, the webhook status is marked as "failed" and you can manually retry from the dashboard.</p>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2>Refund API</h2>
        <p>Process refunds for successful payments.</p>

        <h3>Create Refund</h3>
        <code
          style={{
            display: 'block',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '13px',
            overflow: 'auto'
          }}
        >
{`curl -X POST http://localhost:8000/api/v1/payments/pay_123/refunds \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25000,
    "reason": "Customer requested"
  }'`}
        </code>

        <h3>Response</h3>
        <code
          style={{
            display: 'block',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '13px',
            overflow: 'auto'
          }}
        >
{`{
  "id": "ref_123456789",
  "payment_id": "pay_123",
  "merchant_id": "merch_test",
  "amount": 25000,
  "reason": "Customer requested",
  "status": "pending",
  "created_at": "2024-01-15T10:35:00Z",
  "processed_at": null
}`}
        </code>
      </section>

      <section style={{ backgroundColor: '#f0f0f0', padding: '20px', borderRadius: '8px' }}>
        <h2>Support</h2>
        <p>For additional help or questions, please contact our support team at support@paymentgateway.local</p>
      </section>
    </div>
  );
}
