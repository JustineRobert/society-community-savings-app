// ============================================================================
// TITech Community Capital
// Production-grade Logger & Observability Service
// File: backend/utils/logger.js
// Multi-Tenant | Distributed Tracing | Audit | OpenTelemetry Ready
// ============================================================================

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { createLogger, format, transports } = require('winston');

const {
  combine,
  timestamp,
  printf,
  json,
  errors,
  colorize,
  splat,
  metadata,
  label,
} = format;

// Optional dependencies
let MongoDBTransport;
let DailyRotateFile;

try {
  MongoDBTransport =
    require('winston-mongodb').MongoDB;
} catch (_) {
  MongoDBTransport = null;
}

try {
  DailyRotateFile =
    require('winston-daily-rotate-file');
} catch (_) {
  DailyRotateFile = null;
}

// Optional context integration
let requestContext = null;

function loadRequestContext() {
  if (requestContext) {
    return requestContext;
  }

  try {
    requestContext = require('../middleware/requestContext');
  } catch (_) {
    requestContext = null;
  }

  return requestContext;
}

const LOG_LEVEL =
  process.env.LOG_LEVEL || 'info';

const NODE_ENV =
  process.env.NODE_ENV ||
  'development';

const LOG_DIR =
  process.env.LOG_DIR ||
  path.join(
    process.cwd(),
    'logs'
  );

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  'titech-fintech-api';

const SERVICE_VERSION =
  process.env.SERVICE_VERSION ||
  '1.0.0';

const HOSTNAME =
  os.hostname();

const AUDIT_LOG_URI =
  process.env.AUDIT_LOG_URI ||
  process.env.MONGO_AUDIT_URI ||
  null;

const ENABLE_FILE_LOGGING =
  process.env
    .ENABLE_FILE_LOGGING !==
  'false';

const ENABLE_CONSOLE_LOGGING =
  process.env
    .ENABLE_CONSOLE_LOGGING !==
  'false';

/**
 * ============================================================================
 * Ensure Log Directory
 * ============================================================================
 */

if (
  ENABLE_FILE_LOGGING &&
  !fs.existsSync(LOG_DIR)
) {
  try {
    fs.mkdirSync(LOG_DIR, {
      recursive: true,
    });
  } catch (_) {}
}

/**
 * ============================================================================
 * Sensitive Data Redaction
 * ============================================================================
 */

const SENSITIVE_KEYS = [
  'authorization',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'cookie',
  'set-cookie',
  'pin',
  'otp',
  'secret',
  'privatekey',
  'apikey',
  'api-key',
  'cardnumber',
  'cvv',
  'nationalid',
  'nin',
  'ssn',
];

function redactMeta(
  meta = {}
) {
  try {
    const clone =
      JSON.parse(
        JSON.stringify(meta)
      );

    function scrub(obj) {
      if (
        !obj ||
        typeof obj !== 'object'
      ) {
        return;
      }

      for (const key of Object.keys(
        obj
      )) {
        const lower =
          key.toLowerCase();

        if (
          SENSITIVE_KEYS.includes(
            lower
          ) ||
          SENSITIVE_KEYS.some(
            k =>
              lower.includes(
                k
              )
          )
        ) {
          obj[key] =
            '[REDACTED]';
        } else if (
          typeof obj[
            key
          ] === 'object'
        ) {
          scrub(obj[key]);
        }
      }
    }

    scrub(clone);

    return clone;
  } catch (_) {
    return {};
  }
}

/**
 * ============================================================================
 * Request Context Injection
 * ============================================================================
 */

function getRequestMeta() {
  try {
    const contextModule =
      loadRequestContext();

    if (
      !contextModule ||
      typeof contextModule.getContext !==
        'function'
    ) {
      return {};
    }

    const ctx =
      contextModule.getContext() || {};

    return {
      requestId:
        ctx.requestId,
      correlationId:
        ctx.correlationId,
      traceId:
        ctx.traceId,
      spanId:
        ctx.spanId,
      tenantId:
        ctx.tenantId,
      userId:
        ctx.userId,
    };
  } catch (_) {
    return {};
  }
}

/**
 * ============================================================================
 * Development Console Formatter
 * ============================================================================
 */

const devConsoleFormat =
  printf(
    ({
      level,
      message,
      timestamp: ts,
      stack,
      ...meta
    }) => {
      const metadata =
        redactMeta(meta);

      const metaString =
        Object.keys(
          metadata
        ).length
          ? `\n${JSON.stringify(
              metadata,
              null,
              2
            )}`
          : '';

      return `${ts} [${SERVICE_NAME}] ${level}: ${message}${
        stack
          ? `\n${stack}`
          : ''
      }${metaString}`;
    }
  );

/**
 * ============================================================================
 * Production JSON Formatter
 * ============================================================================
 */

const productionFormat =
  combine(
    timestamp(),
    errors({
      stack: true,
    }),
    splat(),
    metadata(),
    json()
  );

/**
 * ============================================================================
 * Transport Configuration
 * ============================================================================
 */

const transportList = [];

/**
 * Console
 */
if (
  ENABLE_CONSOLE_LOGGING
) {
  transportList.push(
    new transports.Console({
      level:
        LOG_LEVEL,
      handleExceptions:
        true,
      format:
        NODE_ENV ===
        'production'
          ? productionFormat
          : combine(
              colorize(),
              timestamp(),
              errors({
                stack: true,
              }),
              splat(),
              devConsoleFormat
            ),
    })
  );
}

/**
 * Daily Rotation
 */
if (
  ENABLE_FILE_LOGGING
) {
  if (
    DailyRotateFile
  ) {
    transportList.push(
      new DailyRotateFile(
        {
          level:
            LOG_LEVEL,
          filename:
            path.join(
              LOG_DIR,
              '%DATE%-application.log'
            ),
          datePattern:
            'YYYY-MM-DD',
          zippedArchive:
            true,
          maxSize:
            '20m',
          maxFiles:
            '30d',
          handleExceptions:
            true,
          format:
            productionFormat,
        }
      )
    );

    transportList.push(
      new DailyRotateFile(
        {
          level:
            'error',
          filename:
            path.join(
              LOG_DIR,
              '%DATE%-error.log'
            ),
          datePattern:
            'YYYY-MM-DD',
          zippedArchive:
            true,
          maxSize:
            '20m',
          maxFiles:
            '60d',
          handleExceptions:
            true,
          format:
            productionFormat,
        }
      )
    );
  } else {
    transportList.push(
      new transports.File({
        level:
          LOG_LEVEL,
        filename:
          path.join(
            LOG_DIR,
            'application.log'
          ),
        maxsize:
          20 *
          1024 *
          1024,
        maxFiles:
          10,
        handleExceptions:
          true,
        format:
          productionFormat,
      })
    );
  }
}

/**
 * MongoDB Audit Logs
 */
if (
  AUDIT_LOG_URI &&
  MongoDBTransport
) {
  transportList.push(
    new MongoDBTransport({
      db: AUDIT_LOG_URI,
      collection:
        'auditlogs',
      level: 'info',
      tryReconnect:
        true,
      options: {
        useUnifiedTopology:
          true,
      },
      format:
        productionFormat,
    })
  );
}

/**
 * ============================================================================
 * Logger Instance
 * ============================================================================
 */

const logger =
  createLogger({
    level: LOG_LEVEL,
    defaultMeta: {
      service:
        SERVICE_NAME,
      version:
        SERVICE_VERSION,
      environment:
        NODE_ENV,
      hostname:
        HOSTNAME,
    },
    transports:
      transportList,
    exitOnError:
      false,
  });

/**
 * ============================================================================
 * Request Context Injection
 * ============================================================================
 */

function enrich(meta = {}) {
  return {
    ...getRequestMeta(),
    ...redactMeta(meta),
  };
}

/**
 * ============================================================================
 * Morgan Stream
 * ============================================================================
 */

logger.stream = {
  write(message) {
    logger.info(
      message.trim()
    );
  },
};

/**
 * ============================================================================
 * Child Logger
 * ============================================================================
 */

logger.child =
  function (
    baseMeta = {}
  ) {
    const meta =
      enrich(baseMeta);

    return {
      info(
        msg,
        extra = {}
      ) {
        logger.info(
          msg,
          {
            ...meta,
            ...enrich(
              extra
            ),
          }
        );
      },

      warn(
        msg,
        extra = {}
      ) {
        logger.warn(
          msg,
          {
            ...meta,
            ...enrich(
              extra
            ),
          }
        );
      },

      error(
        msg,
        extra = {}
      ) {
        logger.error(
          msg,
          {
            ...meta,
            ...enrich(
              extra
            ),
          }
        );
      },

      debug(
        msg,
        extra = {}
      ) {
        logger.debug(
          msg,
          {
            ...meta,
            ...enrich(
              extra
            ),
          }
        );
      },
    };
  };

/**
 * ============================================================================
 * Request Logger
 * ============================================================================
 */

logger.withRequest =
  function (
    requestId,
    extra = {}
  ) {
    return logger.child({
      requestId,
      ...extra,
    });
  };

logger.infoWith =
  (
    requestId,
    msg,
    meta = {}
  ) =>
    logger
      .withRequest(
        requestId
      )
      .info(
        msg,
        meta
      );

logger.warnWith =
  (
    requestId,
    msg,
    meta = {}
  ) =>
    logger
      .withRequest(
        requestId
      )
      .warn(
        msg,
        meta
      );

logger.errorWith =
  (
    requestId,
    msg,
    meta = {}
  ) =>
    logger
      .withRequest(
        requestId
      )
      .error(
        msg,
        meta
      );

/**
 * ============================================================================
 * Structured Audit Logging
 * ============================================================================
 */

logger.audit =
  function (
    action,
    metadata = {}
  ) {
    logger.info(
      `AUDIT:${action}`,
      enrich({
        audit: true,
        action,
        ...metadata,
      })
    );
  };

/**
 * ============================================================================
 * Performance Logging
 * ============================================================================
 */

logger.performance =
  function (
    operation,
    duration,
    metadata = {}
  ) {
    logger.info(
      `PERFORMANCE:${operation}`,
      enrich({
        duration,
        operation,
        ...metadata,
      })
    );
  };

/**
 * ============================================================================
 * Security Logging
 * ============================================================================
 */

logger.security =
  function (
    event,
    metadata = {}
  ) {
    logger.warn(
      `SECURITY:${event}`,
      enrich(metadata)
    );
  };

/**
 * ============================================================================
 * Startup Banner
 * ============================================================================
 */

logger.startup =
  function (
    message,
    metadata = {}
  ) {
    logger.info(
      `STARTUP:${message}`,
      enrich(metadata)
    );
  };

/**
 * ============================================================================
 * Shutdown Banner
 * ============================================================================
 */

logger.shutdown =
  function (
    message,
    metadata = {}
  ) {
    logger.info(
      `SHUTDOWN:${message}`,
      enrich(metadata)
    );
  };

/**
 * ============================================================================
 * Degraded Mode Logging
 * ============================================================================
 */

let degradedLogged =
  false;

logger.logDegradedOnce =
  function (
    message,
    metadata = {}
  ) {
    if (
      degradedLogged
    ) {
      return;
    }

    degradedLogged =
      true;

    logger.warn(
      message,
      enrich(metadata)
    );
  };

/**
 * ============================================================================
 * Process Exception Handling
 * ============================================================================
 */

logger.handleUncaught =
  function () {
    process.on(
      'unhandledRejection',
      reason => {
        logger.error(
          'Unhandled Rejection',
          {
            reason:
              reason?.stack ||
              reason,
          }
        );
      }
    );

    process.on(
      'uncaughtException',
      error => {
        logger.error(
          'Uncaught Exception',
          {
            error:
              error?.stack ||
              error,
          }
        );

        setTimeout(
          () =>
            process.exit(
              1
            ),
          1000
        );
      }
    );
  };

/**
 * ============================================================================
 * Startup Log
 * ============================================================================
 */

logger.startup(
  'Logger initialized',
  {
    level:
      LOG_LEVEL,
    environment:
      NODE_ENV,
    service:
      SERVICE_NAME,
    version:
      SERVICE_VERSION,
    hostname:
      HOSTNAME,
  }
);

/**
 * ============================================================================
 * Export
 * ============================================================================
 */

module.exports = logger;