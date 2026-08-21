'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/startupErrors.js
 *
 * Purpose:
 *   Enterprise production-grade startup error classification, normalization and
 *   diagnostics.
 *
 * Responsibilities:
 *   - Provide canonical startup/bootstrap error types.
 *   - Classify startup failures by lifecycle phase.
 *   - Preserve original causes.
 *   - Normalize unknown errors into structured startup errors.
 *   - Support retryable/non-retryable classification.
 *   - Support critical/non-critical startup failures.
 *   - Prevent sensitive values from leaking into diagnostics.
 *   - Provide serialization for structured logging/observability.
 *   - Provide safe process-startup diagnostics.
 *   - Integrate with bootstrap lifecycle modules without owning lifecycle logic.
 *
 * Architectural position:
 *
 *   environment
 *       ↓
 *   configuration
 *       ↓
 *   logger
 *       ↓
 *   observability
 *       ↓
 *   readiness
 *       ↓
 *   resilience
 *       ↓
 *   infrastructure
 *       ↓
 *   services
 *       ↓
 *   middleware
 *       ↓
 *   routes
 *       ↓
 *   server
 *
 * Startup errors from any phase should normalize through this module.
 *
 * IMPORTANT:
 *
 *   This module does NOT:
 *     - start the application
 *     - stop the application
 *     - retry lifecycle hooks
 *     - connect to databases
 *     - perform financial operations
 *
 *   It only defines the startup failure contract.
 *
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const STARTUP_PHASES =
  Object.freeze({
    ENVIRONMENT:
      'environment',

    CONFIGURATION:
      'configuration',

    LOGGER:
      'logger',

    OBSERVABILITY:
      'observability',

    READINESS:
      'readiness',

    RESILIENCE:
      'resilience',

    INFRASTRUCTURE:
      'infrastructure',

    DATABASE:
      'database',

    CACHE:
      'cache',

    REDIS:
      'redis',

    EVENT_BUS:
      'event-bus',

    QUEUE:
      'queue',

    SERVICES:
      'services',

    MIDDLEWARE:
      'middleware',

    ROUTES:
      'routes',

    SERVER:
      'server',

    RUNTIME:
      'runtime',

    LIFECYCLE:
      'lifecycle',

    BOOTSTRAP:
      'bootstrap',

    UNKNOWN:
      'unknown',
  });

const STARTUP_ERROR_CODES =
  Object.freeze({
    UNKNOWN:
      'STARTUP_UNKNOWN',

    INITIALIZATION_FAILED:
      'STARTUP_INITIALIZATION_FAILED',

    DEPENDENCY_FAILED:
      'STARTUP_DEPENDENCY_FAILED',

    CONFIGURATION_INVALID:
      'STARTUP_CONFIGURATION_INVALID',

    ENVIRONMENT_INVALID:
      'STARTUP_ENVIRONMENT_INVALID',

    IMPLEMENTATION_UNAVAILABLE:
      'STARTUP_IMPLEMENTATION_UNAVAILABLE',

    IMPLEMENTATION_INVALID:
      'STARTUP_IMPLEMENTATION_INVALID',

    TIMEOUT:
      'STARTUP_TIMEOUT',

    DEPENDENCY_TIMEOUT:
      'STARTUP_DEPENDENCY_TIMEOUT',

    PORT_BIND_FAILED:
      'STARTUP_PORT_BIND_FAILED',

    ADDRESS_IN_USE:
      'STARTUP_ADDRESS_IN_USE',

    PERMISSION_DENIED:
      'STARTUP_PERMISSION_DENIED',

    CONNECTION_FAILED:
      'STARTUP_CONNECTION_FAILED',

    AUTHENTICATION_FAILED:
      'STARTUP_AUTHENTICATION_FAILED',

    TLS_CONFIGURATION_FAILED:
      'STARTUP_TLS_CONFIGURATION_FAILED',

    MIGRATION_FAILED:
      'STARTUP_MIGRATION_FAILED',

    SERVICE_FAILED:
      'STARTUP_SERVICE_FAILED',

    ROUTE_FAILED:
      'STARTUP_ROUTE_FAILED',

    MIDDLEWARE_FAILED:
      'STARTUP_MIDDLEWARE_FAILED',

    READINESS_FAILED:
      'STARTUP_READINESS_FAILED',

    RESILIENCE_FAILED:
      'STARTUP_RESILIENCE_FAILED',

    INFRASTRUCTURE_FAILED:
      'STARTUP_INFRASTRUCTURE_FAILED',

    SERVER_FAILED:
      'STARTUP_SERVER_FAILED',

    RUNTIME_FAILED:
      'STARTUP_RUNTIME_FAILED',

    CIRCULAR_DEPENDENCY:
      'STARTUP_CIRCULAR_DEPENDENCY',

    INVALID_STATE:
      'STARTUP_INVALID_STATE',

    ABORTED:
      'STARTUP_ABORTED',
  });

const STARTUP_SEVERITIES =
  Object.freeze({
    INFO:
      'info',

    WARNING:
      'warning',

    ERROR:
      'error',

    FATAL:
      'fatal',
  });

const STARTUP_CATEGORIES =
  Object.freeze({
    VALIDATION:
      'validation',

    DEPENDENCY:
      'dependency',

    NETWORK:
      'network',

    DATABASE:
      'database',

    CACHE:
      'cache',

    QUEUE:
      'queue',

    SECURITY:
      'security',

    CONFIGURATION:
      'configuration',

    LIFECYCLE:
      'lifecycle',

    INTERNAL:
      'internal',

    SYSTEM:
      'system',

    UNKNOWN:
      'unknown',
  });

const RETRYABILITY =
  Object.freeze({
    RETRYABLE:
      'retryable',

    NON_RETRYABLE:
      'non_retryable',

    UNKNOWN:
      'unknown',
  });

/**
 * -----------------------------------------------------------------------------
 * Sensitive Keys
 * -----------------------------------------------------------------------------
 */

const SENSITIVE_KEYS =
  new Set([
    'password',
    'passcode',
    'pin',
    'otp',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'set-cookie',
    'secret',
    'apiKey',
    'api_key',
    'clientSecret',
    'client_secret',
    'privateKey',
    'private_key',
    'encryptionKey',
    'encryption_key',
    'jwt',
    'jwtSecret',
    'databaseUrl',
    'mongoUri',
    'mongodbUri',
    'redisUrl',
    'redisUri',
    'connectionString',
    'dsn',
    'credential',
    'credentials',
  ]);

/**
 * -----------------------------------------------------------------------------
 * Utility Functions
 * -----------------------------------------------------------------------------
 */

function normalizeString(
  value,
  fallback = null,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  const normalized =
    String(value)
      .trim();

  return normalized || fallback;
}

function normalizePhase(
  phase,
) {
  const value =
    normalizeString(
      phase,
      STARTUP_PHASES.UNKNOWN,
    );

  return Object.values(
    STARTUP_PHASES,
  ).includes(value)
    ? value
    : STARTUP_PHASES.UNKNOWN;
}

function normalizeSeverity(
  severity,
) {
  const value =
    normalizeString(
      severity,
      STARTUP_SEVERITIES.ERROR,
    );

  return Object.values(
    STARTUP_SEVERITIES,
  ).includes(value)
    ? value
    : STARTUP_SEVERITIES.ERROR;
}

function normalizeCategory(
  category,
) {
  const value =
    normalizeString(
      category,
      STARTUP_CATEGORIES.UNKNOWN,
    );

  return Object.values(
    STARTUP_CATEGORIES,
  ).includes(value)
    ? value
    : STARTUP_CATEGORIES.UNKNOWN;
}

function normalizeRetryability(
  value,
) {
  const normalized =
    normalizeString(
      value,
      RETRYABILITY.UNKNOWN,
    );

  return Object.values(
    RETRYABILITY,
  ).includes(
    normalized,
  )
    ? normalized
    : RETRYABILITY.UNKNOWN;
}

function sanitize(
  value,
  seen = new WeakSet(),
) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    typeof value ===
      'string' ||
    typeof value ===
      'number' ||
    typeof value ===
      'boolean'
  ) {
    return value;
  }

  if (
    typeof value ===
    'bigint'
  ) {
    return String(value);
  }

  if (
    typeof value ===
    'function'
  ) {
    return '[Function]';
  }

  if (
    value instanceof
    Error
  ) {
    return {
      name:
        value.name,

      code:
        value.code,

      message:
        value.message,
    };
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      item =>
        sanitize(
          item,
          seen,
        ),
    );
  }

  if (
    typeof value !==
    'object'
  ) {
    return String(value);
  }

  if (
    seen.has(value)
  ) {
    return '[Circular]';
  }

  seen.add(value);

  const output = {};

  for (
    const [
      key,
      child,
    ] of Object.entries(
      value,
    )
  ) {
    if (
      SENSITIVE_KEYS.has(
        key,
      ) ||
      SENSITIVE_KEYS.has(
        key.toLowerCase(),
      )
    ) {
      output[key] =
        '[REDACTED]';

      continue;
    }

    output[key] =
      sanitize(
        child,
        seen,
      );
  }

  return output;
}

function safeStack(
  error,
) {
  if (
    !error ||
    typeof error.stack !==
      'string'
  ) {
    return null;
  }

  /**
   * Stack traces may contain environment-specific paths but are generally
   * useful for local diagnostics. The public serializer controls whether the
   * stack is included.
   */
  return error.stack.slice(
    0,
    20_000,
  );
}

function inferCode(
  error,
  options = {},
) {
  if (
    options.code
  ) {
    return options.code;
  }

  if (
    error?.code
  ) {
    const nodeCode =
      String(
        error.code,
      );

    switch (
      nodeCode
    ) {
      case 'EADDRINUSE':
        return STARTUP_ERROR_CODES
          .ADDRESS_IN_USE;

      case 'EACCES':
        return STARTUP_ERROR_CODES
          .PERMISSION_DENIED;

      case 'ECONNREFUSED':
      case 'ECONNRESET':
      case 'ETIMEDOUT':
      case 'EHOSTUNREACH':
      case 'ENETUNREACH':
        return STARTUP_ERROR_CODES
          .CONNECTION_FAILED;

      default:
        break;
    }
  }

  return STARTUP_ERROR_CODES.UNKNOWN;
}

function inferCategory(
  error,
  phase,
  options = {},
) {
  if (
    options.category
  ) {
    return normalizeCategory(
      options.category,
    );
  }

  switch (
    normalizePhase(
      phase,
    )
  ) {
    case STARTUP_PHASES
      .ENVIRONMENT:
    case STARTUP_PHASES
      .CONFIGURATION:
      return STARTUP_CATEGORIES
        .CONFIGURATION;

    case STARTUP_PHASES
      .DATABASE:
    case STARTUP_PHASES
      .CACHE:
    case STARTUP_PHASES
      .REDIS:
      return STARTUP_CATEGORIES
        .DATABASE;

    case STARTUP_PHASES
      .QUEUE:
      case STARTUP_PHASES
        .EVENT_BUS:
      return STARTUP_CATEGORIES
        .QUEUE;

    case STARTUP_PHASES
      .INFRASTRUCTURE:
    case STARTUP_PHASES
      .RESILIENCE:
      case STARTUP_PHASES
        .READINESS:
      case STARTUP_PHASES
        .LIFECYCLE:
      return STARTUP_CATEGORIES
        .LIFECYCLE;

    case STARTUP_PHASES
      .SERVER:
      return STARTUP_CATEGORIES
        .NETWORK;

    case STARTUP_PHASES
      .SERVICES:
      case STARTUP_PHASES
        .MIDDLEWARE:
      case STARTUP_PHASES
        .ROUTES:
      return STARTUP_CATEGORIES
        .INTERNAL;

    default:
      break;
  }

  if (
    error?.code ===
      'EADDRINUSE' ||
    error?.code ===
      'EACCES' ||
    error?.code ===
      'ECONNREFUSED' ||
    error?.code ===
      'ETIMEDOUT'
  ) {
    return STARTUP_CATEGORIES
      .NETWORK;
  }

  return STARTUP_CATEGORIES
    .UNKNOWN;
}

function inferRetryability(
  error,
  options = {},
) {
  if (
    options.retryability
  ) {
    return normalizeRetryability(
      options.retryability,
    );
  }

  if (
    typeof options.retryable ===
    'boolean'
  ) {
    return options.retryable
      ? RETRYABILITY.RETRYABLE
      : RETRYABILITY
          .NON_RETRYABLE;
  }

  switch (
    error?.code
  ) {
    case 'EADDRINUSE':
    case 'EACCES':
      return RETRYABILITY
        .NON_RETRYABLE;

    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return RETRYABILITY
        .RETRYABLE;

    default:
      break;
  }

  if (
    error?.name ===
      'TimeoutError' ||
    error?.code ===
      STARTUP_ERROR_CODES.TIMEOUT ||
    error?.code ===
      STARTUP_ERROR_CODES
        .DEPENDENCY_TIMEOUT
  ) {
    return RETRYABILITY
      .RETRYABLE;
  }

  return RETRYABILITY.UNKNOWN;
}

function inferSeverity(
  options = {},
) {
  if (
    options.severity
  ) {
    return normalizeSeverity(
      options.severity,
    );
  }

  if (
    options.fatal ===
    true
  ) {
    return STARTUP_SEVERITIES
      .FATAL;
  }

  if (
    options.critical ===
    false
  ) {
    return STARTUP_SEVERITIES
      .WARNING;
  }

  return STARTUP_SEVERITIES
    .ERROR;
}

function inferMessage(
  error,
  fallback,
) {
  return (
    normalizeString(
      error?.message,
      null,
    ) ||
    normalizeString(
      fallback,
      'TITech startup failed.',
    )
  );
}

function createErrorId() {
  return `startup_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * =============================================================================
 * StartupError
 * =============================================================================
 */

class StartupError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      options.name ||
      'StartupError';

    this.code =
      inferCode(
        options.cause ||
          options.error,
        options,
      );

    this.phase =
      normalizePhase(
        options.phase,
      );

    this.category =
      inferCategory(
        options.cause ||
          options.error,
        this.phase,
        options,
      );

    this.severity =
      inferSeverity(
        options,
      );

    this.retryability =
      inferRetryability(
        options.cause ||
          options.error,
        options,
      );

    this.retryable =
      this.retryability ===
      RETRYABILITY.RETRYABLE;

    this.critical =
      options.critical !==
      false;

    this.fatal =
      options.fatal ??
      this.severity ===
        STARTUP_SEVERITIES.FATAL;

    this.component =
      normalizeString(
        options.component,
        'bootstrap',
      );

    this.service =
      normalizeString(
        options.service,
        'titech-backend',
      );

    this.operation =
      normalizeString(
        options.operation,
        null,
      );

    this.dependency =
      normalizeString(
        options.dependency,
        null,
      );

    this.attempt =
      Number.isInteger(
        options.attempt,
      ) &&
      options.attempt >
        0
        ? options.attempt
        : 1;

    this.maxAttempts =
      Number.isInteger(
        options.maxAttempts,
      ) &&
      options.maxAttempts >
        0
        ? options.maxAttempts
        : null;

    this.durationMs =
      Number.isFinite(
        options.durationMs,
      )
        ? options.durationMs
        : null;

    this.statusCode =
      Number.isInteger(
        options.statusCode,
      )
        ? options.statusCode
        : null;

    this.errorId =
      normalizeString(
        options.errorId,
        null,
      ) ||
      createErrorId();

    this.timestamp =
      options.timestamp
        ? new Date(
            options.timestamp,
          )
        : new Date();

    this.details =
      Object.freeze(
        sanitize(
          options.details ||
            {},
        ),
      );

    this.metadata =
      Object.freeze(
        sanitize(
          options.metadata ||
            {},
        ),
      );

    this.cause =
      options.cause ||
      options.error ||
      null;

    /**
     * Preserve stack from the underlying cause only when the constructor is
     * specifically asked to do so. The default stack remains the StartupError
     * stack, which points at the normalization boundary.
     */
    if (
      options.preserveCauseStack &&
      this.cause?.stack
    ) {
      this.causeStack =
        safeStack(
          this.cause,
        );
    } else {
      this.causeStack =
        null;
    }

    Error.captureStackTrace?.(
      this,
      StartupError,
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Factory
   * ---------------------------------------------------------------------------
   */

  static from(
    error,
    options = {},
  ) {
    if (
      error instanceof
      StartupError
    ) {
      return error.with(
        options,
      );
    }

    return new StartupError(
      inferMessage(
        error,
        options.message,
      ),
      {
        ...options,

        cause:
          error,
      },
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Derive
   * ---------------------------------------------------------------------------
   */

  with(
    options = {},
  ) {
    return new StartupError(
      options.message ||
        this.message,
      {
        phase:
          options.phase ||
          this.phase,

        category:
          options.category ||
          this.category,

        severity:
          options.severity ||
          this.severity,

        retryability:
          options.retryability ||
          this.retryability,

        retryable:
          options.retryable ??
          this.retryable,

        critical:
          options.critical ??
          this.critical,

        fatal:
          options.fatal ??
          this.fatal,

        component:
          options.component ||
          this.component,

        service:
          options.service ||
          this.service,

        operation:
          options.operation ||
          this.operation,

        dependency:
          options.dependency ||
          this.dependency,

        attempt:
          options.attempt ||
          this.attempt,

        maxAttempts:
          options.maxAttempts ||
          this.maxAttempts,

        durationMs:
          options.durationMs ??
          this.durationMs,

        statusCode:
          options.statusCode ??
          this.statusCode,

        errorId:
          options.errorId ||
          this.errorId,

        details: {
          ...this.details,
          ...(options.details ||
            {}),
        },

        metadata: {
          ...this.metadata,
          ...(options.metadata ||
            {}),
        },

        cause:
          options.cause ||
          this.cause,

        preserveCauseStack:
          options.preserveCauseStack ??
          Boolean(
            this.causeStack,
          ),
      },
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Predicates
   * ---------------------------------------------------------------------------
   */

  isRetryable() {
    return (
      this.retryability ===
      RETRYABILITY.RETRYABLE
    );
  }

  isNonRetryable() {
    return (
      this.retryability ===
      RETRYABILITY
        .NON_RETRYABLE
    );
  }

  isCritical() {
    return (
      this.critical ===
      true
    );
  }

  isFatal() {
    return (
      this.fatal ===
      true
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Cause Chain
   * ---------------------------------------------------------------------------
   */

  getCauseChain(
    maxDepth = 10,
  ) {
    const chain = [];

    let current =
      this;

    let depth =
      0;

    while (
      current &&
      depth <
        maxDepth
    ) {
      chain.push({
        name:
          current.name,

        code:
          current.code,

        message:
          current.message,

        phase:
          current.phase,

        category:
          current.category,
      });

      current =
        current.cause instanceof
        Error
          ? current.cause
          : null;

      depth +=
        1;
    }

    return chain;
  }

  /**
   * ---------------------------------------------------------------------------
   * Serialization
   * ---------------------------------------------------------------------------
   */

  toJSON(
    options = {},
  ) {
    const includeStack =
      options.includeStack ===
      true;

    const includeCauseStack =
      options.includeCauseStack ===
      true;

    return {
      name:
        this.name,

      message:
        this.message,

      code:
        this.code,

      errorId:
        this.errorId,

      phase:
        this.phase,

      category:
        this.category,

      severity:
        this.severity,

      retryability:
        this.retryability,

      retryable:
        this.retryable,

      critical:
        this.critical,

      fatal:
        this.fatal,

      component:
        this.component,

      service:
        this.service,

      operation:
        this.operation,

      dependency:
        this.dependency,

      attempt:
        this.attempt,

      maxAttempts:
        this.maxAttempts,

      durationMs:
        this.durationMs,

      statusCode:
        this.statusCode,

      timestamp:
        this.timestamp.toISOString(),

      details:
        this.details,

      metadata:
        this.metadata,

      cause:
        this.cause instanceof
        StartupError
          ? this.cause.toJSON({
              includeStack:
                false,
            })
          : this.cause instanceof
              Error
            ? {
                name:
                  this.cause.name,

                code:
                  this.cause.code,

                message:
                  this.cause.message,
              }
            : null,

      stack:
        includeStack
          ? safeStack(
              this,
            )
          : undefined,

      causeStack:
        includeCauseStack
          ? this.causeStack
          : undefined,
    };
  }

  toLogObject(
    options = {},
  ) {
    const json =
      this.toJSON(
        options,
      );

    /**
     * Keep top-level logger payload compact and structured.
     */
    return {
      err: {
        type:
          json.name,

        code:
          json.code,

        message:
          json.message,

        stack:
          json.stack,

        cause:
          json.cause,
      },

      startup: {
        errorId:
          json.errorId,

        phase:
          json.phase,

        category:
          json.category,

        severity:
          json.severity,

        retryability:
          json.retryability,

        critical:
          json.critical,

        fatal:
          json.fatal,

        component:
          json.component,

        service:
          json.service,

        operation:
          json.operation,

        dependency:
          json.dependency,

        attempt:
          json.attempt,

        maxAttempts:
          json.maxAttempts,

        durationMs:
          json.durationMs,

        details:
          json.details,

        metadata:
          json.metadata,
      },
    };
  }
}

/**
 * =============================================================================
 * Specialized Startup Errors
 * =============================================================================
 */

class EnvironmentStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'EnvironmentStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .ENVIRONMENT_INVALID,

        phase:
          STARTUP_PHASES
            .ENVIRONMENT,

        category:
          STARTUP_CATEGORIES
            .CONFIGURATION,
      },
    );
  }
}

class ConfigurationStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'ConfigurationStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .CONFIGURATION_INVALID,

        phase:
          STARTUP_PHASES
            .CONFIGURATION,

        category:
          STARTUP_CATEGORIES
            .CONFIGURATION,

        retryable:
          false,
      },
    );
  }
}

class DependencyStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'DependencyStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .DEPENDENCY_FAILED,

        category:
          STARTUP_CATEGORIES
            .DEPENDENCY,
      },
    );
  }
}

class StartupTimeoutError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'StartupTimeoutError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .TIMEOUT,

        retryable:
          options.retryable ??
          true,
      },
    );
  }
}

class DatabaseStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'DatabaseStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .CONNECTION_FAILED,

        phase:
          STARTUP_PHASES
            .DATABASE,

        category:
          STARTUP_CATEGORIES
            .DATABASE,
      },
    );
  }
}

class RedisStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'RedisStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .CONNECTION_FAILED,

        phase:
          STARTUP_PHASES
            .REDIS,

        category:
          STARTUP_CATEGORIES
            .CACHE,
      },
    );
  }
}

class QueueStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'QueueStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .CONNECTION_FAILED,

        phase:
          STARTUP_PHASES
            .QUEUE,

        category:
          STARTUP_CATEGORIES
            .QUEUE,
      },
    );
  }
}

class EventBusStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'EventBusStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .CONNECTION_FAILED,

        phase:
          STARTUP_PHASES
            .EVENT_BUS,

        category:
          STARTUP_CATEGORIES
            .QUEUE,
      },
    );
  }
}

class InfrastructureStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'InfrastructureStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .INFRASTRUCTURE_FAILED,

        phase:
          STARTUP_PHASES
            .INFRASTRUCTURE,

        category:
          STARTUP_CATEGORIES
            .LIFECYCLE,
      },
    );
  }
}

class ResilienceStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'ResilienceStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .RESILIENCE_FAILED,

        phase:
          STARTUP_PHASES
            .RESILIENCE,

        category:
          STARTUP_CATEGORIES
            .LIFECYCLE,
      },
    );
  }
}

class ReadinessStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'ReadinessStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .READINESS_FAILED,

        phase:
          STARTUP_PHASES
            .READINESS,

        category:
          STARTUP_CATEGORIES
            .LIFECYCLE,
      },
    );
  }
}

class ServiceStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'ServiceStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .SERVICE_FAILED,

        phase:
          STARTUP_PHASES
            .SERVICES,

        category:
          STARTUP_CATEGORIES
            .INTERNAL,
      },
    );
  }
}

class MiddlewareStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'MiddlewareStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .MIDDLEWARE_FAILED,

        phase:
          STARTUP_PHASES
            .MIDDLEWARE,

        category:
          STARTUP_CATEGORIES
            .INTERNAL,
      },
    );
  }
}

class RouteStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'RouteStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .ROUTE_FAILED,

        phase:
          STARTUP_PHASES
            .ROUTES,

        category:
          STARTUP_CATEGORIES
            .INTERNAL,
      },
    );
  }
}

class ServerStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    const cause =
      options.cause ||
      options.error;

    let code =
      options.code;

    if (
      !code &&
      cause?.code ===
        'EADDRINUSE'
    ) {
      code =
        STARTUP_ERROR_CODES
          .ADDRESS_IN_USE;
    }

    if (
      !code &&
      cause?.code ===
        'EACCES'
    ) {
      code =
        STARTUP_ERROR_CODES
          .PERMISSION_DENIED;
    }

    super(
      message,
      {
        ...options,

        name:
          'ServerStartupError',

        code:
          code ||
          STARTUP_ERROR_CODES
            .SERVER_FAILED,

        phase:
          STARTUP_PHASES
            .SERVER,

        category:
          STARTUP_CATEGORIES
            .NETWORK,
      },
    );
  }
}

class RuntimeStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'RuntimeStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .RUNTIME_FAILED,

        phase:
          STARTUP_PHASES
            .RUNTIME,

        category:
          STARTUP_CATEGORIES
            .SYSTEM,
      },
    );
  }
}

class CircularDependencyStartupError extends StartupError {
  constructor(
    message,
    options = {},
  ) {
    super(
      message,
      {
        ...options,

        name:
          'CircularDependencyStartupError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .CIRCULAR_DEPENDENCY,

        category:
          STARTUP_CATEGORIES
            .LIFECYCLE,

        retryable:
          false,

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/**
 * =============================================================================
 * Normalization API
 * =============================================================================
 */

function normalizeStartupError(
  error,
  options = {},
) {
  return StartupError.from(
    error,
    {
      ...options,
    },
  );
}

function createStartupError(
  message,
  options = {},
) {
  return new StartupError(
    message,
    options,
  );
}

function isStartupError(
  error,
) {
  return (
    error instanceof
    StartupError
  );
}

/**
 * -----------------------------------------------------------------------------
 * Phase-Specific Factory
 * -----------------------------------------------------------------------------
 */

function startupErrorForPhase(
  phase,
  error,
  options = {},
) {
  const normalizedPhase =
    normalizePhase(
      phase,
    );

  switch (
    normalizedPhase
  ) {
    case STARTUP_PHASES
      .ENVIRONMENT:
      return new EnvironmentStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .CONFIGURATION:
      return new ConfigurationStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .DATABASE:
      return new DatabaseStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .REDIS:
      return new RedisStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .QUEUE:
      return new QueueStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .EVENT_BUS:
      return new EventBusStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .INFRASTRUCTURE:
      return new InfrastructureStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .RESILIENCE:
      return new ResilienceStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .READINESS:
      return new ReadinessStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .SERVICES:
      return new ServiceStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .MIDDLEWARE:
      return new MiddlewareStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .ROUTES:
      return new RouteStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .SERVER:
      return new ServerStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    case STARTUP_PHASES
      .RUNTIME:
      return new RuntimeStartupError(
        inferMessage(
          error,
          options.message,
        ),
        {
          ...options,
          cause:
            error,
        },
      );

    default:
      return normalizeStartupError(
        error,
        {
          ...options,
          phase:
            normalizedPhase,
        },
      );
  }
}

/**
 * =============================================================================
 * BootstrapError Boundary Helpers
 * =============================================================================
 */

function wrapStartup(
  phase,
  operation,
  error,
  options = {},
) {
  return startupErrorForPhase(
    phase,
    error,
    {
      ...options,

      operation:
        options.operation ||
        operation,

      component:
        options.component ||
        'bootstrap',
    },
  );
}

async function captureStartup(
  phase,
  operation,
  fn,
  options = {},
) {
  if (
    typeof fn !==
    'function'
  ) {
    throw new TypeError(
      'captureStartup() requires a function.',
    );
  }

  const started =
    process.hrtime.bigint();

  try {
    const value =
      await fn();

    return value;
  } catch (error) {
    throw wrapStartup(
      phase,
      operation,
      error,
      {
        ...options,

        durationMs:
          Number(
            process.hrtime.bigint() -
              started,
          ) /
          1_000_000,
      },
    );
  }
}

/**
 * =============================================================================
 * Aggregated Startup Failure
 * =============================================================================
 */

class StartupAggregateError extends StartupError {
  constructor(
    message,
    errors = [],
    options = {},
  ) {
    const normalizedErrors =
      errors.map(
        error =>
          isStartupError(
            error,
          )
            ? error
            : normalizeStartupError(
                error,
              ),
      );

    const fatal =
      options.fatal ??
      normalizedErrors.some(
        error =>
          error.fatal ||
          error.critical,
      );

    const retryable =
      normalizedErrors.length >
        0 &&
      normalizedErrors.every(
        error =>
          error.retryable,
      );

    super(
      message,
      {
        ...options,

        name:
          'StartupAggregateError',

        code:
          options.code ||
          STARTUP_ERROR_CODES
            .INITIALIZATION_FAILED,

        fatal,

        critical:
          options.critical ??
          fatal,

        retryable,

        retryability:
          retryable
            ? RETRYABILITY.RETRYABLE
            : RETRYABILITY
                .NON_RETRYABLE,

        details: {
          ...(
            options.details ||
            {}
          ),

          errorCount:
            normalizedErrors.length,

          errors:
            normalizedErrors.map(
              error =>
                error.toJSON({
                  includeStack:
                    false,
                }),
            ),
        },
      },
    );

    this.errors =
      Object.freeze([
        ...normalizedErrors,
      ]);
  }

  toJSON(
    options = {},
  ) {
    return {
      ...super.toJSON(
        options,
      ),

      errors:
        this.errors.map(
          error =>
            error.toJSON(
              options,
            ),
        ),
    };
  }
}

/**
 * =============================================================================
 * Convenience Constructors
 * =============================================================================
 */

function environmentError(
  message,
  options,
) {
  return new EnvironmentStartupError(
    message,
    options,
  );
}

function configurationError(
  message,
  options,
) {
  return new ConfigurationStartupError(
    message,
    options,
  );
}

function dependencyError(
  message,
  options,
) {
  return new DependencyStartupError(
    message,
    options,
  );
}

function timeoutError(
  message,
  options,
) {
  return new StartupTimeoutError(
    message,
    options,
  );
}

function databaseError(
  message,
  options,
) {
  return new DatabaseStartupError(
    message,
    options,
  );
}

function redisError(
  message,
  options,
) {
  return new RedisStartupError(
    message,
    options,
  );
}

function queueError(
  message,
  options,
) {
  return new QueueStartupError(
    message,
    options,
  );
}

function eventBusError(
  message,
  options,
) {
  return new EventBusStartupError(
    message,
    options,
  );
}

function infrastructureError(
  message,
  options,
) {
  return new InfrastructureStartupError(
    message,
    options,
  );
}

function resilienceError(
  message,
  options,
) {
  return new ResilienceStartupError(
    message,
    options,
  );
}

function readinessError(
  message,
  options,
) {
  return new ReadinessStartupError(
    message,
    options,
  );
}

function serviceError(
  message,
  options,
) {
  return new ServiceStartupError(
    message,
    options,
  );
}

function middlewareError(
  message,
  options,
) {
  return new MiddlewareStartupError(
    message,
    options,
  );
}

function routeError(
  message,
  options,
) {
  return new RouteStartupError(
    message,
    options,
  );
}

function serverError(
  message,
  options,
) {
  return new ServerStartupError(
    message,
    options,
  );
}

function runtimeError(
  message,
  options,
) {
  return new RuntimeStartupError(
    message,
    options,
  );
}

function circularDependencyError(
  message,
  options,
) {
  return new CircularDependencyStartupError(
    message,
    options,
  );
}

function aggregateStartupErrors(
  message,
  errors,
  options,
) {
  return new StartupAggregateError(
    message,
    errors,
    options,
  );
}

/**
 * =============================================================================
 * Default Export
 * =============================================================================
 */

module.exports =
  Object.freeze({
    /**
     * Main classes.
     */
    StartupError,

    StartupAggregateError,

    EnvironmentStartupError,

    ConfigurationStartupError,

    DependencyStartupError,

    StartupTimeoutError,

    DatabaseStartupError,

    RedisStartupError,

    QueueStartupError,

    EventBusStartupError,

    InfrastructureStartupError,

    ResilienceStartupError,

    ReadinessStartupError,

    ServiceStartupError,

    MiddlewareStartupError,

    RouteStartupError,

    ServerStartupError,

    RuntimeStartupError,

    CircularDependencyStartupError,

    /**
     * Constants.
     */
    STARTUP_PHASES,

    STARTUP_ERROR_CODES,

    STARTUP_SEVERITIES,

    STARTUP_CATEGORIES,

    RETRYABILITY,

    /**
     * Generic factories.
     */
    createStartupError,

    normalizeStartupError,

    startupErrorForPhase,

    wrapStartup,

    captureStartup,

    aggregateStartupErrors,

    isStartupError,

    /**
     * Phase-specific factories.
     */
    environmentError,

    configurationError,

    dependencyError,

    timeoutError,

    databaseError,

    redisError,

    queueError,

    eventBusError,

    infrastructureError,

    resilienceError,

    readinessError,

    serviceError,

    middlewareError,

    routeError,

    serverError,

    runtimeError,

    circularDependencyError,
  });