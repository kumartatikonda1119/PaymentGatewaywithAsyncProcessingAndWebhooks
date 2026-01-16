const router = require("express").Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");

function generateOrderId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "order_";

  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}

router.post("/", auth, async (req, res) => {
  const { amount, currency = "INR", receipt, notes } = req.body;

  if (!amount || amount < 100) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "amount must be at least 100"
      }
    });
  }

  try {
    let orderId = generateOrderId();

    let exists = await pool.query(
      "SELECT id FROM orders WHERE id = $1",
      [orderId]
    );

    while (exists.rowCount > 0) {
      orderId = generateOrderId();
      exists = await pool.query(
        "SELECT id FROM orders WHERE id = $1",
        [orderId]
      );
    }

    const result = await pool.query(
      `INSERT INTO orders 
       (id, merchant_id, amount, currency, receipt, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,'created')
       RETURNING *`,
      [
        orderId,
        req.merchant.id,
        amount,
        currency,
        receipt || null,
        notes || {}
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:orderId", auth, async (req, res) => {
  const { orderId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM orders 
       WHERE id = $1 AND merchant_id = $2`,
      [orderId, req.merchant.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Order not found"
        }
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUBLIC order fetch
router.get("/:orderId/public", async (req, res) => {
  const { orderId } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, amount, currency, status FROM orders WHERE id=$1",
      [orderId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Order not found"
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
