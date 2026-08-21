'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/infrastructure.js
 *
 * Purpose:
 *   Enterprise-grade infrastructure lifecycle composition.
 *
 * Responsibilities:
 *   - Register infrastructure startup/shutdown hooks.
 *   - Keep infrastructure initialization out of app.js.
 *   - Enforce deterministic dependency ordering.
 *   - Support MongoDB / database lifecycle.
 *   - Support Redis lifecycle.
 *   - Support queue / worker lifecycle.
 *   - Support event-bus lifecycle.
 *   - Support resilience subsystem lifecycle.
 *   - Support Socket.IO lifecycle.
 *   - Support API Gateway / integration lifecycle.
 *   - Avoid duplicate hook registration.
 *   - Provide graceful degradation for optional infrastructure.
 *   - Preserve existing infrastructure implementations.
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
 *   resilience
 *       ↓
 *   database
 *       ↓
 *   redis
 *       ↓
 *   event-bus
 *       ↓
 *   queue
 *       ↓
 *   socket.io / gateway
 *       ↓
 *   middleware
 *       ↓
 *   routes
 *       ↓
 *   HTTP server
 *
 * IMPORTANT:
 *
 *   This file is an ORCHESTRATION ADAPTER.
 *
 *   It does NOT implement:
 *     - database queries
 *     - Redis commands
 *     - queue business logic
 *     - financial transaction logic
 *     - ledger logic
 *     - event handlers
 *     - HTTP routes
 *     - Socket.IO event handlers
 *     - API Gateway business rules
 *
 *   Existing infrastructure code remains authoritative.
 *
 * =============================================================================
 */

const path = require('node:path');

/**
 * -----------------------------------------------------------------------------
 * Hook Engine
 * -----------------------------------------------------------------------------
 */

const {
  hooks,
  startup,
  lifecycle,
} = require('./hooks');

/**
 * -----------------------------------------------------------------------------
 * Infrastructure Definitions
 * -----------------------------------------------------------------------------
 *
 * Each subsystem can expose one of several compatible lifecycle APIs.
 *
 * Supported startup names:
 *
 *   initialize
 *   init
 *   connect
 *   start
 *   bootstrap
 *
 * Supported shutdown names:
 *
 *   shutdown
 *   close
 *   disconnect
 *   stop
 *   destroy
 *
 * This lets infrastructure.js wrap existing production modules without
 * requiring an immediate rewrite of those modules.
 */

const INFRASTRUCTURE_MODULES = Object.freeze({
  database: Object.freeze([
    '../database',
    '../db',
    '../database/index',
    '../db/index',
    '../infrastructure/database',
  ]),

  redis: Object.freeze([
    '../redis',
    '../redis/index',
    '../infrastructure/redis',
    '../cache/redis',
  ]),

  resilience: Object.freeze([
    '../middleware/resilience',
    '../resilience',
    '../infrastructure/resilience',
  ]),

  eventBus: Object.freeze([
    '../event-bus',
    '../eventBus',
    '../events',
    '../infrastructure/event-bus',
  ]),

  queue: Object.freeze([
    '../queue',
    '../queues',
    '../job-queue',
    '../infrastructure/queue',
  ]),

  socketIO: Object.freeze([
    '../socket',
    '../socket.io',
    '../socketIO',
    '../realtime',
    '../infrastructure/socket',
  ]),

  apiGateway: Object.freeze([
    '../api-gateway',
    '../apiGateway',
    '../gateway',
    '../infrastructure/api-gateway',
  ]),
});

/**
 * -----------------------------------------------------------------------------
 * Dependency Graph
 * -----------------------------------------------------------------------------
 *
 * These are lifecycle dependencies, not runtime implementation imports.
 */

const DEPENDENCIES = Object.freeze({
  resilience: [
    'observability',
  ],

  database: [
    'resilience',
  ],

  redis: [
    'database',
  ],

  eventBus: [
    'redis',
  ],

  queue: [
    'redis',
    'eventBus',
  ],

  socketIO: [
    'eventBus',
  ],

  apiGateway: [
    'eventBus',
    'resilience',
  ],
});

/**
 * -----------------------------------------------------------------------------
 * Priority Ordering
 * -----------------------------------------------------------------------------
 */

const PRIORITIES = Object.freeze({
  resilience: -500,

  database: -400,

  redis: -300,

  eventBus: -200,

  queue: -100,

  socketIO: 0,

  apiGateway: 100,
});

/**
 * -----------------------------------------------------------------------------
 * Enabled Infrastructure Environment Flags
 * -----------------------------------------------------------------------------
 */

const ENABLE_FLAGS = Object.freeze({
  database: 'MONGODB_ENABLED',
  redis: 'REDIS_ENABLED',
  resilience: 'RESILIENCE_ENABLED',
  eventBus: 'EVENT_BUS_ENABLED',
  queue: 'QUEUE_ENABLED',
  socketIO: 'SOCKET_IO_ENABLED',
  apiGateway: 'API_GATEWAY_ENABLED',
});

/**
 * -----------------------------------------------------------------------------
 * Utility Functions
 * -----------------------------------------------------------------------------
 */

function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object'
  );
}

function isFunction(value) {
  return typeof value === 'function';
}

function moduleExists(modulePath) {
  try {
    require.resolve(modulePath);
    return true;
  } catch (error) {
    if (
      error &&
      error.code === 'MODULE_NOT_FOUND'
    ) {
      return false;
    }

    throw error;
  }
}

function resolveModule(paths) {
  for (const modulePath of paths) {
    if (!moduleExists(modulePath)) {
      continue;
    }

    return {
      modulePath,
      module: require(modulePath),
    };
  }

  return null;
}

function unwrapModule(moduleValue) {
  if (
    moduleValue &&
    moduleValue.default
  ) {
    return moduleValue.default;
  }

  return moduleValue;
}

function getCandidateMethods(
  target,
  names,
) {
  if (!target) {
    return [];
  }

  const candidates = [];

  for (const name of names) {
    if (
      isFunction(target[name])
    ) {
      candidates.push({
        name,
        fn: target[name],
      });
    }
  }

  return candidates;
}

/**
 * -----------------------------------------------------------------------------
 * Lifecycle Method Discovery
 * -----------------------------------------------------------------------------
 */

function resolveLifecycleMethods(
  loadedModule,
) {
  if (!loadedModule) {
    return null;
  }

  const exported =
    unwrapModule(
      loadedModule.module,
    );

  /**
   * Some modules expose:
   *
   *   { service: {...} }
   *
   * while others directly export their lifecycle methods.
   *
   * Search a small set of common service containers.
   */

  const candidates = [
    exported,
    exported?.service,
    exported?.client,
    exported?.manager,
    exported?.instance,
    exported?.default,
  ].filter(Boolean);

  let start = null;
  let stop = null;

  for (const candidate of candidates) {
    if (!start) {
      const methods =
        getCandidateMethods(
          candidate,
          [
            'initialize',
            'init',
            'connect',
            'start',
            'bootstrap',
          ],
        );

      if (methods.length > 0) {
        start = {
          target: candidate,
          ...methods[0],
        };
      }
    }

    if (!stop) {
      const methods =
        getCandidateMethods(
          candidate,
          [
            'shutdown',
            'close',
            'disconnect',
            'stop',
            'destroy',
          ],
        );

      if (methods.length > 0) {
        stop = {
          target: candidate,
          ...methods[0],
        };
      }
    }

    if (start && stop) {
      break;
    }
  }

  return {
    exported,
    start,
    stop,
  };
}

/**
 * -----------------------------------------------------------------------------
 * Lifecycle Invocation
 * -----------------------------------------------------------------------------
 */

async function invokeLifecycleMethod(
  lifecycle,
  context,
) {
  if (!lifecycle) {
    return undefined;
  }

  return lifecycle.fn.call(
    lifecycle.target,
    context,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Infrastructure Context
 * -----------------------------------------------------------------------------
 */

function createInfrastructureContext(
  context,
) {
  return Object.freeze({
    ...context,

    infrastructure: Object.freeze({
      rootDirectory:
        path.resolve(
          __dirname,
          '..',
          '..',
        ),

      environment:
        context?.environment,

      config:
        context?.config,

      hooks:
        context?.hooks,
    }),
  });
}

/**
 * -----------------------------------------------------------------------------
 * Feature Enablement
 * -----------------------------------------------------------------------------
 *
 * Configuration has priority.
 * Environment flags are a fallback.
 */

function readEnabledFlag(
  context,
  subsystem,
) {
  const environment =
    context?.environment;

  const config =
    context?.config;

  /**
   * Search possible config locations.
   */

  const configCandidates = [
    config?.infrastructure?.[
      subsystem
    ]?.enabled,

    config?.[subsystem]?.enabled,

    config?.database?.[
      subsystem
    ]?.enabled,

    config?.redis?.enabled,
    config?.queue?.enabled,
  ];

  for (
    const candidate of configCandidates
  ) {
    if (
      typeof candidate ===
      'boolean'
    ) {
      return candidate;
    }
  }

  const envKey =
    ENABLE_FLAGS[subsystem];

  if (
    envKey &&
    environment
  ) {
    const value =
      environment?.[
        subsystem
      ]?.enabled;

    if (
      typeof value ===
      'boolean'
    ) {
      return value;
    }
  }

  const environmentValue =
    process.env[envKey];

  if (
    environmentValue ===
      undefined ||
    environmentValue ===
      null
  ) {
    /**
     * Infrastructure defaults:
     *
     * Core systems:
     *   database -> enabled
     *   redis -> enabled
     *   resilience -> enabled
     *
     * Optional systems:
     *   eventBus -> enabled
     *   queue -> enabled
     *   socketIO -> disabled unless configured
     *   apiGateway -> disabled unless configured
     */
    return [
      'database',
      'redis',
      'resilience',
      'eventBus',
      'queue',
    ].includes(
      subsystem,
    );
  }

  return [
    'true',
    '1',
    'yes',
    'on',
    'enabled',
  ].includes(
    String(
      environmentValue,
    )
      .trim()
      .toLowerCase(),
  );
}

/**
 * -----------------------------------------------------------------------------
 * Registration State
 * -----------------------------------------------------------------------------
 */

const registrationState =
  new Map();

/**
 * -----------------------------------------------------------------------------
 * Register One Infrastructure Component
 * -----------------------------------------------------------------------------
 */

function registerInfrastructureComponent(
  subsystem,
  context,
) {
  const existing =
    registrationState.get(
      subsystem,
    );

  if (
    existing
  ) {
    return existing;
  }

  const enabled =
    readEnabledFlag(
      context,
      subsystem,
    );

  const modulePaths =
    INFRASTRUCTURE_MODULES[
      subsystem
    ];

  if (
    !modulePaths
  ) {
    throw new Error(
      `Unknown infrastructure subsystem "${subsystem}".`,
    );
  }

  /**
   * Disabled subsystem.
   */
  if (!enabled) {
    const disabled =
      Object.freeze({
        subsystem,
        enabled: false,
        available: false,
        registered: false,
        reason: 'disabled',
      });

    registrationState.set(
      subsystem,
      disabled,
    );

    return disabled;
  }

  const loaded =
    resolveModule(
      modulePaths,
    );

  /**
   * Enabled but implementation not installed.
   *
   * We intentionally treat optional infrastructure as unavailable rather than
   * silently inventing an implementation.
   *
   * Core infrastructure should normally have explicit availability checks in
   * deployment/CI.
   */
  if (!loaded) {
    const unavailable =
      Object.freeze({
        subsystem,
        enabled: true,
        available: false,
        registered: false,
        reason: 'module-not-found',
      });

    registrationState.set(
      subsystem,
      unavailable,
    );

    return unavailable;
  }

  const lifecycle =
    resolveLifecycleMethods(
      loaded,
    );

  if (
    !lifecycle?.start &&
    !lifecycle?.stop
  ) {
    const noLifecycle =
      Object.freeze({
        subsystem,
        enabled: true,
        available: true,
        registered: false,
        reason:
          'no-lifecycle-methods',
        modulePath:
          loaded.modulePath,
      });

    registrationState.set(
      subsystem,
      noLifecycle,
    );

    return noLifecycle;
  }

  const infrastructureContext =
    createInfrastructureContext(
      context,
    );

  const dependencies =
    DEPENDENCIES[subsystem] || [];

  const priority =
    PRIORITIES[subsystem] ?? 0;

  /**
   * ---------------------------------------------------------------------------
   * Register Lifecycle Hook
   * ---------------------------------------------------------------------------
   */

  if (
    !hooks.has(subsystem)
  ) {
    lifecycle(
      subsystem,
      {
        priority,

        dependencies,

        critical:
          [
            'database',
            'redis',
            'resilience',
          ].includes(
            subsystem,
          ),

        start:
          async hookContext => {
            /**
             * Prevent accidental double initialization when the existing
             * subsystem itself has already been started elsewhere.
             *
             * The subsystem remains responsible for its own idempotency.
             */
            const result =
              await invokeLifecycleMethod(
                lifecycle.start,
                {
                  ...infrastructureContext,
                  ...hookContext,
                },
              );

            /**
             * Save resource instance when a startup method returns one.
             */
            if (
              result !== undefined
            ) {
              context[subsystem] =
                result;
            }

            return result;
          },

        stop:
          async hookContext => {
            return invokeLifecycleMethod(
              lifecycle.stop,
              {
                ...infrastructureContext,
                ...hookContext,
              },
            );
          },

        metadata: {
          subsystem,

          modulePath:
            loaded.modulePath,

          startupMethod:
            lifecycle.start?.name ||
            null,

          shutdownMethod:
            lifecycle.stop?.name ||
            null,

          module:
            loaded.modulePath,
        },
      },
    );
  }

  const registered =
    Object.freeze({
      subsystem,
      enabled: true,
      available: true,
      registered: true,
      modulePath:
        loaded.modulePath,
      startupMethod:
        lifecycle.start?.name ||
        null,
      shutdownMethod:
        lifecycle.stop?.name ||
        null,
    });

  registrationState.set(
    subsystem,
    registered,
  );

  return registered;
}

/**
 * -----------------------------------------------------------------------------
 * Register All Infrastructure
 * -----------------------------------------------------------------------------
 */

function registerInfrastructure(
  context = {},
) {
  const normalizedContext =
    context || {};

  const results = {};

  /**
   * Ordered intentionally for clarity.
   *
   * Actual dependency ordering is still enforced by hooks.js.
   */
  for (
    const subsystem of [
      'resilience',
      'database',
      'redis',
      'eventBus',
      'queue',
      'socketIO',
      'apiGateway',
    ]
  ) {
    results[subsystem] =
      registerInfrastructureComponent(
        subsystem,
        normalizedContext,
      );
  }

  return Object.freeze({
    ...results,
  });
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Adapters
 * -----------------------------------------------------------------------------
 *
 * These functions allow the bootstrap root to explicitly register infrastructure
 * modules that do not follow automatic module discovery.
 */

function registerDatabase(
  moduleValue,
  context = {},
  options = {},
) {
  return registerProvidedInfrastructure(
    'database',
    moduleValue,
    context,
    options,
  );
}

function registerRedis(
  moduleValue,
  context = {},
  options = {},
) {
  return registerProvidedInfrastructure(
    'redis',
    moduleValue,
    context,
    options,
  );
}

function registerQueue(
  moduleValue,
  context = {},
  options = {},
) {
  return registerProvidedInfrastructure(
    'queue',
    moduleValue,
    context,
    options,
  );
}

function registerEventBus(
  moduleValue,
  context = {},
  options = {},
) {
  return registerProvidedInfrastructure(
    'eventBus',
    moduleValue,
    context,
    options,
  );
}

function registerResilience(
  moduleValue,
  context = {},
  options = {},
) {
  return registerProvidedInfrastructure(
    'resilience',
    moduleValue,
    context,
    options,
  );
}

function registerSocketIO(
  moduleValue,
  context = {},
  options = {},
) {
  return registerProvidedInfrastructure(
    'socketIO',
    moduleValue,
    context,
    options,
  );
}

function registerApiGateway(
  moduleValue,
  context = {},
  options = {},
) {
  return registerProvidedInfrastructure(
    'apiGateway',
    moduleValue,
    context,
    options,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Provided Infrastructure Registration
 * -----------------------------------------------------------------------------
 */

function registerProvidedInfrastructure(
  subsystem,
  moduleValue,
  context = {},
  options = {},
) {
  if (
    !moduleValue
  ) {
    throw new TypeError(
      `Cannot register "${subsystem}" infrastructure without a module.`,
    );
  }

  if (
    registrationState.has(
      subsystem,
    )
  ) {
    return registrationState.get(
      subsystem,
    );
  }

  const exported =
    unwrapModule(
      moduleValue,
    );

  const resolved = {
    exported,

    start:
      options.start
        ? {
            target:
              exported,
            fn:
              options.start,
          }
        : null,

    stop:
      options.stop
        ? {
            target:
              exported,
            fn:
              options.stop,
          }
        : null,
  };

  /**
   * Auto-detect lifecycle methods when explicit functions aren't provided.
   */

  const auto =
    resolveLifecycleMethods({
      modulePath:
        options.modulePath ||
        `provided:${subsystem}`,

      module:
        exported,
    });

  resolved.start =
    resolved.start ||
    auto.start;

  resolved.stop =
    resolved.stop ||
    auto.stop;

  if (
    !resolved.start &&
    !resolved.stop
  ) {
    throw new TypeError(
      `Infrastructure "${subsystem}" does not expose a lifecycle API.`,
    );
  }

  const infrastructureContext =
    createInfrastructureContext(
      context,
    );

  if (
    !hooks.has(subsystem)
  ) {
    lifecycle(
      subsystem,
      {
        priority:
          options.priority ??
          PRIORITIES[subsystem] ??
          0,

        dependencies:
          options.dependencies ??
          DEPENDENCIES[subsystem] ??
          [],

        critical:
          options.critical ??
          [
            'database',
            'redis',
            'resilience',
          ].includes(
            subsystem,
          ),

        start:
          async hookContext => {
            return invokeLifecycleMethod(
              resolved.start,
              {
                ...infrastructureContext,
                ...hookContext,
              },
            );
          },

        stop:
          async hookContext => {
            return invokeLifecycleMethod(
              resolved.stop,
              {
                ...infrastructureContext,
                ...hookContext,
              },
            );
          },

        metadata: {
          subsystem,
          explicit: true,
        },
      },
    );
  }

  const registered =
    Object.freeze({
      subsystem,
      enabled: true,
      available: true,
      registered: true,
      explicit: true,
    });

  registrationState.set(
    subsystem,
    registered,
  );

  return registered;
}

/**
 * -----------------------------------------------------------------------------
 * Infrastructure Diagnostics
 * -----------------------------------------------------------------------------
 */

function getInfrastructureStatus() {
  const status = {};

  for (
    const [
      subsystem,
      value,
    ] of registrationState
  ) {
    status[subsystem] = {
      ...value,
    };
  }

  return Object.freeze(
    status,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Infrastructure Readiness
 * -----------------------------------------------------------------------------
 *
 * This only describes registered infrastructure.
 *
 * Actual runtime health should be exposed by the health/observability layer.
 */

function isInfrastructureRegistered(
  subsystem,
) {
  return Boolean(
    registrationState.get(
      subsystem,
    )?.registered,
  );
}

function isInfrastructureAvailable(
  subsystem,
) {
  const status =
    registrationState.get(
      subsystem,
    );

  if (!status) {
    return false;
  }

  return Boolean(
    status.available,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Reset
 * -----------------------------------------------------------------------------
 *
 * Intended for automated tests only.
 *
 * Production callers should not reset infrastructure registration.
 */

function resetInfrastructureRegistry() {
  registrationState.clear();
}

/**
 * -----------------------------------------------------------------------------
 * Bootstrap Registration Contract
 * -----------------------------------------------------------------------------
 *
 * bootstrap/index.js can simply call:
 *
 *   registerBootstrapHooks(context)
 *
 * This keeps infrastructure composition isolated from application startup.
 */

function registerBootstrapHooks(
  context = {},
) {
  return registerInfrastructure(
    context,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Export
 * -----------------------------------------------------------------------------
 */

module.exports = Object.freeze({
  /**
   * Main registration API.
   */
  registerInfrastructure,
  registerBootstrapHooks,

  /**
   * Explicit adapters.
   */
  registerDatabase,
  registerRedis,
  registerQueue,
  registerEventBus,
  registerResilience,
  registerSocketIO,
  registerApiGateway,

  /**
   * Diagnostics.
   */
  getInfrastructureStatus,
  isInfrastructureRegistered,
  isInfrastructureAvailable,

  /**
   * Test support.
   */
  resetInfrastructureRegistry,

  /**
   * Metadata.
   */
  INFRASTRUCTURE_MODULES,
  DEPENDENCIES,
  PRIORITIES,
});