const router = require("express").Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");
const { isValidVPA, luhnCheck, detectNetwork, isValidExpiry } = require("../utils/validation");
const { paymentQueue, webhookQueue, refundQueue } = require("../config/queue");

function generatePaymentId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "pay_";
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateRefundId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "rfnd_";
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Handle idempotency keys
async function handleIdempotency(merchantId, idempotencyKey) {
  if (!idempotencyKey) return null;

  const result = await pool.query(
    `SELECT response FROM idempotency_keys 
     WHERE key = $1 AND merchant_id = $2 AND expires_at > NOW()`,
    [idempotencyKey, merchantId]
  );

  if (result.rowCount > 0) {
    return result.rows[0].response;
  }

  return null;
}

async function storeIdempotency(merchantId, idempotencyKey, response) {
  if (!idempotencyKey) return;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await pool.query(
    `INSERT INTO idempotency_keys (key, merchant_id, response, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key, merchant_id) DO UPDATE SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at`,
    [idempotencyKey, merchantId, response, expiresAt]
  );
}

// POST /api/v1/payments - Create payment (async processing with idempotency)
router.post("/", auth, async (req, res) => {
  const { order_id, method } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  try {
    // Check idempotency
    const cachedResponse = await handleIdempotency(req.merchant.id, idempotencyKey);
    if (cachedResponse) {
      return res.status(201).json(cachedResponse);
    }

    // Validate order
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE id=$1 AND merchant_id=$2",
      [order_id, req.merchant.id]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Order not found" }
      });
    }

    const order = orderResult.rows[0];

    let vpa = null;
    let card_network = null;
    let card_last4 = null;

    // Handle UPI
    if (method === "upi") {
      vpa = req.body.vpa;
      if (!isValidVPA(vpa)) {
        return res.status(400).json({
          error: { code: "INVALID_VPA", description: "Invalid VPA format" }
        });
      }
    }

    // Handle Card
    if (method === "card") {
      const card = req.body.card;
      if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv) {
        return res.status(400).json({
          error: { code: "INVALID_CARD", description: "Missing card fields" }
        });
      }

      if (!luhnCheck(card.number)) {
        return res.status(400).json({
          error: { code: "INVALID_CARD", description: "Card number invalid" }
        });
      }

      if (!isValidExpiry(card.expiry_month, card.expiry_year)) {
        return res.status(400).json({
          error: { code: "EXPIRED_CARD", description: "Card expiry is invalid or expired" }
        });
      }

      card_network = detectNetwork(card.number);
      card_last4 = card.number.slice(-4);
    }

    // Create payment (status = pending for async processing)
    let paymentId = generatePaymentId();

    const result = await pool.query(
      `INSERT INTO payments 
        (id, order_id, merchant_id, amount, currency, method, status, vpa, card_network, card_last4)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)
       RETURNING *`,
      [
        paymentId,
        order.id,
        order.merchant_id,
        order.amount,
        order.currency,
        method,
        vpa,
        card_network,
        card_last4
      ]
    );

    const payment = result.rows[0];

    // Enqueue payment processing job
    await paymentQueue.add({ paymentId: payment.id });

    const responseData = {
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      vpa: payment.vpa,
      status: payment.status,
      created_at: payment.created_at
    };

    // Store idempotency key
    await storeIdempotency(req.merchant.id, idempotencyKey, responseData);

    res.status(201).json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/v1/payments/public - Create payment without auth
router.post("/public", async (req, res) => {
  const { order_id, method } = req.body;

  try {
    // Validate order
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE id=$1",
      [order_id]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Order not found" }
      });
    }

    const order = orderResult.rows[0];

    let vpa = null;
    let card_network = null;
    let card_last4 = null;

    // UPI
    if (method === "upi") {
      if (!isValidVPA(req.body.vpa)) {
        return res.status(400).json({
          error: { code: "INVALID_VPA", description: "Invalid VPA format" }
        });
      }
      vpa = req.body.vpa;
    }

    // CARD
    if (method === "card") {
      const card = req.body.card;
      if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv) {
        return res.status(400).json({
          error: { code: "INVALID_CARD", description: "Missing card fields" }
        });
      }

      if (!luhnCheck(card.number)) {
        return res.status(400).json({
          error: { code: "INVALID_CARD", description: "Card number invalid" }
        });
      }

      if (!isValidExpiry(card.expiry_month, card.expiry_year)) {
        return res.status(400).json({
          error: { code: "EXPIRED_CARD", description: "Card expiry is invalid or expired" }
        });
      }

      card_network = detectNetwork(card.number);
      card_last4 = card.number.slice(-4);
    }

    // Create payment with pending status
    let paymentId = generatePaymentId();

    const result = await pool.query(
      `INSERT INTO payments 
        (id, order_id, merchant_id, amount, currency, method, status, vpa, card_network, card_last4)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)
       RETURNING *`,
      [
        paymentId,
        order.id,
        order.merchant_id,
        order.amount,
        order.currency,
        method,
        vpa,
        card_network,
        card_last4
      ]
    );

    const payment = result.rows[0];

    // Enqueue payment processing job
    await paymentQueue.add({ paymentId: payment.id });

    res.status(201).json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/v1/payments - List all payments for merchant
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payments WHERE merchant_id=$1 ORDER BY created_at DESC",
      [req.merchant.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/v1/payments/:paymentId - Get payment by ID
router.get("/:paymentId", auth, async (req, res) => {
  const { paymentId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM payments 
       WHERE id = $1 AND merchant_id = $2`,
      [paymentId, req.merchant.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Payment not found"
        }
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/v1/payments/:paymentId/public - Get payment without auth
router.get("/:paymentId/public", async (req, res) => {
  const { paymentId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        id,
        order_id,
        amount,
        currency,
        method,
        status,
        vpa,
        card_network,
        card_last4,
        created_at,
        updated_at
       FROM payments
       WHERE id=$1`,
      [paymentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Payment not found"
        }
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/v1/payments/:paymentId/capture - Capture payment
router.post("/:paymentId/capture", auth, async (req, res) => {
  const { paymentId } = req.params;
  const { amount } = req.body;

  try {
    // Fetch payment
    const paymentResult = await pool.query(
      `SELECT * FROM payments 
       WHERE id = $1 AND merchant_id = $2`,
      [paymentId, req.merchant.id]
    );

    if (paymentResult.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Payment not found" }
      });
    }

    const payment = paymentResult.rows[0];

    // Check if payment is in capturable state
    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Payment not in capturable state"
        }
      });
    }

    // Update captured status
    const result = await pool.query(
      `UPDATE payments 
       SET captured = true, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [paymentId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/v1/payments/:paymentId/refunds - Create refund
router.post("/:paymentId/refunds", auth, async (req, res) => {
  const { paymentId } = req.params;
  const { amount, reason } = req.body;

  try {
    // Validate payment exists and belongs to merchant
    const paymentResult = await pool.query(
      `SELECT * FROM payments 
       WHERE id = $1 AND merchant_id = $2`,
      [paymentId, req.merchant.id]
    );

    if (paymentResult.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Payment not found" }
      });
    }

    const payment = paymentResult.rows[0];

    // Verify payment is refundable
    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Payment not in refundable state"
        }
      });
    }

    // Calculate total already refunded
    const totalRefundedResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_refunded 
       FROM refunds 
       WHERE payment_id = $1 AND (status = 'processed' OR status = 'pending')`,
      [paymentId]
    );

    const totalRefunded = parseInt(totalRefundedResult.rows[0].total_refunded);

    // Validate refund amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Invalid refund amount"
        }
      });
    }

    if (totalRefunded + amount > payment.amount) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Refund amount exceeds available amount"
        }
      });
    }

    // Generate refund ID
    const refundId = generateRefundId();

    // Create refund record
    const result = await pool.query(
      `INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [refundId, paymentId, req.merchant.id, amount, reason]
    );

    const refund = result.rows[0];

    // Enqueue refund processing job
    await refundQueue.add({ refundId: refund.id });

    res.status(201).json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/v1/refunds/:refundId - Get refund by ID
router.get("/refunds/:refundId", auth, async (req, res) => {
  const { refundId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM refunds 
       WHERE id = $1 AND merchant_id = $2`,
      [refundId, req.merchant.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Refund not found"
        }
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
