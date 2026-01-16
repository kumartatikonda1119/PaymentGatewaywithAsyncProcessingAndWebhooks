class PaymentGateway {
  constructor(options = {}) {
    if (!options.key) {
      throw new Error('API key is required');
    }
    if (!options.orderId) {
      throw new Error('Order ID is required');
    }

    this.key = options.key;
    this.orderId = options.orderId;
    this.onSuccess = options.onSuccess || (() => {});
    this.onFailure = options.onFailure || (() => {});
    this.onClose = options.onClose || (() => {});
    
    this.modal = null;
    this.iframe = null;
  }

  open() {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'pg-modal-overlay';
    modalOverlay.setAttribute('data-test-id', 'payment-modal');
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'pg-modal-content';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'pg-close-button';
    closeButton.setAttribute('data-test-id', 'close-modal-button');
    closeButton.innerHTML = '×';
    closeButton.onclick = () => this.close();
    
    // Create iframe
    const checkoutUrl = `http://localhost:3001/checkout?order_id=${encodeURIComponent(this.orderId)}&embedded=true`;
    this.iframe = document.createElement('iframe');
    this.iframe.src = checkoutUrl;
    this.iframe.className = 'pg-iframe';
    this.iframe.setAttribute('data-test-id', 'payment-iframe');
    this.iframe.setAttribute('frameborder', '0');
    this.iframe.setAttribute('allowfullscreen', 'true');
    
    // Append elements
    modalContent.appendChild(closeButton);
    modalContent.appendChild(this.iframe);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    this.modal = modalOverlay;
    
    // Setup postMessage listener
    this.setupMessageListener();
  }

  setupMessageListener() {
    this.messageHandler = (event) => {
      // In production, validate origin
      if (event.data.type === 'payment_success') {
        this.onSuccess(event.data.data);
        this.close();
      } else if (event.data.type === 'payment_failed') {
        this.onFailure(event.data.data);
      } else if (event.data.type === 'close_modal') {
        this.close();
      }
    };
    
    window.addEventListener('message', this.messageHandler);
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    this.onClose();
  }
}

// Expose globally
window.PaymentGateway = PaymentGateway;
