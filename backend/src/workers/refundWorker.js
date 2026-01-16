const pool = require('../config/db');
const { webhookQueue } = require('../config/queue');

async function processRefund(job) {
  const { refundId } = job.data;
  console.log(`Processing refund: ${refundId}`);

  try {
    // Fetch refund record
    const refundResult = await pool.query(
      'SELECT * FROM refunds WHERE id = $1',
      [refundId]
    );

    if (refundResult.rowCount === 0) {
      throw new Error(`Refund ${refundId} not found`);
    }

    const refund = refundResult.rows[0];

    // Fetch payment record
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [refund.payment_id]
    );

    if (paymentResult.rowCount === 0) {
      throw new Error(`Payment ${refund.payment_id} not found`);
    }

    const payment = paymentResult.rows[0];

    // Verify payment is in refundable state
    if (payment.status !== 'success') {
      throw new Error(`Payment ${payment.id} is not in success state`);
    }

    // Calculate total refunded amount
    const totalRefundedResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_refunded 
       FROM refunds 
       WHERE payment_id = $1 AND (status = 'processed' OR status = 'pending')`,
      [refund.payment_id]
    );

    const totalRefunded = parseInt(totalRefundedResult.rows[0].total_refunded);

    // Verify refund amount doesn't exceed payment amount
    if (totalRefunded > payment.amount) {
      throw new Error(`Total refunded amount exceeds payment amount`);
    }

    // Simulate refund processing delay (3-5 seconds)
    const delay = Math.floor(Math.random() * (5000 - 3000)) + 3000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Update refund status to processed
    await pool.query(
      `UPDATE refunds 
       SET status = 'processed', processed_at = NOW() 
       WHERE id = $1`,
      [refundId]
    );

    // Enqueue webhook for refund.processed
    await webhookQueue.add({
      merchantId: refund.merchant_id,
      event: 'refund.processed',
      payload: {
        event: 'refund.processed',
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          refund: {
            id: refund.id,
            payment_id: refund.payment_id,
            amount: refund.amount,
            reason: refund.reason,
            status: 'processed',
            created_at: refund.created_at,
            processed_at: new Date()
          }
        }
      }
    });

    console.log(`Refund ${refundId} processed successfully`);
    return { success: true, refundId };
  } catch (error) {
    console.error(`Error processing refund ${refundId}:`, error);
    
    // Mark refund as failed if processing error
    await pool.query(
      `UPDATE refunds 
       SET status = 'failed' 
       WHERE id = $1`,
      [refundId]
    ).catch(err => console.error('Error updating refund status:', err));
    
    throw error;
  }
}

module.exports = processRefund;
