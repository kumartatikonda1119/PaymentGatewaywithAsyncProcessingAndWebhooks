const Queue = require('bull');
const Redis = require('ioredis');

// Redis connection configuration
const redisConfig = {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
};

// Create queues
const paymentQueue = new Queue('payment-processing', redisConfig);
const webhookQueue = new Queue('webhook-delivery', redisConfig);
const refundQueue = new Queue('refund-processing', redisConfig);

// Queue event handlers for monitoring
[paymentQueue, webhookQueue, refundQueue].forEach(queue => {
  queue.on('error', (error) => {
    console.error(`Queue ${queue.name} error:`, error);
  });

  queue.on('waiting', (jobId) => {
    console.log(`Job ${jobId} is waiting in ${queue.name}`);
  });

  queue.on('active', (job) => {
    console.log(`Job ${job.id} started processing in ${queue.name}`);
  });

  queue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed in ${queue.name}`);
  });

  queue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed in ${queue.name}:`, err.message);
  });
});

module.exports = {
  paymentQueue,
  webhookQueue,
  refundQueue
};
