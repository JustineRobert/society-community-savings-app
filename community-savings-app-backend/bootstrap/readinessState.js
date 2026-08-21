'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/readinessState.js
 *
 * Purpose:
 *   Enterprise production-grade application readiness state manager.
 *
 * Responsibilities:
 *   - Maintain the canonical application readiness state.
 *   - Distinguish liveness, readiness and operational degradation.
 *   - Track bootstrap dependencies and their readiness.
 *   - Support dependency registration and health evaluation.
 *   - Prevent traffic from being marked ready before critical infrastructure
 *     is operational.
 *   - Support readiness transitions without process termination.
 *   - Provide safe diagnostics for operational endpoints.
 *   - Support startup grace periods and readiness stabilization.
 *   - Support degradation of non-critical dependencies.
 *   - Prevent stale readiness after shutdown.
 *   - Integrate with bootstrap/lifecycle.js and bootstrap/lifecycleManager.js.
 *
 * Readiness model:
 *
 *   CREATED
 *      ↓
 *   INITIALIZING
 *      ↓
 *   WARMING
 *      ↓
 *   READY
 *      ├──────────────→ DEGRADED
 *      │                   │
 *      └───────────────────┘
 *      ↓
 *   STOPPING
 *      ↓
 *   STOPPED
 *
 * Fatal startup failures:
 *
 *   INITIALIZING / WARMING
 *          ↓
 *        FAILED
 *
 * IMPORTANT:
 *
 *   Readiness is NOT liveness.
 *
 *   Liveness answers:
 *       "Is this process alive?"
 *
 *   Readiness answers:
 *       "Can this instance safely receive production traffic?"
 *
 *   A dependency failure may therefore cause:
 *
 *       READY → DEGRADED
 *
 *   or:
 *
 *       READY → NOT_READY
 *
 *   without killing the Node.js process.
 *
 * =============================================================================
 */

const {
  EventEmitter,
} = require('node:events');

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const STATES = Object.freeze({
  CREATED: 'created',

  INITIALIZING: 'initializing',

  WARMING: 'warming',

  READY: 'ready',

  DEGRADED: 'degraded',

  NOT_READY: 'not_ready',

  STOPPING: 'stopping',

  STOPPED: 'stopped',

  FAILED: 'failed',
});

const DEPENDENCY_STATES = Object.freeze({
  UNKNOWN: 'unknown',

  INITIALIZING: 'initializing',

  HEALTHY: 'healthy',

  DEGRADED: 'degraded',

  UNHEALTHY: 'unhealthy',

  DISABLED: 'disabled',

  STOPPED: 'stopped',

  FAILED: 'failed',
});

const SEVERITIES = Object.freeze({
  CRITICAL: 'critical',

  REQUIRED: 'required',

  OPTIONAL: 'optional',
});

const DEFAULTS = Object.freeze({
  startupGracePeriodMs: 10_000,

  readinessStabilizationMs: 1_000,

  checkTimeoutMs: 5_000,

  maxFailureCount: 3,

  failureWindowMs: 30_000,

  requireCriticalDependencies: true,

  requireRequiredDependencies: true,

  allowOptionalDegradation: true,

  failClosedDuringStartup: true,

  failClosedDuringShutdown: true,
});

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class ReadinessStateError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'ReadinessStateError';

    this.code =
      options.code ||
      'READINESS_STATE_ERROR';

    this.dependency =
      options.dependency ||
      null;

    this.state =
      options.state ||
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
      ReadinessStateError,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Utility Functions
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

function normalizeSeverity(
  value,
) {
  const severity =
    String(
      value ||
        SEVERITIES.REQUIRED,
    )
      .trim()
      .toLowerCase();

  if (
    !Object.values(
      SEVERITIES,
    ).includes(severity)
  ) {
    throw new TypeError(
      `Unsupported readiness severity "${severity}".`,
    );
  }

  return severity;
}

function normalizePositiveInteger(
  value,
  fallback,
  field,
) {
  const resolved =
    value === undefined
      ? fallback
      : value;

  if (
    !Number.isInteger(
      resolved,
    ) ||
    resolved <= 0
  ) {
    throw new TypeError(
      `${field} must be a positive integer.`,
    );
  }

  return resolved;
}

function normalizeNonNegativeInteger(
  value,
  fallback,
  field,
) {
  const resolved =
    value === undefined
      ? fallback
      : value;

  if (
    !Number.isInteger(
      resolved,
    ) ||
    resolved < 0
  ) {
    throw new TypeError(
      `${field} must be a non-negative integer.`,
    );
  }

  return resolved;
}

function safeError(
  error,
) {
  if (!error) {
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

function now() {
  return new Date();
}

/**
 * -----------------------------------------------------------------------------
 * Timeout Helper
 * -----------------------------------------------------------------------------
 */

async function withTimeout(
  fn,
  timeoutMs,
  dependency,
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
                new ReadinessStateError(
                  `Readiness check for "${dependency}" timed out after ${timeoutMs}ms.`,
                  {
                    code:
                      'READINESS_CHECK_TIMEOUT',

                    dependency,
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
    clearTimeout(timer);
  }
}

/**
 * =============================================================================
 * Readiness State Manager
 * =============================================================================
 */

class ReadinessState extends EventEmitter {
  constructor(
    options = {},
  ) {
    super();

    this.options =
      Object.freeze({
        startupGracePeriodMs:
          normalizeNonNegativeInteger(
            options.startupGracePeriodMs,
            DEFAULTS.startupGracePeriodMs,
            'startupGracePeriodMs',
          ),

        readinessStabilizationMs:
          normalizeNonNegativeInteger(
            options.readinessStabilizationMs,
            DEFAULTS.readinessStabilizationMs,
            'readinessStabilizationMs',
          ),

        checkTimeoutMs:
          normalizePositiveInteger(
            options.checkTimeoutMs,
            DEFAULTS.checkTimeoutMs,
            'checkTimeoutMs',
          ),

        maxFailureCount:
          normalizePositiveInteger(
            options.maxFailureCount,
            DEFAULTS.maxFailureCount,
            'maxFailureCount',
          ),

        failureWindowMs:
          normalizePositiveInteger(
            options.failureWindowMs,
            DEFAULTS.failureWindowMs,
            'failureWindowMs',
          ),

        requireCriticalDependencies:
          options.requireCriticalDependencies ??
          DEFAULTS.requireCriticalDependencies,

        requireRequiredDependencies:
          options.requireRequiredDependencies ??
          DEFAULTS.requireRequiredDependencies,

        allowOptionalDegradation:
          options.allowOptionalDegradation ??
          DEFAULTS.allowOptionalDegradation,

        failClosedDuringStartup:
          options.failClosedDuringStartup ??
          DEFAULTS.failClosedDuringStartup,

        failClosedDuringShutdown:
          options.failClosedDuringShutdown ??
          DEFAULTS.failClosedDuringShutdown,
      });

    this.state =
      STATES.CREATED;

    this.previousState =
      null;

    this.stateChangedAt =
      now();

    this.createdAt =
      now();

    this.initializingAt =
      null;

    this.warmingAt =
      null;

    this.readyAt =
      null;

    this.degradedAt =
      null;

    this.stoppingAt =
      null;

    this.stoppedAt =
      null;

    this.failedAt =
      null;

    this.startupCompletedAt =
      null;

    this.shutdownReason =
      null;

    this.failure =
      null;

    this.dependencies =
      new Map();

    this.transitionHistory =
      [];

    this._startupGraceTimer =
      null;

    this._stabilizationTimer =
      null;

    this._checkPromise =
      null;

    this._transitionLock =
      false;
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency Registration
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
      this.dependencies.has(
        name,
      )
    ) {
      throw new ReadinessStateError(
        `Readiness dependency "${name}" is already registered.`,
        {
          code:
            'READINESS_DEPENDENCY_DUPLICATE',

          dependency:
            name,
        },
      );
    }

    const severity =
      normalizeSeverity(
        options.severity,
      );

    const dependency =
      {
        name,

        severity,

        critical:
          severity ===
          SEVERITIES.CRITICAL,

        required:
          severity ===
            SEVERITIES.CRITICAL ||
          severity ===
            SEVERITIES.REQUIRED,

        enabled:
          options.enabled !== false,

        ready:
          false,

        state:
          options.enabled === false
            ? DEPENDENCY_STATES.DISABLED
            : DEPENDENCY_STATES.UNKNOWN,

        health:
          typeof options.health ===
          'function'
            ? options.health
            : null,

        readiness:
          typeof options.readiness ===
          'function'
            ? options.readiness
            : null,

        timeoutMs:
          normalizePositiveInteger(
            options.timeoutMs,
            this.options.checkTimeoutMs,
            `dependency "${name}" timeout`,
          ),

        metadata:
          Object.freeze({
            ...(options.metadata || {}),
          }),

        failureCount:
          0,

        failureTimestamps:
          [],

        lastCheckedAt:
          null,

        lastHealthyAt:
          null,

        lastUnhealthyAt:
          null,

        lastDurationMs:
          null,

        lastError:
          null,

        registeredAt:
          now(),
      };

    this.dependencies.set(
      name,
      dependency,
    );

    this.emit(
      'dependencyRegistered',
      this._dependencySnapshot(
        dependency,
      ),
    );

    return dependency;
  }

  unregister(
    name,
  ) {
    const normalized =
      normalizeName(name);

    if (
      !this.dependencies.has(
        normalized,
      )
    ) {
      return false;
    }

    this.dependencies.delete(
      normalized,
    );

    this.emit(
      'dependencyUnregistered',
      {
        name:
          normalized,
      },
    );

    if (
      this.isReady() ||
      this.isDegraded()
    ) {
      void this.evaluate();
    }

    return true;
  }

  has(
    name,
  ) {
    return this.dependencies.has(
      name,
    );
  }

  get(
    name,
  ) {
    return (
      this.dependencies.get(
        name,
      ) ||
      null
    );
  }

  list() {
    return [
      ...this.dependencies.values(),
    ];
  }

  /**
   * ---------------------------------------------------------------------------
   * State Transitions
   * ---------------------------------------------------------------------------
   */

  transition(
    nextState,
    metadata = {},
  ) {
    if (
      !Object.values(
        STATES,
      ).includes(
        nextState,
      )
    ) {
      throw new ReadinessStateError(
        `Unsupported readiness state "${nextState}".`,
        {
          code:
            'READINESS_INVALID_STATE',
        },
      );
    }

    if (
      this.state ===
      nextState
    ) {
      return this.state;
    }

    const previous =
      this.state;

    this.previousState =
      previous;

    this.state =
      nextState;

    this.stateChangedAt =
      now();

    this._recordTransition(
      previous,
      nextState,
      metadata,
    );

    this._updateStateTimestamp(
      nextState,
    );

    this.emit(
      'stateChanged',
      {
        previousState:
          previous,

        state:
          nextState,

        timestamp:
          this.stateChangedAt,

        metadata: {
          ...metadata,
        },
      },
    );

    return this.state;
  }

  _recordTransition(
    previousState,
    state,
    metadata = {},
  ) {
    this.transitionHistory.push(
      {
        previousState,

        state,

        timestamp:
          new Date(
            this.stateChangedAt,
          ).toISOString(),

        metadata: {
          ...metadata,
        },
      },
    );

    if (
      this.transitionHistory.length >
      500
    ) {
      this.transitionHistory.shift();
    }
  }

  _updateStateTimestamp(
    state,
  ) {
    const timestamp =
      now();

    switch (state) {
      case STATES.INITIALIZING:
        this.initializingAt =
          timestamp;

        break;

      case STATES.WARMING:
        this.warmingAt =
          timestamp;

        break;

      case STATES.READY:
        this.readyAt =
          timestamp;

        this.startupCompletedAt =
          timestamp;

        break;

      case STATES.DEGRADED:
        this.degradedAt =
          timestamp;

        break;

      case STATES.STOPPING:
        this.stoppingAt =
          timestamp;

        break;

      case STATES.STOPPED:
        this.stoppedAt =
          timestamp;

        break;

      case STATES.FAILED:
        this.failedAt =
          timestamp;

        break;

      default:
        break;
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Lifecycle State Helpers
   * ---------------------------------------------------------------------------
   */

  beginInitialization(
    metadata = {},
  ) {
    if (
      this.state ===
      STATES.STOPPING
    ) {
      throw new ReadinessStateError(
        'Cannot initialize readiness state while shutdown is in progress.',
        {
          code:
            'READINESS_INITIALIZE_DURING_SHUTDOWN',
        },
      );
    }

    if (
      this.state ===
      STATES.STOPPED
    ) {
      throw new ReadinessStateError(
        'Cannot initialize readiness state after it has stopped.',
        {
          code:
            'READINESS_ALREADY_STOPPED',
        },
      );
    }

    this.failure =
      null;

    this.transition(
      STATES.INITIALIZING,
      metadata,
    );

    return this;
  }

  beginWarming(
    metadata = {},
  ) {
    if (
      this.state !==
        STATES.INITIALIZING &&
      this.state !==
        STATES.WARMING
    ) {
      throw new ReadinessStateError(
        `Cannot enter warming state from "${this.state}".`,
        {
          code:
            'READINESS_INVALID_WARMING_TRANSITION',
        },
      );
    }

    this.transition(
      STATES.WARMING,
      metadata,
    );

    this._startGracePeriod();

    return this;
  }

  /**
   * ---------------------------------------------------------------------------
   * Startup Grace Period
   * ---------------------------------------------------------------------------
   */

  _startGracePeriod() {
    if (
      this._startupGraceTimer
    ) {
      clearTimeout(
        this._startupGraceTimer,
      );
    }

    if (
      this.options
        .startupGracePeriodMs <= 0
    ) {
      return;
    }

    this._startupGraceTimer =
      setTimeout(
        () => {
          this._startupGraceTimer =
            null;

          void this.evaluate();
        },
        this.options
          .startupGracePeriodMs,
      );

    this._startupGraceTimer.unref?.();
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency Checks
   * ---------------------------------------------------------------------------
   */

  async check(
    name,
  ) {
    const dependency =
      this.dependencies.get(
        name,
      );

    if (!dependency) {
      throw new ReadinessStateError(
        `Unknown readiness dependency "${name}".`,
        {
          code:
            'READINESS_DEPENDENCY_NOT_FOUND',

          dependency:
            name,
        },
      );
    }

    if (
      !dependency.enabled
    ) {
      dependency.state =
        DEPENDENCY_STATES.DISABLED;

      dependency.ready =
        false;

      return this._dependencySnapshot(
        dependency,
      );
    }

    const started =
      process.hrtime.bigint();

    dependency.state =
      DEPENDENCY_STATES.INITIALIZING;

    dependency.lastCheckedAt =
      now();

    dependency.lastError =
      null;

    try {
      let result =
        true;

      if (
        dependency.readiness
      ) {
        result =
          await withTimeout(
            () =>
              dependency.readiness({
                dependency:
                  this._dependencySnapshot(
                    dependency,
                  ),

                readiness:
                  this,
              }),
            dependency.timeoutMs,
            dependency.name,
          );
      } else if (
        dependency.health
      ) {
        result =
          await withTimeout(
            () =>
              dependency.health({
                dependency:
                  this._dependencySnapshot(
                    dependency,
                  ),

                readiness:
                  this,
              }),
            dependency.timeoutMs,
            dependency.name,
          );
      }

      const normalized =
        this._normalizeCheckResult(
          result,
        );

      dependency.lastDurationMs =
        Number(
          process.hrtime.bigint() -
            started,
        ) /
        1_000_000;

      if (
        normalized.ready
      ) {
        dependency.ready =
          true;

        dependency.state =
          normalized.degraded
            ? DEPENDENCY_STATES.DEGRADED
            : DEPENDENCY_STATES.HEALTHY;

        dependency.lastHealthyAt =
          now();

        dependency.lastError =
          null;

        dependency.failureCount =
          0;

        dependency.failureTimestamps =
          [];
      } else {
        this._recordDependencyFailure(
          dependency,
          normalized.error,
        );
      }

      this.emit(
        'dependencyChecked',
        this._dependencySnapshot(
          dependency,
        ),
      );

      return this._dependencySnapshot(
        dependency,
      );
    } catch (error) {
      dependency.lastDurationMs =
        Number(
          process.hrtime.bigint() -
            started,
        ) /
        1_000_000;

      this._recordDependencyFailure(
        dependency,
        error,
      );

      this.emit(
        'dependencyChecked',
        this._dependencySnapshot(
          dependency,
        ),
      );

      return this._dependencySnapshot(
        dependency,
      );
    }
  }

  async checkAll() {
    const dependencies =
      this.list();

    const results =
      await Promise.all(
        dependencies.map(
          dependency =>
            this.check(
              dependency.name,
            ),
        ),
      );

    return results;
  }

  _normalizeCheckResult(
    result,
  ) {
    if (
      typeof result ===
      'boolean'
    ) {
      return {
        ready:
          result,

        degraded:
          false,

        error:
          result
            ? null
            : new ReadinessStateError(
                'Dependency readiness check returned false.',
                {
                  code:
                    'DEPENDENCY_NOT_READY',
                },
              ),
      };
    }

    if (
      result === null ||
      result === undefined
    ) {
      return {
        ready:
          true,

        degraded:
          false,

        error:
          null,
      };
    }

    if (
      typeof result ===
      'object'
    ) {
      const ready =
        result.ready !== false &&
        result.status !==
          'unhealthy' &&
        result.status !==
          'not_ready' &&
        result.healthy !==
          false;

      const degraded =
        result.degraded ===
        true ||
        result.status ===
          'degraded';

      return {
        ready,

        degraded,

        error:
          ready
            ? null
            : (
                result.error ||
                new ReadinessStateError(
                  'Dependency reported an unhealthy readiness state.',
                  {
                    code:
                      'DEPENDENCY_UNHEALTHY',
                  },
                )
              ),
      };
    }

    return {
      ready:
        Boolean(result),

      degraded:
        false,

      error:
        result
          ? null
          : new ReadinessStateError(
              'Dependency readiness check failed.',
              {
                code:
                  'DEPENDENCY_NOT_READY',
              },
            ),
    };
  }

  _recordDependencyFailure(
    dependency,
    error,
  ) {
    const timestamp =
      Date.now();

    const cutoff =
      timestamp -
      this.options
        .failureWindowMs;

    dependency.failureTimestamps =
      dependency.failureTimestamps.filter(
        value =>
          value >= cutoff,
      );

    dependency.failureTimestamps.push(
      timestamp,
    );

    dependency.failureCount =
      dependency.failureTimestamps.length;

    dependency.lastUnhealthyAt =
      now();

    dependency.lastError =
      safeError(
        error,
      );

    dependency.ready =
      false;

    if (
      dependency.critical
    ) {
      dependency.state =
        DEPENDENCY_STATES.FAILED;
    } else if (
      dependency.required
    ) {
      dependency.state =
        DEPENDENCY_STATES.UNHEALTHY;
    } else {
      dependency.state =
        DEPENDENCY_STATES.DEGRADED;
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness Evaluation
   * ---------------------------------------------------------------------------
   */

  async evaluate(
    options = {},
  ) {
    if (
      this._checkPromise
    ) {
      return this._checkPromise;
    }

    this._checkPromise =
      this._evaluate(
        options,
      );

    try {
      return await this._checkPromise;
    } finally {
      this._checkPromise =
        null;
    }
  }

  async _evaluate(
    options = {},
  ) {
    if (
      this.state ===
        STATES.STOPPING ||
      this.state ===
        STATES.STOPPED
    ) {
      return this.snapshot();
    }

    if (
      this.state ===
        STATES.FAILED &&
      !options.allowRecovery
    ) {
      return this.snapshot();
    }

    if (
      this.state ===
      STATES.CREATED
    ) {
      if (
        this.options
          .failClosedDuringStartup
      ) {
        this.transition(
          STATES.NOT_READY,
          {
            reason:
              'not_initialized',
          },
        );
      }

      return this.snapshot();
    }

    await this.checkAll();

    const evaluation =
      this._evaluateDependencies();

    if (
      evaluation.criticalFailure
    ) {
      this.failure =
        evaluation.error;

      this.transition(
        STATES.NOT_READY,
        {
          reason:
            'critical_dependency_failure',

          failures:
            evaluation.failures,
        },
      );

      this.emit(
        'notReady',
        evaluation,
      );

      return this.snapshot();
    }

    if (
      evaluation.requiredFailure
    ) {
      this.failure =
        evaluation.error;

      this.transition(
        STATES.NOT_READY,
        {
          reason:
            'required_dependency_failure',

          failures:
            evaluation.failures,
        },
      );

      this.emit(
        'notReady',
        evaluation,
      );

      return this.snapshot();
    }

    if (
      evaluation.optionalDegradation &&
      this.options
        .allowOptionalDegradation
    ) {
      this.transition(
        STATES.DEGRADED,
        {
          reason:
            'optional_dependency_degradation',

          failures:
            evaluation.failures,
        },
      );

      this.emit(
        'degraded',
        evaluation,
      );

      return this.snapshot();
    }

    /**
     * No dependency failures.
     *
     * During startup we use a stabilization window so an instance does not
     * immediately enter READY while infrastructure is still flapping.
     */
    if (
      this.state ===
        STATES.INITIALIZING ||
      this.state ===
        STATES.WARMING ||
      this.state ===
        STATES.NOT_READY
    ) {
      return this._stabilizeReadiness();
    }

    if (
      this.state ===
      STATES.DEGRADED
    ) {
      this.transition(
        STATES.READY,
        {
          reason:
            'dependencies_recovered',
        },
      );

      this.emit(
        'ready',
        this.snapshot(),
      );

      return this.snapshot();
    }

    return this.snapshot();
  }

  _evaluateDependencies() {
    const failures = [];

    let criticalFailure =
      false;

    let requiredFailure =
      false;

    let optionalDegradation =
      false;

    for (
      const dependency of
        this.dependencies.values()
    ) {
      if (
        !dependency.enabled
      ) {
        continue;
      }

      const unhealthy =
        !dependency.ready ||
        dependency.state ===
          DEPENDENCY_STATES.UNHEALTHY ||
        dependency.state ===
          DEPENDENCY_STATES.FAILED;

      if (
        !unhealthy
      ) {
        if (
          dependency.state ===
          DEPENDENCY_STATES.DEGRADED
        ) {
          optionalDegradation =
            true;
        }

        continue;
      }

      const failure =
        this._dependencySnapshot(
          dependency,
        );

      failures.push(
        failure,
      );

      if (
        dependency.critical
      ) {
        criticalFailure =
          true;
      } else if (
        dependency.required
      ) {
        requiredFailure =
          true;
      } else {
        optionalDegradation =
          true;
      }
    }

    let error =
      null;

    if (
      failures.length > 0
    ) {
      error =
        new ReadinessStateError(
          'One or more readiness dependencies are unavailable.',
          {
            code:
              'READINESS_DEPENDENCY_FAILURE',
            details: {
              failures,
            },
          },
        );
    }

    return {
      criticalFailure,

      requiredFailure,

      optionalDegradation,

      failures,

      error,
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * Readiness Stabilization
   * ---------------------------------------------------------------------------
   */

  _stabilizeReadiness() {
    if (
      this.options
        .readinessStabilizationMs <=
      0
    ) {
      this.transition(
        STATES.READY,
        {
          reason:
            'dependencies_healthy',
        },
      );

      this.emit(
        'ready',
        this.snapshot(),
      );

      return this.snapshot();
    }

    if (
      this._stabilizationTimer
    ) {
      return this.snapshot();
    }

    this.transition(
      STATES.WARMING,
      {
        reason:
          'stabilizing',
      },
    );

    this._stabilizationTimer =
      setTimeout(
        () => {
          this._stabilizationTimer =
            null;

          void this.evaluate({
            allowRecovery:
              true,
          });
        },
        this.options
          .readinessStabilizationMs,
      );

    this._stabilizationTimer.unref?.();

    return this.snapshot();
  }

  /**
   * ---------------------------------------------------------------------------
   * Explicit Ready
   * ---------------------------------------------------------------------------
   */

  markReady(
    metadata = {},
  ) {
    if (
      this.state ===
        STATES.STOPPING ||
      this.state ===
        STATES.STOPPED
    ) {
      throw new ReadinessStateError(
        'Cannot mark the application ready after shutdown has started.',
        {
          code:
            'READINESS_READY_AFTER_STOP',
        },
      );
    }

    this.failure =
      null;

    this.transition(
      STATES.READY,
      metadata,
    );

    this.emit(
      'ready',
      this.snapshot(),
    );

    return this.snapshot();
  }

  /**
   * ---------------------------------------------------------------------------
   * Explicit Degradation
   * ---------------------------------------------------------------------------
   */

  markDegraded(
    reason =
      'manual-degradation',
    metadata = {},
  ) {
    if (
      this.state ===
      STATES.STOPPED
    ) {
      throw new ReadinessStateError(
        'Cannot degrade a stopped application.',
        {
          code:
            'READINESS_DEGRADE_AFTER_STOP',
        },
      );
    }

    this.transition(
      STATES.DEGRADED,
      {
        reason,
        ...metadata,
      },
    );

    this.emit(
      'degraded',
      this.snapshot(),
    );

    return this.snapshot();
  }

  /**
   * ---------------------------------------------------------------------------
   * Explicit Not Ready
   * ---------------------------------------------------------------------------
   */

  markNotReady(
    reason =
      'manual-not-ready',
    metadata = {},
  ) {
    this.transition(
      STATES.NOT_READY,
      {
        reason,
        ...metadata,
      },
    );

    this.emit(
      'notReady',
      this.snapshot(),
    );

    return this.snapshot();
  }

  /**
   * ---------------------------------------------------------------------------
   * Failure
   * ---------------------------------------------------------------------------
   */

  markFailed(
    error,
    metadata = {},
  ) {
    this.failure =
      error instanceof Error
        ? error
        : new Error(
            String(error),
          );

    this.transition(
      STATES.FAILED,
      {
        ...metadata,

        error:
          safeError(
            this.failure,
          ),
      },
    );

    this.emit(
      'failed',
      {
        error:
          safeError(
            this.failure,
          ),

        snapshot:
          this.snapshot(),
      },
    );

    return this.snapshot();
  }

  /**
   * ---------------------------------------------------------------------------
   * Shutdown
   * ---------------------------------------------------------------------------
   */

  beginShutdown(
    reason =
      'application-shutdown',
  ) {
    this.shutdownReason =
      reason;

    this._clearTimers();

    this.transition(
      STATES.STOPPING,
      {
        reason,
      },
    );

    this.emit(
      'stopping',
      this.snapshot(),
    );

    return this.snapshot();
  }

  completeShutdown() {
    this._clearTimers();

    this.ready =
      false;

    this.transition(
      STATES.STOPPED,
      {
        reason:
          this.shutdownReason,
      },
    );

    this.emit(
      'stopped',
      this.snapshot(),
    );

    return this.snapshot();
  }

  /**
   * ---------------------------------------------------------------------------
   * Predicates
   * ---------------------------------------------------------------------------
   */

  isAlive() {
    return (
      this.state !==
      STATES.STOPPED
    );
  }

  isReady() {
    return (
      this.state ===
      STATES.READY
    );
  }

  isDegraded() {
    return (
      this.state ===
      STATES.DEGRADED
    );
  }

  isNotReady() {
    return (
      this.state ===
      STATES.NOT_READY
    );
  }

  isStopping() {
    return (
      this.state ===
      STATES.STOPPING
    );
  }

  isStopped() {
    return (
      this.state ===
      STATES.STOPPED
    );
  }

  isFailed() {
    return (
      this.state ===
      STATES.FAILED
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Operational Health
   * ---------------------------------------------------------------------------
   */

  async health() {
    const evaluation =
      await this.evaluate({
        allowRecovery:
          true,
      });

    const critical =
      this.list().filter(
        dependency =>
          dependency.critical,
      );

    const required =
      this.list().filter(
        dependency =>
          dependency.required &&
          !dependency.critical,
      );

    const optional =
      this.list().filter(
        dependency =>
          !dependency.required,
      );

    return {
      status:
        this.isReady()
          ? 'healthy'
          : this.isDegraded()
            ? 'degraded'
            : 'unhealthy',

      ready:
        this.isReady(),

      state:
        this.state,

      service:
        'titech-backend',

      timestamp:
        new Date().toISOString(),

      dependencies: {
        total:
          this.dependencies.size,

        healthy:
          this.list().filter(
            dependency =>
              dependency.ready,
          ).length,

        critical:
          {
            total:
              critical.length,

            healthy:
              critical.filter(
                dependency =>
                  dependency.ready,
              ).length,
          },

        required:
          {
            total:
              required.length,

            healthy:
              required.filter(
                dependency =>
                  dependency.ready,
              ).length,
          },

        optional:
          {
            total:
              optional.length,

            healthy:
              optional.filter(
                dependency =>
                  dependency.ready,
              ).length,
          },
      },

      evaluation:
        {
          failures:
            evaluation.failures,
        },
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency Snapshot
   * ---------------------------------------------------------------------------
   */

  _dependencySnapshot(
    dependency,
  ) {
    return {
      name:
        dependency.name,

      severity:
        dependency.severity,

      critical:
        dependency.critical,

      required:
        dependency.required,

      enabled:
        dependency.enabled,

      ready:
        dependency.ready,

      state:
        dependency.state,

      failureCount:
        dependency.failureCount,

      lastCheckedAt:
        dependency.lastCheckedAt,

      lastHealthyAt:
        dependency.lastHealthyAt,

      lastUnhealthyAt:
        dependency.lastUnhealthyAt,

      lastDurationMs:
        dependency.lastDurationMs,

      lastError:
        dependency.lastError,

      metadata:
        dependency.metadata,
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * Snapshot
   * ---------------------------------------------------------------------------
   */

  snapshot() {
    return Object.freeze({
      state:
        this.state,

      previousState:
        this.previousState,

      ready:
        this.isReady(),

      degraded:
        this.isDegraded(),

      alive:
        this.isAlive(),

      stopping:
        this.isStopping(),

      stopped:
        this.isStopped(),

      failed:
        this.isFailed(),

      createdAt:
        this.createdAt,

      initializingAt:
        this.initializingAt,

      warmingAt:
        this.warmingAt,

      readyAt:
        this.readyAt,

      degradedAt:
        this.degradedAt,

      stoppingAt:
        this.stoppingAt,

      stoppedAt:
        this.stoppedAt,

      failedAt:
        this.failedAt,

      startupCompletedAt:
        this.startupCompletedAt,

      stateChangedAt:
        this.stateChangedAt,

      shutdownReason:
        this.shutdownReason,

      failure:
        safeError(
          this.failure,
        ),

      dependencies:
        Object.freeze(
          Object.fromEntries(
            [...this.dependencies.entries()]
              .map(
                ([
                  name,
                  dependency,
                ]) => [
                  name,
                  this._dependencySnapshot(
                    dependency,
                  ),
                ],
              ),
          ),
        ),

      transitionHistory:
        Object.freeze(
          this.transitionHistory.map(
            item => ({
              ...item,
            }),
          ),
        ),

      options:
        Object.freeze({
          ...this.options,
        }),
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Timer Cleanup
   * ---------------------------------------------------------------------------
   */

  _clearTimers() {
    if (
      this._startupGraceTimer
    ) {
      clearTimeout(
        this._startupGraceTimer,
      );

      this._startupGraceTimer =
        null;
    }

    if (
      this._stabilizationTimer
    ) {
      clearTimeout(
        this._stabilizationTimer,
      );

      this._stabilizationTimer =
        null;
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Reset
   * ---------------------------------------------------------------------------
   *
   * Intended for tests/process isolation.
   */

  reset() {
    if (
      this.state ===
        STATES.STOPPING ||
      this.state ===
        STATES.INITIALIZING ||
      this.state ===
        STATES.WARMING
    ) {
      throw new ReadinessStateError(
        'Cannot reset readiness state while lifecycle execution is active.',
        {
          code:
            'READINESS_RESET_NOT_ALLOWED',

          state:
            this.state,
        },
      );
    }

    this._clearTimers();

    for (
      const dependency of
        this.dependencies.values()
    ) {
      dependency.ready =
        dependency.enabled ===
          false;

      dependency.state =
        dependency.enabled ===
        false
          ? DEPENDENCY_STATES
              .DISABLED
          : DEPENDENCY_STATES
              .UNKNOWN;

      dependency.failureCount =
        0;

      dependency.failureTimestamps =
        [];

      dependency.lastCheckedAt =
        null;

      dependency.lastHealthyAt =
        null;

      dependency.lastUnhealthyAt =
        null;

      dependency.lastDurationMs =
        null;

      dependency.lastError =
        null;
    }

    this.state =
      STATES.CREATED;

    this.previousState =
      null;

    this.stateChangedAt =
      now();

    this.initializingAt =
      null;

    this.warmingAt =
      null;

    this.readyAt =
      null;

    this.degradedAt =
      null;

    this.stoppingAt =
      null;

    this.stoppedAt =
      null;

    this.failedAt =
      null;

    this.startupCompletedAt =
      null;

    this.shutdownReason =
      null;

    this.failure =
      null;

    this.transitionHistory =
      [];

    return this;
  }
}

/**
 * =============================================================================
 * Default TITech Readiness Singleton
 * =============================================================================
 */

const readinessState =
  new ReadinessState();

/**
 * -----------------------------------------------------------------------------
 * Convenience API
 * -----------------------------------------------------------------------------
 */

function register(
  options,
) {
  return readinessState.register(
    options,
  );
}

function unregister(
  name,
) {
  return readinessState.unregister(
    name,
  );
}

function has(
  name,
) {
  return readinessState.has(
    name,
  );
}

function get(
  name,
) {
  return readinessState.get(
    name,
  );
}

function list() {
  return readinessState.list();
}

function beginInitialization(
  metadata,
) {
  return readinessState.beginInitialization(
    metadata,
  );
}

function beginWarming(
  metadata,
) {
  return readinessState.beginWarming(
    metadata,
  );
}

async function check(
  name,
) {
  return readinessState.check(
    name,
  );
}

async function checkAll() {
  return readinessState.checkAll();
}

async function evaluate(
  options,
) {
  return readinessState.evaluate(
    options,
  );
}

function markReady(
  metadata,
) {
  return readinessState.markReady(
    metadata,
  );
}

function markDegraded(
  reason,
  metadata,
) {
  return readinessState.markDegraded(
    reason,
    metadata,
  );
}

function markNotReady(
  reason,
  metadata,
) {
  return readinessState.markNotReady(
    reason,
    metadata,
  );
}

function markFailed(
  error,
  metadata,
) {
  return readinessState.markFailed(
    error,
    metadata,
  );
}

function beginShutdown(
  reason,
) {
  return readinessState.beginShutdown(
    reason,
  );
}

function completeShutdown() {
  return readinessState.completeShutdown();
}

function isAlive() {
  return readinessState.isAlive();
}

function isReady() {
  return readinessState.isReady();
}

function isDegraded() {
  return readinessState.isDegraded();
}

function isNotReady() {
  return readinessState.isNotReady();
}

function isStopping() {
  return readinessState.isStopping();
}

function isStopped() {
  return readinessState.isStopped();
}

function isFailed() {
  return readinessState.isFailed();
}

async function health() {
  return readinessState.health();
}

function snapshot() {
  return readinessState.snapshot();
}

function reset() {
  return readinessState.reset();
}

/**
 * =============================================================================
 * Bootstrap Lifecycle Integration
 * =============================================================================
 *
 * This adapter allows bootstrap/lifecycle.js and bootstrap/lifecycleManager.js
 * to use readinessState as the authoritative readiness source.
 */

function registerBootstrapHooks(
  context = {},
  options = {},
) {
  const {
    lifecycle,
  } = require('./hooks');

  if (
    require('./hooks').hooks.has(
      'readiness',
    )
  ) {
    return require('./hooks').hooks.get(
      'readiness',
    );
  }

  return lifecycle(
    'readiness',
    {
      priority:
        options.priority ??
        -700,

      dependencies:
        options.dependencies ||
        [
          'observability',
        ],

      critical:
        options.critical !== false,

      timeoutMs:
        options.timeoutMs ||
        30_000,

      start:
        async hookContext => {
          beginInitialization({
            source:
              'bootstrap',

            service:
              'titech-backend',
          });

          beginWarming({
            source:
              'bootstrap',
          });

          /**
           * Register any dependencies supplied by bootstrap context.
           *
           * Expected format:
           *
           *   context.readinessDependencies = [
           *     {
           *       name,
           *       severity,
           *       health,
           *       readiness
           *     }
           *   ]
           */
          const dependencies =
            hookContext
              ?.readinessDependencies;

          if (
            Array.isArray(
              dependencies,
            )
          ) {
            for (
              const dependency of
                dependencies
            ) {
              if (
                !has(
                  dependency.name,
                )
              ) {
                register(
                  dependency,
                );
              }
            }
          }

          await evaluate({
            allowRecovery:
              true,
          });

          hookContext.readiness =
            readinessState;

          return readinessState;
        },

      ready:
        async () => {
          return isReady();
        },

      health:
        async () => {
          return health();
        },

      stop:
        async hookContext => {
          beginShutdown(
            hookContext?.reason ||
              'bootstrap-shutdown',
          );

          completeShutdown();
        },

      metadata: {
        component:
          'readiness',

        service:
          'titech-backend',

        implementation:
          'backend/bootstrap/readinessState.js',
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
     * Core implementation.
     */
    ReadinessState,

    ReadinessStateError,

    STATES,

    DEPENDENCY_STATES,

    SEVERITIES,

    readinessState,

    /**
     * Dependency API.
     */
    register,
    unregister,
    has,
    get,
    list,

    /**
     * Lifecycle.
     */
    beginInitialization,
    beginWarming,

    check,
    checkAll,
    evaluate,

    markReady,
    markDegraded,
    markNotReady,
    markFailed,

    beginShutdown,
    completeShutdown,

    /**
     * Predicates.
     */
    isAlive,
    isReady,
    isDegraded,
    isNotReady,
    isStopping,
    isStopped,
    isFailed,

    /**
     * Operational.
     */
    health,
    snapshot,

    /**
     * Bootstrap integration.
     */
    registerBootstrapHooks,

    /**
     * Testing.
     */
    reset,
  });