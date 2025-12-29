
// middleware/errorHandler.js
// ============================================================================
// Global Error Handler for Community Savings App
// - Centralizes API error responses with consistent shape.
// - Logs structured details with correlation ID (requestId).
// - Avoids leaking internals in production.
// ============================================================================

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const isProd = (process.env.NODE_ENV || 'development') === 'production';

/**
 * Normalize an error object into a consistent shape.
 * Adds message, type, and optional details based on environment.
 * @param {Error} err
 * @returns {{type: string, message: string, statusCode?: number, details?: any}}
 */
function normalizeError(err) {
  if (!err) {
    return { type: 'UnknownError', message: 'Unknown error occurred' };
  }
  const name = err.name || 'Error';
  const message = err.message || 'Something went wrong';
  return {
    type: name,
    message,
    statusCode: err.statusCode,
    // Only attach additional details in non-production for easier debugging
    ...(isProd ? {} : { details: pickDebugDetails(err) }),
  };
}

/**
 * Picks safe debug details from an error (non-production).
 * Avoids serializing huge or sensitive structures.
 */
function pickDebugDetails(err) {
  const out = {};
  if (err.code != null) out.code = err.code;
  if (err.path != null) out.path = err.path;
  if (err.kind != null) out.kind = err.kind;
  if (err.type != null) out.type = err.type;
  if (err.name) out.name = err.name;
  // Include stack only in development
  if (process.env.NODE_ENV === 'development' && err.stack) out.stack = err.stack;
  return out;
}

/**
 * Consistent JSON response envelope for errors
 * @param {object} opts
 * @param {string} opts.errorId
 * @param {number} opts.statusCode
 * @param {string} opts.message
 * @param {string} [opts.type]
 * @param {any} [opts.errors]   // list of validation field errors
 * @param {any} [opts.meta]     // extra info when not in production
 */
function sendError(res, { errorId, statusCode, message, type, errors, meta }) {
  const payload = {
    errorId,
    message,
    ...(type ? { type } : {}),
    ...(Array.isArray(errors) && errors.length ? { errors } : {}),
    ...(!isProd && meta ? { meta } : {}),
  };
  res.status(statusCode).json(payload);
}

/**
 * Global Error Handler Middleware
 * Must be added after all other middleware and routes.
 */
const errorHandler = (err, req, res, next) => {
  // Prefer the requestId provided by server.js middleware; fallback to a new UUID
  const errorId = req.requestId || uuidv4();
  const statusFromErr = err?.statusCode;

  // --------------------------------------------------------------------------
  // Structured logging (never throw from logger)
  // --------------------------------------------------------------------------
  try {
    logger.error('Unhandled error', {
      errorId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: statusFromErr || 500,
      message: err?.message,
      name: err?.name,
      code: err?.code,
      userId: req.user?.id,
      ip: req.ip,
      // Only include stack in development to avoid leaking internals in prod
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    });
  } catch (_) {
    // swallow logging errors
  }

  // --------------------------------------------------------------------------
  // Error Type Handling (specific to libs we use)
  // --------------------------------------------------------------------------

  // 1) Express JSON body parser errors (e.g., malformed JSON)
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return sendError(res, {
      errorId,
      statusCode: 400,
      message: 'Invalid JSON payload',
      type: 'BadRequest',
    });
  }

  // 2) express-validator errors (usually thrown via custom handler)
  // If your `handleValidation` forwards errors, you might receive a structured object.
  if (Array.isArray(err?.errors) && err?.status === 400) {
    return sendError(res, {
      errorId,
      statusCode: 400,
      message: 'Validation error',
      type: 'ValidationError',
      errors: err.errors.map((e) => ({
        field: e.param,
        message: e.msg,
      })),
      meta: normalizeError(err),
    });
  }

  // 3) Mongoose ValidationError
  if (err.name === 'ValidationError') {
    return sendError(res, {
      errorId,
      statusCode: 400,
      message: 'Validation error',
      type: 'ValidationError',
      errors: Object.values(err.errors || {}).map((e) => e.message),
    });
  }

  // 4) Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, {
      errorId,
      statusCode: 400,
      message: `Invalid value for '${err.path}'`,
      type: 'CastError',
      meta: normalizeError(err),
    });
  }

  // 5) Mongoose duplicate key error
  if (err.code === 11000) {
    const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : 'field';
    return sendError(res, {
      errorId,
      statusCode: 400,
      message: `${field} already exists`,
      type: 'DuplicateKey',
      meta: normalizeError(err),
    });
  }

  // 6) JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, {
      errorId,
      statusCode: 401,
      message: 'Invalid token',
      type: 'AuthError',
    });
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, {
      errorId,
      statusCode: 401,
      message: 'Token has expired',
      type: 'AuthError',
    });
  }

  // 7) Multer/File upload errors
  if (err.name === 'MulterError') {
    return sendError(res, {
      errorId,
      statusCode: 400,
      message: err.message || 'File upload error',
      type: 'UploadError',
      meta: normalizeError(err),
    });
  }

  // 8) CORS errors (from our CORS origin callback)
  if (err.message === 'Not allowed by CORS') {
    return sendError(res, {
      errorId,
      statusCode: 403,
      message: 'Origin not allowed',
      type: 'CorsError',
    });
  }

  // 9) Rate limit errors (express-rate-limit custom handler generally sends the response itself)
  // But if one bubbles up, handle gracefully:
  if (err.name === 'RateLimitError') {
    return sendError(res, {
      errorId,
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      type: 'RateLimitError',
    });
  }

  // --------------------------------------------------------------------------
  // Default error response
  // --------------------------------------------------------------------------
  const normalized = normalizeError(err);
  const statusCode = Number.isInteger(statusFromErr) ? statusFromErr : 500;

  return sendError(res, {
    errorId,
    statusCode,
    message:
      statusCode >= 500
        ? 'Internal server error'
        : normalized.message || 'Request failed',
    type: normalized.type || (statusCode >= 500 ? 'InternalError' : 'Error'),
    meta: normalized,
  });
};

module.exports = {
  errorHandler,
};
