'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/shutdown.js
 *
 * Purpose:
 *   Enterprise production-grade application shutdown coordinator.
 *
 * Responsibilities:
 *   - Coordinate deterministic application shutdown.
 *   - Provide one canonical shutdown entry point.
 *   - Prevent duplicate/concurrent shutdown execution.
 *   - Support graceful shutdown on SIGTERM/SIGINT/SIGQUIT.
 *   - Drain HTTP/HTTPS traffic before infrastructure teardown.
 *   - Execute registered shutdown participants in reverse dependency order.
 *   - Enforce per-participant and global shutdown timeouts.
 *   - Support best-effort cleanup of non-critical components.
 *   - Preserve the original shutdown failure while continuing cleanup when
 *     policy permits.
 *   - Integrate readiness, runtime, lifecycleManager, lifecycle and hooks.
 *   - Flush observability/logging after application resources are stopped.
 *   - Expose safe shutdown diagnostics.
 *
 * Architectural position:
 *
 *   runtime.js
 *       ↓
 *   shutdown.js
 *       ↓
 *   readinessState.js
 *       ↓
 *   server.js
 *       ↓
 *   routes/services
 *       ↓
 *   queue/event-bus
 *       ↓
 *   Redis/idempotency
 *       ↓
 *   database
 *       ↓
 *   observability/logger
 *
 * IMPORTANT:
 *
 *   This file is a SHUTDOWN ORCHESTRATOR.
 *
 *   It does NOT:
 *     - implement finance logic
 *     - implement ledger logic
 *     - execute database queries
 *     - own Redis
 *     - process queue messages
 *     - implement HTTP routes
 *     - duplicate infrastructure cleanup logic
 *
 * Existing subsystems remain authoritative.
 *
 * =============================================================================
 */

const {
  EventEmitter,
} = require('node:events');

/**
 * -----------------------------------------------------------------------------
 * Optional lifecycle dependencies
 * -----------------------------------------------------------------------------
 */

let hooksModule = null;

try {
  // eslint-disable-next-line global-require
  hooksModule =
    require('./hooks');
} catch {
  hooksModule = null;
}

let lifecycleModule = null;

try {
  // eslint-disable-next-line global-require
  lifecycleModule =
    require('./lifecycleManager');
} catch {
  lifecycleModule = null;
}

let applicationLifecycleModule =
  null;

try {
  // eslint-disable-next-line global-require
  applicationLifecycleModule =
    require('./lifecycle');
} catch {
  applicationLifecycleModule = null;
}

let runtimeModule = null;

try {
  // eslint-disable-next-line global-require
  runtimeModule =
    require('./runtime');
} catch {
  runtimeModule = null;
}

let readinessModule = null;

try {
  // eslint-disable-next-line global-require
  readinessModule =
    require('./readinessState');
} catch {
  readinessModule = null;
}

let serverModule = null;

try {
  // eslint-disable-next-line global-require
  serverModule =
    require('./server');
} catch {
  serverModule = null;
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
  'shutdown';

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

  signalGraceMs:
    250,

  forceExitOnTimeout:
    false,

  continueOnError:
    true,

  installSignalHandlers:
    false,

  shutdownOnUncaughtException:
    true,

  shutdownOnUnhandledRejection:
    true,

  closeServerFirst:
    true,

  markNotReadyFirst:
    true,

  flushObservabilityLast:
    true,

  flushLoggerLast:
    true,
});

const SIGNALS = Object.freeze([
  'SIGTERM',
  'SIGINT',
  'SIGQUIT',
]);

const SHUTDOWN_STATES = Object.freeze({
  CREATED:
    'created',

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

class ShutdownError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'ShutdownError';

    this.code =
      options.code ||
      'SHUTDOWN_ERROR';

    this.phase =
      options.phase ||
      null;

    this.participant =
      options.participant ||
      null;

    this.signal =
      options.signal ||
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
      ShutdownError,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Utility
 * -----------------------------------------------------------------------------
 */

function asBoolean(
  value,
  fallback,
) {
  if (
    value === undefined ||
    value === null ||
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

/**
 * -----------------------------------------------------------------------------
 * Timeout Helper
 * -----------------------------------------------------------------------------
 */

async function withTimeout(
  fn,
  timeoutMs,
  label,
) {
  let timer;

  const operation =
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
                new ShutdownError(
                  `${label} timed out after ${timeoutMs}ms.`,
                  {
                    code:
                      'SHUTDOWN_TIMEOUT',
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
      operation,
      timeout,
    ]);
  } finally {
    clearTimeout(
      timer,
    );
  }
}

/**
 * =============================================================================
 * Shutdown Coordinator
 * =============================================================================
 */

class ShutdownCoordinator extends EventEmitter {
  constructor(
    options = {},
  ) {
    super();

    this.options =
      Object.freeze({
        timeoutMs:
          asPositiveInteger(
            options.timeoutMs ??
              process.env.SHUTDOWN_TIMEOUT_MS,
            DEFAULTS.timeoutMs,
          ),

        participantTimeoutMs:
          asPositiveInteger(
            options.participantTimeoutMs ??
              process.env.SHUTDOWN_PARTICIPANT_TIMEOUT_MS,
            DEFAULTS.participantTimeoutMs,
          ),

        signalGraceMs:
          asPositiveInteger(
            options.signalGraceMs ??
              process.env.SHUTDOWN_SIGNAL_GRACE_MS,
            DEFAULTS.signalGraceMs,
          ),

        forceExitOnTimeout:
          options.forceExitOnTimeout ??
          asBoolean(
            process.env.SHUTDOWN_FORCE_EXIT,
            DEFAULTS.forceExitOnTimeout,
          ),

        continueOnError:
          options.continueOnError ??
          asBoolean(
            process.env.SHUTDOWN_CONTINUE_ON_ERROR,
            DEFAULTS.continueOnError,
          ),

        installSignalHandlers:
          options.installSignalHandlers ??
          asBoolean(
            process.env.SHUTDOWN_INSTALL_SIGNALS,
            DEFAULTS.installSignalHandlers,
          ),

        shutdownOnUncaughtException:
          options.shutdownOnUncaughtException ??
          asBoolean(
            process.env.SHUTDOWN_ON_UNCAUGHT_EXCEPTION,
            DEFAULTS.shutdownOnUncaughtException,
          ),

        shutdownOnUnhandledRejection:
          options.shutdownOnUnhandledRejection ??
          asBoolean(
            process.env.SHUTDOWN_ON_UNHANDLED_REJECTION,
            DEFAULTS.shutdownOnUnhandledRejection,
          ),

        closeServerFirst:
          options.closeServerFirst ??
          DEFAULTS.closeServerFirst,

        markNotReadyFirst:
          options.markNotReadyFirst ??
          DEFAULTS.markNotReadyFirst,

        flushObservabilityLast:
          options.flushObservabilityLast ??
          DEFAULTS.flushObservabilityLast,

        flushLoggerLast:
          options.flushLoggerLast ??
          DEFAULTS.flushLoggerLast,
      });

    this.state =
      SHUTDOWN_STATES.CREATED;

    this.requestedAt =
      null;

    this.startedAt =
      null;

    this.completedAt =
      null;

    this.reason =
      null;

    this.signal =
      null;

    this.failure =
      null;

    this.shutdownPromise =
      null;

    this.shutdownRequested =
      false;

    this.forceExitRequested =
      false;

    this.signalHandlersInstalled =
      false;

    this.processErrorHandlersInstalled =
      false;

    this.participants =
      new Map();

    this.executionHistory =
      [];

    this.errors =
      [];

    this._installSignalHandlersIfConfigured();
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
      // Shutdown must not depend on logging availability.
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

  _emitObservability(
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
      // Telemetry failure must never block shutdown.
    }

    return null;
  }

  /**
   * ---------------------------------------------------------------------------
   * Participant Registration
   * ---------------------------------------------------------------------------
   *
   * Participants allow application-owned resources to join shutdown without
   * creating duplicate shutdown logic in this module.
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
      throw new ShutdownError(
        `Shutdown participant "${name}" is already registered.`,
        {
          code:
            'SHUTDOWN_PARTICIPANT_DUPLICATE',

          participant:
            name,
        },
      );
    }

    const participant = {
      name,

      priority:
        Number.isInteger(
          options.priority,
        )
          ? options.priority
          : 0,

      timeoutMs:
        asPositiveInteger(
          options.timeoutMs,
          this.options
            .participantTimeoutMs,
        ),

      critical:
        options.critical !==
        false,

      enabled:
        options.enabled !==
        false,

      stop:
        typeof options.stop ===
        'function'
          ? options.stop
          : null,

      metadata: {
        ...(options.metadata ||
          {}),
      },

      registeredAt:
        new Date(),
    };

    this.participants.set(
      name,
      participant,
    );

    return Object.freeze({
      ...participant,
    });
  }

  unregister(
    name,
  ) {
    const normalized =
      normalizeName(
        name,
      );

    return this.participants.delete(
      normalized,
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
   * Participant Order
   * ---------------------------------------------------------------------------
   *
   * Higher startup priorities stop later. Shutdown is reverse-priority.
   */

  _resolveParticipantOrder() {
    return [
      ...this.participants.values(),
    ]
      .filter(
        participant =>
          participant.enabled &&
          typeof participant.stop ===
            'function',
      )
      .sort(
        (
          a,
          b,
        ) => {
          if (
            a.priority !==
            b.priority
          ) {
            return (
              b.priority -
              a.priority
            );
          }

          return a.name.localeCompare(
            b.name,
          );
        },
      );
  }

  /**
   * ---------------------------------------------------------------------------
   * Signal Handling
   * ---------------------------------------------------------------------------
   */

  _installSignalHandlersIfConfigured() {
    if (
      !this.options
        .installSignalHandlers ||
      this.signalHandlersInstalled
    ) {
      return;
    }

    for (
      const signal of
        SIGNALS
    ) {
      const handler =
        () => {
          void this.request(
            `signal:${signal}`,
            {
              signal,
            },
          );
        };

      process.once(
        signal,
        handler,
      );

      this[`_${signal}Handler`] =
        handler;
    }

    this.signalHandlersInstalled =
      true;
  }

  installSignalHandlers() {
    if (
      this.signalHandlersInstalled
    ) {
      return false;
    }

    this.options =
      Object.freeze({
        ...this.options,
      });

    for (
      const signal of
        SIGNALS
    ) {
      const handler =
        () => {
          void this.request(
            `signal:${signal}`,
            {
              signal,
            },
          );
        };

      process.once(
        signal,
        handler,
      );

      this[`_${signal}Handler`] =
        handler;
    }

    this.signalHandlersInstalled =
      true;

    return true;
  }

  removeSignalHandlers() {
    for (
      const signal of
        SIGNALS
    ) {
      const handler =
        this[`_${signal}Handler`];

      if (
        handler
      ) {
        process.removeListener(
          signal,
          handler,
        );

        this[`_${signal}Handler`] =
          null;
      }
    }

    this.signalHandlersInstalled =
      false;

    return true;
  }

  /**
   * ---------------------------------------------------------------------------
   * Fatal Process Error Handling
   * ---------------------------------------------------------------------------
   */

  installProcessErrorHandlers() {
    if (
      this.processErrorHandlersInstalled
    ) {
      return false;
    }

    const uncaughtExceptionHandler =
      error => {
        if (
          !this.options
            .shutdownOnUncaughtException
        ) {
          return;
        }

        void this.request(
          'uncaughtException',
          {
            error,
          },
        );
      };

    const unhandledRejectionHandler =
      reason => {
        if (
          !this.options
            .shutdownOnUnhandledRejection
        ) {
          return;
        }

        const error =
          reason instanceof
          Error
            ? reason
            : new Error(
                String(reason),
              );

        void this.request(
          'unhandledRejection',
          {
            error,
          },
        );
      };

    process.once(
      'uncaughtException',
      uncaughtExceptionHandler,
    );

    process.once(
      'unhandledRejection',
      unhandledRejectionHandler,
    );

    this._uncaughtExceptionHandler =
      uncaughtExceptionHandler;

    this._unhandledRejectionHandler =
      unhandledRejectionHandler;

    this.processErrorHandlersInstalled =
      true;

    return true;
  }

  removeProcessErrorHandlers() {
    if (
      this._uncaughtExceptionHandler
    ) {
      process.removeListener(
        'uncaughtException',
        this._uncaughtExceptionHandler,
      );
    }

    if (
      this._unhandledRejectionHandler
    ) {
      process.removeListener(
        'unhandledRejection',
        this._unhandledRejectionHandler,
      );
    }

    this._uncaughtExceptionHandler =
      null;

    this._unhandledRejectionHandler =
      null;

    this.processErrorHandlersInstalled =
      false;

    return true;
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

    if (
      this.state ===
      SHUTDOWN_STATES.STOPPED
    ) {
      return true;
    }

    this.shutdownRequested =
      true;

    this.reason =
      reason;

    this.signal =
      metadata.signal ||
      null;

    this.requestedAt =
      new Date();

    this._transition(
      SHUTDOWN_STATES.REQUESTED,
      {
        reason,
        signal:
          this.signal,
      },
    );

    this._emitObservability(
      'shutdown.requested',
      {
        reason,

        signal:
          this.signal,
      },
    );

    this._log(
      'info',
      {
        reason,

        signal:
          this.signal,
      },
      'TITech application shutdown requested.',
    );

    this.shutdownPromise =
      this._performShutdown(
        metadata,
      );

    return this.shutdownPromise;
  }

  async _performShutdown(
    metadata = {},
  ) {
    const started =
      process.hrtime.bigint();

    try {
      this._transition(
        SHUTDOWN_STATES.DRAINING,
        {
          reason:
            this.reason,

          signal:
            this.signal,
        },
      );

      /**
       * -----------------------------------------------------------------------
       * Phase 1: Mark application not ready.
       * -----------------------------------------------------------------------
       */

      if (
        this.options
          .markNotReadyFirst
      ) {
        await this._markNotReady();
      }

      /**
       * -----------------------------------------------------------------------
       * Phase 2: Stop accepting new network traffic.
       * -----------------------------------------------------------------------
       */

      if (
        this.options
          .closeServerFirst
      ) {
        await this._closeServer(
          metadata,
        );
      }

      /**
       * -----------------------------------------------------------------------
       * Phase 3: Stop the application lifecycle.
       * -----------------------------------------------------------------------
       */

      this._transition(
        SHUTDOWN_STATES.STOPPING,
      );

      await this._stopApplicationLifecycle(
        metadata,
      );

      /**
       * -----------------------------------------------------------------------
       * Phase 4: Run explicitly registered shutdown participants.
       * -----------------------------------------------------------------------
       */

      await this._stopParticipants(
        metadata,
      );

      /**
       * -----------------------------------------------------------------------
       * Phase 5: Final telemetry/logging flush.
       * -----------------------------------------------------------------------
       */

      this._transition(
        SHUTDOWN_STATES.FLUSHING,
      );

      if (
        this.options
          .flushObservabilityLast
      ) {
        await this._flushObservability();
      }

      if (
        this.options
          .flushLoggerLast
      ) {
        await this._flushLogger();
      }

      /**
       * -----------------------------------------------------------------------
       * Completed.
       * -----------------------------------------------------------------------
       */

      this.completedAt =
        new Date();

      this._transition(
        SHUTDOWN_STATES.STOPPED,
        {
          reason:
            this.reason,

          durationMs:
            hrtimeMs(
              started,
            ),
        },
      );

      this._emitObservability(
        'shutdown.completed',
        {
          reason:
            this.reason,

          durationMs:
            hrtimeMs(
              started,
            ),

          participantCount:
            this.participants.size,
        },
      );

      this._log(
        'info',
        {
          reason:
            this.reason,

          durationMs:
            hrtimeMs(
              started,
            ),
        },
        'TITech application shutdown completed.',
      );

      return true;
    } catch (error) {
      this.failure =
        error;

      this._transition(
        SHUTDOWN_STATES.FAILED,
        {
          reason:
            this.reason,

          error:
            safeError(
              error,
            ),
        },
      );

      this._emitObservability(
        'shutdown.failed',
        {
          reason:
            this.reason,

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
          reason:
            this.reason,

          err:
            error,
        },
        'TITech application shutdown failed.',
      );

      if (
        this.options
          .forceExitOnTimeout &&
        (
          error?.code ===
            'SHUTDOWN_TIMEOUT' ||
          error?.code ===
            'SHUTDOWN_GLOBAL_TIMEOUT'
        )
      ) {
        this.forceExit();
      }

      throw (
        error instanceof
        ShutdownError
          ? error
          : new ShutdownError(
              'TITech application shutdown failed.',
              {
                code:
                  'SHUTDOWN_FAILED',

                phase:
                  this.state,

                signal:
                  this.signal,

                cause:
                  error,
              },
            )
      );
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness
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
          'application-shutdown',
          {
            signal:
              this.signal,
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
            'application-shutdown',
            {
              signal:
                this.signal,
            },
          );
      }
    } catch (error) {
      /**
       * Readiness failure should not prevent resource cleanup.
       */
      this.errors.push({
        participant:
          'readiness',

        error:
          safeError(
            error,
          ),
      });
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Server
   * ---------------------------------------------------------------------------
   */

  async _closeServer(
    metadata,
  ) {
    try {
      if (
        typeof serverModule
          ?.shutdown ===
        'function'
      ) {
        await withTimeout(
          () =>
            serverModule.shutdown(
              this.reason ||
                'application-shutdown',
              {
                ...metadata,

                signal:
                  this.signal,
              },
            ),
          this.options
            .participantTimeoutMs,
          'TITech HTTP server shutdown',
        );

        return;
      }

      if (
        typeof serverModule?.stop ===
        'function'
      ) {
        await withTimeout(
          () =>
            serverModule.stop(
              this.reason ||
                'application-shutdown',
              {
                ...metadata,

                signal:
                  this.signal,
              },
            ),
          this.options
            .participantTimeoutMs,
          'TITech HTTP server stop',
        );
      }
    } catch (error) {
      this.errors.push({
        participant:
          'server',

        error:
          safeError(
            error,
          ),
      });

      if (
        !this.options
          .continueOnError
      ) {
        throw error;
      }
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Application Lifecycle
   * ---------------------------------------------------------------------------
   */

  async _stopApplicationLifecycle(
    metadata,
  ) {
    /**
     * Prefer lifecycleManager because it owns manager dependency order.
     */
    if (
      lifecycleModule
        ?.lifecycleManager &&
      typeof lifecycleModule
        .lifecycleManager
        .shutdown ===
      'function'
    ) {
      try {
        await withTimeout(
          () =>
            lifecycleModule
              .lifecycleManager
              .shutdown(
                {
                  ...metadata,

                  signal:
                    this.signal,

                  reason:
                    this.reason,
                },
                this.reason ||
                  'application-shutdown',
              ),
          this.options
            .timeoutMs,
          'TITech lifecycle manager shutdown',
        );

        return;
      } catch (error) {
        this.errors.push({
          participant:
            'lifecycleManager',

          error:
            safeError(
              error,
            ),
        });

        if (
          !this.options
            .continueOnError
        ) {
          throw error;
        }
      }
    }

    /**
     * Fallback to lifecycle.js.
     */
    if (
      typeof applicationLifecycleModule
        ?.shutdown ===
      'function'
    ) {
      try {
        await withTimeout(
          () =>
            applicationLifecycleModule.shutdown(
              this.reason ||
                'application-shutdown',
              {
                ...metadata,

                signal:
                  this.signal,
              },
            ),
          this.options
            .timeoutMs,
          'TITech application lifecycle shutdown',
        );

        return;
      } catch (error) {
        this.errors.push({
          participant:
            'lifecycle',

          error:
            safeError(
              error,
            ),
        });

        if (
          !this.options
            .continueOnError
        ) {
          throw error;
        }
      }
    }

    /**
     * Final fallback to hooks.js.
     */
    if (
      typeof hooksModule?.stop ===
      'function'
    ) {
      try {
        await withTimeout(
          () =>
            hooksModule.stop({
              ...metadata,

              signal:
                this.signal,

              reason:
                this.reason,
            }),
          this.options
            .timeoutMs,
          'TITech bootstrap hooks shutdown',
        );
      } catch (error) {
        this.errors.push({
          participant:
            'hooks',

          error:
            safeError(
              error,
            ),
        });

        if (
          !this.options
            .continueOnError
        ) {
          throw error;
        }
      }
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Registered Participants
   * ---------------------------------------------------------------------------
   */

  async _stopParticipants(
    metadata,
  ) {
    const participants =
      this._resolveParticipantOrder();

    for (
      const participant of
        participants
    ) {
      const started =
        process.hrtime.bigint();

      try {
        await withTimeout(
          () =>
            participant.stop({
              ...metadata,

              reason:
                this.reason,

              signal:
                this.signal,

              shutdown:
                this,
            }),
          participant.timeoutMs,
          `shutdown participant "${participant.name}"`,
        );

        this.executionHistory.push({
          name:
            participant.name,

          status:
            'stopped',

          durationMs:
            hrtimeMs(
              started,
            ),
        });
      } catch (error) {
        const record = {
          name:
            participant.name,

          status:
            'failed',

          durationMs:
            hrtimeMs(
              started,
            ),

          error:
            safeError(
              error,
            ),
        };

        this.executionHistory.push(
          record,
        );

        this.errors.push({
          participant:
            participant.name,

          critical:
            participant.critical,

          error:
            safeError(
              error,
            ),
        });

        this._emitObservability(
          'shutdown.participant_failed',
          {
            participant:
              participant.name,

            critical:
              participant.critical,

            error:
              safeError(
                error,
              ),
          },
        );

        if (
          participant.critical &&
          !this.options
            .continueOnError
        ) {
          throw new ShutdownError(
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
   * Flush Observability
   * ---------------------------------------------------------------------------
   */

  async _flushObservability() {
    try {
      if (
        typeof observabilityModule
          ?.shutdown ===
        'function'
      ) {
        await withTimeout(
          () =>
            observabilityModule.shutdown(),
          this.options
            .participantTimeoutMs,
          'TITech observability shutdown',
        );

        return;
      }

      if (
        observabilityModule
          ?.observability &&
        typeof observabilityModule
          .observability
          .shutdown ===
        'function'
      ) {
        await withTimeout(
          () =>
            observabilityModule
              .observability
              .shutdown(),
          this.options
            .participantTimeoutMs,
          'TITech observability shutdown',
        );
      }
    } catch (error) {
      this.errors.push({
        participant:
          'observability',

        error:
          safeError(
            error,
          ),
      });

      /**
       * Telemetry shutdown errors should not prevent process termination.
       */
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Flush Logger
   * ---------------------------------------------------------------------------
   */

  async _flushLogger() {
    try {
      const logger =
        loggerModule?.getLogger?.();

      if (
        logger &&
        typeof logger.flush ===
          'function'
      ) {
        await new Promise(
          resolve => {
            try {
              logger.flush(
                () =>
                  resolve(),
              );
            } catch {
              resolve();
            }
          },
        );
      }
    } catch (error) {
      /**
       * Logging errors should never replace the original shutdown result.
       */
      this.errors.push({
        participant:
          'logger',

        error:
          safeError(
            error,
          ),
      });
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Force Exit Request
   * ---------------------------------------------------------------------------
   *
   * Deliberately sets process.exitCode rather than calling process.exit()
   * immediately. This lets stdout/stderr and other event-loop cleanup finish.
   */

  forceExit() {
    this.forceExitRequested =
      true;

    process.exitCode =
      1;

    this._emitObservability(
      'shutdown.force_exit_requested',
      {
        reason:
          this.reason,
      },
    );

    setTimeout(
      () => {
        /**
         * Last-resort termination.
         *
         * This should only be reachable when explicitly configured.
         */
        try {
          process.exit(
            1,
          );
        } catch {
          // Nothing more can safely be done.
        }
      },
      this.options
        .signalGraceMs,
    ).unref?.();
  }

  /**
   * ---------------------------------------------------------------------------
   * State
   * ---------------------------------------------------------------------------
   */

  _transition(
    state,
    metadata = {},
  ) {
    const previous =
      this.state;

    this.state =
      state;

    this.emit(
      'stateChanged',
      {
        previousState:
          previous,

        state,

        timestamp:
          new Date().toISOString(),

        metadata: {
          ...metadata,
        },
      },
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Health
   * ---------------------------------------------------------------------------
   */

  isStopping() {
    return (
      this.state ===
      SHUTDOWN_STATES.DRAINING ||
      this.state ===
      SHUTDOWN_STATES.STOPPING ||
      this.state ===
      SHUTDOWN_STATES.FLUSHING
    );
  }

  isStopped() {
    return (
      this.state ===
      SHUTDOWN_STATES.STOPPED
    );
  }

  isFailed() {
    return (
      this.state ===
      SHUTDOWN_STATES.FAILED
    );
  }

  isRequested() {
    return (
      this.shutdownRequested
    );
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
        this.shutdownRequested,

      stopping:
        this.isStopping(),

      stopped:
        this.isStopped(),

      failed:
        this.isFailed(),

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

      errors:
        Object.freeze(
          this.errors.map(
            error => ({
              ...error,
            }),
          ),
        ),

      executionHistory:
        Object.freeze(
          this.executionHistory.map(
            item => ({
              ...item,
            }),
          ),
        ),

      participants:
        Object.freeze(
          this.list(),
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
      this.shutdownRequested &&
      !this.isStopped()
    ) {
      throw new ShutdownError(
        'Cannot reset an active TITech shutdown coordinator.',
        {
          code:
            'SHUTDOWN_RESET_NOT_ALLOWED',
        },
      );
    }

    this.state =
      SHUTDOWN_STATES.CREATED;

    this.requestedAt =
      null;

    this.startedAt =
      null;

    this.completedAt =
      null;

    this.reason =
      null;

    this.signal =
      null;

    this.failure =
      null;

    this.shutdownPromise =
      null;

    this.shutdownRequested =
      false;

    this.forceExitRequested =
      false;

    this.errors =
      [];

    this.executionHistory =
      [];

    return this;
  }
}

/**
 * =============================================================================
 * Default Singleton
 * =============================================================================
 */

const shutdownCoordinator =
  new ShutdownCoordinator();

/**
 * -----------------------------------------------------------------------------
 * Convenience Functions
 * -----------------------------------------------------------------------------
 */

function register(
  options,
) {
  return shutdownCoordinator.register(
    options,
  );
}

function unregister(
  name,
) {
  return shutdownCoordinator.unregister(
    name,
  );
}

function has(
  name,
) {
  return shutdownCoordinator.has(
    name,
  );
}

function list() {
  return shutdownCoordinator.list();
}

async function shutdown(
  reason =
    'application-request',
  metadata = {},
) {
  return shutdownCoordinator.request(
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
  return shutdownCoordinator.forceExit();
}

function snapshot() {
  return shutdownCoordinator.snapshot();
}

/**
 * =============================================================================
 * Bootstrap Lifecycle Registration
 * =============================================================================
 *
 * shutdown.js itself is registered late in the lifecycle and acts as a
 * coordinator. Normal execution is initiated by runtime.js/process signals.
 */

function registerBootstrapHooks(
  context = {},
  options = {},
) {
  if (
    hooksModule?.hooks?.has(
      COMPONENT,
    )
  ) {
    return hooksModule.hooks.get(
      COMPONENT,
    );
  }

  /**
   * We use the existing hook/lifecycle system without making this module the
   * owner of every individual subsystem.
   */
  if (
    typeof hooksModule?.lifecycle !==
    'function'
  ) {
    throw new ShutdownError(
      'TITech shutdown could not register because the lifecycle hook engine is unavailable.',
      {
        code:
          'SHUTDOWN_HOOK_ENGINE_UNAVAILABLE',
      },
    );
  }

  return hooksModule.lifecycle(
    COMPONENT,
    {
      priority:
        options.priority ??
        50_000,

      dependencies:
        options.dependencies ||
        [],

      critical:
        options.critical === true,

      enabled:
        options.enabled !==
        false,

      timeoutMs:
        options.timeoutMs ||
        DEFAULTS.timeoutMs,

      start:
        async () =>
          shutdownCoordinator,

      ready:
        async () =>
          !shutdownCoordinator
            .isFailed(),

      health:
        async () => ({
          status:
            shutdownCoordinator
              .isFailed()
              ? 'unhealthy'
              : shutdownCoordinator
                    .isStopping()
                ? 'stopping'
                : 'healthy',

          state:
            shutdownCoordinator.state,
        }),

      stop:
        async hookContext =>
          shutdown(
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
}

/**
 * -----------------------------------------------------------------------------
 * Public Export
 * -----------------------------------------------------------------------------
 */

module.exports =
  Object.freeze({
    /**
     * Core.
     */
    ShutdownCoordinator,

    ShutdownError,

    shutdownCoordinator,

    SHUTDOWN_STATES,

    SIGNALS,

    /**
     * Participant registration.
     */
    register,
    unregister,
    has,
    list,

    /**
     * Lifecycle.
     */
    shutdown,
    stop,

    /**
     * Bootstrap.
     */
    registerBootstrapHooks,

    bootstrap:
      registerBootstrapHooks,

    /**
     * Operational.
     */
    snapshot,

    forceExit,
  });