// backend/errors/NotFoundError.js
'use strict';

const ApiError = require('./ApiError');

class NotFoundError extends ApiError {
  constructor(message = 'Not Found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

module.exports = NotFoundError;
