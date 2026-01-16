import { useEffect } from "react";

export default function Failure() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbedded = params.get("embedded") === "true";
    
    if (isEmbedded) {
      const error = params.get("error") || "Payment failed";
      window.parent.postMessage({
        type: 'payment_failed',
        data: { error }
      }, '*');
    }
  }, []);

  return (
    <div className="page" data-test-id="error-state">
      <h2>Payment Failed</h2>

      <span data-test-id="error-message">
        Payment could not be processed
      </span>

      <button data-test-id="retry-button" onClick={() => window.history.back()}>
        Try Again
      </button>
    </div>
  );
}
