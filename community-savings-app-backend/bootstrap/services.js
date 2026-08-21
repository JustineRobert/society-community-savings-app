'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/services.js
 *
 * Purpose:
 *   Enterprise production-grade application services bootstrap adapter.
 *
 * Responsibilities:
 *   - Compose application service lifecycle into the TITech bootstrap pipeline.
 *   - Initialize service registries/factories after infrastructure is ready.
 *   - Validate service contracts before the application accepts traffic.
 *   - Support dependency-aware service startup and shutdown.
 *   - Support service readiness and health reporting.
 *   - Prevent duplicate service initialization.
 *   - Preserve existing domain/service implementations.
 *   - Keep service composition out of app.js.
 *   - Provide safe diagnostics.
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
 *   HTTP server
 *
 * IMPORTANT:
 *
 *   This file is a SERVICE COMPOSITION ADAPTER.
 *
 *   It does NOT:
 *     - implement business rules
 *     - implement finance logic
 *     - implement ledger logic
 *     - execute database queries directly
 *     - implement payment providers
 *     - process queues directly
 *     - implement controllers
 *     - implement HTTP routes
 *
 * Existing services remain authoritative.
 *
 * Supported service module contracts:
 *
 *   registerServices(context)
 *   registerServices(container, context)
 *   initializeServices(context)
 *   createServices(context)
 *   start(context)
 *   stop(context)
 *
 * A service registry/container may additionally expose:
 *
 *   initialize()
 *   init()
 *   start()
 *   shutdown()
 *   close()
 *   stop()
 *   destroy()
 *   readiness()
 *   isReady()
 *   health()
 *   checkHealth()
 *
 * =============================================================================
 */

const {
  hooks,
  lifecycle,
} = require('./hooks');

/**
 * -----------------------------------------------------------------------------
 * Optional integrations
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

let observabilityModule = null;

try {
  // eslint-disable-next-line global-require
  observabilityModule =
    require('./observability');
} catch {
  observabilityModule = null;
}

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
 * Constants
 * -----------------------------------------------------------------------------
 */

const COMPONENT =
  'services';

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.OTEL_SERVICE_NAME ||
  'titech-backend';

const DEFAULT_PRIORITY =
  0;

const DEFAULT_TIMEOUT_MS =
  60_000;

const DEFAULT_READINESS_TIMEOUT_MS =
  10_000;

const DEFAULT_HEALTH_TIMEOUT_MS =
  5_000;

const DEFAULT_DEPENDENCIES =
  Object.freeze([
    'database',
    'redis',
    'resilience',
  ]);

const SERVICE_MODULE_CANDIDATES =
  Object.freeze([
    '../services',
    '../services/index',
    '../application/services',
    '../domain/services',
    '../service',
    '../service/index',
  ]);

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class ServicesBootstrapError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'ServicesBootstrapError';

    this.code =
      options.code ||
      'SERVICES_BOOTSTRAP_ERROR';

    this.phase =
      options.phase ||
      null;

    this.service =
      options.service ||
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
      ServicesBootstrapError,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Internal State
 * -----------------------------------------------------------------------------
 */

let servicesImplementation =
  null;

let servicesModulePath =
  null;

let servicesRegistry =
  null;

let registered =
  false;

let started =
  false;

let stopped =
  false;

let failed =
  false;

let degraded =
  false;

let registrationResult =
  null;

let startPromise =
  null;

let stopPromise =
  null;

let lastError =
  null;

let startedAt =
  null;

let stoppedAt =
  null;

let serviceCount =
  0;

/**
 * Individual service registry.
 *
 * This allows TITech to gradually migrate existing services into explicit
 * lifecycle contracts without requiring all services to be rewritten at once.
 */
const serviceDefinitions =
  new Map();

const serviceStates =
  new Map();

/**
 * -----------------------------------------------------------------------------
 * Utility Helpers
 * -----------------------------------------------------------------------------
 */

function asPositiveInteger(
  value,
  fallback,
  field,
) {
  const resolved =
    value === undefined
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(
      resolved,
    ) ||
    resolved <= 0
  ) {
    return fallback;
  }

  return resolved;
}

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

function moduleExists(
  modulePath,
) {
  try {
    require.resolve(
      modulePath,
    );

    return true;
  } catch (error) {
    if (
      error?.code ===
      'MODULE_NOT_FOUND'
    ) {
      return false;
    }

    throw error;
  }
}

function unwrapModule(
  value,
) {
  if (
    value &&
    value.default
  ) {
    return value.default;
  }

  return value;
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

function isFunction(
  value,
) {
  return typeof value ===
    'function';
}

/**
 * -----------------------------------------------------------------------------
 * Logger
 * -----------------------------------------------------------------------------
 */

function log(
  level,
  payload,
  message,
) {
  try {
    const logger =
      loggerModule?.getLogger?.();

    if (
      logger &&
      typeof logger[level] ===
        'function'
    ) {
      logger[level](
        {
          component:
            COMPONENT,

          service:
            SERVICE_NAME,

          ...payload,
        },
        message,
      );

      return;
    }
  } catch {
    // Best-effort logging only.
  }

  const output =
    `[${COMPONENT}] ${message}`;

  if (
    level === 'error' ||
    level === 'fatal'
  ) {
    process.stderr.write(
      `${output}\n`,
    );
  } else {
    process.stdout.write(
      `${output}\n`,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Observability
 * -----------------------------------------------------------------------------
 */

function emitObservabilityEvent(
  event,
  payload = {},
) {
  try {
    if (
      observabilityModule
        ?.observability
        ?.emitEvent
    ) {
      return observabilityModule
        .observability
        .emitEvent(
          event,
          {
            component:
              COMPONENT,

            service:
              SERVICE_NAME,

            ...payload,
          },
        );
    }

    if (
      typeof observabilityModule?.emitEvent ===
      'function'
    ) {
      return observabilityModule.emitEvent(
        event,
        {
          component:
            COMPONENT,

          service:
            SERVICE_NAME,

          ...payload,
        },
      );
    }
  } catch {
    /**
     * Service lifecycle must not fail because telemetry failed.
     */
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * Dependency Normalization
 * -----------------------------------------------------------------------------
 */

function normalizeDependencies(
  dependencies,
) {
  if (
    dependencies ===
      undefined ||
    dependencies ===
      null
  ) {
    return [];
  }

  if (
    !Array.isArray(
      dependencies,
    )
  ) {
    throw new TypeError(
      'Service dependencies must be an array.',
    );
  }

  return [
    ...new Set(
      dependencies
        .map(
          dependency =>
            normalizeName(
              dependency,
              'dependency',
            ),
        ),
    ),
  ];
}

/**
 * -----------------------------------------------------------------------------
 * Service Definition
 * -----------------------------------------------------------------------------
 */

function normalizeServiceDefinition(
  options = {},
) {
  const name =
    normalizeName(
      options.name,
    );

  if (
    serviceDefinitions.has(
      name,
    )
  ) {
    throw new ServicesBootstrapError(
      `Service "${name}" is already registered.`,
      {
        code:
          'SERVICE_DUPLICATE_REGISTRATION',

        service:
          name,
      },
    );
  }

  const definition =
    Object.freeze({
      name,

      description:
        options.description ||
        null,

      version:
        options.version ||
        null,

      enabled:
        options.enabled !==
        false,

      critical:
        options.critical !==
        false,

      priority:
        Number.isInteger(
          options.priority,
        )
          ? options.priority
          : 0,

      dependencies:
        Object.freeze(
          normalizeDependencies(
            options.dependencies,
          ),
        ),

      timeoutMs:
        asPositiveInteger(
          options.timeoutMs,
          DEFAULT_TIMEOUT_MS,
          `service "${name}" timeout`,
        ),

      readinessTimeoutMs:
        asPositiveInteger(
          options.readinessTimeoutMs,
          DEFAULT_READINESS_TIMEOUT_MS,
          `service "${name}" readiness timeout`,
        ),

      healthTimeoutMs:
        asPositiveInteger(
          options.healthTimeoutMs,
          DEFAULT_HEALTH_TIMEOUT_MS,
          `service "${name}" health timeout`,
        ),

      initialize:
        options.initialize ||
        options.init ||
        null,

      start:
        options.start ||
        null,

      stop:
        options.stop ||
        null,

      shutdown:
        options.shutdown ||
        null,

      destroy:
        options.destroy ||
        null,

      readiness:
        options.readiness ||
        options.ready ||
        null,

      health:
        options.health ||
        options.checkHealth ||
        null,

      metadata:
        Object.freeze({
          ...(options.metadata || {}),
        }),

      registeredAt:
        new Date(),
    });

  for (
    const [
      field,
      value,
    ] of Object.entries(
      definition,
    )
  ) {
    if (
      [
        'initialize',
        'start',
        'stop',
        'shutdown',
        'destroy',
        'readiness',
        'health',
      ].includes(field) &&
      value !== null &&
      !isFunction(value)
    ) {
      throw new ServicesBootstrapError(
        `Service "${name}" field "${field}" must be a function.`,
        {
          code:
            'SERVICE_LIFECYCLE_CONTRACT_INVALID',

          service:
            name,

          details: {
            field,
          },
        },
      );
    }
  }

  return definition;
}

/**
 * -----------------------------------------------------------------------------
 * Register Individual Service
 * -----------------------------------------------------------------------------
 */

function registerService(
  options = {},
) {
  const definition =
    normalizeServiceDefinition(
      options,
    );

  serviceDefinitions.set(
    definition.name,
    definition,
  );

  serviceStates.set(
    definition.name,
    {
      state:
        definition.enabled
          ? 'registered'
          : 'disabled',

      started:
        false,

      ready:
        false,

      failed:
        false,

      startedAt:
        null,

      readyAt:
        null,

      stoppedAt:
        null,

      lastError:
        null,

      durationMs:
        null,
    },
  );

  serviceCount =
    serviceDefinitions.size;

  return definition;
}

/**
 * -----------------------------------------------------------------------------
 * Service Lookup
 * -----------------------------------------------------------------------------
 */

function hasService(
  name,
) {
  return serviceDefinitions.has(
    name,
  );
}

function getService(
  name,
) {
  const definition =
    serviceDefinitions.get(
      name,
    );

  if (!definition) {
    return null;
  }

  return {
    definition,

    state:
      serviceStates.get(
        name,
      ),
  };
}

function listServices({
  enabledOnly = false,
} = {}) {
  return [
    ...serviceDefinitions.values(),
  ].filter(
    definition =>
      !enabledOnly ||
      definition.enabled,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Service Dependency Ordering
 * -----------------------------------------------------------------------------
 */

function resolveServiceOrder(
  direction = 'startup',
) {
  const services =
    listServices({
      enabledOnly:
        true,
    });

  const serviceMap =
    new Map(
      services.map(
        service => [
          service.name,
          service,
        ],
      ),
    );

  const incoming =
    new Map();

  const outgoing =
    new Map();

  for (
    const service of
      services
  ) {
    incoming.set(
      service.name,
      0,
    );

    outgoing.set(
      service.name,
      new Set(),
    );
  }

  for (
    const service of
      services
  ) {
    for (
      const dependency of
        service.dependencies
    ) {
      if (
        !serviceMap.has(
          dependency,
        )
      ) {
        /**
         * A service may legitimately depend on an infrastructure lifecycle
         * manager that is not registered in the local service registry.
         *
         * Only service-to-service dependencies are resolved here.
         */
        continue;
      }

      if (
        dependency ===
        service.name
      ) {
        throw new ServicesBootstrapError(
          `Service "${service.name}" cannot depend on itself.`,
          {
            code:
              'SERVICE_SELF_DEPENDENCY',

            service:
              service.name,
          },
        );
      }

      incoming.set(
        service.name,
        incoming.get(
          service.name,
        ) + 1,
      );

      outgoing
        .get(dependency)
        .add(
          service.name,
        );
    }
  }

  const queue =
    services
      .filter(
        service =>
          incoming.get(
            service.name,
          ) === 0,
      )
      .sort(
        compareServices,
      );

  const order = [];

  while (
    queue.length >
    0
  ) {
    const current =
      queue.shift();

    order.push(
      current,
    );

    for (
      const dependent of
        outgoing.get(
          current.name,
        )
    ) {
      const remaining =
        incoming.get(
          dependent,
        ) - 1;

      incoming.set(
        dependent,
        remaining,
      );

      if (
        remaining ===
        0
      ) {
        queue.push(
          serviceMap.get(
            dependent,
          ),
        );

        queue.sort(
          compareServices,
        );
      }
    }
  }

  if (
    order.length !==
    services.length
  ) {
    const cyclic =
      services
        .filter(
          service =>
            incoming.get(
              service.name,
            ) > 0,
        )
        .map(
          service =>
            service.name,
        );

    throw new ServicesBootstrapError(
      'Circular TITech service dependency detected.',
      {
        code:
          'SERVICE_DEPENDENCY_CYCLE',

        details: {
          direction,
          services:
            cyclic,
        },
      },
    );
  }

  return direction ===
    'shutdown'
    ? order.reverse()
    : order;
}

function compareServices(
  a,
  b,
) {
  if (
    a.priority !==
    b.priority
  ) {
    return (
      a.priority -
      b.priority
    );
  }

  return a.name.localeCompare(
    b.name,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Timeout Helper
 * -----------------------------------------------------------------------------
 */

async function withTimeout(
  fn,
  timeoutMs,
  operation,
) {
  let timer;

  const work =
    Promise.resolve().then(
      fn,
    );

  const timeout =
    new Promise(
      (_, reject) => {
        timer =
          setTimeout(
            () => {
              reject(
                new ServicesBootstrapError(
                  `TITech ${operation} timed out after ${timeoutMs}ms.`,
                  {
                    code:
                      'SERVICE_LIFECYCLE_TIMEOUT',
                  },
                ),
              );
            },
            timeoutMs,
          );

        timer.unref?.();
      },
    );

  try {
    return await Promise.race([
      work,
      timeout,
    ]);
  } finally {
    clearTimeout(
      timer,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Generic Service Method Discovery
 * -----------------------------------------------------------------------------
 */

function findLifecycleMethod(
  target,
  candidates,
) {
  if (
    !target
  ) {
    return null;
  }

  for (
    const name of
      candidates
  ) {
    if (
      typeof target[name] ===
      'function'
    ) {
      return target[name].bind(
        target,
      );
    }
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * External Service Module Resolution
 * -----------------------------------------------------------------------------
 */

function resolveServicesImplementation() {
  if (
    servicesImplementation
  ) {
    return {
      implementation:
        servicesImplementation,

      path:
        servicesModulePath,
    };
  }

  for (
    const candidate of
      SERVICE_MODULE_CANDIDATES
  ) {
    if (
      !moduleExists(
        candidate,
      )
    ) {
      continue;
    }

    try {
      const loaded =
        require(candidate);

      servicesImplementation =
        unwrapModule(
          loaded,
        );

      servicesModulePath =
        candidate;

      return {
        implementation:
          servicesImplementation,

        path:
          servicesModulePath,
      };
    } catch (error) {
      throw new ServicesBootstrapError(
        'Failed to load the TITech service module.',
        {
          code:
            'SERVICES_MODULE_LOAD_FAILED',

          cause:
            error,

          details: {
            candidate,
          },
        },
      );
    }
  }

  return {
    implementation:
      null,

    path:
      null,
  };
}

/**
 * -----------------------------------------------------------------------------
 * Existing Service Registry Initialization
 * -----------------------------------------------------------------------------
 */

function resolveExternalServiceContract(
  implementation,
) {
  if (
    !implementation
  ) {
    return null;
  }

  const candidates = [
    implementation,
    implementation.services,
    implementation.registry,
    implementation.container,
    implementation.manager,
    implementation.default,
  ].filter(Boolean);

  const target =
    candidates[0] ||
    implementation;

  return {
    target,

    initialize:
      findLifecycleMethod(
        target,
        [
          'registerServices',
          'initializeServices',
          'initialize',
          'init',
          'bootstrap',
        ],
      ),

    start:
      findLifecycleMethod(
        target,
        [
          'start',
          'startServices',
        ],
      ),

    stop:
      findLifecycleMethod(
        target,
        [
          'shutdown',
          'stopServices',
          'stop',
          'close',
          'destroy',
        ],
      ),

    readiness:
      findLifecycleMethod(
        target,
        [
          'readiness',
          'ready',
        ],
      ),

    isReady:
      findLifecycleMethod(
        target,
        [
          'isReady',
        ],
      ),

    health:
      findLifecycleMethod(
        target,
        [
          'health',
          'checkHealth',
          'getHealth',
        ],
      ),
  };
}

/**
 * -----------------------------------------------------------------------------
 * Register Default Service Registry
 * -----------------------------------------------------------------------------
 *
 * This function does not force a service module to exist.
 *
 * Existing individually registered services remain valid.
 */

function loadServiceModule(
  context = {},
) {
  const resolved =
    resolveServicesImplementation();

  if (
    !resolved.implementation
  ) {
    return null;
  }

  const contract =
    resolveExternalServiceContract(
      resolved.implementation,
    );

  return {
    ...resolved,
    ...contract,
  };
}

/**
 * -----------------------------------------------------------------------------
 * Start Individual Service
 * -----------------------------------------------------------------------------
 */

async function startRegisteredService(
  definition,
  context,
) {
  const state =
    serviceStates.get(
      definition.name,
    );

  if (
    !state ||
    !definition.enabled
  ) {
    return;
  }

  const timer =
    process.hrtime.bigint();

  state.state =
    'starting';

  state.startedAt =
    new Date();

  state.failed =
    false;

  state.lastError =
    null;

  try {
    const startHandler =
      definition.initialize ||
      definition.start;

    if (
      startHandler
    ) {
      await withTimeout(
        () =>
          startHandler({
            ...context,

            services:
              servicesRegistry,

            service:
              definition,
          }),
        definition.timeoutMs,
        `service "${definition.name}" startup`,
      );
    }

    state.state =
      'started';

    state.started =
      true;

    state.ready =
      false;

    state.durationMs =
      Number(
        process.hrtime.bigint() -
          timer,
      ) / 1_000_000;

    emitObservabilityEvent(
      'service.started',
      {
        serviceName:
          definition.name,

        durationMs:
          state.durationMs,
      },
    );
  } catch (error) {
    state.state =
      'failed';

    state.failed =
      true;

    state.started =
      false;

    state.ready =
      false;

    state.lastError =
      safeError(
        error,
      );

    state.durationMs =
      Number(
        process.hrtime.bigint() -
          timer,
      ) / 1_000_000;

    throw new ServicesBootstrapError(
      `TITech service "${definition.name}" failed during startup.`,
      {
        code:
          'SERVICE_START_FAILED',

        service:
          definition.name,

        cause:
          error,

        details: {
          durationMs:
            state.durationMs,
        },
      },
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Stop Individual Service
 * -----------------------------------------------------------------------------
 */

async function stopRegisteredService(
  definition,
  context,
) {
  const state =
    serviceStates.get(
      definition.name,
    );

  if (
    !state ||
    !definition.enabled ||
    !state.started
  ) {
    return;
  }

  const timer =
    process.hrtime.bigint();

  state.state =
    'stopping';

  try {
    const stopHandler =
      definition.stop ||
      definition.shutdown ||
      definition.destroy;

    if (
      stopHandler
    ) {
      await withTimeout(
        () =>
          stopHandler({
            ...context,

            services:
              servicesRegistry,

            service:
              definition,
          }),
        definition.timeoutMs,
        `service "${definition.name}" shutdown`,
      );
    }

    state.state =
      'stopped';

    state.started =
      false;

    state.ready =
      false;

    state.stoppedAt =
      new Date();

    state.durationMs =
      Number(
        process.hrtime.bigint() -
          timer,
      ) / 1_000_000;

    emitObservabilityEvent(
      'service.stopped',
      {
        serviceName:
          definition.name,

        durationMs:
          state.durationMs,
      },
    );
  } catch (error) {
    state.state =
      'failed';

    state.failed =
      true;

    state.lastError =
      safeError(
        error,
      );

    state.durationMs =
      Number(
        process.hrtime.bigint() -
          timer,
      ) / 1_000_000;

    throw new ServicesBootstrapError(
      `TITech service "${definition.name}" failed during shutdown.`,
      {
        code:
          'SERVICE_STOP_FAILED',

        service:
          definition.name,

        cause:
          error,

        details: {
          durationMs:
            state.durationMs,
        },
      },
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Service Readiness
 * -----------------------------------------------------------------------------
 */

async function checkRegisteredServiceReadiness(
  definition,
  context,
) {
  const state =
    serviceStates.get(
      definition.name,
    );

  if (
    !state ||
    !definition.enabled
  ) {
    return {
      ready:
        definition.enabled ===
        false,

      state:
        'disabled',
    };
  }

  try {
    let ready =
      state.started;

    if (
      definition.readiness
    ) {
      const result =
        await withTimeout(
          () =>
            definition.readiness({
              ...context,

              service:
                definition,

              services:
                servicesRegistry,
            }),
          definition.readinessTimeoutMs,
          `service "${definition.name}" readiness check`,
        );

      ready =
        normalizeReadiness(
          result,
        );
    }

    state.ready =
      ready;

    state.state =
      ready
        ? 'ready'
        : 'not_ready';

    if (
      ready
    ) {
      state.readyAt =
        state.readyAt ||
        new Date();
    }

    return {
      ready,

      state:
        state.state,
    };
  } catch (error) {
    state.ready =
      false;

    state.state =
      'not_ready';

    state.lastError =
      safeError(
        error,
      );

    return {
      ready:
        false,

      state:
        'not_ready',

      error:
        safeError(
          error,
        ),
    };
  }
}

/**
 * -----------------------------------------------------------------------------
 * Readiness Normalization
 * -----------------------------------------------------------------------------
 */

function normalizeReadiness(
  result,
) {
  if (
    typeof result ===
    'boolean'
  ) {
    return result;
  }

  if (
    result ===
      null ||
    result ===
      undefined
  ) {
    return true;
  }

  if (
    typeof result ===
    'object'
  ) {
    return (
      result.ready !==
        false &&
      result.status !==
        'not_ready' &&
      result.status !==
        'unhealthy'
    );
  }

  return Boolean(
    result,
  );
}

/**
 * -----------------------------------------------------------------------------
 * External Registry Registration
 * -----------------------------------------------------------------------------
 */

async function initializeExternalServiceRegistry(
  context,
) {
  const resolved =
    loadServiceModule(
      context,
    );

  if (
    !resolved
  ) {
    return null;
  }

  const {
    implementation,
    initialize,
    start,
    stop,
    readiness,
    isReady,
    health,
    path,
  } = resolved;

  /**
   * If an external service registry exposes a registration function, allow it
   * to compose services.
   */
  if (
    initialize
  ) {
    const result =
      await initialize({
        ...context,

        services:
          servicesRegistry,

        component:
          COMPONENT,
      });

    servicesRegistry =
      result ||
      implementation;
  } else {
    servicesRegistry =
      implementation;
  }

  return {
    implementation:
      servicesRegistry,

    path,

    initialize,

    start,

    stop,

    readiness,

    isReady,

    health,
  };
}

/**
 * -----------------------------------------------------------------------------
 * External Registry Lifecycle
 * -----------------------------------------------------------------------------
 */

async function startExternalRegistry(
  contract,
  context,
) {
  if (
    !contract
  ) {
    return null;
  }

  if (
    contract.start
  ) {
    return contract.start({
      ...context,

      services:
        servicesRegistry,

      component:
        COMPONENT,
    });
  }

  return null;
}

async function stopExternalRegistry(
  contract,
  context,
) {
  if (
    !contract
  ) {
    return null;
  }

  if (
    contract.stop
  ) {
    return contract.stop({
      ...context,

      services:
        servicesRegistry,

      component:
        COMPONENT,
    });
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * Register Readiness Dependency
 * -----------------------------------------------------------------------------
 */

function registerReadinessDependency(
  context = {},
  options = {},
) {
  if (
    !readinessModule
  ) {
    return null;
  }

  const {
    register,
    has,
  } =
    readinessModule;

  if (
    typeof register !==
    'function'
  ) {
    return null;
  }

  if (
    typeof has ===
      'function' &&
    has(COMPONENT)
  ) {
    return null;
  }

  try {
    return register({
      name:
        COMPONENT,

      severity:
        options.readinessSeverity ||
        'required',

      enabled:
        options.enabled !==
        false,

      readiness:
        async () => {
          if (
            serviceDefinitions.size ===
            0
          ) {
            /**
             * No locally registered services means the external service
             * registry is the readiness authority.
             */
            return {
              ready:
                started &&
                !failed &&
                !stopped,
            };
          }

          const results =
            await checkAllServices(
              context,
            );

          return {
            ready:
              results.requiredFailures
                .length ===
                0,

            degraded:
              results.optionalFailures
                .length >
              0,

            services:
              results.services,
          };
        },

      health:
        async () =>
          health(),

      timeoutMs:
        options.readinessTimeoutMs ||
        DEFAULT_READINESS_TIMEOUT_MS,

      metadata: {
        component:
          COMPONENT,

        service:
          SERVICE_NAME,
      },
    });
  } catch (error) {
    lastError =
      error;

    return null;
  }
}

/**
 * -----------------------------------------------------------------------------
 * Check All Services
 * -----------------------------------------------------------------------------
 */

async function checkAllServices(
  context = {},
) {
  const enabled =
    listServices({
      enabledOnly:
        true,
    });

  const results = {};

  const requiredFailures =
    [];

  const optionalFailures =
    [];

  for (
    const definition of
      enabled
  ) {
    const result =
      await checkRegisteredServiceReadiness(
        definition,
        context,
      );

    results[
      definition.name
    ] = {
      ...result,

      critical:
        definition.critical,

      dependencies:
        [
          ...definition.dependencies,
        ],
    };

    if (
      !result.ready
    ) {
      if (
        definition.critical
      ) {
        requiredFailures.push(
          definition.name,
        );
      } else {
        optionalFailures.push(
          definition.name,
        );
      }
    }
  }

  return {
    services:
      results,

    requiredFailures,

    optionalFailures,
  };
}

/**
 * =============================================================================
 * Bootstrap Service Registration
 * =============================================================================
 */

function registerServicesHooks(
  context = {},
  options = {},
) {
  /**
   * ---------------------------------------------------------------------------
   * Duplicate Registration Protection
   * ---------------------------------------------------------------------------
   */

  if (
    hooks.has(
      COMPONENT,
    )
  ) {
    registered =
      true;

    registrationResult =
      hooks.get(
        COMPONENT,
      );

    return registrationResult;
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness Registration
   * ---------------------------------------------------------------------------
   */

  registerReadinessDependency(
    context,
    options,
  );

  /**
   * ---------------------------------------------------------------------------
   * Lifecycle Registration
   * ---------------------------------------------------------------------------
   */

  registrationResult =
    lifecycle(
      COMPONENT,
      {
        priority:
          options.priority ??
          DEFAULT_PRIORITY,

        dependencies:
          Array.isArray(
            options.dependencies,
          )
            ? [
                ...options.dependencies,
              ]
            : [
                ...DEFAULT_DEPENDENCIES,
              ],

        timeoutMs:
          asPositiveInteger(
            options.timeoutMs,
            DEFAULT_TIMEOUT_MS,
            'services timeout',
          ),

        critical:
          options.critical !==
          false,

        enabled:
          options.enabled !==
          false,

        metadata: {
          component:
            COMPONENT,

          service:
            SERVICE_NAME,

          implementation:
            'backend/bootstrap/services.js',
        },

        /**
         * ---------------------------------------------------------------------
         * START
         * ---------------------------------------------------------------------
         */

        start:
          async hookContext => {
            if (
              startPromise
            ) {
              return startPromise;
            }

            startPromise =
              (async () => {
                const runtimeContext =
                  hookContext ||
                  context ||
                  {};

                const timer =
                  process.hrtime.bigint();

                try {
                  /**
                   * First initialize any central external service registry.
                   */
                  const externalContract =
                    await initializeExternalServiceRegistry(
                      runtimeContext,
                    );

                  /**
                   * Then start registered service modules in dependency order.
                   */
                  const order =
                    resolveServiceOrder(
                      'startup',
                    );

                  for (
                    const definition of
                      order
                  ) {
                    await startRegisteredService(
                      definition,
                      runtimeContext,
                    );
                  }

                  /**
                   * Some service registries expose a distinct start phase
                   * after registration/initialization.
                   */
                  if (
                    externalContract
                      ?.start
                  ) {
                    await withTimeout(
                      () =>
                        startExternalRegistry(
                          externalContract,
                          runtimeContext,
                        ),
                      DEFAULT_TIMEOUT_MS,
                      'external service registry startup',
                    );
                  }

                  serviceCount =
                    serviceDefinitions.size;

                  started =
                    true;

                  stopped =
                    false;

                  failed =
                    false;

                  degraded =
                    false;

                  startedAt =
                    new Date();

                  lastError =
                    null;

                  if (
                    runtimeContext &&
                    typeof runtimeContext ===
                      'object'
                  ) {
                    runtimeContext.services =
                      servicesRegistry;

                    runtimeContext.serviceRegistry =
                      servicesRegistry;
                  }

                  const durationMs =
                    Number(
                      process.hrtime.bigint() -
                        timer,
                    ) /
                    1_000_000;

                  emitObservabilityEvent(
                    'services.started',
                    {
                      serviceCount,

                      durationMs,

                      externalRegistry:
                        Boolean(
                          externalContract,
                        ),
                    },
                  );

                  log(
                    'info',
                    {
                      serviceCount,

                      durationMs,
                    },
                    'TITech application services started.',
                  );

                  return {
                    services:
                      servicesRegistry,

                    serviceCount,

                    durationMs,
                  };
                } catch (error) {
                  failed =
                    true;

                  started =
                    false;

                  degraded =
                    true;

                  lastError =
                    error;

                  emitObservabilityEvent(
                    'services.start_failed',
                    {
                      error:
                        safeError(
                          error,
                        ),
                      serviceCount,
                    },
                  );

                  throw wrapError(
                    error,
                    'SERVICES_START_FAILED',
                    'startup',
                    'TITech application services startup failed.',
                  );
                }
              })();

            try {
              return await startPromise;
            } finally {
              if (
                failed
              ) {
                startPromise =
                  null;
              }
            }
          },

        /**
         * ---------------------------------------------------------------------
         * READY
         * ---------------------------------------------------------------------
         */

        ready:
          async hookContext => {
            try {
              const result =
                await checkAllServices(
                  hookContext ||
                    context ||
                    {},
                );

              if (
                result.requiredFailures
                  .length >
                0
              ) {
                return false;
              }

              degraded =
                result.optionalFailures
                  .length >
                0;

              return true;
            } catch (error) {
              lastError =
                error;

              return false;
            }
          },

        /**
         * ---------------------------------------------------------------------
         * HEALTH
         * ---------------------------------------------------------------------
         */

        health:
          async hookContext =>
            health(
              hookContext ||
                context ||
                {},
            ),

        /**
         * ---------------------------------------------------------------------
         * STOP
         * ---------------------------------------------------------------------
         */

        stop:
          async hookContext => {
            if (
              stopPromise
            ) {
              return stopPromise;
            }

            stopPromise =
              (async () => {
                const runtimeContext =
                  hookContext ||
                  context ||
                  {};

                const errors = [];

                try {
                  /**
                   * Stop external service registry first.
                   */
                  const externalContract =
                    resolveExternalServiceContract(
                      servicesImplementation,
                    );

                  if (
                    externalContract
                  ) {
                    try {
                      await withTimeout(
                        () =>
                          stopExternalRegistry(
                            externalContract,
                            runtimeContext,
                          ),
                        DEFAULT_TIMEOUT_MS,
                        'external service registry shutdown',
                      );
                    } catch (error) {
                      errors.push(
                        error,
                      );
                    }
                  }

                  /**
                   * Shutdown service modules in reverse dependency order.
                   */
                  const order =
                    resolveServiceOrder(
                      'shutdown',
                    );

                  for (
                    const definition of
                      order
                  ) {
                    try {
                      await stopRegisteredService(
                        definition,
                        runtimeContext,
                      );
                    } catch (error) {
                      errors.push(
                        error,
                      );

                      if (
                        definition.critical &&
                        options.continueOnShutdownError ===
                          false
                      ) {
                        break;
                      }
                    }
                  }

                  started =
                    false;

                  stopped =
                    errors.length ===
                    0;

                  failed =
                    errors.length >
                    0;

                  degraded =
                    false;

                  stoppedAt =
                    new Date();

                  if (
                    errors.length >
                    0
                  ) {
                    lastError =
                      errors[0];

                    emitObservabilityEvent(
                      'services.stop_failed',
                      {
                        error:
                          safeError(
                            errors[0],
                          ),

                        errorCount:
                          errors.length,
                      },
                    );

                    throw new ServicesBootstrapError(
                      'One or more TITech application services failed during shutdown.',
                      {
                        code:
                          'SERVICES_STOP_PARTIAL_FAILURE',

                        phase:
                          'shutdown',

                        cause:
                          errors[0],

                        details: {
                          errorCount:
                            errors.length,
                        },
                      },
                    );
                  }

                  emitObservabilityEvent(
                    'services.stopped',
                    {
                      serviceCount,
                    },
                  );

                  log(
                    'info',
                    {
                      serviceCount,
                    },
                    'TITech application services stopped.',
                  );

                  return true;
                } catch (error) {
                  failed =
                    true;

                  lastError =
                    error;

                  throw (
                    error instanceof
                    ServicesBootstrapError
                      ? error
                      : wrapError(
                          error,
                          'SERVICES_STOP_FAILED',
                          'shutdown',
                          'TITech application services shutdown failed.',
                        )
                  );
                }
              })();

            return stopPromise;
          },
      },
    );

  registered =
    true;

  return registrationResult;
}

/**
 * -----------------------------------------------------------------------------
 * Bootstrap Contract
 * -----------------------------------------------------------------------------
 */

function registerBootstrapHooks(
  context = {},
  options = {},
) {
  return registerServicesHooks(
    context,
    options,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Initialization
 * -----------------------------------------------------------------------------
 */

async function initialize(
  context = {},
  options = {},
) {
  if (
    started &&
    !stopped &&
    !failed
  ) {
    return servicesRegistry;
  }

  if (
    startPromise
  ) {
    return startPromise;
  }

  startPromise =
    (async () => {
      const timer =
        process.hrtime.bigint();

      try {
        const externalContract =
          await initializeExternalServiceRegistry(
            context,
          );

        const order =
          resolveServiceOrder(
            'startup',
          );

        for (
          const definition of
            order
        ) {
          await startRegisteredService(
            definition,
            context,
          );
        }

        if (
          externalContract?.start
        ) {
          await withTimeout(
            () =>
              startExternalRegistry(
                externalContract,
                context,
              ),
            options.timeoutMs ||
              DEFAULT_TIMEOUT_MS,
            'external service registry startup',
          );
        }

        started =
          true;

        stopped =
          false;

        failed =
          false;

        degraded =
          false;

        startedAt =
          new Date();

        serviceCount =
          serviceDefinitions.size;

        if (
          context &&
          typeof context ===
            'object'
        ) {
          context.services =
            servicesRegistry;

          context.serviceRegistry =
            servicesRegistry;
        }

        return servicesRegistry;
      } catch (error) {
        failed =
          true;

        started =
          false;

        degraded =
          true;

        lastError =
          error;

        startPromise =
          null;

        throw wrapError(
          error,
          'SERVICES_INITIALIZATION_FAILED',
          'initialization',
          'TITech application service initialization failed.',
        );
      } finally {
        void timer;
      }
    })();

  return startPromise;
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Shutdown
 * -----------------------------------------------------------------------------
 */

async function shutdown(
  context = {},
) {
  if (
    stopped
  ) {
    return true;
  }

  if (
    stopPromise
  ) {
    return stopPromise;
  }

  stopPromise =
    (async () => {
      const errors = [];

      try {
        const externalContract =
          resolveExternalServiceContract(
            servicesImplementation,
          );

        if (
          externalContract
        ) {
          try {
            await stopExternalRegistry(
              externalContract,
              context,
            );
          } catch (error) {
            errors.push(
              error,
            );
          }
        }

        const order =
          resolveServiceOrder(
            'shutdown',
          );

        for (
          const definition of
            order
        ) {
          try {
            await stopRegisteredService(
              definition,
              context,
            );
          } catch (error) {
            errors.push(
              error,
            );
          }
        }

        started =
          false;

        stopped =
          errors.length ===
          0;

        failed =
          errors.length >
          0;

        stoppedAt =
          new Date();

        if (
          errors.length >
          0
        ) {
          lastError =
            errors[0];

          throw new ServicesBootstrapError(
            'One or more TITech application services failed during shutdown.',
            {
              code:
                'SERVICES_SHUTDOWN_PARTIAL_FAILURE',

              cause:
                errors[0],

              details: {
                errorCount:
                  errors.length,
              },
            },
          );
        }

        return true;
      } catch (error) {
        failed =
          true;

        lastError =
          error;

        throw (
          error instanceof
          ServicesBootstrapError
            ? error
            : wrapError(
                error,
                'SERVICES_SHUTDOWN_FAILED',
                'shutdown',
                'TITech application service shutdown failed.',
              )
        );
      }
    })();

  return stopPromise;
}

async function stop(
  context = {},
) {
  return shutdown(
    context,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Readiness / Health
 * -----------------------------------------------------------------------------
 */

async function readiness(
  context = {},
) {
  const results =
    await checkAllServices(
      context,
    );

  const ready =
    started &&
    !stopped &&
    !failed &&
    results.requiredFailures
      .length ===
      0;

  degraded =
    results.optionalFailures
      .length >
    0;

  return {
    status:
      ready
        ? degraded
          ? 'degraded'
          : 'ready'
        : 'not_ready',

    ready,

    degraded,

    service:
      SERVICE_NAME,

    component:
      COMPONENT,

    serviceCount,

    services:
      results.services,

    requiredFailures:
      results.requiredFailures,

    optionalFailures:
      results.optionalFailures,

    timestamp:
      new Date().toISOString(),
  };
}

async function health(
  context = {},
) {
  const result =
    await readiness(
      context,
    );

  return {
    status:
      result.ready
        ? result.degraded
          ? 'degraded'
          : 'healthy'
        : 'unhealthy',

    ready:
      result.ready,

    degraded:
      result.degraded,

    component:
      COMPONENT,

    service:
      SERVICE_NAME,

    serviceCount,

    services:
      result.services,

    requiredFailures:
      result.requiredFailures,

    optionalFailures:
      result.optionalFailures,

    implementation:
      servicesModulePath,

    timestamp:
      new Date().toISOString(),
  };
}

/**
 * -----------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------
 */

function isReady() {
  return (
    started &&
    !stopped &&
    !failed
  );
}

function isStarted() {
  return started;
}

function isStopped() {
  return stopped;
}

function isFailed() {
  return failed;
}

function isDegraded() {
  return degraded;
}

/**
 * -----------------------------------------------------------------------------
 * Runtime Access
 * -----------------------------------------------------------------------------
 */

function getServices() {
  return servicesRegistry;
}

function getServiceRegistry() {
  return servicesRegistry;
}

function getImplementation() {
  return servicesImplementation;
}

/**
 * -----------------------------------------------------------------------------
 * Snapshot
 * -----------------------------------------------------------------------------
 */

function snapshot() {
  const services = {};

  for (
    const [
      name,
      definition,
    ] of serviceDefinitions
  ) {
    const state =
      serviceStates.get(
        name,
      );

    services[name] =
      {
        name,

        description:
          definition.description,

        version:
          definition.version,

        enabled:
          definition.enabled,

        critical:
          definition.critical,

        priority:
          definition.priority,

        dependencies:
          [
            ...definition.dependencies,
          ],

        state:
          state?.state ||
          'unknown',

        started:
          state?.started ||
          false,

        ready:
          state?.ready ||
          false,

        failed:
          state?.failed ||
          false,

        startedAt:
          state?.startedAt ||
          null,

        readyAt:
          state?.readyAt ||
          null,

        stoppedAt:
          state?.stoppedAt ||
          null,

        durationMs:
          state?.durationMs ||
          null,

        lastError:
          state?.lastError ||
          null,

        metadata:
          definition.metadata,
      };
  }

  return Object.freeze({
    component:
      COMPONENT,

    service:
      SERVICE_NAME,

    registered,

    started,

    stopped,

    failed,

    degraded,

    ready:
      isReady(),

    serviceCount,

    implementation:
      servicesModulePath,

    externalRegistry:
      Boolean(
        servicesRegistry,
      ),

    services:
      Object.freeze(
        services,
      ),

    lastError:
      safeError(
        lastError,
      ),

    startedAt,

    stoppedAt,
  });
}

/**
 * -----------------------------------------------------------------------------
 * Service Container Registration Helper
 * -----------------------------------------------------------------------------
 *
 * Useful where the application context owns dependency-injection bindings.
 */

function registerIntoContext(
  context = {},
) {
  if (
    !context ||
    typeof context !==
      'object'
  ) {
    throw new TypeError(
      'A bootstrap context object is required.',
    );
  }

  context.services =
    servicesRegistry;

  context.serviceRegistry =
    servicesRegistry;

  return context;
}

/**
 * -----------------------------------------------------------------------------
 * Reset
 * -----------------------------------------------------------------------------
 *
 * Testing/process isolation only.
 */

function reset() {
  if (
    started
  ) {
    throw new ServicesBootstrapError(
      'Cannot reset active TITech services.',
      {
        code:
          'SERVICES_RESET_NOT_ALLOWED',
      },
    );
  }

  servicesImplementation =
    null;

  servicesModulePath =
    null;

  servicesRegistry =
    null;

  registered =
    false;

  started =
    false;

  stopped =
    false;

  failed =
    false;

  degraded =
    false;

  registrationResult =
    null;

  startPromise =
    null;

  stopPromise =
    null;

  lastError =
    null;

  startedAt =
    null;

  stoppedAt =
    null;

  serviceCount =
    0;

  serviceDefinitions.clear();

  serviceStates.clear();

  return true;
}

/**
 * -----------------------------------------------------------------------------
 * Error Wrapper
 * -----------------------------------------------------------------------------
 */

function wrapError(
  error,
  code,
  phase,
  message,
) {
  if (
    error instanceof
    ServicesBootstrapError
  ) {
    return error;
  }

  return new ServicesBootstrapError(
    message,
    {
      code,

      phase,

      cause:
        error,
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Export
 * -----------------------------------------------------------------------------
 */

module.exports =
  Object.freeze({
    /**
     * Registration.
     */
    registerService,

    registerServicesHooks,

    registerBootstrapHooks,

    bootstrap:
      registerBootstrapHooks,

    /**
     * Explicit lifecycle.
     */
    initialize,

    start:
      initialize,

    shutdown,

    stop,

    /**
     * Service registry.
     */
    hasService,

    getService,

    listServices,

    resolveServiceOrder,

    getServices,

    getServiceRegistry,

    getImplementation,

    registerIntoContext,

    /**
     * Operational.
     */
    readiness,

    health,

    snapshot,

    /**
     * State.
     */
    isReady,

    isStarted,

    isStopped,

    isFailed,

    isDegraded,

    /**
     * Testing.
     */
    reset,

    /**
     * Error/constants.
     */
    ServicesBootstrapError,

    COMPONENT,

    SERVICE_NAME,

    SERVICE_MODULE_CANDIDATES,
  });