// backend/errors/PaymentRequiredError.js
'use strict';

const ApiError = require('./ApiError');

class PaymentRequiredError extends ApiError {
  constructor(message = 'Payment Required', details = null) {
    super(message, 402, 'PAYMENT_REQUIRED', details);
  }
}

module.exports = PaymentRequiredError;
