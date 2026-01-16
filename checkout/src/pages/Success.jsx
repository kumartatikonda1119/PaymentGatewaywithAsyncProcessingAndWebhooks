import { useEffect } from "react";

export default function Success() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbedded = params.get("embedded") === "true";
    
    if (isEmbedded) {
      const paymentId = params.get("paymentId");
      window.parent.postMessage({
        type: 'payment_success',
        data: { paymentId }
      }, '*');
    }
  }, []);

  return (
    <div className="page" data-test-id="success-state">
      <h2>Payment Successful!</h2>
      <span data-test-id="success-message">
        Your payment has been processed successfully
      </span>
    </div>
  );
}
