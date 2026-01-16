require('dotenv').config();
const { paymentQueue, webhookQueue, refundQueue } = require('./config/queue');
const processPayment = require('./workers/paymentWorker');
const deliverWebhook = require('./workers/webhookWorker');
const processRefund = require('./workers/refundWorker');
const pool = require('./config/db');

console.log('Starting worker services...');
console.log('Redis URL:', process.env.REDIS_URL);

// Process payment queue
paymentQueue.process(async (job) => {
  return await processPayment(job);
});

// Process webhook queue
webhookQueue.process(async (job) => {
  return await deliverWebhook(job);
});

// Process refund queue
refundQueue.process(async (job) => {
  return await processRefund(job);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await paymentQueue.close();
  await webhookQueue.close();
  await refundQueue.close();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await paymentQueue.close();
  await webhookQueue.close();
  await refundQueue.close();
  await pool.end();
  process.exit(0);
});

console.log('✅ Worker services started successfully');
console.log('- Payment processing worker: Running');
console.log('- Webhook delivery worker: Running');
console.log('- Refund processing worker: Running');
