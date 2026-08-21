'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/logger.js
 *
 * Purpose:
 *   Enterprise production-grade structured logging foundation.
 *
 * Responsibilities:
 *   - Initialize the application logger before infrastructure startup.
 *   - Provide structured JSON logging in production.
 *   - Support human-readable development logs.
 *   - Redact secrets and sensitive financial/security fields.
 *   - Support request/correlation/trace context via AsyncLocalStorage.
 *   - Provide child loggers.
 *   - Provide audit/security/financial logging helpers.
 *   - Expose a stable logger API to the whole application.
 *   - Integrate with bootstrap/hooks lifecycle.
 *   - Flush logs during graceful shutdown.
 *   - Prevent duplicate logger initialization.
 *   - Never expose secrets through logger diagnostics.
 *
 * Architectural position:
 *
 *   environment.js
 *       ↓
 *   config/index.js
 *       ↓
 *   logger.js
 *       ↓
 *   observability
 *       ↓
 *   resilience
 *       ↓
 *   database / Redis / queue / event-bus
 *       ↓
 *   middleware
 *       ↓
 *   routes / services
 *
 * IMPORTANT:
 *
 *   This module does NOT:
 *     - perform business logic
 *     - write financial records
 *     - persist audit records itself
 *     - send notifications
 *     - connect to a database
 *     - connect to Redis
 *     - manage queues
 *
 *   It provides logging infrastructure only.
 *
 * Recommended dependencies:
 *
 *   npm install pino
 *
 * Optional development formatter:
 *
 *   npm install -D pino-pretty
 *
 * =============================================================================
 */

const {
  AsyncLocalStorage,
} = require('node:async_hooks');
const crypto = require('node:crypto');
const os = require('node:os');

const pino = require('pino');

const {
  startup,
  shutdown: registerShutdownHook,
  hooks,
} = require('./hooks');

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const LOGGER_NAME =
  'titech-acfos';

const DEFAULT_LEVEL =
  'info';

const DEFAULT_REDACT_PATHS =
  Object.freeze([
    'password',
    'passcode',
    'pin',
    'otp',
    'token',
    'accessToken',
    'refreshToken',
    'id_token',
    'access_token',
    'refresh_token',
    'authorization',
    'cookie',
    'set-cookie',

    'req.headers.authorization',
    'req.headers.cookie',
    'request.headers.authorization',
    'request.headers.cookie',

    'headers.authorization',
    'headers.cookie',

    'jwt',
    'jwtSecret',
    'secret',
    'apiKey',
    'api_key',
    'clientSecret',
    'client_secret',

    'encryptionKey',
    'encryption_key',

    'privateKey',
    'private_key',

    'cardNumber',
    'card_number',
    'cvv',
    'cvc',

    'accountPassword',
    'account_password',
  ]);

const LOG_LEVELS =
  Object.freeze([
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ]);

const DEFAULT_CONTEXT_FIELDS =
  Object.freeze([
    'requestId',
    'correlationId',
    'traceId',
    'spanId',
    'userId',
    'actorId',
    'sessionId',
    'tenantId',
    'organizationId',
    'service',
    'component',
    'operation',
  ]);

/**
 * -----------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------
 */

let loggerInstance = null;

let rootLogger = null;

let initialized = false;

let initializationPromise = null;

let shutdownRegistered = false;

let configurationSnapshot = null;

let initializationError = null;

/**
 * Per-async-operation context.
 *
 * Middleware can do:
 *
 *   logger.runWithContext(
 *     {
 *       requestId,
 *       correlationId,
 *       userId
 *     },
 *     () => next()
 *   );
 */
const asyncContext =
  new AsyncLocalStorage();

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class LoggerBootstrapError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'LoggerBootstrapError';

    this.code =
      options.code ||
      'LOGGER_BOOTSTRAP_ERROR';

    this.cause =
      options.cause ||
      null;

    this.details =
      Object.freeze({
        ...(options.details || {}),
      });

    Error.captureStackTrace?.(
      this,
      LoggerBootstrapError,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Utility Functions
 * -----------------------------------------------------------------------------
 */

function normalizeLevel(
  value,
) {
  const level =
    String(
      value ||
        DEFAULT_LEVEL,
    )
      .trim()
      .toLowerCase();

  if (
    !LOG_LEVELS.includes(level)
  ) {
    throw new LoggerBootstrapError(
      `Unsupported LOG_LEVEL "${level}".`,
      {
        code:
          'LOGGER_INVALID_LEVEL',

        details: {
          allowed:
            LOG_LEVELS,
        },
      },
    );
  }

  return level;
}

function normalizeBoolean(
  value,
  fallback,
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value === ''
  ) {
    return fallback;
  }

  if (
    typeof value ===
    'boolean'
  ) {
    return value;
  }

  return [
    '1',
    'true',
    'yes',
    'on',
    'enabled',
  ].includes(
    String(value)
      .trim()
      .toLowerCase(),
  );
}

function normalizePositiveInteger(
  value,
  fallback,
) {
  const result =
    value === undefined
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(result) ||
    result <= 0
  ) {
    return fallback;
  }

  return result;
}

function normalizeList(
  value,
  fallback = [],
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value === ''
  ) {
    return [
      ...fallback,
    ];
  }

  if (
    Array.isArray(value)
  ) {
    return [
      ...value,
    ]
      .map(
        item =>
          String(item).trim(),
      )
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map(
      item =>
        item.trim(),
    )
    .filter(Boolean);
}

function isPlainObject(
  value,
) {
  if (
    value === null ||
    typeof value !==
      'object'
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(
      value,
    );

  return (
    prototype ===
      Object.prototype ||
    prototype === null
  );
}

function mergeContext(
  ...sources
) {
  const result = {};

  for (
    const source of sources
  ) {
    if (
      source &&
      isPlainObject(source)
    ) {
      Object.assign(
        result,
        source,
      );
    }
  }

  return result;
}

function sanitizeContext(
  context,
) {
  const output = {};

  if (
    !context ||
    typeof context !==
      'object'
  ) {
    return output;
  }

  for (
    const field of
      DEFAULT_CONTEXT_FIELDS
  ) {
    if (
      context[field] !==
        undefined &&
      context[field] !==
        null
    ) {
      output[field] =
        context[field];
    }
  }

  return output;
}

function getCurrentContext() {
  return (
    asyncContext.getStore() ||
    {}
  );
}

function createRequestId() {
  return crypto.randomUUID();
}

function createChildBindings(
  bindings,
) {
  return mergeContext(
    sanitizeContext(
      getCurrentContext(),
    ),
    bindings,
  );
}

function serializeError(
  error,
) {
  if (
    !error
  ) {
    return null;
  }

  if (
    error instanceof Error
  ) {
    return {
      type:
        error.constructor?.name ||
        'Error',

      name:
        error.name,

      message:
        error.message,

      code:
        error.code,

      stack:
        error.stack,

      statusCode:
        error.statusCode,

      cause:
        error.cause
          ? serializeError(
              error.cause,
            )
          : undefined,
    };
  }

  return error;
}

/**
 * -----------------------------------------------------------------------------
 * Sensitive Data Redaction
 * -----------------------------------------------------------------------------
 *
 * Pino performs structural redaction.
 *
 * The application may additionally call:
 *
 *   logger.redactObject(...)
 *
 * before logging dynamically constructed data.
 */

function redactObject(
  value,
  sensitiveKeys = DEFAULT_REDACT_PATHS,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return value;
  }

  const sensitive =
    new Set(
      sensitiveKeys.map(
        key =>
          key
            .split('.')
            .pop()
            .toLowerCase(),
      ),
    );

  const redact =
    current => {
      if (
        current ===
          null ||
        current ===
          undefined
      ) {
        return current;
      }

      if (
        Array.isArray(current)
      ) {
        return current.map(
          item =>
            redact(item),
        );
      }

      if (
        typeof current !==
        'object'
      ) {
        return current;
      }

      const result = {};

      for (
        const [
          key,
          child,
        ] of Object.entries(
          current,
        )
      ) {
        if (
          sensitive.has(
            key.toLowerCase(),
          )
        ) {
          result[key] =
            '[REDACTED]';

          continue;
        }

        result[key] =
          redact(child);
      }

      return result;
    };

  return redact(value);
}

/**
 * -----------------------------------------------------------------------------
 * Configuration Resolution
 * -----------------------------------------------------------------------------
 *
 * Supports the environment/config shapes already established in this project.
 */

function resolveConfiguration(
  environment,
  config,
) {
  const environmentLogging =
    environment?.logging ||
    {};

  const configLogging =
    config?.logging ||
    config?.logger ||
    {};

  const level =
    normalizeLevel(
      configLogging.level ??
        environmentLogging.level ??
        process.env.LOG_LEVEL ??
        DEFAULT_LEVEL,
    );

  const pretty =
    normalizeBoolean(
      configLogging.pretty ??
        environmentLogging.pretty ??
        process.env.LOG_PRETTY,
      Boolean(
        environment?.runtime
          ?.isDevelopment ??
          process.env.NODE_ENV ===
            'development',
      ),
    );

  const enabled =
    normalizeBoolean(
      configLogging.enabled ??
        environmentLogging.enabled ??
        process.env.LOGGING_ENABLED,
      true,
    );

  const redactSecrets =
    normalizeBoolean(
      configLogging.redactSecrets ??
        environmentLogging.redactSecrets ??
        process.env.LOG_REDACT_SECRETS,
      true,
    );

  const redactPaths =
    normalizeList(
      configLogging.redactPaths ??
        process.env.LOG_REDACT_PATHS,
      DEFAULT_REDACT_PATHS,
    );

  const serviceName =
    config?.app?.serviceName ||
    config?.service?.name ||
    environment?.app?.serviceName ||
    process.env.SERVICE_NAME ||
    LOGGER_NAME;

  const applicationName =
    config?.app?.name ||
    environment?.app?.name ||
    process.env.APP_NAME ||
    LOGGER_NAME;

  const version =
    config?.app?.version ||
    environment?.app?.version ||
    process.env.APP_VERSION ||
    '0.0.0';

  const nodeEnvironment =
    environment?.runtime
      ?.nodeEnv ||
    environment?.app?.nodeEnv ||
    environment?.app?.environment ||
    process.env.NODE_ENV ||
    'development';

  const deployment =
    config?.deployment ||
    environment?.deployment ||
    {};

  const metadata =
    {
      service:
        serviceName,

      application:
        applicationName,

      version,

      environment:
        nodeEnvironment,

      hostname:
        os.hostname(),

      pid:
        process.pid,

      nodeVersion:
        process.version,

      platform:
        process.platform,

      architecture:
        process.arch,

      region:
        deployment.region,

      zone:
        deployment.zone,

      instanceId:
        deployment.instanceId,

      releaseId:
        deployment.releaseId,

      commitSha:
        deployment.commitSha,

      containerId:
        deployment.containerId,
    };

  return Object.freeze({
    enabled,

    level,

    pretty,

    redactSecrets,

    redactPaths:
      Object.freeze([
        ...redactPaths,
      ]),

    serviceName,

    applicationName,

    version,

    environment:
      nodeEnvironment,

    metadata:
      Object.freeze(
        metadata,
      ),

    timestamp:
      process.env.LOG_TIMESTAMP !==
      'false',

    messageKey:
      process.env.LOG_MESSAGE_KEY ||
      'msg',

    levelKey:
      process.env.LOG_LEVEL_KEY ||
      'level',

    nameKey:
      process.env.LOG_NAME_KEY ||
      'logger',

    maxStackDepth:
      normalizePositiveInteger(
        process.env.LOG_STACK_DEPTH,
        20,
      ),
  });
}

/**
 * -----------------------------------------------------------------------------
 * Pino Serializers
 * -----------------------------------------------------------------------------
 */

function serializeRequest(
  request,
) {
  if (
    !request
  ) {
    return request;
  }

  return {
    id:
      request.id ||
      request.idempotencyKey ||
      undefined,

    method:
      request.method,

    url:
      request.originalUrl ||
      request.url,

    userAgent:
      request.headers
        ?.['user-agent'],

    remoteAddress:
      request.ip ||
      request.socket
        ?.remoteAddress,

    headers:
      request.headers
        ? redactObject(
            request.headers,
          )
        : undefined,
  };
}

function serializeResponse(
  response,
) {
  if (
    !response
  ) {
    return response;
  }

  return {
    statusCode:
      response.statusCode,

    headers:
      response.getHeaders
        ? redactObject(
            response.getHeaders(),
          )
        : undefined,
  };
}

/**
 * -----------------------------------------------------------------------------
 * Logger Destination
 * -----------------------------------------------------------------------------
 */

function createDestination(
  options,
) {
  if (
    options.pretty !==
    true
  ) {
    return undefined;
  }

  /**
   * pino-pretty is intentionally optional.
   *
   * Production remains pure JSON.
   */
  let PrettyTransport;

  try {
    PrettyTransport =
      require.resolve(
        'pino-pretty',
      );
  } catch {
    return undefined;
  }

  return pino.transport({
    target:
      PrettyTransport,

    options: {
      colorize: true,

      translateTime:
        'SYS:standard',

      ignore:
        'pid,hostname',

      singleLine: true,
    },
  });
}

/**
 * -----------------------------------------------------------------------------
 * Logger Factory
 * -----------------------------------------------------------------------------
 */

function createLogger(
  options = {},
) {
  const resolved =
    resolveConfiguration(
      options.environment,
      options.config,
    );

  if (
    !resolved.enabled
  ) {
    /**
     * Disabled logging should still preserve a complete logger interface.
     *
     * pino silent mode avoids expensive output while keeping application code
     * unchanged.
     */
    resolved.level =
      'silent';
  }

  const redaction =
    resolved.redactSecrets
      ? {
          paths:
            resolved.redactPaths,

          censor:
            '[REDACTED]',

          remove: false,
        }
      : undefined;

  const baseBindings =
    {
      ...resolved.metadata,
    };

  const destination =
    createDestination(
      resolved,
    );

  const logger =
    pino(
      {
        name:
          resolved.serviceName,

        level:
          resolved.level,

        base:
          baseBindings,

        timestamp:
          resolved.timestamp
            ? pino.stdTimeFunctions
                .isoTime
            : false,

        messageKey:
          resolved.messageKey,

        levelKey:
          resolved.levelKey,

        serializers: {
          err:
            serializeError,

          error:
            serializeError,

          req:
            serializeRequest,

          request:
            serializeRequest,

          res:
            serializeResponse,

          response:
            serializeResponse,
        },

        redact,
      },

      destination,
    );

  return logger;
}

/**
 * -----------------------------------------------------------------------------
 * Context-Aware Logger Wrapper
 * -----------------------------------------------------------------------------
 *
 * This ensures every log line can automatically inherit:
 *
 *   requestId
 *   correlationId
 *   traceId
 *   spanId
 *   userId
 *   tenantId
 *   operation
 *
 * without manually adding them to every logging call.
 */

function createContextAwareLogger(
  logger,
) {
  const facade = {
    get level() {
      return logger.level;
    },

    set level(value) {
      logger.level =
        value;
    },

    get bindings() {
      return logger.bindings();
    },

    isLevelEnabled(level) {
      return logger.isLevelEnabled(
        level,
      );
    },

    child(
      bindings = {},
      options = {},
    ) {
      const merged =
        createChildBindings(
          bindings,
        );

      return createContextAwareLogger(
        logger.child(
          merged,
          options,
        ),
      );
    },

    withContext(
      bindings = {},
    ) {
      const merged =
        createChildBindings(
          bindings,
        );

      return createContextAwareLogger(
        logger.child(
          merged,
        ),
      );
    },

    runWithContext(
      bindings = {},
      callback,
    ) {
      if (
        typeof callback !==
        'function'
      ) {
        throw new TypeError(
          'runWithContext callback must be a function.',
        );
      }

      const merged =
        createChildBindings(
          bindings,
        );

      return asyncContext.run(
        merged,
        callback,
      );
    },

    getContext() {
      return sanitizeContext(
        getCurrentContext(),
      );
    },

    requestContext(
      bindings = {},
    ) {
      return {
        ...sanitizeContext(
          getCurrentContext(),
        ),

        ...sanitizeContext(
          bindings,
        ),
      };
    },

    redactObject,

    fatal(
      ...args
    ) {
      return logger.fatal(
        createChildBindings(
          {},
        ),
        ...args,
      );
    },

    error(
      ...args
    ) {
      return logger.error(
        createChildBindings(
          {},
        ),
        ...args,
      );
    },

    warn(
      ...args
    ) {
      return logger.warn(
        createChildBindings(
          {},
        ),
        ...args,
      );
    },

    info(
      ...args
    ) {
      return logger.info(
        createChildBindings(
          {},
        ),
        ...args,
      );
    },

    debug(
      ...args
    ) {
      return logger.debug(
        createChildBindings(
          {},
        ),
        ...args,
      );
    },

    trace(
      ...args
    ) {
      return logger.trace(
        createChildBindings(
          {},
        ),
        ...args,
      );
    },

    silent(
      ...args
    ) {
      return logger.silent(
        ...args,
      );
    },

    flush(
      callback,
    ) {
      return logger.flush(
        callback,
      );
    },

    levelVal:
      () => logger.levelVal,

    version:
      () => logger.version,

    /**
     * Semantic logging helpers.
     */
    audit(
      payload = {},
      message =
        'Audit event',
    ) {
      return logger.info(
        {
          eventType:
            'audit',

          ...createChildBindings(
            {},
          ),

          ...redactObject(
            payload,
          ),
        },

        message,
      );
    },

    security(
      payload = {},
      message =
        'Security event',
    ) {
      return logger.warn(
        {
          eventType:
            'security',

          ...createChildBindings(
            {},
          ),

          ...redactObject(
            payload,
          ),
        },

        message,
      );
    },

    financial(
      payload = {},
      message =
        'Financial event',
    ) {
      /**
       * Never log secrets/payment credentials.
       *
       * Amounts and transaction references may be logged depending on the
       * application's data-classification policy, but sensitive credentials are
       * structurally redacted.
       */
      return logger.info(
        {
          eventType:
            'financial',

          ...createChildBindings(
            {},
          ),

          ...redactObject(
            payload,
          ),
        },

        message,
      );
    },

    performance(
      payload = {},
      message =
        'Performance event',
    ) {
      return logger.info(
        {
          eventType:
            'performance',

          ...createChildBindings(
            {},
          ),

          ...payload,
        },

        message,
      );
    },

    /**
     * Expose the underlying Pino logger for integrations that explicitly
     * require it.
     */
    raw:
      logger,
  };

  /**
   * Pino APIs that are not explicitly wrapped above.
   *
   * This keeps compatibility with common Pino methods while ensuring context
   * is still applied for standard log levels.
   */
  facade.log =
    (...args) =>
      facade.info(
        ...args,
      );

  return Object.freeze(
    facade,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Initialization
 * -----------------------------------------------------------------------------
 */

async function initializeLogger(
  options = {},
) {
  if (
    initialized &&
    loggerInstance
  ) {
    return loggerInstance;
  }

  if (
    initializationPromise
  ) {
    return initializationPromise;
  }

  initializationPromise =
    (async () => {
      try {
        const logger =
          createLogger(
            options,
          );

        rootLogger =
          logger;

        loggerInstance =
          createContextAwareLogger(
            logger,
          );

        configurationSnapshot =
          resolveConfiguration(
            options.environment,
            options.config,
          );

        initialized =
          true;

        initializationError =
          null;

        return loggerInstance;
      } catch (error) {
        initializationError =
          error;

        throw (
          error instanceof
          LoggerBootstrapError
            ? error
            : new LoggerBootstrapError(
                'Logger initialization failed.',
                {
                  code:
                    'LOGGER_INITIALIZATION_FAILED',

                  cause:
                    error,
                },
              )
        );
      }
    })();

  try {
    return await initializationPromise;
  } finally {
    if (
      !initialized
    ) {
      initializationPromise =
        null;
    }
  }
}

/**
 * -----------------------------------------------------------------------------
 * Bootstrap Hook Registration
 * -----------------------------------------------------------------------------
 *
 * This module intentionally registers the canonical "logger" lifecycle hook.
 * bootstrap/index.js can therefore use it as the dependency anchor for
 * observability, resilience, database, and other infrastructure.
 */

function registerBootstrapHooks(
  context = {},
) {
  if (
    hooks.has('logger')
  ) {
    return hooks.get(
      'logger',
    );
  }

  const registered =
    startup(
      'logger',
      async hookContext => {
        const logger =
          await initializeLogger({
            environment:
              hookContext?.environment,

            config:
              hookContext?.config,
          });

        /**
         * Expose the initialized logger to the shared application context.
         */
        if (
          hookContext &&
          typeof hookContext ===
            'object'
        ) {
          hookContext.logger =
            logger;
        }

        return logger;
      },
      {
        priority:
          -700,

        dependencies: [
          'configuration',
        ],

        critical:
          true,

        metadata: {
          component:
            'logger',

          service:
            LOGGER_NAME,
        },
      },
    );

  /**
   * Register shutdown once.
   */
  if (
    !shutdownRegistered
  ) {
    registerShutdownHook(
      'logger-shutdown',
      async () => {
        await flush();
      },
      {
        priority:
          10_000,

        dependencies: [
          'logger',
        ],

        critical:
          false,
      },
    );

    shutdownRegistered =
      true;
  }

  return registered;
}

/**
 * -----------------------------------------------------------------------------
 * Logger Access
 * -----------------------------------------------------------------------------
 */

function getLogger() {
  if (
    loggerInstance
  ) {
    return loggerInstance;
  }

  /**
   * A safe fallback is deliberately initialized lazily for code paths that
   * import the logger before bootstrap has completed.
   */
  if (
    !rootLogger
  ) {
    rootLogger =
      pino({
        name:
          LOGGER_NAME,

        level:
          'info',

        base: {
          service:
            LOGGER_NAME,
        },
      });

    loggerInstance =
      createContextAwareLogger(
        rootLogger,
      );
  }

  return loggerInstance;
}

function getRootLogger() {
  return rootLogger;
}

/**
 * -----------------------------------------------------------------------------
 * Convenience Logger Methods
 * -----------------------------------------------------------------------------
 */

function fatal(
  ...args
) {
  return getLogger().fatal(
    ...args,
  );
}

function error(
  ...args
) {
  return getLogger().error(
    ...args,
  );
}

function warn(
  ...args
) {
  return getLogger().warn(
    ...args,
  );
}

function info(
  ...args
) {
  return getLogger().info(
    ...args,
  );
}

function debug(
  ...args
) {
  return getLogger().debug(
    ...args,
  );
}

function trace(
  ...args
) {
  return getLogger().trace(
    ...args,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Context API
 * -----------------------------------------------------------------------------
 */

function runWithContext(
  bindings,
  callback,
) {
  return getLogger().runWithContext(
    bindings,
    callback,
  );
}

function withContext(
  bindings,
) {
  return getLogger().withContext(
    bindings,
  );
}

function getContext() {
  return getLogger().getContext();
}

/**
 * -----------------------------------------------------------------------------
 * Request Context Helper
 * -----------------------------------------------------------------------------
 */

function createRequestContext(
  input = {},
) {
  return {
    requestId:
      input.requestId ||
      createRequestId(),

    correlationId:
      input.correlationId ||
      input.requestId ||
      createRequestId(),

    traceId:
      input.traceId,

    spanId:
      input.spanId,

    userId:
      input.userId,

    actorId:
      input.actorId,

    tenantId:
      input.tenantId,

    organizationId:
      input.organizationId,

    operation:
      input.operation,

    service:
      input.service ||
      configurationSnapshot
        ?.serviceName ||
      LOGGER_NAME,

    component:
      input.component,
  };
}

/**
 * -----------------------------------------------------------------------------
 * Flush
 * -----------------------------------------------------------------------------
 */

async function flush() {
  if (
    !rootLogger
  ) {
    return;
  }

  await new Promise(
    resolve => {
      try {
        rootLogger.flush(
          () => resolve(),
        );
      } catch {
        resolve();
      }
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Shutdown
 * -----------------------------------------------------------------------------
 */

async function shutdown() {
  await flush();

  loggerInstance =
    null;

  rootLogger =
    null;

  initialized =
    false;

  initializationPromise =
    null;

  configurationSnapshot =
    null;
}

/**
 * -----------------------------------------------------------------------------
 * Diagnostics
 * -----------------------------------------------------------------------------
 *
 * No secrets are returned.
 */

function snapshot() {
  const configuration =
    configurationSnapshot;

  return Object.freeze({
    initialized,

    available:
      Boolean(
        loggerInstance,
      ),

    level:
      configuration?.level ||
      'info',

    enabled:
      configuration?.enabled ??
      true,

    pretty:
      configuration?.pretty ??
      false,

    redactSecrets:
      configuration?.redactSecrets ??
      true,

    serviceName:
      configuration?.serviceName ||
      LOGGER_NAME,

    applicationName:
      configuration?.applicationName ||
      LOGGER_NAME,

    environment:
      configuration?.environment ||
      'unknown',

    version:
      configuration?.version ||
      '0.0.0',

    pid:
      process.pid,

    hostname:
      os.hostname(),

    initializationFailed:
      Boolean(
        initializationError,
      ),

    initializationError:
      initializationError
        ? {
            name:
              initializationError.name,

            code:
              initializationError.code,

            message:
              initializationError.message,
          }
        : null,
  });
}

/**
 * -----------------------------------------------------------------------------
 * Semantic Logging Exports
 * -----------------------------------------------------------------------------
 */

function audit(
  payload,
  message,
) {
  return getLogger().audit(
    payload,
    message,
  );
}

function security(
  payload,
  message,
) {
  return getLogger().security(
    payload,
    message,
  );
}

function financial(
  payload,
  message,
) {
  return getLogger().financial(
    payload,
    message,
  );
}

function performance(
  payload,
  message,
) {
  return getLogger().performance(
    payload,
    message,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Default Bootstrap Contract
 * -----------------------------------------------------------------------------
 */

module.exports =
  Object.freeze({
    /**
     * Core logger.
     */
    logger:
      getLogger(),

    getLogger,
    getRootLogger,

    /**
     * Initialization/lifecycle.
     */
    initialize:
      initializeLogger,

    registerBootstrapHooks,

    shutdown,
    flush,

    /**
     * Context.
     */
    runWithContext,
    withContext,
    getContext,
    createRequestContext,

    /**
     * Semantic helpers.
     */
    audit,
    security,
    financial,
    performance,

    /**
     * Standard log levels.
     */
    fatal,
    error,
    warn,
    info,
    debug,
    trace,

    /**
     * Security utility.
     */
    redactObject,

    /**
     * Diagnostics.
     */
    snapshot,

    /**
     * Errors/constants.
     */
    LoggerBootstrapError,
    LOGGER_NAME,

    DEFAULT_REDACT_PATHS,
  });