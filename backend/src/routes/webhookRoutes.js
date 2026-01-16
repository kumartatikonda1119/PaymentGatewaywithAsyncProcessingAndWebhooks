const router = require("express").Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");
const { webhookQueue, paymentQueue, refundQueue } = require("../config/queue");

// GET /api/v1/webhooks - List webhook logs for merchant
router.get("/", auth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Get total count
    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM webhook_logs WHERE merchant_id = $1",
      [req.merchant.id]
    );

    const total = parseInt(countResult.rows[0].total);

    // Get webhook logs with pagination
    const result = await pool.query(
      `SELECT id, event, status, attempts, created_at, last_attempt_at, response_code
       FROM webhook_logs
       WHERE merchant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.merchant.id, limit, offset]
    );

    res.json({
      data: result.rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/v1/webhooks/:webhookId/retry - Manual webhook retry
router.post("/:webhookId/retry", auth, async (req, res) => {
  const { webhookId } = req.params;

  try {
    // Fetch webhook log
    const webhookResult = await pool.query(
      `SELECT * FROM webhook_logs
       WHERE id = $1 AND merchant_id = $2`,
      [webhookId, req.merchant.id]
    );

    if (webhookResult.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Webhook log not found",
        },
      });
    }

    const webhook = webhookResult.rows[0];

    // Reset webhook for retry
    await pool.query(
      `UPDATE webhook_logs
       SET status = 'pending', attempts = 0, next_retry_at = NOW()
       WHERE id = $1`,
      [webhookId]
    );

    // Enqueue webhook delivery job
    await webhookQueue.add({
      merchantId: webhook.merchant_id,
      event: webhook.event,
      payload: webhook.payload,
    });

    res.json({
      id: webhookId,
      status: "pending",
      message: "Webhook retry scheduled",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/v1/webhooks - Update merchant webhook configuration
router.put("/", auth, async (req, res) => {
  const { webhook_url, webhook_secret } = req.body;

  try {
    await pool.query(
      `UPDATE merchants SET webhook_url = $1, webhook_secret = $2, updated_at = NOW() WHERE id = $3`,
      [webhook_url || null, webhook_secret || null, req.merchant.id]
    );

    // Return masked secret to the client for display
    const masked = webhook_secret
      ? webhook_secret.substring(0, 10) + "***"
      : null;

    res.json({ webhook_url: webhook_url || null, webhook_secret: masked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
