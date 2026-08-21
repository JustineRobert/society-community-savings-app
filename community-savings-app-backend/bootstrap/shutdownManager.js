'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/shutdownManager.js
 *
 * Purpose:
 *   Enterprise production-grade shutdown lifecycle manager.
 *
 * Responsibilities:
 *   - Coordinate ordered application shutdown participants.
 *   - Manage dependency-aware shutdown ordering.
 *   - Deduplicate concurrent shutdown requests.
 *   - Enforce participant and global shutdown timeouts.
 *   - Support critical/non-critical shutdown participants.
 *   - Support graceful shutdown hooks.
 *   - Track shutdown state and execution history.
 *   - Integrate with bootstrap/shutdown.js.
 *   - Integrate with lifecycleManager.js.
 *   - Integrate with readinessState.js.
 *   - Integrate with observability/logger.
 *   - Provide safe diagnostics.
 *
 * Architectural position:
 *
 *   runtime.js
 *       ↓
 *   shutdown.js
 *       ↓
 *   shutdownManager.js
 *       ↓
 *   lifecycleManager.js
 *       ↓
 *   infrastructure / services / routes / server
 *       ↓
 *   observability
 *       ↓
 *   logger
 *
 * IMPORTANT:
 *
 *   This module is a SHUTDOWN MANAGEMENT ENGINE.
 *
 *   It does NOT:
 *     - implement financial logic
 *     - implement database cleanup itself
 *     - implement Redis cleanup itself
 *     - implement queue cleanup itself
 *     - implement HTTP routes
 *     - duplicate service/infrastructure shutdown code
 *
 *   Each subsystem remains responsible for its own cleanup.
 *
 * =============================================================================
 */

const {
  EventEmitter,
} = require('node:events');

/**
 * -----------------------------------------------------------------------------
 * Optional integrations
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

let observabilityModule = null;

try {
  // eslint-disable-next-line global-require
  observabilityModule =
    require('./observability');
} catch {
  observabilityModule = null;
}

let readinessModule = null;

try {
  // eslint-disable-next-line global-require
  readinessModule =
    require('./readinessState');
} catch {
  readinessModule = null;
}

let lifecycleManagerModule = null;

try {
  // eslint-disable-next-line global-require
  lifecycleManagerModule =
    require('./lifecycleManager');
} catch {
  lifecycleManagerModule = null;
}

let shutdownModule = null;

try {
  // eslint-disable-next-line global-require
  shutdownModule =
    require('./shutdown');
} catch {
  shutdownModule = null;
}

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const COMPONENT =
  'shutdown-manager';

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.OTEL_SERVICE_NAME ||
  'titech-backend';

const APPLICATION_NAME =
  process.env.APP_NAME ||
  'titech-community-capital';

const DEFAULTS = Object.freeze({
  timeoutMs:
    30_000,

  participantTimeoutMs:
    15_000,

  continueOnError:
    true,

  forceExitOnTimeout:
    false,

  retryAttempts:
    0,

  retryDelayMs:
    250,
});

const STATES = Object.freeze({
  CREATED:
    'created',

  INITIALIZING:
    'initializing',

  READY:
    'ready',

  REQUESTED:
    'requested',

  DRAINING:
    'draining',

  STOPPING:
    'stopping',

  FLUSHING:
    'flushing',

  STOPPED:
    'stopped',

  FAILED:
    'failed',
});

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class ShutdownManagerError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'ShutdownManagerError';

    this.code =
      options.code ||
      'SHUTDOWN_MANAGER_ERROR';

    this.phase =
      options.phase ||
      null;

    this.participant =
      options.participant ||
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
      ShutdownManagerError,
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
    typeof value !==
      'string' ||
    value.trim() ===
      ''
  ) {
    throw new TypeError(
      `${field} must be a non-empty string.`,
    );
  }

  return value.trim();
}

function asPositiveInteger(
  value,
  fallback,
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

function hrtimeMs(
  start,
) {
  return (
    Number(
      process.hrtime.bigint() -
        start,
    ) / 1_000_000
  );
}

function sleep(
  ms,
) {
  return new Promise(
    resolve => {
      const timer =
        setTimeout(
          resolve,
          ms,
        );

      timer.unref?.();
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Timeout Wrapper
 * -----------------------------------------------------------------------------
 */

async function withTimeout(
  fn,
  timeoutMs,
  label,
) {
  let timer = null;

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
                new ShutdownManagerError(
                  `${label} timed out after ${timeoutMs}ms.`,
                  {
                    code:
                      'SHUTDOWN_MANAGER_TIMEOUT',
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
    if (timer) {
      clearTimeout(
        timer,
      );
    }
  }
}

/**
 * =============================================================================
 * Shutdown Manager
 * =============================================================================
 */

class ShutdownManager extends EventEmitter {
  constructor(
    options = {},
  ) {
    super();

    this.options =
      Object.freeze({
        timeoutMs:
          asPositiveInteger(
            options.timeoutMs ??
              process.env.SHUTDOWN_MANAGER_TIMEOUT_MS,
            DEFAULTS.timeoutMs,
          ),

        participantTimeoutMs:
          asPositiveInteger(
            options.participantTimeoutMs ??
              process.env.SHUTDOWN_MANAGER_PARTICIPANT_TIMEOUT_MS,
            DEFAULTS.participantTimeoutMs,
          ),

        continueOnError:
          options.continueOnError ??
          DEFAULTS.continueOnError,

        forceExitOnTimeout:
          options.forceExitOnTimeout ??
          DEFAULTS.forceExitOnTimeout,

        retryAttempts:
          asPositiveInteger(
            options.retryAttempts ??
              process.env.SHUTDOWN_RETRY_ATTEMPTS,
            DEFAULTS.retryAttempts + 1,
          ) - 1,

        retryDelayMs:
          asPositiveInteger(
            options.retryDelayMs ??
              process.env.SHUTDOWN_RETRY_DELAY_MS,
            DEFAULTS.retryDelayMs,
          ),
      });

    this.state =
      STATES.CREATED;

    this.requested =
      false;

    this.running =
      false;

    this.completed =
      false;

    this.failed =
      false;

    this.forceExitRequested =
      false;

    this.reason =
      null;

    this.signal =
      null;

    this.requestedAt =
      null;

    this.startedAt =
      null;

    this.completedAt =
      null;

    this.failure =
      null;

    this.shutdownPromise =
      null;

    this.participants =
      new Map();

    this.executionHistory =
      [];

    this.errors =
      [];

    this._registered =
      false;

    this._shutdownAdapterRegistered =
      false;
  }

  /**
   * ---------------------------------------------------------------------------
   * Logging
   * ---------------------------------------------------------------------------
   */

  _log(
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
      // Best-effort.
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
   * ---------------------------------------------------------------------------
   * Observability
   * ---------------------------------------------------------------------------
   */

  _emit(
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

              application:
                APPLICATION_NAME,

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

            application:
              APPLICATION_NAME,

            ...payload,
          },
        );
      }
    } catch {
      // Never block shutdown.
    }

    return null;
  }

  /**
   * ---------------------------------------------------------------------------
   * Participant Registration
   * ---------------------------------------------------------------------------
   */

  register(
    options = {},
  ) {
    const name =
      normalizeName(
        options.name,
      );

    if (
      this.participants.has(
        name,
      )
    ) {
      throw new ShutdownManagerError(
        `Shutdown participant "${name}" is already registered.`,
        {
          code:
            'SHUTDOWN_PARTICIPANT_DUPLICATE',

          participant:
            name,
        },
      );
    }

    const participant =
      Object.freeze({
        name,

        priority:
          Number.isInteger(
            options.priority,
          )
            ? options.priority
            : 0,

        dependencies:
          Object.freeze(
            Array.isArray(
              options.dependencies,
            )
              ? [
                  ...new Set(
                    options.dependencies.map(
                      dependency =>
                        normalizeName(
                          dependency,
                          'dependency',
                        ),
                    ),
                  ),
                ]
              : [],
          ),

        critical:
          options.critical !==
          false,

        enabled:
          options.enabled !==
          false,

        timeoutMs:
          asPositiveInteger(
            options.timeoutMs,
            this.options
              .participantTimeoutMs,
          ),

        retryAttempts:
          Math.max(
            0,
            asPositiveInteger(
              options.retryAttempts,
              this.options
                .retryAttempts +
                1,
            ) - 1,
          ),

        retryDelayMs:
          asPositiveInteger(
            options.retryDelayMs,
            this.options
              .retryDelayMs,
          ),

        stop:
          typeof options.stop ===
          'function'
            ? options.stop
            : null,

        metadata:
          Object.freeze({
            ...(options.metadata || {}),
          }),

        registeredAt:
          new Date(),
      });

    this.participants.set(
      name,
      participant,
    );

    this._registered =
      true;

    return participant;
  }

  unregister(
    name,
  ) {
    return this.participants.delete(
      normalizeName(
        name,
      ),
    );
  }

  has(
    name,
  ) {
    return this.participants.has(
      name,
    );
  }

  list() {
    return [
      ...this.participants.values(),
    ].map(
      participant => ({
        ...participant,
      }),
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency-Aware Ordering
   * ---------------------------------------------------------------------------
   */

  resolveOrder() {
    const active =
      [
        ...this.participants.values(),
      ].filter(
        participant =>
          participant.enabled &&
          typeof participant.stop ===
            'function',
      );

    const map =
      new Map(
        active.map(
          participant => [
            participant.name,
            participant,
          ],
        ),
      );

    const incoming =
      new Map();

    const outgoing =
      new Map();

    for (
      const participant of
        active
    ) {
      incoming.set(
        participant.name,
        0,
      );

      outgoing.set(
        participant.name,
        new Set(),
      );
    }

    for (
      const participant of
        active
    ) {
      for (
        const dependency of
          participant.dependencies
      ) {
        if (
          !map.has(
            dependency,
          )
        ) {
          continue;
        }

        incoming.set(
          participant.name,
          incoming.get(
            participant.name,
          ) + 1,
        );

        outgoing
          .get(
            dependency,
          )
          .add(
            participant.name,
          );
      }
    }

    const ready = active
      .filter(
        participant =>
          incoming.get(
            participant.name,
          ) === 0,
      )
      .sort(
        compareParticipants,
      );

    const order = [];

    while (
      ready.length >
      0
    ) {
      const current =
        ready.shift();

      order.push(
        current,
      );

      for (
        const dependent of
          outgoing.get(
            current.name,
          )
      ) {
        const count =
          incoming.get(
            dependent,
          ) - 1;

        incoming.set(
          dependent,
          count,
        );

        if (
          count === 0
        ) {
          ready.push(
            map.get(
              dependent,
            ),
          );

          ready.sort(
            compareParticipants,
          );
        }
      }
    }

    if (
      order.length !==
      active.length
    ) {
      const cyclic =
        active
          .filter(
            participant =>
              incoming.get(
                participant.name,
              ) > 0,
          )
          .map(
            participant =>
              participant.name,
          );

      throw new ShutdownManagerError(
        'Circular shutdown dependency detected.',
        {
          code:
            'SHUTDOWN_DEPENDENCY_CYCLE',

          details: {
            participants:
              cyclic,
          },
        },
      );
    }

    /**
     * Shutdown ordering is the reverse of the dependency-safe startup order.
     */
    return order.reverse();
  }

  /**
   * ---------------------------------------------------------------------------
   * Bootstrap Adapter
   * ---------------------------------------------------------------------------
   */

  registerBootstrapHooks(
    context = {},
    options = {},
  ) {
    if (
      this._shutdownAdapterRegistered
    ) {
      return null;
    }

    if (
      hooksModule?.hooks?.has(
        COMPONENT,
      )
    ) {
      this._shutdownAdapterRegistered =
        true;

      return hooksModule.hooks.get(
        COMPONENT,
      );
    }

    if (
      typeof hooksModule?.lifecycle !==
      'function'
    ) {
      throw new ShutdownManagerError(
        'TITech shutdown manager could not register because the lifecycle hook engine is unavailable.',
        {
          code:
            'SHUTDOWN_HOOK_ENGINE_UNAVAILABLE',
        },
      );
    }

    const result =
      hooksModule.lifecycle(
        COMPONENT,
        {
          priority:
            options.priority ??
            40_000,

          dependencies:
            options.dependencies ||
            [],

          critical:
            options.critical ===
            true,

          enabled:
            options.enabled !==
            false,

          timeoutMs:
            options.timeoutMs ||
            this.options
              .timeoutMs,

          start:
            async () => {
              this.initialize();

              return this;
            },

          ready:
            async () =>
              !this.failed,

          health:
            async () =>
              this.health(),

          stop:
            async hookContext =>
              this.request(
                hookContext?.reason ||
                  'bootstrap-shutdown',
                hookContext,
              ),

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

    this._shutdownAdapterRegistered =
      true;

    return result;
  }

  /**
   * ---------------------------------------------------------------------------
   * Initialization
   * ---------------------------------------------------------------------------
   */

  initialize() {
    if (
      this.state ===
      STATES.CREATED
    ) {
      this.state =
        STATES.INITIALIZING;

      this.state =
        STATES.READY;
    }

    this._registerCanonicalAdapter();

    return this;
  }

  /**
   * ---------------------------------------------------------------------------
   * Canonical shutdown.js Integration
   * ---------------------------------------------------------------------------
   *
   * shutdown.js remains the process-level orchestrator.
   *
   * shutdownManager.js should register itself as a participant rather than
   * recursively invoking shutdown.js.
   */

  _registerCanonicalAdapter() {
    if (
      this._shutdownAdapterRegistered ||
      !shutdownModule
    ) {
      return;
    }

    if (
      typeof shutdownModule.register ===
      'function'
    ) {
      try {
        shutdownModule.register({
          name:
            COMPONENT,

          priority:
            10_000,

          critical:
            true,

          stop:
            async context =>
              this._executeManagedShutdown(
                context?.reason ||
                  'canonical-shutdown',
                context,
              ),

          metadata: {
            component:
              COMPONENT,

            service:
              SERVICE_NAME,
          },
        });

        this._shutdownAdapterRegistered =
          true;
      } catch (error) {
        /**
         * Duplicate registration is acceptable during migration.
         * Other registration errors remain visible in diagnostics.
         */
        if (
          error?.code !==
          'SHUTDOWN_PARTICIPANT_DUPLICATE'
        ) {
          this._recordError(
            COMPONENT,
            error,
          );
        }
      }
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Shutdown Request
   * ---------------------------------------------------------------------------
   */

  async request(
    reason =
      'application-request',
    metadata = {},
  ) {
    if (
      this.shutdownPromise
    ) {
      return this.shutdownPromise;
    }

    this.requested =
      true;

    this.reason =
      reason;

    this.signal =
      metadata.signal ||
      null;

    this.requestedAt =
      new Date();

    this.state =
      STATES.REQUESTED;

    this._emit(
      'shutdown_manager.requested',
      {
        reason,

        signal:
          this.signal,
      },
    );

    this.shutdownPromise =
      this._executeManagedShutdown(
        reason,
        metadata,
      );

    return this.shutdownPromise;
  }

  /**
   * ---------------------------------------------------------------------------
   * Managed Shutdown
   * ---------------------------------------------------------------------------
   */

  async _executeManagedShutdown(
    reason,
    metadata = {},
  ) {
    if (
      this.running
    ) {
      return;
    }

    const started =
      process.hrtime.bigint();

    this.running =
      true;

    this.completed =
      false;

    this.failed =
      false;

    this.failure =
      null;

    try {
      /**
       * ---------------------------------------------------------------
       * Phase 1: readiness fencing.
       * ---------------------------------------------------------------
       */
      this.state =
        STATES.DRAINING;

      await this._markNotReady();

      /**
       * ---------------------------------------------------------------
       * Phase 2: Let lifecycleManager perform its canonical dependency-aware
       * shutdown when available.
       * ---------------------------------------------------------------
       *
       * We do not call it recursively when this manager is already executing
       * as a lifecycle-managed participant.
       */
      const lifecycleResult =
        await this._invokeLifecycleManager(
          reason,
          metadata,
        );

      /**
       * ---------------------------------------------------------------
       * Phase 3: Explicitly registered shutdown participants.
       * ---------------------------------------------------------------
       */
      this.state =
        STATES.STOPPING;

      await this._executeParticipants(
        reason,
        metadata,
      );

      /**
       * ---------------------------------------------------------------
       * Phase 4: Telemetry state.
       * ---------------------------------------------------------------
       */
      this.state =
        STATES.FLUSHING;

      this._emit(
        'shutdown_manager.completed',
        {
          reason,

          signal:
            this.signal,

          durationMs:
            hrtimeMs(
              started,
            ),

          participantCount:
            this.participants.size,
        },
      );

      this.completed =
        true;

      this.running =
        false;

      this.state =
        STATES.STOPPED;

      this.completedAt =
        new Date();

      this._log(
        'info',
        {
          reason,

          durationMs:
            hrtimeMs(
              started,
            ),
        },
        'TITech shutdown manager completed.',
      );

      return {
        success:
          true,

        lifecycle:
          lifecycleResult,

        durationMs:
          hrtimeMs(
            started,
          ),
      };
    } catch (error) {
      this.failed =
        true;

      this.running =
        false;

      this.failure =
        error;

      this.state =
        STATES.FAILED;

      this._emit(
        'shutdown_manager.failed',
        {
          reason,

          signal:
            this.signal,

          error:
            safeError(
              error,
            ),

          durationMs:
            hrtimeMs(
              started,
            ),
        },
      );

      this._log(
        'error',
        {
          reason,

          err:
            error,
        },
        'TITech shutdown manager failed.',
      );

      if (
        this.options
          .forceExitOnTimeout &&
        (
          error?.code ===
            'SHUTDOWN_MANAGER_TIMEOUT' ||
          error?.code ===
            'SHUTDOWN_GLOBAL_TIMEOUT'
        )
      ) {
        this.forceExit();
      }

      throw (
        error instanceof
        ShutdownManagerError
          ? error
          : new ShutdownManagerError(
              'TITech shutdown manager failed.',
              {
                code:
                  'SHUTDOWN_MANAGER_FAILED',

                cause:
                  error,

                details: {
                  reason,
                },
              },
            )
      );
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness Fence
   * ---------------------------------------------------------------------------
   */

  async _markNotReady() {
    try {
      if (
        typeof readinessModule
          ?.markNotReady ===
        'function'
      ) {
        readinessModule.markNotReady(
          'shutdown-manager',
          {
            reason:
              this.reason,
          },
        );

        return;
      }

      if (
        readinessModule
          ?.readinessState &&
        typeof readinessModule
          .readinessState
          .markNotReady ===
        'function'
      ) {
        readinessModule
          .readinessState
          .markNotReady(
            'shutdown-manager',
            {
              reason:
                this.reason,
            },
          );
      }
    } catch (error) {
      this._recordError(
        'readiness',
        error,
      );
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Lifecycle Manager
   * ---------------------------------------------------------------------------
   */

  async _invokeLifecycleManager(
    reason,
    metadata,
  ) {
    /**
     * Avoid recursive shutdown-manager → lifecycleManager → shutdown-manager
     * calls where lifecycleManager invokes this participant.
     *
     * lifecycleManager remains authoritative for application lifecycle.
     */
    const manager =
      lifecycleManagerModule
        ?.lifecycleManager;

    if (
      !manager ||
      typeof manager.shutdown !==
        'function'
    ) {
      return null;
    }

    return withTimeout(
      () =>
        manager.shutdown(
          {
            ...metadata,

            reason,

            signal:
              this.signal,

            source:
              COMPONENT,
          },
          reason,
        ),
      this.options.timeoutMs,
      'TITech lifecycle manager shutdown',
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Explicit Participant Execution
   * ---------------------------------------------------------------------------
   */

  async _executeParticipants(
    reason,
    metadata,
  ) {
    const order =
      this.resolveOrder();

    for (
      const participant of
        order
    ) {
      await this._executeParticipant(
        participant,
        reason,
        metadata,
      );
    }
  }

  async _executeParticipant(
    participant,
    reason,
    metadata,
  ) {
    const started =
      process.hrtime.bigint();

    let attempts =
      0;

    const maxAttempts =
      participant.retryAttempts +
      1;

    while (
      attempts <
      maxAttempts
    ) {
      attempts +=
        1;

      try {
        await withTimeout(
          () =>
            participant.stop({
              ...metadata,

              reason,

              signal:
                this.signal,

              shutdownManager:
                this,
            }),
          participant.timeoutMs,
          `shutdown participant "${participant.name}"`,
        );

        this.executionHistory.push({
          participant:
            participant.name,

          status:
            'stopped',

          attempts,

          durationMs:
            hrtimeMs(
              started,
            ),
        });

        this._emit(
          'shutdown_manager.participant_stopped',
          {
            participant:
              participant.name,

            attempts,

            durationMs:
              hrtimeMs(
                started,
              ),
          },
        );

        return;
      } catch (error) {
        if (
          attempts <
          maxAttempts
        ) {
          await sleep(
            participant.retryDelayMs,
          );

          continue;
        }

        const record = {
          participant:
            participant.name,

          status:
            'failed',

          attempts,

          durationMs:
            hrtimeMs(
              started,
            ),

          critical:
            participant.critical,

          error:
            safeError(
              error,
            ),
        };

        this.executionHistory.push(
          record,
        );

        this._recordError(
          participant.name,
          error,
        );

        this._emit(
          'shutdown_manager.participant_failed',
          record,
        );

        if (
          participant.critical &&
          !this.options
            .continueOnError
        ) {
          throw new ShutdownManagerError(
            `Critical shutdown participant "${participant.name}" failed.`,
            {
              code:
                'SHUTDOWN_CRITICAL_PARTICIPANT_FAILED',

              participant:
                participant.name,

              cause:
                error,
            },
          );
        }
      }
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Error Tracking
   * ---------------------------------------------------------------------------
   */

  _recordError(
    participant,
    error,
  ) {
    this.errors.push({
      participant,

      timestamp:
        new Date().toISOString(),

      error:
        safeError(
          error,
        ),
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Health
   * ---------------------------------------------------------------------------
   */

  async health() {
    return {
      status:
        this.failed
          ? 'unhealthy'
          : this.running
            ? 'stopping'
            : this.completed
              ? 'stopped'
              : 'healthy',

      state:
        this.state,

      requested:
        this.requested,

      running:
        this.running,

      completed:
        this.completed,

      failed:
        this.failed,

      participantCount:
        this.participants.size,

      failedParticipantCount:
        this.errors.length,

      reason:
        this.reason,

      signal:
        this.signal,

      service:
        SERVICE_NAME,

      timestamp:
        new Date().toISOString(),
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * Force Exit
   * ---------------------------------------------------------------------------
   */

  forceExit() {
    this.forceExitRequested =
      true;

    process.exitCode =
      1;

    /**
     * Delay actual termination very briefly to allow logs to flush.
     */
    const timer =
      setTimeout(
        () => {
          try {
            process.exit(
              1,
            );
          } catch {
            // Last-resort operation.
          }
        },
        250,
      );

    timer.unref?.();
  }

  /**
   * ---------------------------------------------------------------------------
   * Snapshot
   * ---------------------------------------------------------------------------
   */

  snapshot() {
    return Object.freeze({
      component:
        COMPONENT,

      service:
        SERVICE_NAME,

      application:
        APPLICATION_NAME,

      state:
        this.state,

      requested:
        this.requested,

      running:
        this.running,

      completed:
        this.completed,

      failed:
        this.failed,

      forceExitRequested:
        this.forceExitRequested,

      reason:
        this.reason,

      signal:
        this.signal,

      requestedAt:
        this.requestedAt,

      startedAt:
        this.startedAt,

      completedAt:
        this.completedAt,

      failure:
        safeError(
          this.failure,
        ),

      participants:
        Object.freeze(
          this.list(),
        ),

      executionHistory:
        Object.freeze(
          this.executionHistory.map(
            item => ({
              ...item,
            }),
          ),
        ),

      errors:
        Object.freeze(
          this.errors.map(
            item => ({
              ...item,
            }),
          ),
        ),
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Reset
   * ---------------------------------------------------------------------------
   */

  reset() {
    if (
      this.running
    ) {
      throw new ShutdownManagerError(
        'Cannot reset an active TITech shutdown manager.',
        {
          code:
            'SHUTDOWN_MANAGER_RESET_NOT_ALLOWED',
        },
      );
    }

    this.state =
      STATES.CREATED;

    this.requested =
      false;

    this.running =
      false;

    this.completed =
      false;

    this.failed =
      false;

    this.forceExitRequested =
      false;

    this.reason =
      null;

    this.signal =
      null;

    this.requestedAt =
      null;

    this.startedAt =
      null;

    this.completedAt =
      null;

    this.failure =
      null;

    this.shutdownPromise =
      null;

    this.executionHistory =
      [];

    this.errors =
      [];

    return this;
  }
}

/**
 * -----------------------------------------------------------------------------
 * Participant Comparator
 * -----------------------------------------------------------------------------
 */

function compareParticipants(
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
 * =============================================================================
 * Default Singleton
 * =============================================================================
 */

const shutdownManager =
  new ShutdownManager();

/**
 * -----------------------------------------------------------------------------
 * Convenience API
 * -----------------------------------------------------------------------------
 */

function register(
  options,
) {
  return shutdownManager.register(
    options,
  );
}

function unregister(
  name,
) {
  return shutdownManager.unregister(
    name,
  );
}

function has(
  name,
) {
  return shutdownManager.has(
    name,
  );
}

function list() {
  return shutdownManager.list();
}

function resolveOrder() {
  return shutdownManager.resolveOrder();
}

function initialize() {
  return shutdownManager.initialize();
}

async function shutdown(
  reason =
    'application-request',
  metadata = {},
) {
  return shutdownManager.request(
    reason,
    metadata,
  );
}

async function stop(
  reason =
    'application-request',
  metadata = {},
) {
  return shutdown(
    reason,
    metadata,
  );
}

function forceExit() {
  return shutdownManager.forceExit();
}

function health() {
  return shutdownManager.health();
}

function snapshot() {
  return shutdownManager.snapshot();
}

/**
 * -----------------------------------------------------------------------------
 * Bootstrap Registration
 * -----------------------------------------------------------------------------
 */

function registerBootstrapHooks(
  context = {},
  options = {},
) {
  return shutdownManager.registerBootstrapHooks(
    context,
    options,
  );
}

/**
 * =============================================================================
 * Export
 * =============================================================================
 */

module.exports =
  Object.freeze({
    /**
     * Core.
     */
    ShutdownManager,

    ShutdownManagerError,

    shutdownManager,

    STATES,

    /**
     * Participant registry.
     */
    register,
    unregister,
    has,
    list,
    resolveOrder,

    /**
     * Lifecycle.
     */
    initialize,

    shutdown,

    stop,

    registerBootstrapHooks,

    bootstrap:
      registerBootstrapHooks,

    /**
     * Operational.
     */
    health,
    snapshot,
    forceExit,
  });