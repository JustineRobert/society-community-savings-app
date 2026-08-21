'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Application Bootstrap / Composition Root
 *
 * File:
 *   backend/bootstrap/app.js
 *
 * Production Grade
 * -----------------------------------------------------------------------------
 * Responsibilities
 * - Compose the canonical TITech bootstrap lifecycle.
 * - Register lifecycle components in deterministic order.
 * - Build and expose the shared bootstrap context.
 * - Coordinate startup and shutdown through canonical lifecycle modules.
 * - Provide one application entry point for HTTP, workers and CLI processes.
 * - Convert startup failures into structured startup errors.
 * - Preserve compatibility with backend/runtime/state.js.
 * - Isolate lifecycle-state bookkeeping failures from real bootstrap failures.
 *
 * Critical reliability rule
 * -----------------------------------------------------------------------------
 * A failure in lifecycle bookkeeping, telemetry or compatibility state MUST NOT
 * falsely convert a successfully initialized infrastructure component into a
 * failed bootstrap phase.
 *
 * Example:
 *
 *   logger initialization
 *        ↓
 *   logger ready
 *        ↓
 *   runtimeState.markPhaseCompleted()
 *        ↓
 *   bookkeeping failure
 *
 * The logger remains successfully initialized.
 *
 * Real bootstrap failures remain fatal according to phase policy.
 * =============================================================================
 */

const http = require('node:http');

/* =============================================================================
 * Core Application
 * =============================================================================
 */

const app = require('../app');

/* =============================================================================
 * Canonical Configuration
 * =============================================================================
 */

const configuration = require('../config');

/* =============================================================================
 * Runtime Compatibility Layer
 * =============================================================================
 */

const runtimeState = require('../runtime/state');

/* =============================================================================
 * Canonical Bootstrap Modules
 * =============================================================================
 */

const environmentBootstrap = require('./environment');
const loggerBootstrap = require('./logger');
const observabilityBootstrap = require('./observability');
const readinessBootstrap = require('./readinessState');
const resilienceBootstrap = require('./resilience');
const infrastructureBootstrap = require('./infrastructure');
const servicesBootstrap = require('./services');
const servicesContextBootstrap = require('./servicesContext');
const middlewareBootstrap = require('./middleware');
const routesBootstrap = require('./routes');
const serverBootstrap = require('./server');
const runtimeBootstrap = require('./runtime');
const shutdownBootstrap = require('./shutdown');
const shutdownManagerBootstrap = require('./shutdownManager');

/* =============================================================================
 * Lifecycle / Hook Engine
 * =============================================================================
 */

const hooksModule = require('./hooks');
const lifecycleModule = require('./lifecycle');

/* =============================================================================
 * Startup Errors
 * =============================================================================
 */

const startupErrors = require('./startupErrors');

/* =============================================================================
 * Logger Resolution
 * =============================================================================
 */

function createConsoleLogger() {
  return {
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    debug: (...args) => console.debug(...args),
    trace: (...args) => console.debug(...args),
    fatal: (...args) => console.error(...args),
  };
}

function resolveLogger() {
  try {
    if (
      loggerBootstrap &&
      typeof loggerBootstrap.getLogger === 'function'
    ) {
      const resolved = loggerBootstrap.getLogger();

      if (
        resolved &&
        typeof resolved.info === 'function'
      ) {
        return resolved;
      }
    }

    if (
      loggerBootstrap?.logger &&
      typeof loggerBootstrap.logger.info === 'function'
    ) {
      return loggerBootstrap.logger;
    }

    if (
      loggerBootstrap &&
      (
        typeof loggerBootstrap.info === 'function' ||
        typeof loggerBootstrap.warn === 'function' ||
        typeof loggerBootstrap.error === 'function'
      )
    ) {
      return loggerBootstrap;
    }
  } catch {
    // Bootstrap must remain usable before logger initialization.
  }

  return createConsoleLogger();
}

let logger = resolveLogger();

/* =============================================================================
 * Safe Logger
 * =============================================================================
 *
 * Some bootstrap implementations use pino-style:
 *
 *   logger.info(object, message)
 *
 * Others use Winston/console-style:
 *
 *   logger.info(message, object)
 *
 * We keep normal logging calls compatible while ensuring logger diagnostics
 * never become bootstrap-fatal.
 * =============================================================================
 */

function safeLogInfo(
  metadata = {},
  message = undefined,
) {
  try {
    if (typeof logger?.info === 'function') {
      if (
        message !== undefined
      ) {
        logger.info(
          metadata,
          message,
        );
      } else {
        logger.info(
          metadata,
        );
      }
    } else {
      console.info(
        message || metadata,
      );
    }
  } catch {
    try {
      console.info(
        message || metadata,
      );
    } catch {
      // Logging must never crash startup.
    }
  }
}

function safeLogWarn(
  metadata = {},
  message = undefined,
) {
  try {
    if (typeof logger?.warn === 'function') {
      if (
        message !== undefined
      ) {
        logger.warn(
          metadata,
          message,
        );
      } else {
        logger.warn(
          metadata,
        );
      }
    } else {
      console.warn(
        message || metadata,
      );
    }
  } catch {
    try {
      console.warn(
        message || metadata,
      );
    } catch {
      // Logging must never crash startup.
    }
  }
}

function safeLogError(
  metadata = {},
  message = undefined,
) {
  try {
    if (typeof logger?.error === 'function') {
      if (
        message !== undefined
      ) {
        logger.error(
          metadata,
          message,
        );
      } else {
        logger.error(
          metadata,
        );
      }
    } else {
      console.error(
        message || metadata,
      );
    }
  } catch {
    try {
      console.error(
        message || metadata,
      );
    } catch {
      // Logging must never crash startup.
    }
  }
}

function safeLogDebug(
  metadata = {},
  message = undefined,
) {
  try {
    if (typeof logger?.debug === 'function') {
      if (
        message !== undefined
      ) {
        logger.debug(
          metadata,
          message,
        );
      } else {
        logger.debug(
          metadata,
        );
      }
    }
  } catch {
    // Debug logging is never bootstrap-fatal.
  }
}

function safeLogFatal(
  metadata = {},
  message = undefined,
) {
  try {
    if (typeof logger?.fatal === 'function') {
      if (
        message !== undefined
      ) {
        logger.fatal(
          metadata,
          message,
        );
      } else {
        logger.fatal(
          metadata,
        );
      }

      return;
    }

    safeLogError(
      metadata,
      message,
    );
  } catch {
    try {
      console.error(
        message || metadata,
      );
    } catch {
      // Ignore.
    }
  }
}

/* =============================================================================
 * Runtime Variables
 * =============================================================================
 */

let startupPromise = null;

let shutdownPromise = null;

let startupCompleted = false;

let shutdownCompleted = false;

let bootstrapContext = null;

let directExecution = false;

/* =============================================================================
 * Bootstrap Environment
 * =============================================================================
 */

async function bootstrapEnvironment() {
  try {
    const initializer =
      environmentBootstrap?.initialize ||
      environmentBootstrap?.bootstrap ||
      environmentBootstrap?.start ||
      environmentBootstrap?.load ||
      (
        typeof environmentBootstrap === 'function'
          ? environmentBootstrap
          : null
      );

    if (
      typeof initializer === 'function'
    ) {
      const result =
        await initializer(
          bootstrapContext || {},
        );

      /*
       * The callable environment bootstrap may return the canonical
       * configuration directly.
       *
       * Normalize the result for the shared context.
       */
      if (
        result &&
        typeof result === 'object'
      ) {
        return (
          result.environment ||
          result.configuration ||
          result.config ||
          result
        );
      }
    }

    if (
      environmentBootstrap?.environment
    ) {
      return environmentBootstrap.environment;
    }

    if (
      configuration?.environment
    ) {
      return configuration.environment;
    }

    throw new Error(
      'TITech environment bootstrap is unavailable.',
    );
  } catch (error) {
    throw startupErrors.wrapStartup(
      'environment',
      'bootstrap-environment',
      error,
      {
        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Configuration
 * =============================================================================
 */

async function bootstrapConfiguration() {
  try {
    if (!configuration) {
      throw new Error(
        'TITech application configuration is unavailable.',
      );
    }

    if (
      Object.isFrozen(
        configuration,
      ) !== true
    ) {
      throw new Error(
        'TITech application configuration must be immutable.',
      );
    }

    return configuration;
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'configuration',
      error,
      {
        operation:
          'validate-configuration',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Logger
 * =============================================================================
 */

async function bootstrapLogger() {
  try {
    const initializer =
      loggerBootstrap?.initialize ||
      loggerBootstrap?.start ||
      loggerBootstrap?.bootstrap;

    if (
      typeof initializer === 'function'
    ) {
      const initializedLogger =
        await initializer({
          configuration,
        });

      if (
        initializedLogger &&
        typeof initializedLogger.info === 'function'
      ) {
        logger =
          initializedLogger;
      }
    }

    /*
     * Refresh the logger after initialization.
     *
     * This matters when loggerBootstrap exposes a logger lazily.
     */
    try {
      const refreshed =
        resolveLogger();

      if (
        refreshed &&
        typeof refreshed.info === 'function'
      ) {
        logger =
          refreshed;
      }
    } catch {
      // Keep the existing logger.
    }

    if (
      !logger ||
      typeof logger.info !== 'function'
    ) {
      throw new Error(
        'TITech application logger is unavailable.',
      );
    }

    safeLogInfo(
      {
        component:
          'bootstrap/app',

        phase:
          'logger',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        environment:
          configuration?.environment ||
          process.env.NODE_ENV ||
          'development',
      },
      'TITech logger bootstrap completed.',
    );

    return logger;
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'logger',
      error,
      {
        operation:
          'initialize-logger',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Observability
 * =============================================================================
 */

async function bootstrapObservability() {
  try {
    const initializer =
      observabilityBootstrap?.initialize ||
      observabilityBootstrap?.start ||
      observabilityBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech observability bootstrap initializer is unavailable.',
      );
    }

    const result =
      await initializer({
        configuration,
        logger,
        context:
          bootstrapContext,
      });

    return (
      result ||
      observabilityBootstrap?.observability ||
      observabilityBootstrap ||
      null
    );
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'observability',
      error,
      {
        operation:
          'initialize-observability',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Readiness
 * =============================================================================
 */

async function bootstrapReadiness() {
  try {
    if (
      typeof readinessBootstrap?.beginInitialization ===
        'function'
    ) {
      readinessBootstrap.beginInitialization({
        source:
          'bootstrap/app',
      });
    }

    if (
      typeof readinessBootstrap?.beginWarming ===
        'function'
    ) {
      readinessBootstrap.beginWarming({
        source:
          'bootstrap/app',
      });
    }

    if (
      typeof readinessBootstrap?.evaluate ===
        'function'
    ) {
      await readinessBootstrap.evaluate({
        allowRecovery:
          true,
      });
    }

    return (
      readinessBootstrap?.readinessState ||
      readinessBootstrap
    );
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'readiness',
      error,
      {
        operation:
          'initialize-readiness',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,
      },
    );
  }
}

/* =============================================================================
 * Resilience
 * =============================================================================
 */

async function bootstrapResilience() {
  try {
    const initializer =
      resilienceBootstrap?.initialize ||
      resilienceBootstrap?.start ||
      resilienceBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech resilience bootstrap initializer is unavailable.',
      );
    }

    return await initializer(
      bootstrapContext,
    );
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'resilience',
      error,
      {
        operation:
          'initialize-resilience',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Infrastructure
 * =============================================================================
 */

async function bootstrapInfrastructure() {
  try {
    const initializer =
      infrastructureBootstrap?.initialize ||
      infrastructureBootstrap?.start ||
      infrastructureBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech infrastructure bootstrap initializer is unavailable.',
      );
    }

    return await initializer(
      bootstrapContext,
    );
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'infrastructure',
      error,
      {
        operation:
          'initialize-infrastructure',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Services
 * =============================================================================
 */

async function bootstrapServices() {
  try {
    if (
      typeof servicesContextBootstrap?.createRootContext ===
        'function'
    ) {
      bootstrapContext.servicesContext =
        servicesContextBootstrap.createRootContext(
          {
            config:
              configuration,

            environment:
              bootstrapContext.environment,

            logger,

            observability:
              bootstrapContext.observability ||
              observabilityBootstrap?.observability ||
              observabilityBootstrap,

            readiness:
              bootstrapContext.readiness ||
              readinessBootstrap?.readinessState ||
              readinessBootstrap,

            resilience:
              bootstrapContext.resilience ||
              resilienceBootstrap?.getResilience?.() ||
              resilienceBootstrap?.resilience ||
              resilienceBootstrap,

            infrastructure:
              bootstrapContext.infrastructure ||
              {},

            services:
              bootstrapContext.services ||
              {},

            container:
              bootstrapContext.container ||
              {},

            metadata: {
              source:
                'bootstrap/app',
            },
          },
        );

      bootstrapContext.serviceContext =
        bootstrapContext.servicesContext;
    }

    const initializer =
      servicesBootstrap?.initialize ||
      servicesBootstrap?.start ||
      servicesBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech services bootstrap initializer is unavailable.',
      );
    }

    const services =
      await initializer(
        bootstrapContext,
      );

    bootstrapContext.services =
      services ||
      servicesBootstrap?.getServices?.() ||
      {};

    bootstrapContext.serviceRegistry =
      servicesBootstrap?.getServiceRegistry?.() ||
      bootstrapContext.services;

    if (
      typeof servicesContextBootstrap?.createServicesContext ===
        'function' &&
      bootstrapContext.servicesContext
    ) {
      bootstrapContext.servicesContext =
        servicesContextBootstrap.createServicesContext(
          {
            parent:
              bootstrapContext.servicesContext,

            services:
              bootstrapContext.serviceRegistry,
          },
        );

      bootstrapContext.serviceContext =
        bootstrapContext.servicesContext;
    }

    return services;
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'services',
      error,
      {
        operation:
          'initialize-services',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Middleware
 * =============================================================================
 */

async function bootstrapMiddleware() {
  try {
    const initializer =
      middlewareBootstrap?.initialize ||
      middlewareBootstrap?.registerMiddleware ||
      middlewareBootstrap?.start ||
      middlewareBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech middleware bootstrap initializer is unavailable.',
      );
    }

    /*
     * Prefer the canonical initialize(app, context) contract.
     *
     * Function arity is not treated as a hard contract because default
     * parameters can change .length.
     */
    try {
      return await initializer(
        app,
        bootstrapContext,
      );
    } catch (firstError) {
      /*
       * Some adapters accept context only.
       *
       * Do not retry arbitrary application failures: only retry when the
       * initializer explicitly exposes an adapter marker.
       */
      if (
        middlewareBootstrap?.acceptsContextOnly === true
      ) {
        return await initializer(
          bootstrapContext,
        );
      }

      throw firstError;
    }
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'middleware',
      error,
      {
        operation:
          'initialize-middleware',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Routes
 * =============================================================================
 */

async function bootstrapRoutes() {
  try {
    const initializer =
      routesBootstrap?.initialize ||
      routesBootstrap?.mountRoutes ||
      routesBootstrap?.registerRoutesHooks ||
      routesBootstrap?.start ||
      routesBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech route bootstrap initializer is unavailable.',
      );
    }

    return await initializer(
      app,
      bootstrapContext,
      {
        requireReadiness:
          false,
      },
    );
  } catch (error) {
    /*
     * Some legacy route adapters expose initialize(context) rather than
     * initialize(app, context). Retry only when explicitly declared.
     */
    if (
      routesBootstrap?.acceptsContextOnly === true
    ) {
      try {
        return await initializer(
          bootstrapContext,
        );
      } catch (fallbackError) {
        throw startupErrors.startupErrorForPhase(
          'routes',
          fallbackError,
          {
            operation:
              'initialize-routes',

            component:
              'bootstrap/app',

            service:
              configuration?.serviceName ||
              'titech-community-capital-backend',

            critical:
              true,

            fatal:
              true,
          },
        );
      }
    }

    throw startupErrors.startupErrorForPhase(
      'routes',
      error,
      {
        operation:
          'initialize-routes',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Server
 * =============================================================================
 */

async function bootstrapServer() {
  try {
    const initializer =
      serverBootstrap?.initialize ||
      serverBootstrap?.start ||
      serverBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech HTTP server bootstrap initializer is unavailable.',
      );
    }

    /*
     * server.js / bootstrap/server.js owns:
     * - HTTP/HTTPS selection
     * - listen()
     * - timeouts
     * - connection draining
     * - server health
     */
    const result =
      await initializer(
        {
          ...bootstrapContext,
          app,
        },
        {
          requireReadiness:
            true,
        },
      );

    bootstrapContext.server =
      result?.server ||
      serverBootstrap?.getServer?.() ||
      null;

    bootstrapContext.httpServer =
      bootstrapContext.server;

    bootstrapContext.serverAddress =
      result?.address ||
      serverBootstrap?.getAddress?.() ||
      null;

    return result;
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'server',
      error,
      {
        operation:
          'start-http-server',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Runtime
 * =============================================================================
 */

async function bootstrapRuntime() {
  try {
    const initializer =
      runtimeBootstrap?.initialize ||
      runtimeBootstrap?.start ||
      runtimeBootstrap?.bootstrap;

    if (
      typeof initializer !== 'function'
    ) {
      throw new Error(
        'TITech runtime bootstrap initializer is unavailable.',
      );
    }

    return await initializer(
      bootstrapContext,
    );
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'runtime',
      error,
      {
        operation:
          'initialize-runtime',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Readiness / Ready
 * =============================================================================
 */

async function markReady() {
  try {
    if (
      typeof readinessBootstrap?.evaluate ===
        'function'
    ) {
      await readinessBootstrap.evaluate({
        allowRecovery:
          true,
      });
    }

    const readinessReady =
      typeof readinessBootstrap?.isReady ===
        'function'
        ? readinessBootstrap.isReady()
        : true;

    if (!readinessReady) {
      throw new Error(
        'TITech application dependencies are not ready.',
      );
    }

    if (
      typeof readinessBootstrap?.markReady ===
        'function'
    ) {
      readinessBootstrap.markReady({
        source:
          'bootstrap/app',
      });
    }

    /*
     * Compatibility state is advisory.
     * A bookkeeping failure must not turn readiness into a bootstrap failure.
     */
    try {
      runtimeState.markApplicationReady?.(
        null,
        logger,
      );
    } catch (stateError) {
      safeLogWarn(
        {
          component:
            'bootstrap/app',

          event:
            'runtime_state_ready_update_failed',

          message:
            stateError?.message,
        },
        'TITech runtime ready-state compatibility update failed.',
      );
    }

    return true;
  } catch (error) {
    throw startupErrors.startupErrorForPhase(
      'readiness',
      error,
      {
        operation:
          'mark-application-ready',

        component:
          'bootstrap/app',

        service:
          configuration?.serviceName ||
          'titech-community-capital-backend',

        critical:
          true,

        fatal:
          true,
      },
    );
  }
}

/* =============================================================================
 * Runtime State Compatibility
 * =============================================================================
 */

function mirrorRuntimeState(
  state = {},
) {
  if (
    typeof runtimeState?.setServiceState !==
      'function'
  ) {
    return;
  }

  for (
    const [
      service,
      serviceState,
    ] of Object.entries(state)
  ) {
    try {
      runtimeState.setServiceState(
        service,
        serviceState,
        null,
        logger,
      );
    } catch (error) {
      safeLogWarn(
        {
          component:
            'bootstrap/app',

          event:
            'runtime_state_service_update_failed',

          service,

          state:
            serviceState,

          message:
            error?.message,
        },
        'TITech runtime state compatibility update failed.',
      );
    }
  }
}

/* =============================================================================
 * Bootstrap Context
 * =============================================================================
 */

function createBootstrapContext() {
  return {
    app,

    configuration,

    environment:
      null,

    logger,

    observability:
      null,

    readiness:
      null,

    resilience:
      null,

    infrastructure:
      null,

    services:
      null,

    serviceRegistry:
      null,

    servicesContext:
      null,

    serviceContext:
      null,

    container:
      {},

    server:
      null,

    httpServer:
      null,

    serverAddress:
      null,

    runtime:
      runtimeBootstrap?.runtime ||
      runtimeBootstrap,

    state:
      runtimeState,

    getApplicationState:
      runtimeState.getApplicationState,

    getHealthState:
      runtimeState.getHealthState,
  };
}

/* =============================================================================
 * Startup
 * =============================================================================
 */

async function startApplication() {
  if (startupPromise) {
    return startupPromise;
  }

  if (startupCompleted) {
    return {
      app,

      server:
        bootstrapContext?.server ||
        serverBootstrap?.getServer?.() ||
        null,

      context:
        bootstrapContext,

      state:
        runtimeState.getApplicationState?.(),
    };
  }

  startupPromise =
    (async () => {
      bootstrapContext =
        createBootstrapContext();

      try {
        safeLogInfo(
          {
            section:
              'runtime',

            state:
              'starting',

            service:
              configuration?.serviceName ||
              'titech-community-capital-backend',

            environment:
              configuration?.environment ||
              process.env.NODE_ENV ||
              'development',
          },
          'Starting TITech Community Capital application bootstrap.',
        );

        try {
          runtimeState.markStarting?.(
            null,
            logger,
          );
        } catch (stateError) {
          safeLogWarn(
            {
              component:
                'bootstrap/app',

              event:
                'runtime_state_starting_update_failed',

              message:
                stateError?.message,
            },
            'TITech runtime starting-state update failed.',
          );
        }

        /* ---------------------------------------------------------------------
         * Environment
         * ------------------------------------------------------------------- */

        bootstrapContext.environment =
          await runStartupPhase(
            'environment',
            bootstrapEnvironment,
          );

        /* ---------------------------------------------------------------------
         * Configuration
         * ------------------------------------------------------------------- */

        bootstrapContext.configuration =
          await runStartupPhase(
            'configuration',
            bootstrapConfiguration,
          );

        /* ---------------------------------------------------------------------
         * Logger
         * ------------------------------------------------------------------- */

        bootstrapContext.logger =
          await runStartupPhase(
            'logger',
            bootstrapLogger,
          );

        /* ---------------------------------------------------------------------
         * Observability
         * ------------------------------------------------------------------- */

        bootstrapContext.observability =
          await runStartupPhase(
            'observability',
            bootstrapObservability,
          );

        /* ---------------------------------------------------------------------
         * Runtime
         * ------------------------------------------------------------------- */

        bootstrapContext.runtime =
          await runStartupPhase(
            'runtime',
            bootstrapRuntime,
          );

        /* ---------------------------------------------------------------------
         * Readiness
         * ------------------------------------------------------------------- */

        bootstrapContext.readiness =
          await runStartupPhase(
            'readiness',
            bootstrapReadiness,
          );

        /* ---------------------------------------------------------------------
         * Resilience
         * ------------------------------------------------------------------- */

        bootstrapContext.resilience =
          await runStartupPhase(
            'resilience',
            bootstrapResilience,
          );

        /* ---------------------------------------------------------------------
         * Infrastructure
         * ------------------------------------------------------------------- */

        bootstrapContext.infrastructure =
          await runStartupPhase(
            'infrastructure',
            bootstrapInfrastructure,
          );

        /* ---------------------------------------------------------------------
         * Services
         * ------------------------------------------------------------------- */

        bootstrapContext.services =
          await runStartupPhase(
            'services',
            bootstrapServices,
          );

        /* ---------------------------------------------------------------------
         * Middleware
         * ------------------------------------------------------------------- */

        await runStartupPhase(
          'middleware',
          bootstrapMiddleware,
        );

        /* ---------------------------------------------------------------------
         * Routes
         * ------------------------------------------------------------------- */

        await runStartupPhase(
          'routes',
          bootstrapRoutes,
        );

        /* ---------------------------------------------------------------------
         * Server
         * ------------------------------------------------------------------- */

        const serverResult =
          await runStartupPhase(
            'server',
            bootstrapServer,
          );

        bootstrapContext.server =
          serverResult?.server ||
          bootstrapContext.server;

        bootstrapContext.httpServer =
          bootstrapContext.server;

        /* ---------------------------------------------------------------------
         * Shutdown manager
         * ------------------------------------------------------------------- */

        try {
          shutdownManagerBootstrap?.initialize?.();

          shutdownManagerBootstrap?.registerBootstrapHooks?.(
            bootstrapContext,
          );
        } catch (shutdownRegistrationError) {
          throw startupErrors.startupErrorForPhase(
            'lifecycle',
            shutdownRegistrationError,
            {
              operation:
                'register-shutdown-manager',

              component:
                'bootstrap/app',

              service:
                configuration?.serviceName ||
                'titech-community-capital-backend',

              critical:
                true,

              fatal:
                true,
            },
          );
        }

        /* ---------------------------------------------------------------------
         * Started
         * ------------------------------------------------------------------- */

        try {
          runtimeState.markApplicationStarted?.(
            null,
            logger,
          );
        } catch (stateError) {
          safeLogWarn(
            {
              component:
                'bootstrap/app',

              event:
                'runtime_state_started_update_failed',

              message:
                stateError?.message,
            },
            'TITech application-started compatibility update failed.',
          );
        }

        /* ---------------------------------------------------------------------
         * Ready
         * ------------------------------------------------------------------- */

        await markReady();

        startupCompleted = true;
        shutdownCompleted = false;

        mirrorRuntimeState({
          environment:
            'ready',

          configuration:
            'ready',

          logger:
            'ready',

          observability:
            'ready',

          runtime:
            'ready',

          readiness:
            'ready',

          resilience:
            'ready',

          infrastructure:
            'ready',

          services:
            'ready',

          middleware:
            'ready',

          routes:
            'ready',

          server:
            'ready',
        });

        safeLogInfo(
          {
            component:
              'bootstrap/app',

            event:
              'application.ready',

            service:
              configuration?.serviceName ||
              'titech-community-capital-backend',

            environment:
              configuration?.environment ||
              process.env.NODE_ENV ||
              'development',

            server:
              bootstrapContext.serverAddress,
          },
          'TITech application startup completed successfully.',
        );

        return {
          app,

          server:
            bootstrapContext.server,

          context:
            bootstrapContext,

          state:
            runtimeState.getApplicationState?.(),
        };
      } catch (error) {
        const normalized =
          startupErrors.normalizeStartupError(
            error,
            {
              phase:
                error?.phase ||
                'bootstrap',

              component:
                'bootstrap/app',

              service:
                configuration?.serviceName ||
                'titech-community-capital-backend',

              critical:
                true,

              fatal:
                true,

              preserveCauseStack:
                true,
            },
          );

        try {
          runtimeState.markFailed?.(
            normalized,
            null,
            logger,
          );
        } catch (stateError) {
          safeLogWarn(
            {
              component:
                'bootstrap/app',

              event:
                'runtime_state_failure_update_failed',

              message:
                stateError?.message,
            },
            'TITech runtime failure-state compatibility update failed.',
          );
        }

        safeLogError(
          normalized.toLogObject({
            includeStack:
              true,

            includeCauseStack:
              true,
          }),
          'TITech application startup failed.',
        );

        /*
         * Delegate all startup cleanup to the canonical shutdown layer.
         */
        try {
          await shutdownApplication({
            reason:
              'startup_failure',

            exit:
              false,

            skipProcessExit:
              true,
          });
        } catch (cleanupError) {
          safeLogError(
            {
              component:
                'bootstrap/app',

              event:
                'startup.cleanup.failed',

              error:
                cleanupError?.message,
            },
            'TITech startup cleanup encountered an error.',
          );
        }

        throw normalized;
      }
    })();

  try {
    return await startupPromise;
  } finally {
    startupPromise = null;
  }
}

/* =============================================================================
 * Startup Phase Runner
 * =============================================================================
 *
 * IMPORTANT:
 * The actual phase execution is authoritative.
 *
 * Runtime compatibility state, telemetry and lifecycle bookkeeping are
 * advisory. Their failures must never replace the original phase result/error.
 * =============================================================================
 */

async function runStartupPhase(
  phase,
  execute,
) {
  const phaseEnum =
    runtimeState?.BOOTSTRAP_PHASES?.[
      String(
        phase,
      ).toUpperCase()
    ] ||
    phase;

  const startedAt =
    process.hrtime.bigint();

  /*
   * ---------------------------------------------------------------------------
   * Phase-start bookkeeping
   * ---------------------------------------------------------------------------
   */

  try {
    runtimeState?.markPhaseStarted?.(
      phaseEnum,
      null,
      logger,
    );
  } catch (stateError) {
    safeLogWarn(
      {
        component:
          'bootstrap/app',

        event:
          'phase.start_state_update_failed',

        phase,

        message:
          stateError?.message,
      },
      `TITech bootstrap phase "${phase}" start-state update failed.`,
    );
  }

  /*
   * ---------------------------------------------------------------------------
   * Execute the actual phase
   * ---------------------------------------------------------------------------
   */

  let result;

  try {
    result =
      await execute();
  } catch (error) {
    /*
     * The actual bootstrap failed.
     *
     * This error is authoritative and MUST be propagated.
     */
    const normalized =
      startupErrors.startupErrorForPhase(
        phase,
        error,
        {
          operation:
            `bootstrap-${phase}`,

          component:
            'bootstrap/app',

          service:
            configuration?.serviceName ||
            'titech-community-capital-backend',

          critical:
            true,

          fatal:
            true,

          preserveCauseStack:
            true,

          durationMs:
            Number(
              process.hrtime.bigint() -
                startedAt,
            ) /
            1_000_000,
        },
      );

    /*
     * Failure bookkeeping is isolated from the real failure.
     */
    try {
      runtimeState?.markPhaseCompleted?.(
        phaseEnum,
        normalized,
        logger,
      );
    } catch (stateError) {
      safeLogWarn(
        {
          component:
            'bootstrap/app',

          event:
            'phase.failure_state_update_failed',

          phase,

          message:
            stateError?.message,
        },
        `TITech bootstrap phase "${phase}" failure-state update failed.`,
      );
    }

    throw normalized;
  }

  /*
   * ---------------------------------------------------------------------------
   * Phase succeeded.
   * ---------------------------------------------------------------------------
   *
   * DO NOT wrap these state updates around the phase execution.
   *
   * This is the exact defect that previously produced:
   *
   *   service: logger -> ready
   *   runtime: failed
   *   "Logger initialization failed."
   *
   * The logger had already initialized successfully.
   * ---------------------------------------------------------------------------
   */

  try {
    runtimeState?.markPhaseCompleted?.(
      phaseEnum,
      null,
      logger,
    );
  } catch (stateError) {
    safeLogWarn(
      {
        component:
          'bootstrap/app',

        event:
          'phase.completion_state_update_failed',

        phase,

        message:
          stateError?.message,
      },
      `TITech bootstrap phase "${phase}" completion-state update failed; phase remains successful.`,
    );
  }

  const durationMs =
    Number(
      process.hrtime.bigint() -
        startedAt,
    ) /
    1_000_000;

  safeLogDebug(
    {
      component:
        'bootstrap/app',

      phase,

      durationMs,
    },
    `TITech bootstrap phase "${phase}" completed.`,
  );

  return result;
}

/* =============================================================================
 * Shutdown
 * =============================================================================
 */

async function shutdownApplication(
  {
    reason =
      'shutdown',

    exit =
      false,

    exitCode =
      0,

    skipProcessExit =
      false,
  } = {},
) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  if (shutdownCompleted) {
    if (
      exit &&
      !skipProcessExit
    ) {
      process.exit(
        exitCode,
      );
    }

    return;
  }

  shutdownPromise =
    (async () => {
      try {
        safeLogInfo(
          {
            component:
              'bootstrap/app',

            event:
              'shutdown.requested',

            reason,
          },
          'TITech application shutdown requested.',
        );

        try {
          readinessBootstrap?.markNotReady?.(
            'application-shutdown',
            {
              reason,
            },
          );
        } catch (stateError) {
          safeLogWarn(
            {
              component:
                'bootstrap/app',

              event:
                'readiness.shutdown_update_failed',

              message:
                stateError?.message,
            },
            'TITech readiness shutdown-state update failed.',
          );
        }

        try {
          runtimeState?.markApplicationShutdown?.(
            null,
            logger,
          );
        } catch (stateError) {
          safeLogWarn(
            {
              component:
                'bootstrap/app',

              event:
                'runtime_state_shutdown_update_failed',

              message:
                stateError?.message,
            },
            'TITech runtime shutdown-state compatibility update failed.',
          );
        }

        /*
         * Canonical shutdown coordinator.
         */
        if (
          typeof shutdownBootstrap?.shutdown ===
            'function'
        ) {
          await shutdownBootstrap.shutdown(
            reason,
            {
              signal:
                reason.startsWith(
                  'signal:',
                )
                  ? reason.slice(
                      'signal:'.length,
                    )
                  : undefined,
            },
          );
        } else if (
          typeof shutdownBootstrap
            ?.shutdownCoordinator
            ?.request ===
            'function'
        ) {
          await shutdownBootstrap.shutdownCoordinator.request(
            reason,
          );
        } else if (
          typeof shutdownManagerBootstrap?.shutdown ===
            'function'
        ) {
          await shutdownManagerBootstrap.shutdown(
            reason,
          );
        }

        try {
          runtimeState?.markApplicationStopped?.(
            null,
            logger,
          );
        } catch (stateError) {
          safeLogWarn(
            {
              component:
                'bootstrap/app',

              event:
                'runtime_state_stopped_update_failed',

              message:
                stateError?.message,
            },
            'TITech runtime stopped-state compatibility update failed.',
          );
        }

        shutdownCompleted = true;
        startupCompleted = false;
        bootstrapContext = null;

        safeLogInfo(
          {
            component:
              'bootstrap/app',

            event:
              'shutdown.completed',

            reason,
          },
          'TITech application shutdown completed.',
        );

        if (
          exit &&
          !skipProcessExit
        ) {
          process.exit(
            exitCode,
          );
        }
      } catch (error) {
        const normalized =
          startupErrors.normalizeStartupError(
            error,
            {
              phase:
                'lifecycle',

              operation:
                'application-shutdown',

              component:
                'bootstrap/app',

              service:
                configuration?.serviceName ||
                'titech-community-capital-backend',

              critical:
                true,

              fatal:
                exit,

              preserveCauseStack:
                true,
            },
          );

        safeLogError(
          normalized.toLogObject({
            includeStack:
              true,

            includeCauseStack:
              true,
          }),
          'TITech application shutdown failed.',
        );

        if (
          exit &&
          !skipProcessExit
        ) {
          process.exit(
            exitCode ||
              1,
          );
        }

        throw normalized;
      }
    })();

  try {
    return await shutdownPromise;
  } finally {
    shutdownPromise = null;
  }
}

/* =============================================================================
 * Process Signals
 * =============================================================================
 */

function installSignalHandlers() {
  /*
   * runtime.js is the preferred process signal owner.
   */
  try {
    if (
      runtimeBootstrap?.runtime &&
      typeof runtimeBootstrap.runtime.initialize ===
        'function'
    ) {
      return;
    }

    if (
      typeof runtimeBootstrap?.initialize ===
        'function'
    ) {
      return;
    }
  } catch {
    // Continue to compatibility registration.
  }

  if (
    installSignalHandlers.installed
  ) {
    return;
  }

  installSignalHandlers.installed =
    true;

  const handle =
    (signal) =>
    async () => {
      safeLogInfo(
        {
          component:
            'bootstrap/app',

          event:
            'signal.received',

          signal,
        },
        `TITech process received ${signal}.`,
      );

      try {
        await shutdownApplication({
          reason:
            `signal:${signal}`,

          exit:
            true,

          exitCode:
            0,
        });
      } catch (error) {
        safeLogError(
          {
            component:
              'bootstrap/app',

            event:
              'signal.shutdown.failed',

            signal,

            message:
              error?.message,
          },
          'TITech signal shutdown failed.',
        );

        process.exitCode = 1;
      }
    };

  process.once(
    'SIGINT',
    handle('SIGINT'),
  );

  process.once(
    'SIGTERM',
    handle('SIGTERM'),
  );

  process.once(
    'SIGQUIT',
    handle('SIGQUIT'),
  );
}

installSignalHandlers.installed =
  false;

/* =============================================================================
 * Fatal Process Error Compatibility
 * =============================================================================
 */

function installFatalErrorHandlers() {
  if (
    installFatalErrorHandlers.installed
  ) {
    return;
  }

  if (
    runtimeBootstrap &&
    typeof runtimeBootstrap.handleFatalError ===
      'function'
  ) {
    return;
  }

  installFatalErrorHandlers.installed =
    true;

  process.once(
    'uncaughtException',
    async (error) => {
      const normalized =
        startupErrors.runtimeError(
          'TITech process encountered an uncaught exception.',
          {
            cause:
              error,

            critical:
              true,

            fatal:
              true,

            retryable:
              false,
          },
        );

      safeLogFatal(
        normalized.toLogObject({
          includeStack:
            true,

          includeCauseStack:
            true,
        }),
        'TITech uncaught exception.',
      );

      try {
        await shutdownApplication({
          reason:
            'uncaughtException',

          exit:
            true,

          exitCode:
            1,
        });
      } catch {
        process.exitCode = 1;
      }
    },
  );

  process.once(
    'unhandledRejection',
    async (reason) => {
      const error =
        reason instanceof Error
          ? reason
          : new Error(
              String(
                reason,
              ),
            );

      const normalized =
        startupErrors.runtimeError(
          'TITech process encountered an unhandled promise rejection.',
          {
            cause:
              error,

            critical:
              true,

            fatal:
              true,

            retryable:
              false,
          },
        );

      safeLogFatal(
        normalized.toLogObject({
          includeStack:
            true,

          includeCauseStack:
            true,
        }),
        'TITech unhandled promise rejection.',
      );

      try {
        await shutdownApplication({
          reason:
            'unhandledRejection',

          exit:
            true,

          exitCode:
            1,
        });
      } catch {
        process.exitCode = 1;
      }
    },
  );
}

installFatalErrorHandlers.installed =
  false;

/* =============================================================================
 * Readiness
 * =============================================================================
 */

function isRuntimeReady() {
  try {
    if (
      typeof readinessBootstrap?.isReady ===
        'function' &&
      !readinessBootstrap.isReady()
    ) {
      return false;
    }

    if (
      typeof runtimeBootstrap?.isReady ===
        'function' &&
      !runtimeBootstrap.isReady()
    ) {
      return false;
    }

    const state =
      runtimeState.getApplicationState?.();

    if (
      state &&
      (
        state.failed === true ||
        state.shuttingDown === true
      )
    ) {
      return false;
    }

    return Boolean(
      startupCompleted &&
      !shutdownCompleted,
    );
  } catch {
    return false;
  }
}

/* =============================================================================
 * Health
 * =============================================================================
 */

async function getHealthState() {
  try {
    if (
      typeof readinessBootstrap?.health ===
        'function'
    ) {
      return await readinessBootstrap.health();
    }

    if (
      typeof observabilityBootstrap?.health ===
        'function'
    ) {
      return await observabilityBootstrap.health();
    }

    return {
      status:
        isRuntimeReady()
          ? 'healthy'
          : 'not_ready',

      ready:
        isRuntimeReady(),
    };
  } catch (error) {
    return {
      status:
        'unhealthy',

      ready:
        false,

      error: {
        name:
          error?.name,

        code:
          error?.code,

        message:
          error?.message,
      },
    };
  }
}

/* =============================================================================
 * Bootstrap Snapshot
 * =============================================================================
 */

function getBootstrapState() {
  return {
    startupCompleted,

    shutdownCompleted,

    ready:
      isRuntimeReady(),

    context:
      bootstrapContext,

    runtime:
      runtimeState.getApplicationState?.(),

    health:
      runtimeState.getHealthState?.(),
  };
}

/* =============================================================================
 * Public API
 * =============================================================================
 */

module.exports = Object.freeze({
  app,

  configuration,

  getLogger() {
    return logger;
  },

  logger,

  getBootstrapContext() {
    return bootstrapContext;
  },

  startApplication,

  shutdownApplication,

  installSignalHandlers,

  installFatalErrorHandlers,

  bootstrapEnvironment,

  bootstrapConfiguration,

  bootstrapLogger,

  bootstrapObservability,

  bootstrapReadiness,

  bootstrapResilience,

  bootstrapInfrastructure,

  bootstrapServices,

  bootstrapMiddleware,

  bootstrapRoutes,

  bootstrapServer,

  bootstrapRuntime,

  markReady,

  createBootstrapContext,

  runStartupPhase,

  getBootstrapState,

  getRuntimeState:
    runtimeState.getApplicationState,

  getHealthState,

  isRuntimeReady,
});

/* =============================================================================
 * Direct Execution
 * =============================================================================
 */

if (
  require.main === module
) {
  directExecution = true;

  try {
    runtimeBootstrap?.initialize?.({
      app,

      configuration,

      logger,
    });
  } catch (error) {
    safeLogWarn(
      {
        component:
          'bootstrap/app',

        event:
          'runtime.compatibility_initialize_failed',

        message:
          error?.message,
      },
      'TITech runtime compatibility initialization failed.',
    );
  }

  installSignalHandlers();

  installFatalErrorHandlers();

  startApplication()
    .catch(
      (error) => {
        const normalized =
          startupErrors.normalizeStartupError(
            error,
            {
              phase:
                error?.phase ||
                'bootstrap',

              component:
                'bootstrap/app',

              service:
                configuration?.serviceName ||
                'titech-community-capital-backend',

              critical:
                true,

              fatal:
                true,

              preserveCauseStack:
                true,
            },
          );

        safeLogFatal(
          normalized.toLogObject({
            includeStack:
              true,

            includeCauseStack:
              true,
          }),
          'TITech application failed to start.',
        );

        process.exitCode = 1;
      },
    );
}