// ============================================================================
// TITech Community Capital
// Production-grade logger
// File: backend/utils/logger.js
// ============================================================================

'use strict';

const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');

const { combine, timestamp, printf, json, errors, colorize, splat } = format;

// Optional transports
let MongoDBTransport;
let DailyRotateFile;
try {
  MongoDBTransport = require('winston-mongodb').MongoDB;
} catch (_) {
  MongoDBTransport = null;
}
try {
  DailyRotateFile = require('winston-daily-rotate-file');
} catch (_) {
  DailyRotateFile = null;
}

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const AUDIT_LOG_URI = process.env.AUDIT_LOG_URI || process.env.MONGO_AUDIT_URI || null;
const SERVICE_NAME = process.env.SERVICE_NAME || 'titech-fintech-api';

// Ensure log directory exists for file transports
if (LOG_DIR && !fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    // ignore directory creation errors; console fallback will still work
  }
}

// Redact sensitive fields from metadata
function redactMeta(meta = {}) {
  const clone = JSON.parse(JSON.stringify(meta));
  const sensitiveKeys = ['authorization', 'password', 'token', 'accessToken', 'refreshToken', 'cookie', 'set-cookie'];
  function scrub(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.includes(lower) || sensitiveKeys.some((s) => lower.includes(s))) {
        obj[k] = '[REDACTED]';
      } else if (typeof obj[k] === 'object') {
        scrub(obj[k]);
      }
    }
  }
  scrub(clone);
  return clone;
}

// Human readable console format for development
const devConsoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const time = ts || new Date().toISOString();
  const metaObj = redactMeta(meta);
  const metaStr = Object.keys(metaObj).length ? `\n${JSON.stringify(metaObj, null, 2)}` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${time} [${SERVICE_NAME}] ${level}: ${message}${stackStr}${metaStr}`;
});

// JSON format for production with error stack
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

// Build transports list
const transportList = [];

// Console transport
transportList.push(
  new transports.Console({
    level: LOG_LEVEL,
    handleExceptions: true,
    format: NODE_ENV === 'production' ? productionFormat : combine(colorize(), timestamp(), errors({ stack: true }), splat(), devConsoleFormat),
  })
);

// Optional daily rotate file transport for persistent logs
if (DailyRotateFile) {
  transportList.push(
    new DailyRotateFile({
      level: LOG_LEVEL,
      filename: path.join(LOG_DIR, '%DATE%-app.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      handleExceptions: true,
      format: combine(timestamp(), errors({ stack: true }), splat(), json()),
    })
  );
} else {
  // Fallback file transport if daily rotate not available
  transportList.push(
    new transports.File({
      level: LOG_LEVEL,
      filename: path.join(LOG_DIR, 'app.log'),
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5,
      handleExceptions: true,
      format: combine(timestamp(), errors({ stack: true }), splat(), json()),
    })
  );
}

// Optional audit log to MongoDB
if (AUDIT_LOG_URI && MongoDBTransport) {
  transportList.push(
    new MongoDBTransport({
      level: 'info',
      db: AUDIT_LOG_URI,
      collection: 'auditlogs',
      tryReconnect: true,
      options: { useUnifiedTopology: true },
      format: combine(timestamp(), errors({ stack: true }), splat(), json()),
    })
  );
}

// Create logger
const logger = createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: SERVICE_NAME },
  transports: transportList,
  exitOnError: false,
});

// Stream for morgan
logger.stream = {
  write: (message) => {
    const trimmed = message && message.trim ? message.trim() : message;
    logger.info(trimmed);
  },
};

// Helper: create child logger with requestId and extra meta
logger.withRequest = (requestId, extra = {}) => {
  const childMeta = { requestId, ...extra };
  return {
    info: (msg, meta = {}) => logger.info(msg, { ...childMeta, ...redactMeta(meta) }),
    warn: (msg, meta = {}) => logger.warn(msg, { ...childMeta, ...redactMeta(meta) }),
    error: (msg, meta = {}) => logger.error(msg, { ...childMeta, ...redactMeta(meta) }),
    debug: (msg, meta = {}) => logger.debug(msg, { ...childMeta, ...redactMeta(meta) }),
  };
};

// Convenience wrappers
logger.infoWith = (requestId, msg, meta = {}) => logger.withRequest(requestId).info(msg, meta);
logger.warnWith = (requestId, msg, meta = {}) => logger.withRequest(requestId).warn(msg, meta);
logger.errorWith = (requestId, msg, meta = {}) => logger.withRequest(requestId).error(msg, meta);

// Expose a function to create a child logger with static meta
logger.child = (meta = {}) => {
  const safeMeta = redactMeta(meta);
  return {
    info: (msg, m = {}) => logger.info(msg, { ...safeMeta, ...redactMeta(m) }),
    warn: (msg, m = {}) => logger.warn(msg, { ...safeMeta, ...redactMeta(m) }),
    error: (msg, m = {}) => logger.error(msg, { ...safeMeta, ...redactMeta(m) }),
    debug: (msg, m = {}) => logger.debug(msg, { ...safeMeta, ...redactMeta(m) }),
  };
};

// Handle uncaught exceptions and unhandled rejections
logger.handleUncaught = () => {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason: reason && reason.stack ? reason.stack : reason });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err && err.stack ? err.stack : err });
    // allow transports to flush then exit
    setTimeout(() => process.exit(1), 500);
  });
};

// Expose a small helper to log degraded mode once
let degradedLogged = false;
logger.logDegradedOnce = (msg, meta = {}) => {
  if (!degradedLogged) {
    degradedLogged = true;
    logger.warn(msg, redactMeta(meta));
  }
};

// Export logger
module.exports = logger;
