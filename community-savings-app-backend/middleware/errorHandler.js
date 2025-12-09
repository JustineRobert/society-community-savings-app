// middleware/errorHandler.js

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * Must be added after all other middleware and routes
 */
const errorHandler = (err, req, res, next) => {
  const errorId = uuidv4();
  const timestamp = new Date().toISOString();

  // Log error with unique ID for tracking
  logger.error('Error occurred', {
    errorId,
    timestamp,
    method: req.method,
    url: req.path,
    statusCode: err.statusCode || 500,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId: req.user?.id,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      errorId,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message),
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      errorId,
      message: `${field} already exists`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      errorId,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      errorId,
      message: 'Token has expired',
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong';

  res.status(statusCode).json({
    errorId,
    message,
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  asyncHandler,
};
