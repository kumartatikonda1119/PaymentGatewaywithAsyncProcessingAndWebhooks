import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "../styles/dashboard.css";

export default function Dashboard() {
  const [merchant, setMerchant] = useState(null);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    async function load() {
      const mRes = await fetch("http://localhost:8000/api/v1/test/merchant");
      const mData = await mRes.json();
      setMerchant(mData);

      const pRes = await fetch("http://localhost:8000/api/v1/payments", {
        headers: {
          "X-Api-Key": mData.api_key,
          "X-Api-Secret": "secret_test_xyz789"
        }
      });

      const pData = await pRes.json();
      setPayments(pData);
    }

    load();
  }, []);

  const totalTransactions = payments.length;

  const totalAmount = payments
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + p.amount, 0);

  const successRate = totalTransactions
    ? Math.round(
        (payments.filter((p) => p.status === "success").length /
          totalTransactions) *
          100
      )
    : 0;

  return (
    <div className="container" data-test-id="dashboard">
      <div className="card">
        <h2 className="dashboard-title">Merchant Dashboard</h2>

        {merchant && (
          <div className="credentials" data-test-id="api-credentials">
            <div>
              <label>API Key</label>
              <span data-test-id="api-key">{merchant.api_key}</span>
            </div>

            <div>
              <label>API Secret</label>
              <span data-test-id="api-secret">secret_test_xyz789</span>
            </div>
          </div>
        )}
      </div>

      <div className="card stats-grid" data-test-id="stats-container">
        <div className="stat-box" data-test-id="total-transactions">
          {totalTransactions}
        </div>

        <div className="stat-box" data-test-id="total-amount">
          ₹{(totalAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        <div className="stat-box" data-test-id="success-rate">
          {successRate}%
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link
          to="/dashboard/transactions"
          className="button"
          style={{ display: "inline-block", textDecoration: "none", marginRight: 8 }}
        >
          View Transactions
        </Link>

        <Link
          to="/dashboard/docs"
          className="button"
          style={{ display: "inline-block", textDecoration: "none", marginRight: 8 }}
        >
          Docs
        </Link>

        <Link
          to="/dashboard/webhooks"
          className="button"
          style={{ display: "inline-block", textDecoration: "none" }}
        >
          Webhooks
        </Link>
      </div>
    </div>
  );
}
