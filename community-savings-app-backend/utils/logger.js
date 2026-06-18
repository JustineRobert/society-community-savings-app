// utils/logger.js
'use strict';

const { createLogger, format, transports } = require("winston");
require("winston-mongodb");

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: "titech-fintech-api" },
  transports: [
    // ✅ Console transport (development + production fallback)
    new transports.Console({
      handleExceptions: true,
      format:
        process.env.NODE_ENV !== "production"
          ? format.combine(format.colorize(), format.simple())
          : format.json(),
    }),

    // ✅ MongoDB transport (audit trail, only if AUDIT_LOG_URI is set)
    ...(process.env.AUDIT_LOG_URI
      ? [
          new transports.MongoDB({
            db: process.env.AUDIT_LOG_URI,
            collection: "auditlogs",
            options: { useUnifiedTopology: true },
          }),
        ]
      : []),
  ],
  exitOnError: false,
});

/**
 * Helper: log with correlation ID (requestId)
 */
logger.withRequest = (requestId) => ({
  info: (msg, meta = {}) => logger.info(msg, { requestId, ...meta }),
  warn: (msg, meta = {}) => logger.warn(msg, { requestId, ...meta }),
  error: (msg, meta = {}) => logger.error(msg, { requestId, ...meta }),
  debug: (msg, meta = {}) => logger.debug(msg, { requestId, ...meta }),
});

module.exports = logger;
