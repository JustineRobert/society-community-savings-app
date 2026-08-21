'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/hooks.js
 *
 * Purpose:
 *   Enterprise application lifecycle hook registry and execution engine.
 *
 * Responsibilities:
 *   - Register application startup/shutdown hooks.
 *   - Execute hooks deterministically.
 *   - Support hook priorities and dependencies.
 *   - Prevent duplicate registration.
 *   - Prevent accidental double execution.
 *   - Apply execution timeouts.
 *   - Support startup rollback when initialization partially fails.
 *   - Execute shutdown hooks in reverse dependency order.
 *   - Track lifecycle state.
 *   - Provide controlled error handling.
 *   - Keep bootstrap orchestration centralized.
 *
 * Canonical Bootstrap Dependency:
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
 *   middleware
 *       ↓
 *   routes
 *       ↓
 *   HTTP server
 *
 * Lifecycle:
 *
 *   register()
 *      ↓
 *   initialize()
 *      ↓
 *   start()
 *      ↓
 *   running
 *      ↓
 *   shutdown()
 *      ↓
 *   stopped
 *
 * IMPORTANT:
 *   This module is intentionally infrastructure-only.
 *
 *   It does NOT:
 *     - create an Express application
 *     - create an HTTP server
 *     - connect to databases directly
 *     - initialize Redis directly
 *     - initialize queues directly
 *     - initialize Socket.IO directly
 *     - contain financial business logic
 *
 *   Subsystems register their lifecycle functions here.
 *
 * =============================================================================
 */

const crypto = require('node:crypto');

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const HOOK_PHASES = Object.freeze({
  STARTUP: 'startup',
  SHUTDOWN: 'shutdown',
});

const LIFECYCLE_STATES = Object.freeze({
  CREATED: 'created',
  INITIALIZING: 'initializing',
  READY: 'ready',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  FAILED: 'failed',
});

const DEFAULTS = Object.freeze({
  timeoutMs: 30_000,
  shutdownTimeoutMs: 30_000,
  continueOnError: false,
  rollbackOnFailure: true,
});

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class BootstrapHookError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'BootstrapHookError';

    this.code = options.code || 'BOOTSTRAP_HOOK_ERROR';

    this.hookId = options.hookId || null;

    this.phase = options.phase || null;

    this.cause = options.cause || null;

    this.details = Object.freeze({
      ...(options.details || {}),
    });

    Error.captureStackTrace?.(this, BootstrapHookError);
  }
}

class BootstrapHookTimeoutError extends BootstrapHookError {
  constructor(hook, timeoutMs) {
    super(
      `Bootstrap hook "${hook.name}" timed out after ${timeoutMs}ms.`,
      {
        code: 'BOOTSTRAP_HOOK_TIMEOUT',
        hookId: hook.id,
        phase: hook.phase,
        details: {
          timeoutMs,
        },
      },
    );

    this.timeoutMs = timeoutMs;
  }
}

class BootstrapDependencyError extends BootstrapHookError {
  constructor(message, details = {}) {
    super(message, {
      code: 'BOOTSTRAP_DEPENDENCY_ERROR',
      details,
    });
  }
}

/**
 * -----------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------
 */

function createId(name) {
  return crypto
    .createHash('sha256')
    .update(String(name))
    .digest('hex')
    .slice(0, 16);
}

function normalizeName(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Hook name must be a non-empty string.');
  }

  return value.trim();
}

function normalizeDependencies(dependencies) {
  if (dependencies === undefined || dependencies === null) {
    return [];
  }

  if (!Array.isArray(dependencies)) {
    throw new TypeError('Hook dependencies must be an array.');
  }

  return [
    ...new Set(
      dependencies
        .map((dependency) => normalizeName(dependency))
        .filter(Boolean),
    ),
  ];
}

function normalizePriority(priority) {
  if (priority === undefined || priority === null) {
    return 0;
  }

  if (!Number.isInteger(priority)) {
    throw new TypeError('Hook priority must be an integer.');
  }

  return priority;
}

function normalizeTimeout(timeoutMs, fallback) {
  const value = timeoutMs === undefined
    ? fallback
    : timeoutMs;

  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(
      'Hook timeout must be a positive integer.',
    );
  }

  return value;
}

function normalizeFunction(fn, name) {
  if (typeof fn !== 'function') {
    throw new TypeError(
      `Hook "${name}" must provide a function.`,
    );
  }

  return fn;
}

function isPromiseLike(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  ) || typeof value === 'function' && value.then;
}

/**
 * -----------------------------------------------------------------------------
 * Timeout Wrapper
 * -----------------------------------------------------------------------------
 */

async function executeWithTimeout(
  fn,
  {
    hook,
    context,
    timeoutMs,
  },
) {
  let timer;

  const operation = Promise.resolve().then(() => (
    fn(context)
  ));

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new BootstrapHookTimeoutError(
          hook,
          timeoutMs,
        ),
      );
    }, timeoutMs);

    timer.unref?.();
  });

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
 * -----------------------------------------------------------------------------
 * Hook Registry
 * -----------------------------------------------------------------------------
 */

class BootstrapHookRegistry {
  constructor(options = {}) {
    this.options = Object.freeze({
      timeoutMs: normalizeTimeout(
        options.timeoutMs,
        DEFAULTS.timeoutMs,
      ),

      shutdownTimeoutMs: normalizeTimeout(
        options.shutdownTimeoutMs,
        DEFAULTS.shutdownTimeoutMs,
      ),

      continueOnError:
        options.continueOnError ??
        DEFAULTS.continueOnError,

      rollbackOnFailure:
        options.rollbackOnFailure ??
        DEFAULTS.rollbackOnFailure,
    });

    this._hooks = new Map();

    this._state = LIFECYCLE_STATES.CREATED;

    this._startedHooks = [];

    this._shutdownStarted = false;

    this._initialized = false;

    this._started = false;

    this._stopped = false;

    this._initializationError = null;

    this._startupError = null;

    this._shutdownError = null;

    this._createdAt = new Date();

    this._startedAt = null;

    this._stoppedAt = null;
  }

  /**
   * ---------------------------------------------------------------------------
   * Hook Registration
   * ---------------------------------------------------------------------------
   */

  register(options = {}) {
    const name = normalizeName(options.name);

    const phase = options.phase || HOOK_PHASES.STARTUP;

    if (
      phase !== HOOK_PHASES.STARTUP &&
      phase !== HOOK_PHASES.SHUTDOWN
    ) {
      throw new TypeError(
        `Unsupported hook phase "${phase}".`,
      );
    }

    if (
      this._hooks.has(name)
    ) {
      throw new BootstrapHookError(
        `Bootstrap hook "${name}" is already registered.`,
        {
          code: 'BOOTSTRAP_HOOK_DUPLICATE',
          hookId: this._hooks.get(name).id,
          phase,
        },
      );
    }

    const startup = normalizeFunction(
      options.start,
      name,
    );

    const shutdown = options.stop === undefined
      ? null
      : normalizeFunction(
          options.stop,
          name,
        );

    const hook = Object.freeze({
      id: options.id
        ? normalizeName(options.id)
        : createId(name),

      name,

      phase,

      start: startup,

      stop: shutdown,

      priority: normalizePriority(
        options.priority,
      ),

      timeoutMs: normalizeTimeout(
        options.timeoutMs,
        phase === HOOK_PHASES.SHUTDOWN
          ? this.options.shutdownTimeoutMs
          : this.options.timeoutMs,
      ),

      dependencies: Object.freeze(
        normalizeDependencies(
          options.dependencies,
        ),
      ),

      critical:
        options.critical !== undefined
          ? Boolean(options.critical)
          : true,

      enabled:
        options.enabled !== undefined
          ? Boolean(options.enabled)
          : true,

      rollback:
        options.rollback !== undefined
          ? Boolean(options.rollback)
          : true,

      metadata: Object.freeze({
        ...(options.metadata || {}),
      }),

      registeredAt: new Date(),
    });

    this._hooks.set(name, hook);

    return hook;
  }

  /**
   * ---------------------------------------------------------------------------
   * Convenience Registration
   * ---------------------------------------------------------------------------
   */

  startup(name, start, options = {}) {
    return this.register({
      ...options,
      name,
      start,
      phase: HOOK_PHASES.STARTUP,
    });
  }

  shutdown(name, stop, options = {}) {
    return this.register({
      ...options,
      name,
      start: async () => undefined,
      stop,
      phase: HOOK_PHASES.SHUTDOWN,
    });
  }

  lifecycle(
    name,
    {
      start,
      stop,
      ...options
    },
  ) {
    return this.register({
      ...options,
      name,
      start,
      stop,
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Lookup
   * ---------------------------------------------------------------------------
   */

  get(name) {
    return this._hooks.get(name) || null;
  }

  has(name) {
    return this._hooks.has(name);
  }

  list({
    phase = undefined,
    includeDisabled = false,
  } = {}) {
    return [...this._hooks.values()]
      .filter((hook) => {
        if (
          phase !== undefined &&
          hook.phase !== phase
        ) {
          return false;
        }

        if (
          !includeDisabled &&
          !hook.enabled
        ) {
          return false;
        }

        return true;
      });
  }

  /**
   * ---------------------------------------------------------------------------
   * Dependency Resolution
   * ---------------------------------------------------------------------------
   *
   * Kahn-style topological sorting with priority as the deterministic
   * tie-breaker.
   */

  _resolveOrder(
    phase,
  ) {
    const hooks = this.list({
      phase,
      includeDisabled: false,
    });

    const hookMap = new Map(
      hooks.map((hook) => [
        hook.name,
        hook,
      ]),
    );

    const incoming = new Map();

    const outgoing = new Map();

    for (const hook of hooks) {
      incoming.set(
        hook.name,
        0,
      );

      outgoing.set(
        hook.name,
        new Set(),
      );
    }

    for (const hook of hooks) {
      for (
        const dependency of hook.dependencies
      ) {
        if (!hookMap.has(dependency)) {
          throw new BootstrapDependencyError(
            `Bootstrap hook "${hook.name}" depends on missing hook "${dependency}".`,
            {
              hook: hook.name,
              dependency,
              phase,
            },
          );
        }

        if (dependency === hook.name) {
          throw new BootstrapDependencyError(
            `Bootstrap hook "${hook.name}" cannot depend on itself.`,
            {
              hook: hook.name,
              phase,
            },
          );
        }

        incoming.set(
          hook.name,
          incoming.get(hook.name) + 1,
        );

        outgoing
          .get(dependency)
          .add(hook.name);
      }
    }

    const queue = hooks
      .filter(
        (hook) =>
          incoming.get(hook.name) === 0,
      )
      .sort(
        BootstrapHookRegistry.compareHooks,
      );

    const ordered = [];

    while (queue.length > 0) {
      const current = queue.shift();

      ordered.push(current);

      for (
        const dependent of outgoing
          .get(current.name)
      ) {
        const remaining =
          incoming.get(dependent) - 1;

        incoming.set(
          dependent,
          remaining,
        );

        if (remaining === 0) {
          queue.push(
            hookMap.get(dependent),
          );

          queue.sort(
            BootstrapHookRegistry.compareHooks,
          );
        }
      }
    }

    if (ordered.length !== hooks.length) {
      const cyclicHooks = hooks
        .filter(
          (hook) =>
            incoming.get(hook.name) > 0,
        )
        .map(
          (hook) => hook.name,
        );

      throw new BootstrapDependencyError(
        'A circular bootstrap hook dependency was detected.',
        {
          phase,
          hooks: cyclicHooks,
        },
      );
    }

    return ordered;
  }

  static compareHooks(a, b) {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    return a.name.localeCompare(
      b.name,
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * Execute One Hook
   * ---------------------------------------------------------------------------
   */

  async _executeHook(
    hook,
    {
      phase,
      context,
      throwOnError = true,
    },
  ) {
    const fn =
      phase === HOOK_PHASES.STARTUP
        ? hook.start
        : hook.stop;

    if (typeof fn !== 'function') {
      return {
        hook: hook.name,
        skipped: true,
        reason: 'no-handler',
      };
    }

    const startedAt = process.hrtime.bigint();

    try {
      const result =
        await executeWithTimeout(
          fn,
          {
            hook,
            context,
            timeoutMs: hook.timeoutMs,
          },
        );

      const finishedAt = process.hrtime.bigint();

      return {
        hook: hook.name,
        id: hook.id,
        phase,
        success: true,
        result,
        durationMs: Number(
          finishedAt - startedAt,
        ) / 1_000_000,
      };
    } catch (error) {
      const duration =
        Number(
          process.hrtime.bigint() -
          startedAt,
        ) / 1_000_000;

      const wrapped =
        error instanceof BootstrapHookError
          ? error
          : new BootstrapHookError(
              `Bootstrap hook "${hook.name}" failed.`,
              {
                code:
                  phase ===
                  HOOK_PHASES.STARTUP
                    ? 'BOOTSTRAP_STARTUP_FAILED'
                    : 'BOOTSTRAP_SHUTDOWN_FAILED',

                hookId: hook.id,

                phase,

                cause: error,

                details: {
                  durationMs: duration,
                },
              },
            );

      if (
        throwOnError &&
        (
          hook.critical ||
          !this.options.continueOnError
        )
      ) {
        throw wrapped;
      }

      return {
        hook: hook.name,
        id: hook.id,
        phase,
        success: false,
        error: wrapped,
        durationMs: duration,
      };
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Startup
   * ---------------------------------------------------------------------------
   */

  async initialize(context = {}) {
    if (
      this._initialized ||
      this._started
    ) {
      return this;
    }

    if (
      this._state ===
      LIFECYCLE_STATES.INITIALIZING
    ) {
      throw new BootstrapHookError(
        'Bootstrap initialization is already in progress.',
        {
          code:
            'BOOTSTRAP_INITIALIZATION_IN_PROGRESS',
        },
      );
    }

    this._state =
      LIFECYCLE_STATES.INITIALIZING;

    const executionContext =
      this._createContext(
        context,
        HOOK_PHASES.STARTUP,
      );

    try {
      const ordered =
        this._resolveOrder(
          HOOK_PHASES.STARTUP,
        );

      for (const hook of ordered) {
        const result =
          await this._executeHook(
            hook,
            {
              phase:
                HOOK_PHASES.STARTUP,

              context:
                executionContext,

              throwOnError:
                hook.critical,
            },
          );

        if (result.success) {
          this._startedHooks.push(
            hook,
          );
        }
      }

      this._initialized = true;

      this._state =
        LIFECYCLE_STATES.READY;

      return this;
    } catch (error) {
      this._initializationError =
        error;

      this._state =
        LIFECYCLE_STATES.FAILED;

      if (
        this.options.rollbackOnFailure
      ) {
        await this._rollback(
          executionContext,
        );
      }

      throw error;
    }
  }

  async start(context = {}) {
    if (
      this._started &&
      this._state ===
      LIFECYCLE_STATES.RUNNING
    ) {
      return this;
    }

    if (
      !this._initialized
    ) {
      await this.initialize(
        context,
      );
    }

    if (
      this._state ===
      LIFECYCLE_STATES.STARTING
    ) {
      throw new BootstrapHookError(
        'Bootstrap startup is already in progress.',
        {
          code:
            'BOOTSTRAP_START_IN_PROGRESS',
        },
      );
    }

    this._state =
      LIFECYCLE_STATES.STARTING;

    const executionContext =
      this._createContext(
        context,
        HOOK_PHASES.STARTUP,
      );

    try {
      this._started = true;

      this._startedAt =
        new Date();

      this._state =
        LIFECYCLE_STATES.RUNNING;

      return this;
    } catch (error) {
      this._startupError =
        error;

      this._state =
        LIFECYCLE_STATES.FAILED;

      await this._rollback(
        executionContext,
      );

      throw error;
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Rollback
   * ---------------------------------------------------------------------------
   *
   * Only shutdown handlers belonging to successfully initialized hooks are
   * invoked, in reverse startup order.
   */

  async _rollback(context = {}) {
    const hooks = [
      ...this._startedHooks,
    ].reverse();

    for (const hook of hooks) {
      if (
        !hook.rollback ||
        typeof hook.stop !== 'function'
      ) {
        continue;
      }

      try {
        await this._executeHook(
          hook,
          {
            phase:
              HOOK_PHASES.SHUTDOWN,

            context: this._createContext(
              context,
              HOOK_PHASES.SHUTDOWN,
            ),

            throwOnError: false,
          },
        );
      } catch {
        // Rollback is best effort.
        // The original initialization/startup error remains authoritative.
      }
    }

    this._startedHooks = [];
  }

  /**
   * ---------------------------------------------------------------------------
   * Shutdown
   * ---------------------------------------------------------------------------
   */

  async shutdown(context = {}) {
    if (
      this._shutdownStarted
    ) {
      return this;
    }

    this._shutdownStarted =
      true;

    if (
      this._state ===
      LIFECYCLE_STATES.STOPPED
    ) {
      return this;
    }

    this._state =
      LIFECYCLE_STATES.STOPPING;

    const executionContext =
      this._createContext(
        context,
        HOOK_PHASES.SHUTDOWN,
      );

    const errors = [];

    /**
     * Resolve shutdown dependencies.
     *
     * Startup:
     *   A → B → C
     *
     * Shutdown:
     *   C → B → A
     */
    let ordered;

    try {
      ordered =
        this._resolveOrder(
          HOOK_PHASES.SHUTDOWN,
        );
    } catch (error) {
      this._shutdownError =
        error;

      this._state =
        LIFECYCLE_STATES.FAILED;

      throw error;
    }

    const shutdownHooks = [
      ...ordered,
    ].reverse();

    /**
     * Prefer hooks that actually participated in startup.
     *
     * If a subsystem has a registered shutdown hook but never started,
     * executing it is usually unsafe.
     */
    const activeNames = new Set(
      this._startedHooks.map(
        (hook) => hook.name,
      ),
    );

    const candidates =
      shutdownHooks.filter(
        (hook) =>
          activeNames.size === 0 ||
          activeNames.has(hook.name),
      );

    for (const hook of candidates) {
      try {
        await this._executeHook(
          hook,
          {
            phase:
              HOOK_PHASES.SHUTDOWN,

            context:
              executionContext,

            throwOnError: false,
          },
        );
      } catch (error) {
        errors.push(error);

        if (
          hook.critical &&
          !this.options.continueOnError
        ) {
          /**
           * Continue shutdown even after critical cleanup errors.
           *
           * Stopping a financial backend should attempt best-effort cleanup
           * across every subsystem rather than abandoning remaining cleanup
           * after the first failure.
           */
          continue;
        }
      }
    }

    this._startedHooks = [];

    this._stopped = true;

    this._stoppedAt =
      new Date();

    if (errors.length > 0) {
      this._shutdownError =
        new BootstrapHookError(
          'One or more shutdown hooks failed.',
          {
            code:
              'BOOTSTRAP_SHUTDOWN_PARTIAL_FAILURE',

            details: {
              errorCount:
                errors.length,
            },
          },
        );

      this._state =
        LIFECYCLE_STATES.FAILED;

      return this;
    }

    this._state =
      LIFECYCLE_STATES.STOPPED;

    return this;
  }

  /**
   * ---------------------------------------------------------------------------
   * Lifecycle Context
   * ---------------------------------------------------------------------------
   */

  _createContext(
    context,
    phase,
  ) {
    return Object.freeze({
      ...context,

      lifecycle: Object.freeze({
        phase,

        state:
          this._state,

        timestamp:
          new Date(),

        hookCount:
          this._hooks.size,
      }),
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * State
   * ---------------------------------------------------------------------------
   */

  get state() {
    return this._state;
  }

  get initialized() {
    return this._initialized;
  }

  get started() {
    return this._started;
  }

  get stopped() {
    return this._stopped;
  }

  get initializationError() {
    return this._initializationError;
  }

  get startupError() {
    return this._startupError;
  }

  get shutdownError() {
    return this._shutdownError;
  }

  get startedAt() {
    return this._startedAt;
  }

  get stoppedAt() {
    return this._stoppedAt;
  }

  /**
   * ---------------------------------------------------------------------------
   * Diagnostics
   * ---------------------------------------------------------------------------
   */

  snapshot() {
    return Object.freeze({
      state:
        this._state,

      hookCount:
        this._hooks.size,

      startupHookCount:
        this.list({
          phase:
            HOOK_PHASES.STARTUP,
        }).length,

      shutdownHookCount:
        this.list({
          phase:
            HOOK_PHASES.SHUTDOWN,
        }).length,

      initialized:
        this._initialized,

      started:
        this._started,

      stopped:
        this._stopped,

      shutdownStarted:
        this._shutdownStarted,

      startedHooks:
        Object.freeze(
          this._startedHooks.map(
            (hook) => hook.name,
          ),
        ),

      createdAt:
        this._createdAt,

      startedAt:
        this._startedAt,

      stoppedAt:
        this._stoppedAt,

      initializationFailed:
        Boolean(
          this._initializationError,
        ),

      startupFailed:
        Boolean(
          this._startupError,
        ),

      shutdownFailed:
        Boolean(
          this._shutdownError,
        ),
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * Reset
   * ---------------------------------------------------------------------------
   *
   * Intended for controlled test environments only.
   */

  reset() {
    if (
      this._state ===
      LIFECYCLE_STATES.RUNNING
    ) {
      throw new BootstrapHookError(
        'Cannot reset a running bootstrap registry.',
        {
          code:
            'BOOTSTRAP_RESET_RUNNING',
        },
      );
    }

    this._hooks.clear();

    this._state =
      LIFECYCLE_STATES.CREATED;

    this._startedHooks = [];

    this._shutdownStarted = false;

    this._initialized = false;

    this._started = false;

    this._stopped = false;

    this._initializationError =
      null;

    this._startupError =
      null;

    this._shutdownError =
      null;

    this._startedAt =
      null;

    this._stoppedAt =
      null;

    return this;
  }
}

/**
 * -----------------------------------------------------------------------------
 * Default Registry
 * -----------------------------------------------------------------------------
 *
 * One process-wide registry is exported so subsystem bootstrap modules can
 * register lifecycle handlers without creating competing registries.
 */

const hooks =
  new BootstrapHookRegistry();

/**
 * -----------------------------------------------------------------------------
 * Signal Management
 * -----------------------------------------------------------------------------
 *
 * Signals are registered explicitly so applications can choose when they want
 * process lifecycle handling.
 */

let signalHandlersInstalled = false;

function installSignalHandlers({
  signals = [
    'SIGTERM',
    'SIGINT',
  ],

  context = {},

  exit = true,

  onShutdown = null,
} = {}) {
  if (signalHandlersInstalled) {
    return false;
  }

  signalHandlersInstalled = true;

  let shuttingDown = false;

  const handler = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    try {
      if (typeof onShutdown === 'function') {
        await onShutdown(
          signal,
          context,
        );
      }

      await hooks.shutdown({
        ...context,
        signal,
      });

      if (exit) {
        process.exitCode = 0;
      }
    } catch (error) {
      process.exitCode = 1;

      /**
       * Do not throw out of an async signal listener.
       *
       * The logger layer should normally report this error before this
       * bootstrap layer is initialized.
       */
      if (
        process.env.NODE_ENV !== 'test'
      ) {
        console.error(
          '[bootstrap] graceful shutdown failed:',
          error,
        );
      }
    }
  };

  for (const signal of signals) {
    process.once(
      signal,
      handler,
    );
  }

  return true;
}

/**
 * -----------------------------------------------------------------------------
 * Process Exception / Rejection Hooks
 * -----------------------------------------------------------------------------
 *
 * These are deliberately opt-in.
 *
 * Do not silently swallow uncaught exceptions or unhandled rejections.
 */

let processErrorHandlersInstalled =
  false;

function installProcessErrorHandlers({
  onUncaughtException = null,
  onUnhandledRejection = null,
  shutdownOnError = true,
} = {}) {
  if (
    processErrorHandlersInstalled
  ) {
    return false;
  }

  processErrorHandlersInstalled =
    true;

  process.on(
    'uncaughtException',
    async (error) => {
      try {
        if (
          typeof onUncaughtException ===
          'function'
        ) {
          await onUncaughtException(
            error,
          );
        }
      } finally {
        if (shutdownOnError) {
          await hooks.shutdown({
            reason:
              'uncaughtException',
            error,
          });
        }

        process.exitCode = 1;
      }
    },
  );

  process.on(
    'unhandledRejection',
    async (reason) => {
      const error =
        reason instanceof Error
          ? reason
          : new Error(
              String(reason),
            );

      try {
        if (
          typeof onUnhandledRejection ===
          'function'
        ) {
          await onUnhandledRejection(
            error,
          );
        }
      } finally {
        if (shutdownOnError) {
          await hooks.shutdown({
            reason:
              'unhandledRejection',
            error,
          });
        }

        process.exitCode = 1;
      }
    },
  );

  return true;
}

/**
 * -----------------------------------------------------------------------------
 * Public Bootstrap API
 * -----------------------------------------------------------------------------
 */

async function initialize(context = {}) {
  return hooks.initialize(
    context,
  );
}

async function start(context = {}) {
  return hooks.start(
    context,
  );
}

async function shutdown(context = {}) {
  return hooks.shutdown(
    context,
  );
}

function register(options = {}) {
  return hooks.register(
    options,
  );
}

function startup(
  name,
  startHandler,
  options = {},
) {
  return hooks.startup(
    name,
    startHandler,
    options,
  );
}

function shutdownHook(
  name,
  stopHandler,
  options = {},
) {
  return hooks.shutdown(
    name,
    stopHandler,
    options,
  );
}

function lifecycle(
  name,
  handlers = {},
) {
  return hooks.lifecycle(
    name,
    handlers,
  );
}

function get(name) {
  return hooks.get(name);
}

function has(name) {
  return hooks.has(name);
}

function list(options = {}) {
  return hooks.list(
    options,
  );
}

function snapshot() {
  return hooks.snapshot();
}

function getState() {
  return hooks.state;
}

/**
 * -----------------------------------------------------------------------------
 * Export
 * -----------------------------------------------------------------------------
 */

module.exports = Object.freeze({
  BootstrapHookError,
  BootstrapHookTimeoutError,
  BootstrapDependencyError,

  BootstrapHookRegistry,

  HOOK_PHASES,
  LIFECYCLE_STATES,

  hooks,

  register,
  startup,
  shutdown: shutdownHook,
  lifecycle,

  initialize,
  start,

  /**
   * Actual application shutdown lifecycle.
   */
  stop: shutdown,

  get,
  has,
  list,
  snapshot,
  getState,

  installSignalHandlers,
  installProcessErrorHandlers,
});