#!/usr/bin/env node

/**
 * SDK Builder Script
 * Bundles the PaymentGateway SDK with styles and makes it available as checkout.js
 */

const fs = require("fs");
const path = require("path");

const sdkPath = path.resolve(__dirname, "src/sdk/PaymentGateway.js");
const stylesPath = path.resolve(__dirname, "src/sdk/styles.css");
const outputPath = path.resolve(__dirname, "dist/checkout.js");
const distDir = path.resolve(__dirname, "dist");

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Read SDK and styles
const sdkCode = fs.readFileSync(sdkPath, "utf-8");
const styles = fs.readFileSync(stylesPath, "utf-8");

// Create UMD bundle that includes styles
const umdBundle = `
(function(root) {
  "use strict";

  // Inject styles
  function injectStyles() {
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(styles)};
      document.head.appendChild(style);
    }
  }

  // PaymentGateway class definition
  ${sdkCode}

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentGateway;
  }
  
  // UMD export
  if (typeof define === 'function' && define.amd) {
    define([], function() { return PaymentGateway; });
  }
  
  // Global browser export
  if (typeof window !== 'undefined') {
    window.PaymentGateway = PaymentGateway;
    injectStyles();
  }
  
})(typeof self !== 'undefined' ? self : this);
`;

// Write the bundle
fs.writeFileSync(outputPath, umdBundle.trim(), "utf-8");
console.log("✅ SDK bundle created:", outputPath);
