// ============================================================================
// TITech Community Capital – Frontend Logger
// File: src/utils/logger.js
// Production-grade
// ============================================================================

/**
 * Lightweight frontend logger
 *
 * - Provides consistent logging methods (info, warn, error, debug)
 * - Adds timestamps and service name for clarity
 * - Redacts sensitive fields from metadata before printing
 * - Environment-aware: verbose in development, minimal in production
 */

const SERVICE_NAME = 'community-savings-frontend';
const NODE_ENV = import.meta.env.MODE || 'development';

// Redact sensitive fields from metadata
function redactMeta(meta = {}) {
  const clone = { ...meta };
  const sensitiveKeys = [
    'authorization',
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'cookie',
    'set-cookie',
  ];
  for (const key of Object.keys(clone)) {
    const lower = key.toLowerCase();
    if (sensitiveKeys.includes(lower) || sensitiveKeys.some((s) => lower.includes(s))) {
      clone[key] = '[REDACTED]';
    }
  }
  return clone;
}

// Format log entry
function format(level, msg, meta) {
  const time = new Date().toISOString();
  const safeMeta = redactMeta(meta);
  const metaStr = Object.keys(safeMeta).length ? safeMeta : '';
  return `[${time}] [${SERVICE_NAME}] ${level}: ${msg}${metaStr ? ' ' + JSON.stringify(metaStr) : ''}`;
}

const logger = {
  info: (msg, meta = {}) => {
    if (NODE_ENV !== 'production') {
      console.info(format('INFO', msg, meta));
    } else {
      console.info(msg, redactMeta(meta));
    }
  },
  warn: (msg, meta = {}) => {
    console.warn(format('WARN', msg, meta));
  },
  error: (msg, meta = {}) => {
    console.error(format('ERROR', msg, meta));
  },
  debug: (msg, meta = {}) => {
    if (NODE_ENV === 'development') {
      console.debug(format('DEBUG', msg, meta));
    }
  },
};

export default logger;
