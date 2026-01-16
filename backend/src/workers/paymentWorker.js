const pool = require('../config/db');
const { webhookQueue } = require('../config/queue');

async function processPayment(job) {
  const { paymentId } = job.data;
  console.log(`Processing payment: ${paymentId}`);

  try {
    // Fetch payment record
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    const payment = result.rows[0];

    // Simulate processing delay
    let delay;
    let isSuccess;

    if (process.env.TEST_MODE === 'true') {
      delay = parseInt(process.env.TEST_PROCESSING_DELAY || '1000');
      isSuccess = process.env.TEST_PAYMENT_SUCCESS !== 'false';
    } else {
      delay = Math.floor(Math.random() * (10000 - 5000)) + 5000;
      const rate = payment.method === 'upi' ? 0.9 : 0.95;
      isSuccess = Math.random() < rate;
    }

    // Wait for processing delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Update payment status
    if (isSuccess) {
      await pool.query(
        'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2',
        ['success', paymentId]
      );

      // Enqueue webhook for payment.success
      await enqueueWebhook(payment.merchant_id, 'payment.success', {
        payment: {
          ...payment,
          status: 'success'
        }
      });

      console.log(`Payment ${paymentId} succeeded`);
    } else {
      await pool.query(
        `UPDATE payments 
         SET status = $1, 
             error_code = $2, 
             error_description = $3, 
             updated_at = NOW() 
         WHERE id = $4`,
        ['failed', 'PAYMENT_FAILED', 'Payment was declined by bank', paymentId]
      );

      // Enqueue webhook for payment.failed
      await enqueueWebhook(payment.merchant_id, 'payment.failed', {
        payment: {
          ...payment,
          status: 'failed',
          error_code: 'PAYMENT_FAILED',
          error_description: 'Payment was declined by bank'
        }
      });

      console.log(`Payment ${paymentId} failed`);
    }

    return { success: isSuccess, paymentId };
  } catch (error) {
    console.error(`Error processing payment ${paymentId}:`, error);
    throw error;
  }
}

async function enqueueWebhook(merchantId, event, data) {
  await webhookQueue.add({
    merchantId,
    event,
    payload: {
      event,
      timestamp: Math.floor(Date.now() / 1000),
      data
    }
  });
}

module.exports = processPayment;
