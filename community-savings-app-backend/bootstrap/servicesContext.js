'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/servicesContext.js
 *
 * Purpose:
 *   Enterprise production-grade service dependency context.
 *
 * Responsibilities:
 *   - Provide a stable dependency-injection context for TITech services.
 *   - Centralize access to configuration, logger, observability, readiness,
 *     resilience and infrastructure resources.
 *   - Prevent services from importing bootstrap internals directly.
 *   - Support immutable base context with controlled runtime bindings.
 *   - Support service-scoped child contexts.
 *   - Support dependency lookup with explicit contracts.
 *   - Support request/correlation/trace context propagation.
 *   - Prevent accidental mutation of shared bootstrap state.
 *   - Provide safe diagnostics without exposing secrets.
 *   - Support graceful application lifecycle integration.
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
 *   servicesContext.js
 *       ↓
 *   application services
 *       ↓
 *   finance / ledger / payments / accounts
 *       ↓
 *   routes
 *
 * IMPORTANT:
 *
 *   This file is a DEPENDENCY CONTEXT.
 *
 *   It does NOT:
 *     - implement business logic
 *     - execute transactions
 *     - implement repositories
 *     - connect to databases
 *     - implement Redis
 *     - implement queues
 *     - implement controllers
 *     - perform financial authorization
 *
 * Service implementations receive dependencies through this context rather
 * than importing global bootstrap modules directly.
 *
 * =============================================================================
 */

const {
  AsyncLocalStorage,
} = require('node:async_hooks');

/**
 * -----------------------------------------------------------------------------
 * Optional Logger
 * -----------------------------------------------------------------------------
 */

let loggerModule = null;

try {
  // eslint-disable-next-line global-require
  loggerModule =
    require('./logger');
} catch {
  loggerModule = null;
}

/**
 * -----------------------------------------------------------------------------
 * Optional Observability
 * -----------------------------------------------------------------------------
 */

let observabilityModule = null;

try {
  // eslint-disable-next-line global-require
  observabilityModule =
    require('./observability');
} catch {
  observabilityModule = null;
}

/**
 * -----------------------------------------------------------------------------
 * Optional Readiness
 * -----------------------------------------------------------------------------
 */

let readinessModule = null;

try {
  // eslint-disable-next-line global-require
  readinessModule =
    require('./readinessState');
} catch {
  readinessModule = null;
}

/**
 * -----------------------------------------------------------------------------
 * Optional Resilience
 * -----------------------------------------------------------------------------
 */

let resilienceModule = null;

try {
  // eslint-disable-next-line global-require
  resilienceModule =
    require('./resilience');
} catch {
  resilienceModule = null;
}

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const COMPONENT =
  'services-context';

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.OTEL_SERVICE_NAME ||
  'titech-backend';

const APPLICATION_NAME =
  process.env.APP_NAME ||
  'titech-community-capital';

/**
 * A private marker prevents ordinary objects from being accidentally accepted
 * as a TITech services context.
 */
const CONTEXT_MARKER =
  Symbol('TITechServicesContext');

/**
 * Per-async-operation service context.
 *
 * This is deliberately independent from logger/observability context so service
 * dependency context remains an architectural concern rather than a logging
 * concern.
 */
const asyncContext =
  new AsyncLocalStorage();

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class ServicesContextError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'ServicesContextError';

    this.code =
      options.code ||
      'SERVICES_CONTEXT_ERROR';

    this.service =
      options.service ||
      null;

    this.dependency =
      options.dependency ||
      null;

    this.cause =
      options.cause ||
      null;

    this.details =
      Object.freeze({
        ...(options.details || {}),
      });

    Error.captureStackTrace?.(
      this,
      ServicesContextError,
    );
  }
}

class DependencyNotFoundError extends ServicesContextError {
  constructor(
    dependency,
    service = null,
  ) {
    super(
      `TITech service dependency "${dependency}" is not available.`,
      {
        code:
          'SERVICE_DEPENDENCY_NOT_FOUND',

        dependency,

        service,
      },
    );
  }
}

class ContextFrozenError extends ServicesContextError {
  constructor(
    message =
      'TITech services context is immutable.',
  ) {
    super(
      message,
      {
        code:
          'SERVICES_CONTEXT_IMMUTABLE',
      },
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Utility
 * -----------------------------------------------------------------------------
 */

function normalizeName(
  value,
  field = 'name',
) {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    throw new TypeError(
      `${field} must be a non-empty string.`,
    );
  }

  return value.trim();
}

function isObject(
  value,
) {
  return (
    value !== null &&
    typeof value ===
      'object'
  );
}

function isFunction(
  value,
) {
  return typeof value ===
    'function';
}

function safeError(
  error,
) {
  if (
    !error
  ) {
    return null;
  }

  return {
    name:
      error.name,

    code:
      error.code,

    message:
      error.message,
  };
}

/**
 * -----------------------------------------------------------------------------
 * Safe Object Freeze
 * -----------------------------------------------------------------------------
 */

function deepFreeze(
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
    typeof value !==
      'object' &&
    typeof value !==
      'function'
  ) {
    return value;
  }

  if (
    seen.has(value)
  ) {
    return value;
  }

  seen.add(value);

  for (
    const key of
      Reflect.ownKeys(value)
  ) {
    try {
      const child =
        value[key];

      deepFreeze(
        child,
        seen,
      );
    } catch {
      /**
       * Accessor-backed objects may intentionally reject inspection.
       */
    }
  }

  try {
    Object.freeze(
      value,
    );
  } catch {
    /**
     * Some third-party objects are not safely freezeable.
     */
  }

  return value;
}

/**
 * -----------------------------------------------------------------------------
 * Safe Diagnostics Sanitization
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
  ]);

function sanitize(
  value,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      sanitize,
    );
  }

  if (
    typeof value !==
    'object'
  ) {
    return value;
  }

  const result = {};

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
      result[key] =
        '[REDACTED]';

      continue;
    }

    result[key] =
      sanitize(child);
  }

  return result;
}

/**
 * =============================================================================
 * Services Context
 * =============================================================================
 */

class ServicesContext {
  constructor(
    options = {},
  ) {
    this[CONTEXT_MARKER] =
      true;

    this.createdAt =
      new Date();

    this.service =
      options.service ||
      null;

    this.operation =
      options.operation ||
      null;

    this.config =
      options.config ||
      null;

    this.environment =
      options.environment ||
      null;

    this.logger =
      options.logger ||
      resolveLogger();

    this.observability =
      options.observability ||
      resolveObservability();

    this.readiness =
      options.readiness ||
      resolveReadiness();

    this.resilience =
      options.resilience ||
      resolveResilience();

    /**
     * Infrastructure resources.
     *
     * These are references, not implementations.
     */
    this.infrastructure =
      options.infrastructure ||
      {};

    /**
     * Application/service registry.
     */
    this.services =
      options.services ||
      options.serviceRegistry ||
      {};

    this.container =
      options.container ||
      {};

    /**
     * Request/trace metadata.
     */
    this.request =
      options.request ||
      {};

    this.correlation =
      options.correlation ||
      {};

    this.trace =
      options.trace ||
      {};

    this.metadata =
      {
        component:
          COMPONENT,

        service:
          SERVICE_NAME,

        application:
          APPLICATION_NAME,

        ...(options.metadata || {}),
      };

    /**
     * Explicit lifecycle state.
     */
    this.lifecycle =
      Object.freeze({
        state:
          options.lifecycleState ||
          'initializing',

        ready:
          options.ready ??
          false,

        degraded:
          options.degraded ??
          false,
      });

    deepFreeze(
      this.infrastructure,
    );

    deepFreeze(
      this.services,
    );

    deepFreeze(
      this.container,
    );

    deepFreeze(
      this.request,
    );

    deepFreeze(
      this.correlation,
    );

    deepFreeze(
      this.trace,
    );

    deepFreeze(
      this.metadata,
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Context Validation
   * ---------------------------------------------------------------------------
   */

  static isContext(
    value,
  ) {
    return Boolean(
      value &&
      value[CONTEXT_MARKER] ===
        true,
    );
  }

  assert() {
    if (
      !ServicesContext.isContext(
        this,
      )
    ) {
      throw new ServicesContextError(
        'Invalid TITech services context.',
        {
          code:
            'INVALID_SERVICES_CONTEXT',
        },
      );
    }

    return true;
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency Lookup
   * ---------------------------------------------------------------------------
   */

  has(
    dependency,
  ) {
    const name =
      normalizeName(
        dependency,
        'dependency',
      );

    return (
      Object.prototype.hasOwnProperty.call(
        this.services,
        name,
      ) ||
      Object.prototype.hasOwnProperty.call(
        this.container,
        name,
      ) ||
      Object.prototype.hasOwnProperty.call(
        this.infrastructure,
        name,
      )
    );
  }

  get(
    dependency,
  ) {
    const name =
      normalizeName(
        dependency,
        'dependency',
      );

    if (
      Object.prototype.hasOwnProperty.call(
        this.services,
        name,
      )
    ) {
      return this.services[
        name
      ];
    }

    if (
      Object.prototype.hasOwnProperty.call(
        this.container,
        name,
      )
    ) {
      return this.container[
        name
      ];
    }

    if (
      Object.prototype.hasOwnProperty.call(
        this.infrastructure,
        name,
      )
    ) {
      return this.infrastructure[
        name
      ];
    }

    return undefined;
  }

  require(
    dependency,
  ) {
    const name =
      normalizeName(
        dependency,
        'dependency',
      );

    const value =
      this.get(
        name,
      );

    if (
      value === undefined ||
      value === null
    ) {
      throw new DependencyNotFoundError(
        name,
        this.service,
      );
    }

    return value;
  }

  getOrDefault(
    dependency,
    fallback,
  ) {
    const value =
      this.get(
        dependency,
      );

    return value === undefined
      ? fallback
      : value;
  }

  /**
   * ---------------------------------------------------------------------------
   * Service Lookup
   * ---------------------------------------------------------------------------
   */

  service(
    name,
  ) {
    const normalized =
      normalizeName(
        name,
        'service',
      );

    return this.services[
      normalized
    ];
  }

  requireService(
    name,
  ) {
    const normalized =
      normalizeName(
        name,
        'service',
      );

    const service =
      this.services[
        normalized
      ];

    if (
      service === undefined ||
      service === null
    ) {
      throw new DependencyNotFoundError(
        normalized,
        this.service,
      );
    }

    return service;
  }

  /**
   * ---------------------------------------------------------------------------
   * Infrastructure Lookup
   * ---------------------------------------------------------------------------
   */

  infrastructureService(
    name,
  ) {
    const normalized =
      normalizeName(
        name,
        'infrastructure',
      );

    return this.infrastructure[
      normalized
    ];
  }

  requireInfrastructure(
    name,
  ) {
    const normalized =
      normalizeName(
        name,
        'infrastructure',
      );

    const resource =
      this.infrastructure[
        normalized
      ];

    if (
      resource === undefined ||
      resource === null
    ) {
      throw new DependencyNotFoundError(
        normalized,
        this.service,
      );
    }

    return resource;
  }

  /**
   * ---------------------------------------------------------------------------
   * Child Service Context
   * ---------------------------------------------------------------------------
   *
   * Child contexts provide service identity and operation metadata without
   * mutating the parent context.
   */

  forService(
    service,
    options = {},
  ) {
    const name =
      normalizeName(
        service,
        'service',
      );

    return createServicesContext({
      parent:
        this,

      service:
        name,

      operation:
        options.operation ||
        null,

      metadata: {
        ...this.metadata,

        service:
          name,

        operation:
          options.operation ||
          null,
      },

      request:
        options.request ||
        this.request,

      correlation:
        options.correlation ||
        this.correlation,

      trace:
        options.trace ||
        this.trace,

      lifecycleState:
        options.lifecycleState ||
        this.lifecycle.state,

      ready:
        options.ready ??
        this.lifecycle.ready,

      degraded:
        options.degraded ??
        this.lifecycle.degraded,
    });
  }

  forOperation(
    operation,
    options = {},
  ) {
    const name =
      normalizeName(
        operation,
        'operation',
      );

    return this.forService(
      options.service ||
        this.service ||
        'application',
      {
        ...options,

        operation:
          name,
      },
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Request Context
   * ---------------------------------------------------------------------------
   */

  withRequest(
    request,
  ) {
    return createServicesContext({
      parent:
        this,

      service:
        this.service,

      operation:
        this.operation,

      request,

      correlation:
        this.correlation,

      trace:
        this.trace,

      metadata: {
        ...this.metadata,
      },

      lifecycleState:
        this.lifecycle.state,

      ready:
        this.lifecycle.ready,

      degraded:
        this.lifecycle.degraded,
    });
  }

  withCorrelation(
    correlation,
  ) {
    return createServicesContext({
      parent:
        this,

      service:
        this.service,

      operation:
        this.operation,

      request:
        this.request,

      correlation,

      trace:
        this.trace,

      metadata: {
        ...this.metadata,
      },

      lifecycleState:
        this.lifecycle.state,

      ready:
        this.lifecycle.ready,

      degraded:
        this.lifecycle.degraded,
    });
  }

  withTrace(
    trace,
  ) {
    return createServicesContext({
      parent:
        this,

      service:
        this.service,

      operation:
        this.operation,

      request:
        this.request,

      correlation:
        this.correlation,

      trace,

      metadata: {
        ...this.metadata,
      },

      lifecycleState:
        this.lifecycle.state,

      ready:
        this.lifecycle.ready,

      degraded:
        this.lifecycle.degraded,
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Logger
   * ---------------------------------------------------------------------------
   */

  childLogger(
    bindings = {},
  ) {
    if (
      !this.logger
    ) {
      return null;
    }

    if (
      typeof this.logger.child !==
      'function'
    ) {
      return this.logger;
    }

    return this.logger.child({
      service:
        this.service ||
        undefined,

      operation:
        this.operation ||
        undefined,

      requestId:
        this.request?.requestId,

      correlationId:
        this.correlation?.correlationId,

      traceId:
        this.trace?.traceId,

      spanId:
        this.trace?.spanId,

      ...bindings,
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Observability
   * ---------------------------------------------------------------------------
   */

  emit(
    event,
    payload = {},
  ) {
    if (
      !this.observability
    ) {
      return null;
    }

    const data = {
      ...payload,

      service:
        this.service ||
        SERVICE_NAME,

      operation:
        this.operation ||
        undefined,

      requestId:
        this.request?.requestId,

      correlationId:
        this.correlation?.correlationId,

      traceId:
        this.trace?.traceId,

      spanId:
        this.trace?.spanId,
    };

    if (
      isFunction(
        this.observability.emitEvent,
      )
    ) {
      return this.observability.emitEvent(
        event,
        data,
      );
    }

    return null;
  }

  async instrument(
    operation,
    fn,
    options = {},
  ) {
    if (
      !this.observability ||
      !isFunction(
        this.observability.instrument,
      )
    ) {
      return fn(
        this.forOperation(
          operation,
          options,
        ),
      );
    }

    const child =
      this.forOperation(
        operation,
        options,
      );

    return this.observability.instrument(
      operation,
      async traceContext => {
        return fn(
          child.withTrace(
            traceContext,
          ),
        );
      },
      options,
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Resilience
   * ---------------------------------------------------------------------------
   */

  getResiliencePolicy(
    name,
  ) {
    if (
      !this.resilience
    ) {
      return undefined;
    }

    if (
      isFunction(
        this.resilience.get,
      )
    ) {
      return this.resilience.get(
        name,
      );
    }

    if (
      this.resilience.policies
    ) {
      return this.resilience.policies[
        name
      ];
    }

    return undefined;
  }

  async executeResilient(
    operation,
    fn,
    options = {},
  ) {
    if (
      !this.resilience
    ) {
      return fn(
        this,
      );
    }

    /**
     * Support common resilience APIs without requiring the service layer to
     * know which resilience implementation is currently installed.
     */

    if (
      isFunction(
        this.resilience.execute,
      )
    ) {
      return this.resilience.execute(
        operation,
        () =>
          fn(this),
        options,
      );
    }

    if (
      isFunction(
        this.resilience.run,
      )
    ) {
      return this.resilience.run(
        operation,
        () =>
          fn(this),
        options,
      );
    }

    if (
      isFunction(
        this.resilience.withResilience,
      )
    ) {
      return this.resilience.withResilience(
        operation,
        () =>
          fn(this),
        options,
      );
    }

    return fn(
      this,
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness
   * ---------------------------------------------------------------------------
   */

  isReady() {
    if (
      this.readiness
    ) {
      if (
        isFunction(
          this.readiness.isReady,
        )
      ) {
        return Boolean(
          this.readiness.isReady(),
        );
      }

      if (
        this.readiness.readinessState &&
        isFunction(
          this.readiness
            .readinessState
            .isReady,
        )
      ) {
        return Boolean(
          this.readiness
            .readinessState
            .isReady(),
        );
      }
    }

    return Boolean(
      this.lifecycle.ready,
    );
  }

  async assertReady(
    operation =
      this.operation ||
      this.service ||
      'service-operation',
  ) {
    if (
      this.isReady()
    ) {
      return true;
    }

    throw new ServicesContextError(
      `TITech service "${operation}" cannot execute because the application is not ready.`,
      {
        code:
          'SERVICE_EXECUTION_NOT_READY',

        service:
          this.service,

        details: {
          operation,
        },
      },
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Configuration
   * ---------------------------------------------------------------------------
   */

  getConfig(
    path,
    fallback,
  ) {
    if (
      !path
    ) {
      return this.config;
    }

    const segments =
      String(path)
        .split('.')
        .filter(Boolean);

    let current =
      this.config;

    for (
      const segment of
        segments
    ) {
      if (
        current === null ||
        current ===
          undefined
      ) {
        return fallback;
      }

      current =
        current[
          segment
        ];
    }

    return current ===
      undefined
      ? fallback
      : current;
  }

  requireConfig(
    path,
  ) {
    const value =
      this.getConfig(
        path,
      );

    if (
      value === undefined ||
      value === null
    ) {
      throw new ServicesContextError(
        `Required TITech service configuration "${path}" is unavailable.`,
        {
          code:
            'SERVICE_CONFIGURATION_MISSING',

          service:
            this.service,

          details: {
            path,
          },
        },
      );
    }

    return value;
  }

  /**
   * ---------------------------------------------------------------------------
   * Scoped Async Context
   * ---------------------------------------------------------------------------
   */

  run(
    callback,
  ) {
    if (
      !isFunction(
        callback,
      )
    ) {
      throw new TypeError(
        'ServicesContext.run() requires a callback function.',
      );
    }

    return asyncContext.run(
      this,
      callback,
    );
  }

  getCurrent() {
    return (
      asyncContext.getStore() ||
      this
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Child Context With Bindings
   * ---------------------------------------------------------------------------
   */

  extend(
    bindings = {},
  ) {
    if (
      !isObject(
        bindings,
      )
    ) {
      throw new TypeError(
        'ServicesContext.extend() requires an object.',
      );
    }

    return createServicesContext({
      parent:
        this,

      service:
        bindings.service ||
        this.service,

      operation:
        bindings.operation ||
        this.operation,

      config:
        bindings.config ||
        this.config,

      environment:
        bindings.environment ||
        this.environment,

      logger:
        bindings.logger ||
        this.logger,

      observability:
        bindings.observability ||
        this.observability,

      readiness:
        bindings.readiness ||
        this.readiness,

      resilience:
        bindings.resilience ||
        this.resilience,

      infrastructure:
        bindings.infrastructure ||
        this.infrastructure,

      services:
        bindings.services ||
        this.services,

      container:
        bindings.container ||
        this.container,

      request:
        bindings.request ||
        this.request,

      correlation:
        bindings.correlation ||
        this.correlation,

      trace:
        bindings.trace ||
        this.trace,

      metadata: {
        ...this.metadata,
        ...(bindings.metadata || {}),
      },

      lifecycleState:
        bindings.lifecycleState ||
        this.lifecycle.state,

      ready:
        bindings.ready ??
        this.lifecycle.ready,

      degraded:
        bindings.degraded ??
        this.lifecycle.degraded,
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Diagnostics
   * ---------------------------------------------------------------------------
   */

  snapshot() {
    return Object.freeze({
      component:
        COMPONENT,

      service:
        this.service,

      operation:
        this.operation,

      application:
        APPLICATION_NAME,

      request:
        sanitize(
          this.request,
        ),

      correlation:
        sanitize(
          this.correlation,
        ),

      trace:
        sanitize(
          this.trace,
        ),

      lifecycle:
        {
          ...this.lifecycle,
        },

      dependencyAvailability:
        Object.freeze({
          logger:
            Boolean(
              this.logger,
            ),

          observability:
            Boolean(
              this.observability,
            ),

          readiness:
            Boolean(
              this.readiness,
            ),

          resilience:
            Boolean(
              this.resilience,
            ),

          infrastructure:
            Object.keys(
              this.infrastructure,
            ).length,

          services:
            Object.keys(
              this.services,
            ).length,

          container:
            Object.keys(
              this.container,
            ).length,
        }),

      metadata:
        sanitize(
          this.metadata,
        ),

      createdAt:
        this.createdAt,
    });
  }
}

/**
 * =============================================================================
 * Factory
 * =============================================================================
 */

function resolveLogger() {
  try {
    return (
      loggerModule?.getLogger?.() ||
      null
    );
  } catch {
    return null;
  }
}

function resolveObservability() {
  try {
    return (
      observabilityModule?.observability ||
      null
    );
  } catch {
    return null;
  }
}

function resolveReadiness() {
  try {
    return (
      readinessModule?.readinessState ||
      readinessModule ||
      null
    );
  } catch {
    return null;
  }
}

function resolveResilience() {
  try {
    return (
      resilienceModule?.getResilience?.() ||
      resilienceModule?.resilience ||
      resilienceModule ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * -----------------------------------------------------------------------------
 * Context Factory
 * -----------------------------------------------------------------------------
 */

function createServicesContext(
  options = {},
) {
  if (
    options.parent
  ) {
    const parent =
      options.parent;

    return new ServicesContext({
      config:
        options.config ??
        parent.config,

      environment:
        options.environment ??
        parent.environment,

      logger:
        options.logger ??
        parent.logger,

      observability:
        options.observability ??
        parent.observability,

      readiness:
        options.readiness ??
        parent.readiness,

      resilience:
        options.resilience ??
        parent.resilience,

      infrastructure:
        options.infrastructure ??
        parent.infrastructure,

      services:
        options.services ??
        parent.services,

      container:
        options.container ??
        parent.container,

      request:
        options.request ??
        parent.request,

      correlation:
        options.correlation ??
        parent.correlation,

      trace:
        options.trace ??
        parent.trace,

      service:
        options.service ??
        parent.service,

      operation:
        options.operation ??
        parent.operation,

      metadata: {
        ...(parent.metadata || {}),
        ...(options.metadata || {}),
      },

      lifecycleState:
        options.lifecycleState ??
        parent.lifecycle.state,

      ready:
        options.ready ??
        parent.lifecycle.ready,

      degraded:
        options.degraded ??
        parent.lifecycle.degraded,
    });
  }

  return new ServicesContext(
    options,
  );
}

/**
 * =============================================================================
 * Default Singleton
 * =============================================================================
 */

let rootContext = null;

/**
 * -----------------------------------------------------------------------------
 * Create Root Context
 * -----------------------------------------------------------------------------
 */

function createRootContext(
  options = {},
) {
  if (
    rootContext
  ) {
    return rootContext;
  }

  rootContext =
    createServicesContext({
      ...options,

      service:
        options.service ||
        'application',

      metadata: {
        component:
          COMPONENT,

        service:
          SERVICE_NAME,

        application:
          APPLICATION_NAME,

        ...(options.metadata || {}),
      },
    });

  return rootContext;
}

/**
 * -----------------------------------------------------------------------------
 * Get Root Context
 * -----------------------------------------------------------------------------
 */

function getRootContext() {
  return (
    rootContext ||
    createRootContext()
  );
}

/**
 * -----------------------------------------------------------------------------
 * Create Request Scope
 * -----------------------------------------------------------------------------
 */

function createRequestContext(
  options = {},
) {
  const context =
    options.parent
      ? createServicesContext({
          parent:
            options.parent,

          request:
            options.request,

          correlation:
            options.correlation,

          trace:
            options.trace,

          service:
            options.service,

          operation:
            options.operation,
        })
      : createServicesContext({
          ...options,
        });

  return context;
}

/**
 * -----------------------------------------------------------------------------
 * Run With Service Context
 * -----------------------------------------------------------------------------
 */

function runWithContext(
  context,
  callback,
) {
  if (
    !ServicesContext.isContext(
      context,
    )
  ) {
    throw new TypeError(
      'runWithContext() requires a valid ServicesContext instance.',
    );
  }

  return context.run(
    callback,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Current Context
 * -----------------------------------------------------------------------------
 */

function getCurrentContext() {
  return (
    asyncContext.getStore() ||
    rootContext ||
    null
  );
}

/**
 * -----------------------------------------------------------------------------
 * Register Service Into Context
 * -----------------------------------------------------------------------------
 *
 * This is primarily for the bootstrap/services.js registry.
 */

function addService(
  name,
  service,
) {
  const normalized =
    normalizeName(
      name,
      'service',
    );

  if (
    !rootContext
  ) {
    rootContext =
      createRootContext();
  }

  const existing =
    {
      ...rootContext.services,
    };

  existing[
    normalized
  ] =
    service;

  rootContext =
    createServicesContext({
      parent:
        rootContext,

      services:
        existing,
    });

  return rootContext;
}

/**
 * -----------------------------------------------------------------------------
 * Register Infrastructure Into Context
 * -----------------------------------------------------------------------------
 */

function addInfrastructure(
  name,
  resource,
) {
  const normalized =
    normalizeName(
      name,
      'infrastructure',
    );

  if (
    !rootContext
  ) {
    rootContext =
      createRootContext();
  }

  const existing =
    {
      ...rootContext.infrastructure,
    };

  existing[
    normalized
  ] =
    resource;

  rootContext =
    createServicesContext({
      parent:
        rootContext,

      infrastructure:
        existing,
    });

  return rootContext;
}

/**
 * -----------------------------------------------------------------------------
 * Root Context Lifecycle
 * -----------------------------------------------------------------------------
 */

function resetRootContext() {
  rootContext =
    null;

  return true;
}

function snapshot() {
  return getRootContext()
    .snapshot();
}

/**
 * =============================================================================
 * Bootstrap Lifecycle Integration
 * =============================================================================
 *
 * Creates the root context only after the foundational bootstrap components are
 * available.
 */

function registerBootstrapHooks(
  context = {},
  options = {},
) {
  const {
    hooks,
    lifecycle,
  } =
    require('./hooks');

  if (
    hooks.has(
      COMPONENT,
    )
  ) {
    return hooks.get(
      COMPONENT,
    );
  }

  return lifecycle(
    COMPONENT,
    {
      priority:
        options.priority ??
        -100,

      dependencies:
        options.dependencies ||
        [
          'configuration',
          'logger',
          'observability',
          'readiness',
          'resilience',
        ],

      critical:
        options.critical !==
        false,

      timeoutMs:
        options.timeoutMs ||
        30_000,

      start:
        async hookContext => {
          const runtime =
            hookContext ||
            context ||
            {};

          const created =
            createRootContext({
              config:
                runtime.config,

              environment:
                runtime.environment,

              logger:
                runtime.logger ||
                resolveLogger(),

              observability:
                runtime.observability ||
                resolveObservability(),

              readiness:
                runtime.readiness ||
                resolveReadiness(),

              resilience:
                runtime.resilience ||
                resolveResilience(),

              infrastructure:
                runtime.infrastructure ||
                {},

              services:
                runtime.services ||
                runtime.serviceRegistry ||
                {},

              container:
                runtime.container ||
                {},

              metadata: {
                bootstrap:
                  true,
              },
            });

          /**
           * Publish context to bootstrap runtime.
           */
          runtime.servicesContext =
            created;

          runtime.serviceContext =
            created;

          return created;
        },

      ready:
        async () => {
          return Boolean(
            rootContext,
          );
        },

      health:
        async () => ({
          status:
            rootContext
              ? 'healthy'
              : 'unhealthy',

          component:
            COMPONENT,

          service:
            SERVICE_NAME,

          context:
            rootContext
              ? rootContext.snapshot()
              : null,
        }),

      stop:
        async () => {
          /**
           * Do not destroy service instances here.
           *
           * services.js owns service shutdown.
           */
          rootContext =
            null;
        },

      metadata: {
        component:
          COMPONENT,

        service:
          SERVICE_NAME,

        implementation:
          'backend/bootstrap/servicesContext.js',
      },
    },
  );
}

/**
 =============================================================================
 * Export
 * =============================================================================
 */

module.exports =
  Object.freeze({
    /**
     * Classes/errors.
     */
    ServicesContext,

    ServicesContextError,

    DependencyNotFoundError,

    ContextFrozenError,

    /**
     * Factory.
     */
    createServicesContext,

    createRootContext,

    getRootContext,

    createRequestContext,

    /**
     * Async context.
     */
    runWithContext,

    getCurrentContext,

    /**
     * Runtime bindings.
     */
    addService,

    addInfrastructure,

    /**
     * Lifecycle.
     */
    registerBootstrapHooks,

    /**
     * Diagnostics/testing.
     */
    snapshot,

    resetRootContext,

    /**
     * Metadata.
     */
    COMPONENT,

    SERVICE_NAME,

    APPLICATION_NAME,
  });