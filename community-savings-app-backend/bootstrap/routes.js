'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/routes.js
 *
 * Purpose:
 *   Enterprise production-grade route bootstrap adapter.
 *
 * Responsibilities:
 *   - Register the application routing lifecycle with bootstrap.
 *   - Keep route mounting out of bootstrap/index.js and server.js.
 *   - Mount the canonical Express application routes in a deterministic phase.
 *   - Support modular route registration.
 *   - Prevent duplicate route mounting.
 *   - Validate the application/router contract.
 *   - Integrate readiness and observability.
 *   - Support graceful route shutdown where applicable.
 *   - Preserve existing route implementations.
 *   - Provide route bootstrap diagnostics.
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
 *   database / Redis / event-bus / queue
 *       ↓
 *   middleware
 *       ↓
 *   routes
 *       ↓
 *   HTTP server
 *
 * IMPORTANT:
 *
 *   This module is a ROUTE COMPOSITION ADAPTER.
 *
 *   It does NOT:
 *     - implement business logic
 *     - implement controllers
 *     - implement finance operations
 *     - implement ledger operations
 *     - implement authentication logic
 *     - implement database queries
 *     - implement queue processing
 *     - replace existing route files
 *
 * Existing routes remain authoritative.
 *
 * =============================================================================
 */

const {
  hooks,
  lifecycle,
} = require('./hooks');

/**
 * -----------------------------------------------------------------------------
 * Optional dependencies
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

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const COMPONENT =
  'routes';

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.OTEL_SERVICE_NAME ||
  'titech-backend';

const DEFAULT_PRIORITY =
  100;

const DEFAULT_TIMEOUT_MS =
  30_000;

const DEFAULT_DEPENDENCIES =
  Object.freeze([
    'middleware',
  ]);

const DEFAULT_API_PREFIX =
  '/api';

const DEFAULT_HEALTH_PREFIX =
  '/health';

const DEFAULT_METRICS_PATH =
  '/metrics';

/**
 * -----------------------------------------------------------------------------
 * Candidate Route Modules
 * -----------------------------------------------------------------------------
 *
 * These are compatibility paths for the current migration.
 *
 * The preferred long-term contract is:
 *
 *   backend/routes/index.js
 *
 * or a bootstrap-aware route registry exporting:
 *
 *   registerRoutes(app, context)
 *
 * Existing route implementations are not required to change immediately.
 * -----------------------------------------------------------------------------
 */

const ROUTE_MODULE_CANDIDATES =
  Object.freeze([
    '../routes',
    '../routes/index',
    '../api/routes',
    '../api',
  ]);

/**
 * -----------------------------------------------------------------------------
 * Error
 * -----------------------------------------------------------------------------
 */

class RoutesBootstrapError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'RoutesBootstrapError';

    this.code =
      options.code ||
      'ROUTES_BOOTSTRAP_ERROR';

    this.phase =
      options.phase ||
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
      RoutesBootstrapError,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Internal State
 * -----------------------------------------------------------------------------
 */

let application =
  null;

let router =
  null;

let routeModule =
  null;

let routeModulePath =
  null;

let registered =
  false;

let mounted =
  false;

let stopped =
  false;

let failed =
  false;

let registrationResult =
  null;

let startPromise =
  null;

let stopPromise =
  null;

let lastError =
  null;

let routeCount =
  0;

let mountedAt =
  null;

let stoppedAt =
  null;

/**
 * -----------------------------------------------------------------------------
 * Utility Helpers
 * -----------------------------------------------------------------------------
 */

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

function resolveRouteModule() {
  if (
    routeModule
  ) {
    return {
      module:
        routeModule,

      path:
        routeModulePath,
    };
  }

  for (
    const candidate of
      ROUTE_MODULE_CANDIDATES
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

      routeModule =
        unwrapModule(
          loaded,
        );

      routeModulePath =
        candidate;

      return {
        module:
          routeModule,

        path:
          routeModulePath,
      };
    } catch (error) {
      throw new RoutesBootstrapError(
        'Failed to load the TITech route module.',
        {
          code:
            'ROUTES_MODULE_LOAD_FAILED',

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
    module:
      null,

    path:
      null,
  };
}

/**
 * -----------------------------------------------------------------------------
 * Route Contract Discovery
 * -----------------------------------------------------------------------------
 */

function findRegistrationFunction(
  candidate,
) {
  if (
    !candidate
  ) {
    return null;
  }

  const methods = [
    'registerRoutes',
    'mountRoutes',
    'configureRoutes',
    'initializeRoutes',
  ];

  for (
    const method of methods
  ) {
    if (
      typeof candidate[
        method
      ] ===
      'function'
    ) {
      return {
        name:
          method,

        fn:
          candidate[
            method
          ].bind(candidate),
      };
    }
  }

  return null;
}

function findRouter(
  candidate,
) {
  if (
    !candidate
  ) {
    return null;
  }

  /**
   * Direct Express Router/function export.
   */
  if (
    typeof candidate ===
      'function' &&
    (
      candidate.name ===
        'router' ||
      candidate.name ===
        'routes' ||
      candidate.stack ||
      candidate.use
    )
  ) {
    return candidate;
  }

  /**
   * Common named exports.
   */
  const candidates = [
    candidate.router,
    candidate.routes,
    candidate.apiRouter,
    candidate.httpRouter,
    candidate.default,
  ];

  for (
    const item of candidates
  ) {
    if (
      typeof item ===
        'function' ||
      (
        item &&
        typeof item.use ===
          'function'
      )
    ) {
      return item;
    }
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * Validation
 * -----------------------------------------------------------------------------
 */

function assertApplication(
  value,
) {
  if (
    !value ||
    typeof value.use !==
      'function'
  ) {
    throw new RoutesBootstrapError(
      'A valid Express-compatible application instance is required.',
      {
        code:
          'ROUTES_APPLICATION_INVALID',
      },
    );
  }
}

function assertRouteContract(
  value,
) {
  if (
    !value
  ) {
    throw new RoutesBootstrapError(
      'TITech route implementation is unavailable.',
      {
        code:
          'ROUTES_IMPLEMENTATION_UNAVAILABLE',
      },
    );
  }

  const registration =
    findRegistrationFunction(
      value,
    );

  const resolvedRouter =
    findRouter(
      value,
    );

  if (
    !registration &&
    !resolvedRouter &&
    typeof value !==
      'function'
  ) {
    throw new RoutesBootstrapError(
      'TITech route module does not expose a supported registration or router contract.',
      {
        code:
          'ROUTES_IMPLEMENTATION_INVALID',

        details: {
          supportedContracts: [
            'registerRoutes(app, context)',
            'mountRoutes(app, context)',
            'configureRoutes(app, context)',
            'initializeRoutes(app, context)',
            'Express Router export',
          ],
        },
      },
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Route Count
 * -----------------------------------------------------------------------------
 */

function inspectRouteCount(
  target,
) {
  try {
    /**
     * Express application stack.
     */
    if (
      Array.isArray(
        target?.router?.stack,
      )
    ) {
      return target.router.stack.length;
    }

    if (
      Array.isArray(
        target?._router?.stack,
      )
    ) {
      return target._router.stack.length;
    }

    /**
     * Express Router stack.
     */
    if (
      Array.isArray(
        target?.stack,
      )
    ) {
      return target.stack.length;
    }
  } catch {
    // Diagnostics only.
  }

  return 0;
}

/**
 * -----------------------------------------------------------------------------
 * Configuration
 * -----------------------------------------------------------------------------
 */

function resolveRouteConfiguration(
  context = {},
  options = {},
) {
  const config =
    context.config ||
    {};

  const environment =
    context.environment ||
    {};

  const routeConfig =
    config.routes ||
    config.routing ||
    {};

  return {
    enabled:
      options.enabled !==
        undefined
        ? Boolean(
            options.enabled,
          )
        : routeConfig.enabled !==
              undefined
          ? Boolean(
              routeConfig.enabled,
            )
          : true,

    apiPrefix:
      options.apiPrefix ||
      routeConfig.apiPrefix ||
      process.env.API_PREFIX ||
      DEFAULT_API_PREFIX,

    healthPrefix:
      options.healthPrefix ||
      routeConfig.healthPrefix ||
      process.env.HEALTH_PREFIX ||
      DEFAULT_HEALTH_PREFIX,

    metricsPath:
      options.metricsPath ||
      routeConfig.metricsPath ||
      process.env.METRICS_PATH ||
      DEFAULT_METRICS_PATH,

    versionPrefix:
      options.versionPrefix ||
      routeConfig.versionPrefix ||
      process.env.API_VERSION_PREFIX ||
      '',

    environment:
      environment?.runtime?.nodeEnv ||
      environment?.app?.environment ||
      process.env.NODE_ENV ||
      'development',
  };
}

/**
 * -----------------------------------------------------------------------------
 * Readiness Integration
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
        async () => ({
          ready:
            mounted &&
            !failed &&
            !stopped,

          routes:
            routeCount,
        }),

      health:
        async () => ({
          status:
            failed
              ? 'unhealthy'
              : stopped
                ? 'stopped'
                : mounted
                  ? 'healthy'
                  : 'not_ready',

          ready:
            mounted &&
            !failed &&
            !stopped,

          routes:
            routeCount,

          implementation:
            routeModulePath,
        }),

      timeoutMs:
        options.readinessTimeoutMs ||
        5_000,

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
     * Observability must never prevent route registration.
     */
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Application Registration
 * -----------------------------------------------------------------------------
 */

function setApplication(
  app,
) {
  assertApplication(
    app,
  );

  if (
    mounted
  ) {
    throw new RoutesBootstrapError(
      'Cannot replace the application after routes have been mounted.',
      {
        code:
          'ROUTES_APPLICATION_LOCKED',
      },
    );
  }

  application =
    app;

  return application;
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Route Module Registration
 * -----------------------------------------------------------------------------
 */

function setRouteModule(
  value,
  options = {},
) {
  if (
    mounted
  ) {
    throw new RoutesBootstrapError(
      'Cannot replace the route module after routes have been mounted.',
      {
        code:
          'ROUTES_MODULE_LOCKED',
      },
    );
  }

  assertRouteContract(
    value,
  );

  routeModule =
    unwrapModule(
      value,
    );

  routeModulePath =
    options.path ||
    'provided:route-module';

  return routeModule;
}

/**
 * -----------------------------------------------------------------------------
 * Mount Route Module
 * -----------------------------------------------------------------------------
 */

async function mountRoutes(
  app,
  context = {},
  options = {},
) {
  assertApplication(
    app,
  );

  const resolved =
    routeModule
      ? {
          module:
            routeModule,

          path:
            routeModulePath,
        }
      : resolveRouteModule();

  const module =
    resolved.module;

  if (
    !module
  ) {
    throw new RoutesBootstrapError(
      'No TITech route module could be resolved.',
      {
        code:
          'ROUTES_MODULE_NOT_FOUND',

        details: {
          candidates:
            ROUTE_MODULE_CANDIDATES,
        },
      },
    );
  }

  assertRouteContract(
    module,
  );

  const routeConfig =
    resolveRouteConfiguration(
      context,
      options,
    );

  if (
    !routeConfig.enabled
  ) {
    return {
      enabled:
        false,

      mounted:
        false,

      reason:
        'disabled',

      path:
        resolved.path,
    };
  }

  const registration =
    findRegistrationFunction(
      module,
    );

  /**
   * ---------------------------------------------------------------------------
   * Preferred contract:
   *
   *   registerRoutes(app, context)
   * ---------------------------------------------------------------------------
   */

  if (
    registration
  ) {
    const result =
      await registration.fn(
        app,
        {
          ...context,

          routes: {
            ...routeConfig,
          },
        },
      );

    router =
      findRouter(
        result,
      );

    routeCount =
      inspectRouteCount(
        app,
      );

    return {
      enabled:
        true,

      mounted:
        true,

      mode:
        registration.name,

      path:
        resolved.path,

      result,
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * Direct Router contract
   *
   *   module === express.Router()
   * ---------------------------------------------------------------------------
   */

  const resolvedRouter =
    findRouter(
      module,
    );

  if (
    resolvedRouter
  ) {
    const mountPath =
      options.mountPath ||
      routeConfig.apiPrefix ||
      '/';

    app.use(
      mountPath,
      resolvedRouter,
    );

    router =
      resolvedRouter;

    routeCount =
      inspectRouteCount(
        resolvedRouter,
      );

    return {
      enabled:
        true,

      mounted:
        true,

      mode:
        'router',

      mountPath,

      path:
        resolved.path,

      routeCount,
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * Callable route registration
   * ---------------------------------------------------------------------------
   *
   * Supports:
   *
   *   module(app, context)
   */

  if (
    typeof module ===
    'function'
  ) {
    const result =
      await module(
        app,
        {
          ...context,

          routes: {
            ...routeConfig,
          },
        },
      );

    router =
      findRouter(
        result,
      );

    routeCount =
      inspectRouteCount(
        app,
      );

    return {
      enabled:
        true,

      mounted:
        true,

      mode:
        'function',

      path:
        resolved.path,

      result,
    };
  }

  throw new RoutesBootstrapError(
    'TITech route module could not be mounted using a supported contract.',
    {
      code:
        'ROUTES_MOUNT_CONTRACT_FAILED',
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Registration
 * -----------------------------------------------------------------------------
 */

function registerRoutesHooks(
  context = {},
  options = {},
) {
  /**
   * ---------------------------------------------------------------------------
   * Duplicate protection
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
   * Application resolution
   * ---------------------------------------------------------------------------
   */

  const app =
    options.app ||
    context.app ||
    application;

  if (
    app
  ) {
    setApplication(
      app,
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness registration
   * ---------------------------------------------------------------------------
   */

  registerReadinessDependency(
    context,
    options,
  );

  /**
   * ---------------------------------------------------------------------------
   * Lifecycle registration
   * ---------------------------------------------------------------------------
   */

  registrationResult =
    lifecycle(
      COMPONENT,
      {
        priority:
          Number.isInteger(
            options.priority,
          )
            ? options.priority
            : DEFAULT_PRIORITY,

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
          Number.isInteger(
            options.timeoutMs,
          ) &&
          options.timeoutMs > 0
            ? options.timeoutMs
            : DEFAULT_TIMEOUT_MS,

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
            'backend/routes',
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
                try {
                  const runtimeContext =
                    hookContext ||
                    context ||
                    {};

                  const targetApp =
                    options.app ||
                    runtimeContext.app ||
                    application;

                  assertApplication(
                    targetApp,
                  );

                  application =
                    targetApp;

                  const result =
                    await mountRoutes(
                      targetApp,
                      runtimeContext,
                      options,
                    );

                  mounted =
                    result.mounted ===
                    true;

                  stopped =
                    false;

                  failed =
                    false;

                  registered =
                    true;

                  stoppedAt =
                    null;

                  mountedAt =
                    mounted
                      ? new Date()
                      : null;

                  lastError =
                    null;

                  if (
                    runtimeContext &&
                    typeof runtimeContext ===
                      'object'
                  ) {
                    runtimeContext.routes =
                      {
                        app:
                          application,

                        router,

                        count:
                          routeCount,

                        module:
                          routeModule,

                        modulePath:
                          routeModulePath,
                      };
                  }

                  emitObservabilityEvent(
                    'routes.mounted',
                    {
                      routeCount,

                      modulePath:
                        routeModulePath,
                    },
                  );

                  return result;
                } catch (error) {
                  mounted =
                    false;

                  failed =
                    true;

                  lastError =
                    error;

                  emitObservabilityEvent(
                    'routes.mount_failed',
                    {
                      error: {
                        name:
                          error?.name,

                        code:
                          error?.code,

                        message:
                          error?.message,
                      },
                    },
                  );

                  throw wrapError(
                    error,
                    'ROUTES_MOUNT_FAILED',
                    'startup',
                    'TITech route mounting failed.',
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
          async () => {
            return (
              mounted &&
              !failed &&
              !stopped
            );
          },

        /**
         * ---------------------------------------------------------------------
         * HEALTH
         * ---------------------------------------------------------------------
         */

        health:
          async () => {
            return {
              status:
                failed
                  ? 'unhealthy'
                  : stopped
                    ? 'stopped'
                    : mounted
                      ? 'healthy'
                      : 'not_ready',

              ready:
                mounted &&
                !failed &&
                !stopped,

              component:
                COMPONENT,

              service:
                SERVICE_NAME,

              routeCount,

              modulePath:
                routeModulePath,
            };
          },

        /**
         * ---------------------------------------------------------------------
         * STOP
         * ---------------------------------------------------------------------
         *
         * Express routes generally do not have a teardown phase.
         *
         * This hook therefore marks routing unavailable and releases internal
         * bootstrap references without mutating the Express stack. The HTTP
         * server shutdown is responsible for preventing further traffic.
         * ---------------------------------------------------------------------
         */

        stop:
          async () => {
            mounted =
              false;

            stopped =
              true;

            stoppedAt =
              new Date();

            emitObservabilityEvent(
              'routes.unmounted',
              {
                routeCount,
              },
            );

            return true;
          },
      },
    );

  registered =
    true;

  return registrationResult;
}

/**
 * -----------------------------------------------------------------------------
 * Canonical Bootstrap Contract
 * -----------------------------------------------------------------------------
 */

function registerBootstrapHooks(
  context = {},
  options = {},
) {
  return registerRoutesHooks(
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
  app,
  context = {},
  options = {},
) {
  if (
    app
  ) {
    setApplication(
      app,
    );
  }

  if (
    context?.app
  ) {
    setApplication(
      context.app,
    );
  }

  const target =
    application;

  assertApplication(
    target,
  );

  if (
    mounted &&
    !stopped &&
    !failed
  ) {
    return {
      app:
        target,

      router,

      routeCount,
    };
  }

  if (
    startPromise
  ) {
    return startPromise;
  }

  startPromise =
    mountRoutes(
      target,
      {
        ...context,

        app:
          target,
      },
      options,
    )
      .then(
        result => {
          mounted =
            result.mounted ===
            true;

          registered =
            true;

          stopped =
            false;

          failed =
            false;

          mountedAt =
            mounted
              ? new Date()
              : null;

          return {
            app:
              target,

            router,

            routeCount,

            ...result,
          };
        },
      )
      .catch(
        error => {
          failed =
            true;

          mounted =
            false;

          lastError =
            error;

          startPromise =
            null;

          throw wrapError(
            error,
            'ROUTES_INITIALIZATION_FAILED',
            'initialization',
            'TITech route initialization failed.',
          );
        },
      );

  return startPromise;
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Shutdown
 * -----------------------------------------------------------------------------
 */

async function shutdown() {
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
      try {
        mounted =
          false;

        stopped =
          true;

        stoppedAt =
          new Date();

        return true;
      } catch (error) {
        failed =
          true;

        stopped =
          false;

        lastError =
          error;

        throw wrapError(
          error,
          'ROUTES_SHUTDOWN_FAILED',
          'shutdown',
          'TITech routes shutdown failed.',
        );
      }
    })();

  return stopPromise;
}

async function stop() {
  return shutdown();
}

/**
 * -----------------------------------------------------------------------------
 * Runtime Access
 * -----------------------------------------------------------------------------
 */

function getApplication() {
  return application;
}

function getRouter() {
  return router;
}

function getRouteModule() {
  return routeModule;
}

function getRouteCount() {
  return routeCount;
}

function getState() {
  return Object.freeze({
    component:
      COMPONENT,

    service:
      SERVICE_NAME,

    registered,

    mounted,

    stopped,

    failed,

    ready:
      mounted &&
      !stopped &&
      !failed,

    routeCount,

    modulePath:
      routeModulePath,

    mountedAt,

    stoppedAt,

    lastError:
      lastError
        ? {
            name:
              lastError.name,

            code:
              lastError.code,

            message:
              lastError.message,
          }
        : null,
  });
}

function isRegistered() {
  return registered;
}

function isMounted() {
  return mounted;
}

function isStopped() {
  return stopped;
}

function isFailed() {
  return failed;
}

function isReady() {
  return (
    mounted &&
    !stopped &&
    !failed
  );
}

/**
 * -----------------------------------------------------------------------------
 * Diagnostics
 * -----------------------------------------------------------------------------
 */

function snapshot() {
  return Object.freeze({
    component:
      COMPONENT,

    service:
      SERVICE_NAME,

    registered,

    mounted,

    stopped,

    failed,

    ready:
      isReady(),

    routeCount,

    modulePath:
      routeModulePath,

    mountedAt,

    stoppedAt,

    applicationAvailable:
      Boolean(
        application,
      ),

    routerAvailable:
      Boolean(
        router,
      ),

    lastError:
      lastError
        ? {
            name:
              lastError.name,

            code:
              lastError.code,

            message:
              lastError.message,
          }
        : null,
  });
}

/**
 * -----------------------------------------------------------------------------
 * Reset
 * -----------------------------------------------------------------------------
 *
 * Testing/process-isolation only.
 */

function reset() {
  if (
    mounted
  ) {
    throw new RoutesBootstrapError(
      'Cannot reset route bootstrap while routes are mounted.',
      {
        code:
          'ROUTES_RESET_NOT_ALLOWED',
      },
    );
  }

  application =
    null;

  router =
    null;

  routeModule =
    null;

  routeModulePath =
    null;

  registered =
    false;

  mounted =
    false;

  stopped =
    false;

  failed =
    false;

  registrationResult =
    null;

  startPromise =
    null;

  stopPromise =
    null;

  lastError =
    null;

  routeCount =
    0;

  mountedAt =
    null;

  stoppedAt =
    null;

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
    RoutesBootstrapError
  ) {
    return error;
  }

  return new RoutesBootstrapError(
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
    registerRoutesHooks,

    registerBootstrapHooks,

    bootstrap:
      registerBootstrapHooks,

    /**
     * Application/route injection.
     */
    setApplication,

    setRouteModule,

    mountRoutes,

    /**
     * Explicit lifecycle.
     */
    initialize,

    start:
      initialize,

    shutdown,

    stop,

    /**
     * Runtime access.
     */
    getApplication,

    getRouter,

    getRouteModule,

    getRouteCount,

    /**
     * State.
     */
    getState,

    snapshot,

    isRegistered,

    isMounted,

    isStopped,

    isFailed,

    isReady,

    /**
     * Test support.
     */
    reset,

    /**
     * Constants/errors.
     */
    RoutesBootstrapError,

    COMPONENT,

    SERVICE_NAME,

    ROUTE_MODULE_CANDIDATES,
  });