import { useEffect, useState } from "react";

function sendToParent(type, data) {
  window.parent.postMessage({ type, data }, '*');
}

export default function Checkout() {
  const [order, setOrder] = useState(null);
  const [method, setMethod] = useState("");
  const [payment, setPayment] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order_id");
  const isEmbedded = params.get("embedded") === "true";

  async function createTestOrder() {
    try {
      setError("");
      const res = await fetch("http://localhost:8000/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": "key_test_abc123", "X-Api-Secret": "secret_test_xyz789" },
        body: JSON.stringify({ amount: 50000, currency: "INR", receipt: "test_receipt" })
      });

      const data = await res.json();
      if (data.id) {
        window.location.href = `/checkout?order_id=${data.id}`;
      } else {
        setError("Failed to create test order");
      }
    } catch (err) {
      setError("Error creating test order: " + err.message);
    }
  }

  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await fetch(
          `http://localhost:8000/api/v1/orders/${orderId}/public`
        );
        if (!res.ok) {
          setError("Order not found");
          return;
        }
        const data = await res.json();
        if (data.error) {
          setError(data.error.description || "Failed to load order");
          return;
        }
        setOrder(data);
      } catch (err) {
        setError("Failed to load order: " + err.message);
      }
    }

    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  async function handleUPI(e) {
    e.preventDefault();
    setProcessing(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8000/api/v1/payments/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          method: "upi",
          vpa: e.target.vpa.value
        })
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        setError(data.error?.description || "Payment creation failed");
        setProcessing(false);
        return;
      }

      if (!data.id) {
        setError("Invalid payment response from server");
        setProcessing(false);
        return;
      }

      setPayment(data);
      pollStatus(data.id);
    } catch (err) {
      setError("Payment creation error: " + err.message);
      setProcessing(false);
    }
  }

  async function handleCard(e) {
    e.preventDefault();
    setProcessing(true);
    setError("");

    try {
      const expiryParts = e.target.expiry.value.split("/");
      if (expiryParts.length !== 2) {
        setError("Expiry format should be MM/YY");
        setProcessing(false);
        return;
      }

      const res = await fetch("http://localhost:8000/api/v1/payments/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          method: "card",
          card: {
            number: e.target.number.value,
            expiry_month: expiryParts[0],
            expiry_year: expiryParts[1],
            cvv: e.target.cvv.value,
            holder_name: e.target.name.value
          }
        })
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        setError(data.error?.description || "Payment creation failed");
        setProcessing(false);
        return;
      }

      if (!data.id) {
        setError("Invalid payment response from server");
        setProcessing(false);
        return;
      }

      setPayment(data);
      pollStatus(data.id);
    } catch (err) {
      setError("Payment creation error: " + err.message);
      setProcessing(false);
    }
  }

  async function pollStatus(paymentId) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/api/v1/payments/${paymentId}/public`
        );
        const data = await res.json();

        if (data.status === "success") {
          clearInterval(interval);
          
          if (isEmbedded) {
            sendToParent('payment_success', { paymentId: data.id });
          } else {
            window.location.href = "/success";
          }
        }

        if (data.status === "failed") {
          clearInterval(interval);
          
          if (isEmbedded) {
            sendToParent('payment_failed', { error: data.error_description });
          } else {
            window.location.href = "/failure";
          }
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 2000);
  }

  return (
    <div className="page" data-test-id="checkout-container">
      {error && (
        <div style={{ color: "red", marginBottom: "20px", padding: "10px", backgroundColor: "#ffe6e6", borderRadius: "4px" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!order ? (
        !orderId ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <h2>Create a Test Order</h2>
            <p>No order ID provided. Create a test order to proceed.</p>
            <button 
              onClick={createTestOrder}
              style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
              data-test-id="create-test-order"
            >
              Create Test Order (₹500)
            </button>
          </div>
        ) : (
          <p>{error ? "Failed to load order" : "Loading..."}</p>
        )
      ) : (
        <>
          {/* ORDER SUMMARY */}
          <div data-test-id="order-summary">
            <h2>Complete Payment</h2>

            <div>
              <span>Amount: </span>
              <span data-test-id="order-amount">
                ₹{order && order.amount ? (order.amount / 100).toFixed(2) : "0.00"}
              </span>
            </div>

            <div>
              <span>Order ID: </span>
              <span data-test-id="order-id">{order && order.id ? order.id : "N/A"}</span>
            </div>
          </div>

          {/* METHOD BUTTONS */}
          <div data-test-id="payment-methods">
            <button
              data-test-id="method-upi"
              onClick={() => setMethod("upi")}
            >
              UPI
            </button>

            <button
              data-test-id="method-card"
              onClick={() => setMethod("card")}
            >
              Card
            </button>
          </div>

          {/* UPI FORM */}
          <form
            data-test-id="upi-form"
            style={{ display: method === "upi" ? "block" : "none" }}
            onSubmit={handleUPI}
          >
            <input
              data-test-id="vpa-input"
              name="vpa"
              placeholder="username@bank"
              type="text"
              required
            />

            <button data-test-id="pay-button" type="submit">
              Pay ₹{order && order.amount ? (order.amount / 100).toFixed(2) : "0.00"}
            </button>
          </form>

          {/* CARD FORM */}
          <form
            data-test-id="card-form"
            style={{ display: method === "card" ? "block" : "none" }}
            onSubmit={handleCard}
          >
            <input
              data-test-id="card-number-input"
              name="number"
              placeholder="Card Number"
              required
            />

            <input
              data-test-id="expiry-input"
              name="expiry"
              placeholder="MM/YY"
              required
            />

            <input
              data-test-id="cvv-input"
              name="cvv"
              placeholder="CVV"
              required
            />

            <input
              data-test-id="cardholder-name-input"
              name="name"
              placeholder="Name on Card"
              required
            />

            <button data-test-id="pay-button" type="submit">
              Pay ₹{order && order.amount ? (order.amount / 100).toFixed(2) : "0.00"}
            </button>
          </form>

          {/* PROCESSING */}
          {processing && (
            <div data-test-id="processing-state">
              <div className="spinner"></div>
              <span data-test-id="processing-message">
                Processing payment...
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
