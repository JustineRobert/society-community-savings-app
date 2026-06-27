// backend/errors/ConflictError.js
'use strict';

const ApiError = require('./ApiError');

class ConflictError extends ApiError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

module.exports = ConflictError;
