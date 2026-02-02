// middleware/idempotency.js
// ============================================================================
// Idempotency Middleware
// Prevents duplicate processing of identical requests
// ============================================================================

const crypto = require('crypto');
const logger = require('../utils/logger');

// In-memory cache (replace with Redis for production)
const idempotencyCache = new Map();

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Clean up every hour

/**
 * Cleanup expired idempotency keys
 */
function startCleanupJob() {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of idempotencyCache.entries()) {
      if (now - entry.timestamp > IDEMPOTENCY_TTL_MS) {
        idempotencyCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[Idempotency] Cleaned up ${cleaned} expired entries`);
    }
  }, CLEANUP_INTERVAL_MS);
}

// Start cleanup on first load
startCleanupJob();

/**
 * Extract idempotency key from request
 */
function getIdempotencyKey(req) {
  // Try custom headers
  let key = req.get('Idempotency-Key') || req.get('X-Idempotency-Key');

  if (!key) {
    // Generate from method, path, and body
    const bodyStr = JSON.stringify(req.body || {});
    const bodyHash = crypto
      .createHash('sha256')
      .update(bodyStr)
      .digest('hex')
      .substring(0, 16);

    key = `${req.method}:${req.path}:${bodyHash}`;
  }

  return key;
}

/**
 * Idempotency middleware
 * - Prevents duplicate processing
 * - Returns cached response if request is retried
 * - Only applies to POST/PUT/PATCH/DELETE
 */
function idempotencyMiddleware(req, res, next) {
  // Only apply to mutation methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const key = getIdempotencyKey(req);

  // Check cache
  const cached = idempotencyCache.get(key);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
    logger.debug(`[Idempotency] Cache hit for key: ${key}`);

    res.set('Idempotency-Replayed', 'true');

    if (cached.status) {
      return res.status(cached.status).json(cached.response);
    }

    if (cached.error) {
      return res.status(cached.errorStatus || 500).json({
        message: cached.error,
        idempotencyKey: key,
      });
    }
  }

  // Store original response methods
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = 200;

  // Override res.status to capture status code
  res.status = function (code) {
    statusCode = code;
    return originalStatus(code);
  };

  // Override res.json to cache response
  res.json = function (data) {
    // Cache successful response
    if (statusCode >= 200 && statusCode < 300) {
      idempotencyCache.set(key, {
        status: statusCode,
        response: data,
        timestamp: Date.now(),
      });

      logger.debug(`[Idempotency] Cached response for key: ${key}`);
    }

    return originalJson(data);
  };

  // Store key in request for later use
  req.idempotencyKey = key;

  next();
}

/**
 * Idempotency error handler
 * Caches error responses too (to prevent retry storms)
 */
function idempotencyErrorHandler(err, req, res, next) {
  if (!req.idempotencyKey || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorMessage = err.message || 'Internal server error';

  // Cache error
  idempotencyCache.set(req.idempotencyKey, {
    error: errorMessage,
    errorStatus: statusCode,
    timestamp: Date.now(),
  });

  logger.debug(`[Idempotency] Cached error for key: ${req.idempotencyKey}`);

  next(err);
}

/**
 * Clear idempotency cache (for testing/admin)
 */
function clearIdempotencyCache(key = null) {
  if (key) {
    idempotencyCache.delete(key);
  } else {
    idempotencyCache.clear();
  }
}

/**
 * Get idempotency cache statistics
 */
function getIdempotencyCacheStats() {
  return {
    size: idempotencyCache.size,
    entries: Array.from(idempotencyCache.entries()).map(([key, entry]) => ({
      key,
      status: entry.status,
      error: entry.error,
      age: Date.now() - entry.timestamp,
    })),
  };
}

module.exports = {
  idempotencyMiddleware,
  idempotencyErrorHandler,
  clearIdempotencyCache,
  getIdempotencyCacheStats,
  getIdempotencyKey,
};
