import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/transactions.css";

export default function Transactions() {
  const [merchant, setMerchant] = useState(null);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    async function load() {
      // get merchant first
      const mRes = await fetch("http://localhost:8000/api/v1/test/merchant");
      const mData = await mRes.json();
      setMerchant(mData);

      // get payments
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

  return (
    <div className="container">
      <h2>Transactions</h2>

      <table className="table" data-test-id="transactions-table">
        <thead>
          <tr>
            <th>Payment ID</th>
            <th>Order ID</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {payments.map((p) => (
            <tr
              key={p.id}
              data-test-id="transaction-row"
              data-payment-id={p.id}
            >
              <td data-test-id="payment-id">{p.id}</td>
              <td data-test-id="order-id">{p.order_id}</td>
              <td data-test-id="amount">
                ₹{(p.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td data-test-id="method">{p.method}</td>
              <td
                data-test-id="status"
                className={`status-${p.status}`}
              >
                {p.status}
              </td>
              <td data-test-id="created-at">
                {new Date(p.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <br />

      <Link to="/dashboard" className="button" style={{ textDecoration: "none" }}>
        Back to Dashboard
      </Link>
    </div>
  );
}
