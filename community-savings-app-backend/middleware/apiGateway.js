// middlewares/apiGateway.js
'use strict';

const logger = require('../middleware/logging'); // structured logger
const ERROR_CODES = require('../utils/errorCodes'); // optional
const AppError = require('../utils/AppError'); // optional

const DEFAULT_PHONE = '256772123546';

module.exports = (req, res, next) => {
  // Basic auth check
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({
      success: false,
      message: 'Missing API token',
    });
  }

  // Attach gateway metadata for downstream handlers
  req.gateway = {
    source: 'public-api',
    requestId: req.requestId || res.getHeader('X-Request-Id') || null,
    defaultPhone: DEFAULT_PHONE,
    // placeholder for routing tags, rate limit keys, client id, etc.
    tags: {
      rateLimitKey: req.headers['x-api-key'] || req.ip,
    },
  };

  // Optional: quick validation helper that controllers can use
  req.gateway.validatePhone = (phone) => {
    if (!phone) return DEFAULT_PHONE;
    // simple MSISDN normalization: remove non-digits and ensure country code present
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length >= 9 && digits.startsWith('0')) {
      // example transform: 0772123546 -> 256772123546
      return `256${digits.slice(1)}`;
    }
    return digits;
  };

  // Rate limiting or routing hook (implement your limiter here)
  // Example: req.gateway.rateLimited = await rateLimiter.check(req.gateway.tags.rateLimitKey);
  // If rate limited, you could return 429 here.

  logger.debug('Gateway metadata attached', {
    requestId: req.gateway.requestId,
    source: req.gateway.source,
    rateLimitKey: req.gateway.tags.rateLimitKey,
  });

  next();
};
