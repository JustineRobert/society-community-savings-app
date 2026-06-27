// backend/errors/BadRequestError.js
'use strict';

const ApiError = require('./ApiError');

class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

module.exports = BadRequestError;
