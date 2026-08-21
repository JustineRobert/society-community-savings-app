'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/ApplicationBootstrap.js
 *
 * Purpose:
 *   Enterprise production-grade application bootstrap orchestrator.
 *
 * Responsibilities:
 *   - Coordinate the complete TITech application startup lifecycle.
 *   - Coordinate the complete TITech application shutdown lifecycle.
 *   - Provide a single composition boundary for dependency registration.
 *   - Integrate dependency registry, lifecycle, readiness and shutdown systems.
 *   - Prevent duplicate/concurrent startup.
 *   - Prevent duplicate/concurrent shutdown.
 *   - Normalize startup failures.
 *   - Fence readiness until all required startup dependencies are healthy.
 *   - Propagate a shared bootstrap context to every subsystem.
 *   - Support critical and optional dependencies.
 *   - Preserve deterministic startup ordering.
 *   - Support graceful partial-startup cleanup.
 *   - Provide safe operational diagnostics.
 *
 * Architectural position:
 *
 *   backend/bootstrap/app.js
 *          ↓
 *   ApplicationBootstrap
 *          ↓
 *   ┌─────────────────────────────────────────────┐
 *   │ DependencyRegistry                           │
 *   │ LifecycleManager                             │
 *   │ ReadinessState                               │
 *   │ ShutdownManager                              │
 *   └─────────────────────────────────────────────┘
 *          ↓
 *   environment
 *          ↓
 *   configuration
 *          ↓
 *   logger
 *          ↓
 *   observability
 *          ↓
 *   readiness
 *          ↓
 *   resilience
 *          ↓
 *   infrastructure
 *          ↓
 *   services
 *          ↓
 *   middleware
 *          ↓
 *   routes
 *          ↓
 *   server
 *          ↓
 *   READY
 *
 * IMPORTANT:
 *
 *   This module orchestrates lifecycle.
 *
 *   It does NOT:
 *     - implement business logic
 *     - implement financial transactions
 *     - implement ledger operations
 *     - own database connections
 *     - own Redis connections
 *     - own queue processing
 *     - implement HTTP routes
 *     - implement resilience algorithms
 *
 * =============================================================================
 */

const DependencyRegistryModule =
  require('./dependencyRegistry');

const LifecycleManagerModule =
  require('./lifecycleManager');

const ShutdownManagerModule =
  require('./shutdownManager');

const ReadinessStateModule =
  require('./readinessState');

const ServicesContextModule =
  require('./servicesContext');

const startupErrors =
  require('./startupErrors');

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const COMPONENT =
  'application-bootstrap';

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.OTEL_SERVICE_NAME ||
  'titech-backend';

const APPLICATION_NAME =
  process.env.APP_NAME ||
  'titech-community-capital';

const DEFAULTS = Object.freeze({
  startupTimeoutMs:
    120_000,

  shutdownTimeoutMs:
    60_000,

  dependencyTimeoutMs:
    30_000,

  failOnOptionalDependency:
    false,

  autoRegisterShutdown:
    true,

  requireReadiness:
    true,
});

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class ApplicationBootstrapError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'ApplicationBootstrapError';

    this.code =
      options.code ||
      'APPLICATION_BOOTSTRAP_ERROR';

    this.phase =
      options.phase ||
      null;

    this.component =
      options.component ||
      COMPONENT;

    this.cause =
      options.cause ||
      null;

    this.details =
      Object.freeze({
        ...(options.details || {}),
      });

    Error.captureStackTrace?.(
      this,
      ApplicationBootstrapError,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------
 */

function asPositiveInteger(
  value,
  fallback,
) {
  const parsed =
    value === undefined
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return parsed;
}

function asBoolean(
  value,
  fallback,
) {
  if (
    value === undefined ||
    value === null
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

function withTimeout(
  promiseOrFactory,
  timeoutMs,
  label,
) {
  let timer;

  const operation =
    Promise.resolve().then(
      () =>
        typeof promiseOrFactory ===
        'function'
          ? promiseOrFactory()
          : promiseOrFactory,
    );

  const timeout =
    new Promise(
      (_, reject) => {
        timer =
          setTimeout(
            () => {
              reject(
                new ApplicationBootstrapError(
                  `${label} timed out after ${timeoutMs}ms.`,
                  {
                    code:
                      'APPLICATION_BOOTSTRAP_TIMEOUT',
                  },
                ),
              );
            },
            timeoutMs,
          );

        timer.unref?.();
      },
    );

  return Promise.race([
    operation,
    timeout,
  ]).finally(
    () => {
      if (timer) {
        clearTimeout(timer);
      }
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Module Resolution
 * -----------------------------------------------------------------------------
 *
 * Supports both:
 *
 *   module.exports = Class
 *
 * and:
 *
 *   module.exports = {
 *     Class,
 *     instance,
 *     singleton
 *   }
 *
 * This allows the bootstrap architecture to evolve without breaking this
 * composition root.
 * -----------------------------------------------------------------------------
 */

function resolveConstructor(
  moduleValue,
  names = [],
) {
  if (
    typeof moduleValue ===
    'function'
  ) {
    return moduleValue;
  }

  for (
    const name of names
  ) {
    if (
      typeof moduleValue?.[
        name
      ] === 'function'
    ) {
      return moduleValue[name];
    }
  }

  return null;
}

function resolveInstance(
  moduleValue,
  names = [],
) {
  for (
    const name of names
  ) {
    if (
      moduleValue?.[
        name
      ]
    ) {
      return moduleValue[name];
    }
  }

  if (
    moduleValue &&
    typeof moduleValue ===
      'object'
  ) {
    return moduleValue;
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * Dependency Registry Adapter
 * -----------------------------------------------------------------------------
 */

function createDependencyRegistry() {
  const Constructor =
    resolveConstructor(
      DependencyRegistryModule,
      [
        'DependencyRegistry',
      ],
    );

  if (
    Constructor
  ) {
    return new Constructor();
  }

  const singleton =
    resolveInstance(
      DependencyRegistryModule,
      [
        'dependencyRegistry',
        'registry',
      ],
    );

  if (
    singleton
  ) {
    return singleton;
  }

  throw new ApplicationBootstrapError(
    'TITech dependency registry implementation is unavailable.',
    {
      code:
        'DEPENDENCY_REGISTRY_UNAVAILABLE',
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Lifecycle Adapter
 * -----------------------------------------------------------------------------
 */

function createLifecycleManager() {
  const Constructor =
    resolveConstructor(
      LifecycleManagerModule,
      [
        'LifecycleManager',
      ],
    );

  if (
    Constructor
  ) {
    return new Constructor();
  }

  const singleton =
    resolveInstance(
      LifecycleManagerModule,
      [
        'lifecycleManager',
        'manager',
      ],
    );

  if (
    singleton
  ) {
    return singleton;
  }

  throw new ApplicationBootstrapError(
    'TITech lifecycle manager implementation is unavailable.',
    {
      code:
        'LIFECYCLE_MANAGER_UNAVAILABLE',
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Shutdown Adapter
 * -----------------------------------------------------------------------------
 */

function createShutdownManager() {
  const Constructor =
    resolveConstructor(
      ShutdownManagerModule,
      [
        'ShutdownManager',
      ],
    );

  if (
    Constructor
  ) {
    return new Constructor();
  }

  const singleton =
    resolveInstance(
      ShutdownManagerModule,
      [
        'shutdownManager',
        'manager',
      ],
    );

  if (
    singleton
  ) {
    return singleton;
  }

  throw new ApplicationBootstrapError(
    'TITech shutdown manager implementation is unavailable.',
    {
      code:
        'SHUTDOWN_MANAGER_UNAVAILABLE',
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Readiness Adapter
 * -----------------------------------------------------------------------------
 */

function createReadinessState() {
  const Constructor =
    resolveConstructor(
      ReadinessStateModule,
      [
        'ReadinessState',
      ],
    );

  if (
    Constructor
  ) {
    return new Constructor();
  }

  const singleton =
    resolveInstance(
      ReadinessStateModule,
      [
        'readinessState',
        'state',
      ],
    );

  if (
    singleton
  ) {
    return singleton;
  }

  throw new ApplicationBootstrapError(
    'TITech readiness state implementation is unavailable.',
    {
      code:
        'READINESS_STATE_UNAVAILABLE',
    },
  );
}

/**
 * =============================================================================
 * ApplicationBootstrap
 * =============================================================================
 */

class ApplicationBootstrap {
  constructor(
    options = {},
  ) {
    this.options =
      Object.freeze({
        startupTimeoutMs:
          asPositiveInteger(
            options.startupTimeoutMs ??
              process.env.APPLICATION_STARTUP_TIMEOUT_MS,
            DEFAULTS.startupTimeoutMs,
          ),

        shutdownTimeoutMs:
          asPositiveInteger(
            options.shutdownTimeoutMs ??
              process.env.APPLICATION_SHUTDOWN_TIMEOUT_MS,
            DEFAULTS.shutdownTimeoutMs,
          ),

        dependencyTimeoutMs:
          asPositiveInteger(
            options.dependencyTimeoutMs ??
              process.env.APPLICATION_DEPENDENCY_TIMEOUT_MS,
            DEFAULTS.dependencyTimeoutMs,
          ),

        failOnOptionalDependency:
          asBoolean(
            options.failOnOptionalDependency,
            DEFAULTS.failOnOptionalDependency,
          ),

        autoRegisterShutdown:
          options.autoRegisterShutdown ??
          DEFAULTS.autoRegisterShutdown,

        requireReadiness:
          options.requireReadiness ??
          DEFAULTS.requireReadiness,
      });

    /**
     * -------------------------------------------------------------------------
     * Core lifecycle engines
     * -------------------------------------------------------------------------
     */

    this.dependencies =
      options.dependencies ||
      createDependencyRegistry();

    this.lifecycle =
      options.lifecycle ||
      createLifecycleManager();

    this.shutdown =
      options.shutdown ||
      createShutdownManager();

    this.readiness =
      options.readiness ||
      createReadinessState();

    /**
     * -------------------------------------------------------------------------
     * Runtime/application context
     * -------------------------------------------------------------------------
     */

    this.context =
      null;

    this.servicesContext =
      null;

    this.state =
      'created';

    this.startPromise =
      null;

    this.shutdownPromise =
      null;

    this.started =
      false;

    this.ready =
      false;

    this.stopping =
      false;

    this.stopped =
      false;

    this.failed =
      false;

    this.startingAt =
      null;

    this.startedAt =
      null;

    this.readyAt =
      null;

    this.stoppingAt =
      null;

    this.stoppedAt =
      null;

    this.failure =
      null;

    this.shutdownReason =
      null;

    this.dependenciesStarted =
      new Set();

    this.dependencyMetadata =
      new Map();

    this._shutdownRegistered =
      false;

    this._initialized =
      false;
  }

  /**
   * ---------------------------------------------------------------------------
   * Initialization
   * ---------------------------------------------------------------------------
   */

  initialize(
    context = {},
  ) {
    if (
      this._initialized
    ) {
      return this;
    }

    this.context =
      this._createContext(
        context,
      );

    this._registerDefaultLifecycleIntegration();

    this._initialized =
      true;

    this.state =
      'initialized';

    return this;
  }

  /**
   * ---------------------------------------------------------------------------
   * Context
   * ---------------------------------------------------------------------------
   */

  _createContext(
    context = {},
  ) {
    const base = {
      ...context,

      application:
        context.application ||
        null,

      service:
        context.service ||
        SERVICE_NAME,

      applicationName:
        context.applicationName ||
        APPLICATION_NAME,

      bootstrap:
        this,

      dependencies:
        this.dependencies,

      lifecycle:
        this.lifecycle,

      shutdown:
        this.shutdown,

      readiness:
        this.readiness,
    };

    /**
     * Prefer servicesContext when available.
     */
    if (
      ServicesContextModule?.createServicesContext
    ) {
      try {
        this.servicesContext =
          ServicesContextModule.createServicesContext(
            {
              config:
                context.config ||
                context.configuration,

              environment:
                context.environment,

              logger:
                context.logger,

              observability:
                context.observability,

              readiness:
                this.readiness,

              resilience:
                context.resilience,

              infrastructure:
                context.infrastructure,

              services:
                context.services ||
                context.serviceRegistry,

              container:
                context.container,

              metadata: {
                component:
                  COMPONENT,

                service:
                  SERVICE_NAME,

                application:
                  APPLICATION_NAME,
              },
            },
          );

        base.servicesContext =
          this.servicesContext;

        base.serviceContext =
          this.servicesContext;
      } catch {
        /**
         * ServicesContext is an enhancement, not a reason to prevent the
         * dependency lifecycle from operating if context creation fails.
         */
      }
    }

    return base;
  }

  getContext() {
    return this.context;
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency Registration
   * ---------------------------------------------------------------------------
   *
   * Supports:
   *
   *   registerDependency(name, initializer, options)
   *
   * Options:
   *
   *   critical
   *   priority
   *   dependencies
   *   timeoutMs
   *   enabled
   *   metadata
   */

  registerDependency(
    name,
    initializer,
    options = {},
  ) {
    if (
      typeof initializer !==
      'function'
    ) {
      throw new TypeError(
        `TITech dependency "${name}" initializer must be a function.`,
      );
    }

    const normalizedName =
      String(
        name,
      ).trim();

    if (
      normalizedName ===
      ''
    ) {
      throw new TypeError(
        'TITech dependency name must be a non-empty string.',
      );
    }

    const dependencyOptions = {
      ...options,

      timeoutMs:
        options.timeoutMs ||
        this.options
          .dependencyTimeoutMs,

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

        dependency:
          normalizedName,

        ...(options.metadata ||
          {}),
      },
    };

    /**
     * -------------------------------------------------------------------------
     * Readiness registration
     * -------------------------------------------------------------------------
     */

    this._registerReadinessDependency(
      normalizedName,
      dependencyOptions,
    );

    /**
     * -------------------------------------------------------------------------
     * Dependency Registry
     * -------------------------------------------------------------------------
     *
     * Support both a rich register API and the simpler registry contract.
     */

    const wrappedInitializer =
      async dependencyContext => {
        const childContext =
          this._createDependencyContext(
            normalizedName,
            dependencyContext,
          );

        const startedAt =
          process.hrtime.bigint();

        this._setDependencyState(
          normalizedName,
          'starting',
        );

        try {
          const result =
            await withTimeout(
              () =>
                initializer(
                  childContext,
                ),
              dependencyOptions.timeoutMs,
              `TITech dependency "${normalizedName}" startup`,
            );

          this.dependenciesStarted.add(
            normalizedName,
          );

          this._setDependencyState(
            normalizedName,
            'ready',
          );

          this._updateDependencyMetadata(
            normalizedName,
            {
              durationMs:
                Number(
                  process.hrtime.bigint() -
                    startedAt,
                ) /
                1_000_000,

              startedAt:
                new Date(),
            },
          );

          this._markDependencyReady(
            normalizedName,
            true,
          );

          /**
           * Publish the initialized dependency into the shared bootstrap
           * context.
           */
          this._publishDependency(
            normalizedName,
            result,
          );

          return result;
        } catch (error) {
          const normalized =
            startupErrors.normalizeStartupError(
              error,
              {
                phase:
                  dependencyOptions.phase ||
                  'bootstrap',

                operation:
                  `initialize-${normalizedName}`,

                component:
                  COMPONENT,

                service:
                  SERVICE_NAME,

                dependency:
                  normalizedName,

                critical:
                  dependencyOptions.critical,

                fatal:
                  dependencyOptions.critical,

                durationMs:
                  Number(
                    process.hrtime.bigint() -
                      startedAt,
                  ) /
                  1_000_000,
              },
            );

          this._setDependencyState(
            normalizedName,
            'failed',
          );

          this._updateDependencyMetadata(
            normalizedName,
            {
              durationMs:
                Number(
                  process.hrtime.bigint() -
                    startedAt,
                ) /
                1_000_000,

              error:
                safeError(
                  normalized,
                ),
            },
          );

          this._markDependencyReady(
            normalizedName,
            false,
            normalized,
          );

          throw normalized;
        }
      };

    /**
     * Avoid registering the same dependency twice where the underlying
     * registry exposes a presence check.
     */
    try {
      if (
        typeof this.dependencies.has ===
          'function' &&
        this.dependencies.has(
          normalizedName,
        )
      ) {
        return this;
      }

      this.dependencies.register(
        normalizedName,
        wrappedInitializer,
        dependencyOptions,
      );
    } catch (error) {
      if (
        error?.code ===
        'DEPENDENCY_DUPLICATE'
      ) {
        return this;
      }

      throw startupErrors.normalizeStartupError(
        error,
        {
          phase:
            'bootstrap',

          operation:
            `register-${normalizedName}`,

          component:
            COMPONENT,

          service:
            SERVICE_NAME,

          dependency:
            normalizedName,

          critical:
            dependencyOptions.critical,

          fatal:
            dependencyOptions.critical,
        },
      );
    }

    this._updateDependencyMetadata(
      normalizedName,
      {
        critical:
          dependencyOptions.critical,

        enabled:
          dependencyOptions.enabled,

        priority:
          dependencyOptions.priority ??
          0,

        dependencies:
          dependencyOptions.dependencies ||
          [],
      },
    );

    return this;
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness Integration
   * ---------------------------------------------------------------------------
   */

  _registerReadinessDependency(
    name,
    options,
  ) {
    if (
      !this.readiness ||
      typeof this.readiness.register !==
        'function'
    ) {
      return;
    }

    try {
      if (
        typeof this.readiness.has ===
          'function' &&
        this.readiness.has(name)
      ) {
        return;
      }

      this.readiness.register({
        name,

        severity:
          options.severity ||
          (
            options.critical
              ? 'critical'
              : 'optional'
          ),

        critical:
          options.critical,

        required:
          options.critical,

        enabled:
          options.enabled,

        timeoutMs:
          options.timeoutMs,

        readiness:
          async () => {
            const metadata =
              this.dependencyMetadata.get(
                name,
              );

            return {
              ready:
                metadata?.state ===
                'ready',

              status:
                metadata?.state ===
                'ready'
                  ? 'healthy'
                  : 'not_ready',
            };
          },

        metadata:
          options.metadata,
      });
    } catch {
      /**
       * Dependency registry remains authoritative if readiness registration
       * cannot be duplicated safely.
       */
    }
  }

  _markDependencyReady(
    name,
    ready,
    error = null,
  ) {
    try {
      if (
        ready &&
        typeof this.readiness.markReady ===
          'function'
      ) {
        this.readiness.markReady({
          dependency:
            name,
        });
      }

      if (
        !ready &&
        typeof this.readiness.markNotReady ===
          'function'
      ) {
        this.readiness.markNotReady(
          `dependency:${name}`,
          {
            error:
              safeError(
                error,
              ),
          },
        );
      }
    } catch {
      // Readiness integration is best-effort here.
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency Context
   * ---------------------------------------------------------------------------
   */

  _createDependencyContext(
    name,
    dependencyContext = {},
  ) {
    const base = {
      ...this.context,

      ...dependencyContext,

      bootstrap:
        this,

      dependency:
        name,

      dependencies:
        this.dependencies,

      lifecycle:
        this.lifecycle,

      shutdown:
        this.shutdown,

      readiness:
        this.readiness,

      bootstrapContext:
        this.context,
    };

    if (
      this.servicesContext?.forService
    ) {
      try {
        const child =
          this.servicesContext.forService(
            name,
            {
              metadata: {
                dependency:
                  name,
              },
            },
          );

        base.servicesContext =
          child;

        base.serviceContext =
          child;

        base.service =
          child;
      } catch {
        // Preserve base context.
      }
    }

    return base;
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency publication
   * ---------------------------------------------------------------------------
   */

  _publishDependency(
    name,
    value,
  ) {
    if (
      !this.context ||
      value === undefined
    ) {
      return;
    }

    const existing =
      this.context.dependencies &&
      typeof this.context.dependencies ===
        'object'
        ? {
            ...this.context.dependencies,
          }
        : {};

    existing[name] =
      value;

    this.context.dependencies =
      existing;

    /**
     * Infrastructure/service consumers commonly use named context properties.
     */
    this.context[name] =
      value;

    /**
     * ServicesContext can receive the dependency without allowing mutation of
     * the existing context object.
     */
    if (
      ServicesContextModule?.addInfrastructure
    ) {
      try {
        ServicesContextModule.addInfrastructure(
          name,
          value,
        );
      } catch {
        // The resource may be an application service rather than infrastructure.
      }
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * State
   * ---------------------------------------------------------------------------
   */

  _setDependencyState(
    name,
    state,
  ) {
    const current =
      this.dependencyMetadata.get(
        name,
      ) || {};

    this.dependencyMetadata.set(
      name,
      {
        ...current,

        state,

        updatedAt:
          new Date(),
      },
    );
  }

  _updateDependencyMetadata(
    name,
    metadata,
  ) {
    const current =
      this.dependencyMetadata.get(
        name,
      ) || {};

    this.dependencyMetadata.set(
      name,
      {
        ...current,

        ...metadata,
      },
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Lifecycle Integration
   * ---------------------------------------------------------------------------
   */

  _registerDefaultLifecycleIntegration() {
    if (
      !this.lifecycle
    ) {
      return;
    }

    /**
     * Do not assume one exact lifecycle implementation.
     */
    if (
      typeof this.lifecycle.register !==
        'function'
    ) {
      return;
    }

    const hooks = [
      {
        phase:
          'beforeStart',

        name:
          'application-bootstrap.beforeStart',

        handler:
          async context => {
            return this._executeLifecycleHook(
              'beforeStart',
              context,
            );
          },
      },

      {
        phase:
          'afterStart',

        name:
          'application-bootstrap.afterStart',

        handler:
          async context => {
            return this._executeLifecycleHook(
              'afterStart',
              context,
            );
          },
      },
    ];

    for (
      const hook of hooks
    ) {
      try {
        this.lifecycle.register(
          hook.name,
          hook.handler,
          {
            phase:
              hook.phase,

            priority:
              hook.phase ===
              'beforeStart'
                ? -10_000
                : 10_000,

            metadata: {
              component:
                COMPONENT,
            },
          },
        );
      } catch {
        /**
         * Some lifecycle managers expose `execute()` only and do not require
         * explicit hook registration. start() handles that contract below.
         */
      }
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Lifecycle Execution
   * ---------------------------------------------------------------------------
   */

  async _executeLifecycleHook(
    phase,
    context,
  ) {
    if (
      this.lifecycle &&
      typeof this.lifecycle.execute ===
        'function'
    ) {
      return this.lifecycle.execute(
        phase,
        context,
      );
    }

    return null;
  }

  /**
   * ---------------------------------------------------------------------------
   * Startup
   * ---------------------------------------------------------------------------
   */

  async start(
    context = {},
  ) {
    if (
      this.startPromise
    ) {
      return this.startPromise;
    }

    if (
      this.ready &&
      this.started &&
      !this.stopping
    ) {
      return this.snapshot();
    }

    if (
      this.stopping
    ) {
      throw new ApplicationBootstrapError(
        'TITech application cannot start while shutdown is in progress.',
        {
          code:
            'APPLICATION_START_DURING_SHUTDOWN',
        },
      );
    }

    if (
      this.stopped
    ) {
      throw new ApplicationBootstrapError(
        'TITech application cannot be restarted after shutdown.',
        {
          code:
            'APPLICATION_ALREADY_STOPPED',
        },
      );
    }

    this.startPromise =
      (async () => {
        const startedAt =
          process.hrtime.bigint();

        this.startingAt =
          new Date();

        this.state =
          'starting';

        this.failed =
          false;

        this.failure =
          null;

        this.initialize(
          context,
        );

        /**
         * Merge caller context with existing bootstrap context.
         */
        this.context =
          this._createContext({
            ...this.context,

            ...context,
          });

        try {
          /**
           * ---------------------------------------------------------------
           * beforeStart
           * ---------------------------------------------------------------
           */
          await withTimeout(
            () =>
              this._executeLifecycleHook(
                'beforeStart',
                this.context,
              ),
            this.options
              .startupTimeoutMs,
            'TITech beforeStart lifecycle',
          );

          /**
           * ---------------------------------------------------------------
           * Dependency initialization
           * ---------------------------------------------------------------
           */
          if (
            !this.dependencies ||
            typeof this.dependencies.initialize !==
              'function'
          ) {
            throw new ApplicationBootstrapError(
              'TITech dependency registry does not expose initialize().',
              {
                code:
                  'DEPENDENCY_REGISTRY_INITIALIZE_UNAVAILABLE',
              },
            );
          }

          const result =
            await withTimeout(
              () =>
                this.dependencies.initialize(
                  this.context,
                ),
              this.options
                .startupTimeoutMs,
              'TITech dependency initialization',
            );

          /**
           * Publish returned registry state.
           */
          if (
            result &&
            typeof result ===
              'object'
          ) {
            this.context.dependencies =
              result;
          }

          /**
           * ---------------------------------------------------------------
           * Dependency readiness
           * ---------------------------------------------------------------
           */
          if (
            this.options
              .requireReadiness
          ) {
            await this._evaluateReadiness();
          }

          /**
           * ---------------------------------------------------------------
           * afterStart
           * ---------------------------------------------------------------
           */
          await withTimeout(
            () =>
              this._executeLifecycleHook(
                'afterStart',
                this.context,
              ),
            this.options
              .startupTimeoutMs,
            'TITech afterStart lifecycle',
          );

          /**
           * ---------------------------------------------------------------
           * Final readiness gate
           * ---------------------------------------------------------------
           */
          if (
            this.options
              .requireReadiness
          ) {
            await this._evaluateReadiness();
          }

          this.started =
            true;

          this.stopping =
            false;

          this.stopped =
            false;

          this.failed =
            false;

          this.ready =
            true;

          this.state =
            'ready';

          this.startedAt =
            new Date();

          this.readyAt =
            new Date();

          this._registerCanonicalShutdownParticipant();

          return this.snapshot({
            startupDurationMs:
              Number(
                process.hrtime.bigint() -
                  startedAt,
              ) /
              1_000_000,
          });
        } catch (error) {
          const normalized =
            startupErrors.normalizeStartupError(
              error,
              {
                phase:
                  error?.phase ||
                  'bootstrap',

                component:
                  COMPONENT,

                service:
                  SERVICE_NAME,

                critical:
                  true,

                fatal:
                  true,

                preserveCauseStack:
                  true,
              },
            );

          this.failed =
            true;

          this.started =
            false;

          this.ready =
            false;

          this.state =
            'failed';

          this.failure =
            normalized;

          /**
           * Partial startup cleanup is mandatory.
           *
           * The shutdown manager remains the authoritative cleanup mechanism.
           */
          try {
            await this.shutdownInternal(
              normalized.message,
              {
                startupFailure:
                  true,

                error:
                  normalized,
              },
            );
          } catch {
            /**
             * Preserve the original startup failure.
             */
          }

          throw normalized;
        }
      })();

    try {
      return await this.startPromise;
    } finally {
      this.startPromise =
        null;
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness Evaluation
   * ---------------------------------------------------------------------------
   */

  async _evaluateReadiness() {
    if (
      !this.readiness
    ) {
      return true;
    }

    if (
      typeof this.readiness.evaluate ===
        'function'
    ) {
      await this.readiness.evaluate({
        allowRecovery:
          true,
      });
    }

    let ready =
      true;

    if (
      typeof this.readiness.isReady ===
        'function'
    ) {
      ready =
        this.readiness.isReady();
    } else if (
      typeof this.readiness.snapshot ===
        'function'
    ) {
      const snapshot =
        this.readiness.snapshot();

      ready =
        snapshot.ready !==
          false &&
        snapshot.state !==
          'failed' &&
        snapshot.state !==
          'not_ready';
    }

    if (
      !ready
    ) {
      throw new ApplicationBootstrapError(
        'TITech application readiness requirements were not satisfied.',
        {
          code:
            'APPLICATION_NOT_READY',
        },
      );
    }

    return true;
  }

  /**
   * ---------------------------------------------------------------------------
   * Shutdown Registration
   * ---------------------------------------------------------------------------
   */

  _registerCanonicalShutdownParticipant() {
    if (
      this._shutdownRegistered ||
      !this.options
        .autoRegisterShutdown
    ) {
      return;
    }

    if (
      !this.shutdown
    ) {
      return;
    }

    const handler =
      async context => {
        return this.shutdownInternal(
          context?.reason ||
            'application-shutdown',
          context,
        );
      };

    try {
      if (
        typeof this.shutdown.has ===
          'function' &&
        this.shutdown.has(
          COMPONENT,
        )
      ) {
        this._shutdownRegistered =
          true;

        return;
      }
    } catch {
      // Continue registration attempt.
    }

    try {
      if (
        typeof this.shutdown.register ===
          'function'
      ) {
        this.shutdown.register({
          name:
            COMPONENT,

          priority:
            50_000,

          critical:
            true,

          dependencies:
            [],

          timeoutMs:
            this.options
              .shutdownTimeoutMs,

          stop:
            handler,

          metadata: {
            component:
              COMPONENT,

            service:
              SERVICE_NAME,
          },
        });

        this._shutdownRegistered =
          true;
      }
    } catch (error) {
      if (
        error?.code !==
        'SHUTDOWN_PARTICIPANT_DUPLICATE'
      ) {
        throw error;
      }

      this._shutdownRegistered =
        true;
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Shutdown
   * ---------------------------------------------------------------------------
   */

  async shutdown(
    reason =
      'application-request',
  ) {
    return this.shutdownInternal(
      reason,
      {},
    );
  }

  async shutdownInternal(
    reason =
      'application-request',
    metadata = {},
  ) {
    if (
      this.shutdownPromise
    ) {
      return this.shutdownPromise;
    }

    if (
      this.stopped
    ) {
      return this.snapshot();
    }

    this.shutdownPromise =
      (async () => {
        this.stopping =
          true;

        this.ready =
          false;

        this.state =
          'stopping';

        this.stoppingAt =
          new Date();

        this.shutdownReason =
          reason;

        /**
         * Fence traffic before tearing down resources.
         */
        try {
          if (
            typeof this.readiness.markNotReady ===
              'function'
          ) {
            this.readiness.markNotReady(
              'application-shutdown',
              {
                reason,
              },
            );
          }
        } catch {
          // Continue.
        }

        /**
         * Prefer the canonical shutdown manager.
         */
        try {
          if (
            typeof this.shutdown.request ===
              'function'
          ) {
            await withTimeout(
              () =>
                this.shutdown.request(
                  reason,
                  {
                    ...metadata,

                    bootstrap:
                      this,

                    context:
                      this.context,
                  },
                ),
              this.options
                .shutdownTimeoutMs,
              'TITech shutdown manager',
            );
          } else if (
            typeof this.shutdown.shutdown ===
              'function'
          ) {
            await withTimeout(
              () =>
                this.shutdown.shutdown(
                  reason,
                ),
              this.options
                .shutdownTimeoutMs,
              'TITech shutdown manager',
            );
          } else if (
            typeof this.shutdown.stop ===
              'function'
          ) {
            await withTimeout(
              () =>
                this.shutdown.stop(
                  reason,
                ),
              this.options
                .shutdownTimeoutMs,
              'TITech shutdown manager',
            );
          } else {
            await this._fallbackShutdown(
              reason,
              metadata,
            );
          }
        } catch (error) {
          this.failure =
            error;

          this.failed =
            true;

          this.state =
            'failed';

          throw error;
        }

        this.started =
          false;

        this.ready =
          false;

        this.stopping =
          false;

        this.stopped =
          true;

        this.failed =
          false;

        this.state =
          'stopped';

        this.stoppedAt =
          new Date();

        return this.snapshot();
      })();

    try {
      return await this.shutdownPromise;
    } finally {
      this.shutdownPromise =
        null;
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Fallback Shutdown
   * ---------------------------------------------------------------------------
   *
   * Only used when an older/simple shutdown manager implementation does not
   * expose the canonical request/stop contract.
   */

  async _fallbackShutdown(
    reason,
    metadata,
  ) {
    /**
     * Prefer dependency registry shutdown when available.
     */
    if (
      this.dependencies &&
      typeof this.dependencies.shutdown ===
        'function'
    ) {
      await this.dependencies.shutdown({
        reason,

        ...metadata,
      });

      return;
    }

    if (
      this.dependencies &&
      typeof this.dependencies.stop ===
        'function'
    ) {
      await this.dependencies.stop({
        reason,

        ...metadata,
      });
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Shutdown Registration API
   * ---------------------------------------------------------------------------
   */

  registerShutdown(
    name,
    handler,
    options = {},
  ) {
    if (
      typeof handler !==
      'function'
    ) {
      throw new TypeError(
        `Shutdown handler "${name}" must be a function.`,
      );
    }

    if (
      !this.shutdown ||
      typeof this.shutdown.register !==
        'function'
    ) {
      throw new ApplicationBootstrapError(
        'TITech shutdown manager does not support participant registration.',
        {
          code:
            'SHUTDOWN_REGISTRATION_UNAVAILABLE',
        },
      );
    }

    this.shutdown.register({
      name,

      stop:
        handler,

      priority:
        options.priority ??
        0,

      critical:
        options.critical !==
        false,

      dependencies:
        options.dependencies ||
        [],

      timeoutMs:
        options.timeoutMs ||
        this.options
          .shutdownTimeoutMs,

      metadata: {
        component:
          COMPONENT,

        ...(options.metadata ||
          {}),
      },
    });

    return this;
  }

  /**
   * ---------------------------------------------------------------------------
   * Service Access
   * ---------------------------------------------------------------------------
   */

  getDependency(
    name,
  ) {
    const normalized =
      String(
        name,
      ).trim();

    if (
      this.context?.dependencies &&
      Object.prototype.hasOwnProperty.call(
        this.context.dependencies,
        normalized,
      )
    ) {
      return this.context.dependencies[
        normalized
      ];
    }

    if (
      this.servicesContext?.has?.(
        normalized,
      )
    ) {
      return this.servicesContext.get(
        normalized,
      );
    }

    return undefined;
  }

  requireDependency(
    name,
  ) {
    const dependency =
      this.getDependency(
        name,
      );

    if (
      dependency ===
        undefined ||
      dependency ===
        null
    ) {
      throw new ApplicationBootstrapError(
        `TITech dependency "${name}" is unavailable.`,
        {
          code:
            'APPLICATION_DEPENDENCY_NOT_FOUND',
          details: {
            dependency:
              name,
          },
        },
      );
    }

    return dependency;
  }

  /**
   * ---------------------------------------------------------------------------
   * State
   * ---------------------------------------------------------------------------
   */

  isStarting() {
    return (
      this.state ===
      'starting'
    );
  }

  isStarted() {
    return (
      this.started
    );
  }

  isReady() {
    return (
      this.ready
    );
  }

  isStopping() {
    return (
      this.stopping
    );
  }

  isStopped() {
    return (
      this.stopped
    );
  }

  isFailed() {
    return (
      this.failed
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Snapshot
   * ---------------------------------------------------------------------------
   */

  snapshot(
    additional = {},
  ) {
    const dependencies =
      {};

    for (
      const [
        name,
        metadata,
      ] of this
        .dependencyMetadata
    ) {
      dependencies[name] =
        {
          ...metadata,

          started:
            this.dependenciesStarted.has(
              name,
            ),
        };
    }

    return Object.freeze({
      component:
        COMPONENT,

      service:
        SERVICE_NAME,

      application:
        APPLICATION_NAME,

      state:
        this.state,

      started:
        this.started,

      ready:
        this.ready,

      stopping:
        this.stopping,

      stopped:
        this.stopped,

      failed:
        this.failed,

      initialized:
        this._initialized,

      shutdownRegistered:
        this._shutdownRegistered,

      startingAt:
        this.startingAt,

      startedAt:
        this.startedAt,

      readyAt:
        this.readyAt,

      stoppingAt:
        this.stoppingAt,

      stoppedAt:
        this.stoppedAt,

      shutdownReason:
        this.shutdownReason,

      failure:
        safeError(
          this.failure,
        ),

      dependencies,
      
      servicesContext:
        this.servicesContext
          ?.snapshot?.() ||
        null,

      additional:
        {
          ...additional,
        },
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Reset
   * ---------------------------------------------------------------------------
   */

  reset() {
    if (
      this.started ||
      this.stopping
    ) {
      throw new ApplicationBootstrapError(
        'Cannot reset an active TITech application bootstrap.',
        {
          code:
            'APPLICATION_BOOTSTRAP_RESET_NOT_ALLOWED',
        },
      );
    }

    this.context =
      null;

    this.servicesContext =
      null;

    this.state =
      'created';

    this.startPromise =
      null;

    this.shutdownPromise =
      null;

    this.started =
      false;

    this.ready =
      false;

    this.stopping =
      false;

    this.stopped =
      false;

    this.failed =
      false;

    this.startingAt =
      null;

    this.startedAt =
      null;

    this.readyAt =
      null;

    this.stoppingAt =
      null;

    this.stoppedAt =
      null;

    this.failure =
      null;

    this.shutdownReason =
      null;

    this.dependenciesStarted.clear();

    this.dependencyMetadata.clear();

    this._shutdownRegistered =
      false;

    this._initialized =
      false;

    return this;
  }
}

/**
 * -----------------------------------------------------------------------------
 * Export
 * -----------------------------------------------------------------------------
 */

module.exports =
  Object.freeze({
    ApplicationBootstrap,

    ApplicationBootstrapError,
  });