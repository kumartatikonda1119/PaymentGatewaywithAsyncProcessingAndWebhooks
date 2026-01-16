const axios = require('axios');
const crypto = require('crypto');
const pool = require('../config/db');

async function deliverWebhook(job) {
  const { merchantId, event, payload } = job.data;
  console.log(`Delivering webhook: ${event} to merchant ${merchantId}`);

  try {
    // Fetch merchant details
    const merchantResult = await pool.query(
      'SELECT webhook_url, webhook_secret FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rowCount === 0) {
      throw new Error(`Merchant ${merchantId} not found`);
    }

    const { webhook_url, webhook_secret } = merchantResult.rows[0];

    // Skip if webhook URL not configured
    if (!webhook_url) {
      console.log(`No webhook URL configured for merchant ${merchantId}`);
      return { skipped: true };
    }

    // Generate HMAC signature
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhook_secret || '')
      .update(payloadString)
      .digest('hex');

    // Create or get existing webhook log
    let webhookLogId;
    let currentAttempts = 0;

    // Check if this is a retry (webhook log already exists)
    const existingLogResult = await pool.query(
      `SELECT id, attempts FROM webhook_logs 
       WHERE merchant_id = $1 AND event = $2 AND payload = $3 
       ORDER BY created_at DESC LIMIT 1`,
      [merchantId, event, payload]
    );

    if (existingLogResult.rowCount > 0) {
      webhookLogId = existingLogResult.rows[0].id;
      currentAttempts = existingLogResult.rows[0].attempts;
    } else {
      // Create new webhook log
      const logResult = await pool.query(
        `INSERT INTO webhook_logs (merchant_id, event, payload, status, attempts)
         VALUES ($1, $2, $3, 'pending', 0)
         RETURNING id`,
        [merchantId, event, payload]
      );
      webhookLogId = logResult.rows[0].id;
    }

    // Increment attempts
    currentAttempts += 1;

    // Send HTTP POST request
    let responseCode = null;
    let responseBody = null;
    let deliverySuccess = false;

    try {
      const response = await axios.post(webhook_url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        timeout: 5000
      });

      responseCode = response.status;
      responseBody = JSON.stringify(response.data).substring(0, 1000);
      deliverySuccess = response.status >= 200 && response.status < 300;
    } catch (error) {
      if (error.response) {
        responseCode = error.response.status;
        responseBody = JSON.stringify(error.response.data).substring(0, 1000);
      } else {
        responseBody = error.message;
      }
    }

    // Update webhook log
    if (deliverySuccess) {
      await pool.query(
        `UPDATE webhook_logs 
         SET status = 'success', 
             attempts = $1, 
             last_attempt_at = NOW(), 
             response_code = $2, 
             response_body = $3
         WHERE id = $4`,
        [currentAttempts, responseCode, responseBody, webhookLogId]
      );

      console.log(`Webhook delivered successfully to merchant ${merchantId}`);
      return { success: true, attempts: currentAttempts };
    } else {
      // Failed delivery
      if (currentAttempts < 5) {
        // Calculate next retry time
        const nextRetryAt = calculateNextRetry(currentAttempts);

        await pool.query(
          `UPDATE webhook_logs 
           SET status = 'pending', 
               attempts = $1, 
               last_attempt_at = NOW(), 
               next_retry_at = $2, 
               response_code = $3, 
               response_body = $4
           WHERE id = $5`,
          [currentAttempts, nextRetryAt, responseCode, responseBody, webhookLogId]
        );

        console.log(`Webhook delivery failed (attempt ${currentAttempts}/5), will retry at ${nextRetryAt}`);
        
        // Re-enqueue for retry with delay
        const { webhookQueue } = require('../config/queue');
        const delayMs = nextRetryAt.getTime() - Date.now();
        await webhookQueue.add(
          { merchantId, event, payload },
          { delay: Math.max(delayMs, 0) }
        );

        return { success: false, attempts: currentAttempts, willRetry: true };
      } else {
        // Max attempts reached
        await pool.query(
          `UPDATE webhook_logs 
           SET status = 'failed', 
               attempts = $1, 
               last_attempt_at = NOW(), 
               response_code = $2, 
               response_body = $3
           WHERE id = $4`,
          [currentAttempts, responseCode, responseBody, webhookLogId]
        );

        console.log(`Webhook delivery failed permanently after ${currentAttempts} attempts`);
        return { success: false, attempts: currentAttempts, willRetry: false };
      }
    }
  } catch (error) {
    console.error(`Error delivering webhook to merchant ${merchantId}:`, error);
    throw error;
  }
}

function calculateNextRetry(attemptNumber) {
  const now = new Date();
  let delaySeconds;

  // Check if test mode is enabled
  if (process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true') {
    // Test intervals: 0s, 5s, 10s, 15s, 20s
    const testIntervals = [0, 5, 10, 15, 20];
    delaySeconds = testIntervals[attemptNumber - 1] || 20;
  } else {
    // Production intervals: 0s (immediate), 60s, 300s, 1800s, 7200s
    const prodIntervals = [0, 60, 300, 1800, 7200];
    delaySeconds = prodIntervals[attemptNumber - 1] || 7200;
  }

  return new Date(now.getTime() + delaySeconds * 1000);
}

module.exports = deliverWebhook;
