const router = require("express").Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");
const { isValidVPA, luhnCheck, detectNetwork } = require("../utils/validation");
const { isValidExpiry } = require("../utils/validation");


function generatePaymentId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "pay_";

  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}

router.post("/", auth, async (req, res) => {
  const { order_id, method } = req.body;

  try {
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

    // Create payment (status = processing)
    let paymentId = generatePaymentId();

    const result = await pool.query(
      `INSERT INTO payments 
        (id, order_id, merchant_id, amount, currency, method, status, vpa, card_network, card_last4)
       VALUES ($1,$2,$3,$4,$5,$6,'processing',$7,$8,$9)
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

    res.status(201).json(payment);

    let delay;
    let isSuccess;

    if (process.env.TEST_MODE === "true") {
      delay = parseInt(process.env.TEST_PROCESSING_DELAY || "1000");
      isSuccess = process.env.TEST_PAYMENT_SUCCESS !== "false";
    } else {
      delay = Math.floor(Math.random() * (10000 - 5000)) + 5000;
      let rate = method === "upi" ? 0.9 : 0.95;
      isSuccess = Math.random() < rate;
    }

    setTimeout(async () => {
      if (isSuccess) {
        await pool.query(
          "UPDATE payments SET status='success', updated_at=NOW() WHERE id=$1",
          [paymentId]
        );
      } else {
        await pool.query(
          `UPDATE payments 
          SET status='failed',
          error_code='PAYMENT_FAILED',
          error_description='Payment was declined by bank',
          updated_at=NOW()
          WHERE id=$1`,
          [paymentId]
        );
      }
    }, delay);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

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

    // Create processing payment
    let paymentId = generatePaymentId();

    const result = await pool.query(
      `INSERT INTO payments 
        (id, order_id, merchant_id, amount, currency, method, status, vpa, card_network, card_last4)
       VALUES ($1,$2,$3,$4,$5,$6,'processing',$7,$8,$9)
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
    res.status(201).json(payment);

    // Processing simulation (same as private)
    let delay;
    let isSuccess;

    if (process.env.TEST_MODE === "true") {
      delay = parseInt(process.env.TEST_PROCESSING_DELAY || "1000");
      isSuccess = process.env.TEST_PAYMENT_SUCCESS !== "false";
    } else {
      delay = Math.floor(Math.random() * (10000 - 5000)) + 5000;
      let rate = method === "upi" ? 0.9 : 0.95;
      isSuccess = Math.random() < rate;
    }

    setTimeout(async () => {
      if (isSuccess) {
        await pool.query(
          "UPDATE payments SET status='success', updated_at=NOW() WHERE id=$1",
          [paymentId]
        );
      } else {
        await pool.query(
          `UPDATE payments 
          SET status='failed',
          error_code='PAYMENT_FAILED',
          error_description='Payment was declined by bank',
          updated_at=NOW()
          WHERE id=$1`,
          [paymentId]
        );
      }
    }, delay);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
