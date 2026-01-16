require("dotenv").config();
const express = require("express");
const cors = require("cors");

const pool = require("./config/db");
const initDB = require("./models/init");
const seedTestMerchant = require("./services/seedService");
const testRoutes = require("./routes/testRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");


const app = express();

app.use(cors());
app.use(express.json());

/**
 * ROOT ROUTE - API Information
 */
app.get("/", (req, res) => {
  res.json({
    name: "Payment Gateway API",
    version: "1.0.0",
    status: "running",
    documentation: "http://localhost:3000/dashboard/docs",
    endpoints: {
      health: "GET /health",
      test: "GET /api/v1/test/merchant",
      jobs: "GET /api/v1/test/jobs/status",
      orders: "POST /api/v1/orders",
      payments: "GET/POST /api/v1/payments",
      webhooks: "POST /api/v1/webhooks"
    }
  });
});

app.use("/api/v1/test", testRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/webhooks", webhookRoutes);
app.use("/api/v1/refunds", paymentRoutes); // Refund routes are in paymentRoutes

/**
 * Initialize DB + seed test merchant
 */
(async () => {
  try {
    console.log("Initializing database…");
    await initDB();

    console.log("Seeding test merchant…");
    await seedTestMerchant();

    console.log("Startup complete ✔");
  } catch (err) {
    console.error("Startup error:", err);
  }
})();

/**
 * HEALTH CHECK
 */
app.get("/health", async (req, res) => {
  let dbStatus = "disconnected";

  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch (err) {}

  return res.status(200).json({
    status: "healthy",
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

/**
 * TEST ROUTES
 */
app.use("/api/v1/test", testRoutes);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
