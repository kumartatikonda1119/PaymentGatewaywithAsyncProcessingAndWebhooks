// Validate VPA (UPI address)
function isValidVPA(vpa) {
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
  return regex.test(vpa);
}

// Luhn card validation
function luhnCheck(cardNumber) {
  const num = cardNumber.replace(/\D/g, "");

  if (num.length < 13 || num.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

// Detect card network
function detectNetwork(cardNumber) {
  const n = cardNumber.replace(/\D/g, "");

  if (n.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(60|65|8[1-9])/.test(n)) return "rupay";

  return "unknown";
}

function isValidExpiry(month, year) {
  let mm = parseInt(month);
  let yy = parseInt(year);

  if (isNaN(mm) || mm < 1 || mm > 12) return false;

  // convert 2-digit years → 20XX
  if (yy < 100) {
    yy = 2000 + yy;
  }

  const now = new Date();
  const expiry = new Date(yy, mm - 1, 1);

  // valid if same month or future
  return expiry >= new Date(now.getFullYear(), now.getMonth(), 1);
}

module.exports = {
  isValidVPA,
  luhnCheck,
  detectNetwork,
  isValidExpiry
};
