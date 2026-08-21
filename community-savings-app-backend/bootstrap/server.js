'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * TITech Community Capital Operating System
 * =============================================================================
 *
 * File:
 *   backend/bootstrap/server.js
 *
 * Purpose:
 *   Enterprise production-grade HTTP server bootstrap adapter.
 *
 * Responsibilities:
 *   - Own HTTP/HTTPS server lifecycle.
 *   - Start the server only after application readiness is satisfied.
 *   - Keep server startup/shutdown out of app.js.
 *   - Configure production-grade connection timeouts.
 *   - Support graceful connection draining.
 *   - Prevent duplicate server startup.
 *   - Prevent duplicate shutdown.
 *   - Integrate with readiness, observability and runtime lifecycle.
 *   - Expose safe server diagnostics.
 *   - Support HTTP and HTTPS without changing application routing.
 *   - Preserve the existing Express application.
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
 *   middleware
 *       ↓
 *   routes
 *       ↓
 *   bootstrap/server.js
 *       ↓
 *   listening socket
 *
 * IMPORTANT:
 *
 *   This module does NOT:
 *     - define Express routes
 *     - implement controllers
 *     - implement financial transactions
 *     - implement ledger logic
 *     - implement authentication
 *     - connect to databases
 *     - connect to Redis
 *     - implement queues
 *     - own resilience algorithms
 *
 *   app.js remains responsible for building the application.
 *   bootstrap/server.js is responsible for turning that application into a
 *   controlled network server.
 *
 * =============================================================================
 */

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

/**
 * -----------------------------------------------------------------------------
 * Lifecycle / Dependencies
 * -----------------------------------------------------------------------------
 */

const {
  hooks,
  lifecycle,
} = require('./hooks');

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

let runtimeModule = null;

try {
  // eslint-disable-next-line global-require
  runtimeModule =
    require('./runtime');
} catch {
  runtimeModule = null;
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
  'http-server';

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.OTEL_SERVICE_NAME ||
  'titech-backend';

const DEFAULTS = Object.freeze({
  host:
    '0.0.0.0',

  port:
    3000,

  requestTimeoutMs:
    30_000,

  headersTimeoutMs:
    65_000,

  keepAliveTimeoutMs:
    5_000,

  maxConnections:
    10_000,

  shutdownTimeoutMs:
    30_000,

  shutdownDrainMs:
    5_000,

  enableHttp:
    true,

  enableHttps:
    false,

  enableGracefulShutdown:
    true,

  requireReadiness:
    true,

  reusePort:
    false,

  keepAlive:
    true,
});

/**
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 */

class ServerBootstrapError extends Error {
  constructor(
    message,
    options = {},
  ) {
    super(message);

    this.name =
      'ServerBootstrapError';

    this.code =
      options.code ||
      'SERVER_BOOTSTRAP_ERROR';

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
      ServerBootstrapError,
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * Utility Functions
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

function normalizeHost(
  value,
) {
  const host =
    String(
      value ||
        DEFAULTS.host,
    ).trim();

  return host || DEFAULTS.host;
}

function normalizePath(
  value,
) {
  if (
    !value
  ) {
    return null;
  }

  return String(value)
    .trim();
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

/**
 * -----------------------------------------------------------------------------
 * Configuration
 * -----------------------------------------------------------------------------
 */

function resolveServerConfiguration(
  context = {},
  options = {},
) {
  const config =
    context.config ||
    {};

  const environment =
    context.environment ||
    {};

  const httpConfig =
    config.http ||
    config.server ||
    {};

  const tlsConfig =
    config.tls ||
    environment.tls ||
    {};

  const host =
    options.host ||
    httpConfig.host ||
    environment.http?.host ||
    process.env.HOST ||
    DEFAULTS.host;

  const port =
    asPositiveInteger(
      options.port ??
        httpConfig.port ??
        environment.http?.port ??
        process.env.PORT,
      DEFAULTS.port,
    );

  const httpsEnabled =
    options.httpsEnabled ??
    asBoolean(
      httpConfig.httpsEnabled ??
        tlsConfig.enabled ??
        process.env.TLS_ENABLED,
      DEFAULTS.enableHttps,
    );

  const httpEnabled =
    options.httpEnabled ??
    asBoolean(
      httpConfig.httpEnabled ??
        process.env.HTTP_ENABLED,
      DEFAULTS.enableHttp,
    );

  return Object.freeze({
    host:
      normalizeHost(
        host,
      ),

    port,

    httpsPort:
      asPositiveInteger(
        options.httpsPort ??
          httpConfig.httpsPort ??
          process.env.HTTPS_PORT,
        3443,
      ),

    httpEnabled,

    httpsEnabled,

    requestTimeoutMs:
      asPositiveInteger(
        options.requestTimeoutMs ??
          httpConfig.requestTimeoutMs ??
          environment.http?.requestTimeoutMs ??
          process.env.REQUEST_TIMEOUT_MS,
        DEFAULTS.requestTimeoutMs,
      ),

    headersTimeoutMs:
      asPositiveInteger(
        options.headersTimeoutMs ??
          httpConfig.headersTimeoutMs ??
          environment.http?.headersTimeoutMs ??
          process.env.HEADERS_TIMEOUT_MS,
        DEFAULTS.headersTimeoutMs,
      ),

    keepAliveTimeoutMs:
      asPositiveInteger(
        options.keepAliveTimeoutMs ??
          httpConfig.keepAliveTimeoutMs ??
          environment.http?.keepAliveTimeoutMs ??
          process.env.KEEP_ALIVE_TIMEOUT_MS,
        DEFAULTS.keepAliveTimeoutMs,
      ),

    maxConnections:
      asPositiveInteger(
        options.maxConnections ??
          httpConfig.maxConnections ??
          process.env.MAX_CONNECTIONS,
        DEFAULTS.maxConnections,
      ),

    shutdownTimeoutMs:
      asPositiveInteger(
        options.shutdownTimeoutMs ??
          httpConfig.shutdownTimeoutMs ??
          environment.http?.shutdownTimeoutMs ??
          process.env.SHUTDOWN_TIMEOUT_MS,
        DEFAULTS.shutdownTimeoutMs,
      ),

    shutdownDrainMs:
      asPositiveInteger(
        options.shutdownDrainMs ??
          process.env.SHUTDOWN_DRAIN_MS,
        DEFAULTS.shutdownDrainMs,
      ),

    gracefulShutdown:
      options.gracefulShutdown ??
      asBoolean(
        httpConfig.gracefulShutdown ??
          process.env.GRACEFUL_SHUTDOWN,
        DEFAULTS.enableGracefulShutdown,
      ),

    requireReadiness:
      options.requireReadiness ??
      asBoolean(
        httpConfig.requireReadiness ??
          process.env.REQUIRE_HTTP_READINESS,
        DEFAULTS.requireReadiness,
      ),

    reusePort:
      options.reusePort ??
      asBoolean(
        httpConfig.reusePort ??
          process.env.REUSE_PORT,
        DEFAULTS.reusePort,
      ),

    keepAlive:
      options.keepAlive ??
      asBoolean(
        httpConfig.keepAlive ??
          process.env.KEEP_ALIVE,
        DEFAULTS.keepAlive,
      ),

    tls: Object.freeze({
      keyPath:
        normalizePath(
          options.tlsKeyPath ??
            tlsConfig.keyPath ??
            process.env.TLS_KEY_PATH,
        ),

      certPath:
        normalizePath(
          options.tlsCertPath ??
            tlsConfig.certPath ??
            process.env.TLS_CERT_PATH,
        ),

      caPath:
        normalizePath(
          options.tlsCaPath ??
            tlsConfig.caPath ??
            process.env.TLS_CA_PATH,
        ),

      passphrase:
        options.tlsPassphrase ??
        tlsConfig.passphrase ??
        process.env.TLS_PASSPHRASE ??
        undefined,

      requestCert:
        options.tlsRequestCert ??
        tlsConfig.requestCert ??
        asBoolean(
          process.env.TLS_REQUEST_CERT,
          false,
        ),

      rejectUnauthorized:
        options.tlsRejectUnauthorized ??
        tlsConfig.rejectUnauthorized ??
        asBoolean(
          process.env.TLS_REJECT_UNAUTHORIZED,
          true,
        ),
    }),
  });
}

/**
 * -----------------------------------------------------------------------------
 * Application Resolution
 * -----------------------------------------------------------------------------
 */

function assertApplication(
  app,
) {
  if (
    !app ||
    typeof app !==
      'function'
  ) {
    throw new ServerBootstrapError(
      'A valid Express-compatible application is required.',
      {
        code:
          'SERVER_APPLICATION_INVALID',
      },
    );
  }
}

function resolveApplication(
  context,
  options,
) {
  const explicit =
    options.app ||
    context?.app;

  if (
    explicit
  ) {
    assertApplication(
      explicit,
    );

    return explicit;
  }

  /**
   * Prefer a context-owned application.
   *
   * We intentionally do not blindly require app.js here because that can cause
   * circular bootstrap dependencies if app.js imports bootstrap modules.
   */
  if (
    context?.application
  ) {
    assertApplication(
      context.application,
    );

    return context.application;
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------
 */

let app =
  null;

let httpServer =
  null;

let httpsServer =
  null;

let activeServer =
  null;

let serverType =
  null;

let configuration =
  null;

let registered =
  false;

let starting =
  false;

let started =
  false;

let stopping =
  false;

let stopped =
  false;

let failed =
  false;

let acceptingConnections =
  false;

let startPromise =
  null;

let stopPromise =
  null;

let lastError =
  null;

let startedAt =
  null;

let stoppingAt =
  null;

let stoppedAt =
  null;

let listeningAddress =
  null;

let connectionCount =
  0;

let activeConnections =
  new Set();

/**
 * Socket tracking is intentionally lightweight.
 *
 * We track active sockets so graceful shutdown can drain them without
 * destroying healthy connections prematurely.
 */
function trackSocket(
  socket,
) {
  activeConnections.add(
    socket,
  );

  connectionCount =
    activeConnections.size;

  socket.once(
    'close',
    () => {
      activeConnections.delete(
        socket,
      );

      connectionCount =
        activeConnections.size;
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Logging
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
    // Fall through to stderr/stdout.
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
 * Readiness
 * -----------------------------------------------------------------------------
 */

async function assertReadyToListen(
  options = {},
) {
  if (
    !options.requireReadiness
  ) {
    return true;
  }

  if (
    !readinessModule
  ) {
    /**
     * Do not silently pretend readiness exists when it has been requested.
     */
    if (
      configuration?.requireReadiness
    ) {
      throw new ServerBootstrapError(
        'HTTP server requires readiness validation, but readinessState is unavailable.',
        {
          code:
            'SERVER_READINESS_UNAVAILABLE',
        },
      );
    }

    return true;
  }

  try {
    if (
      typeof readinessModule
        .evaluate ===
      'function'
    ) {
      await readinessModule.evaluate({
        allowRecovery:
          true,
      });
    }

    let ready =
      false;

    if (
      typeof readinessModule
        .isReady ===
      'function'
    ) {
      ready =
        readinessModule.isReady();
    } else if (
      readinessModule
        .readinessState &&
      typeof readinessModule
        .readinessState
        .isReady ===
        'function'
    ) {
      ready =
        readinessModule
          .readinessState
          .isReady();
    }

    if (
      !ready
    ) {
      throw new ServerBootstrapError(
        'TITech HTTP server cannot listen because the application is not ready.',
        {
          code:
            'SERVER_APPLICATION_NOT_READY',
        },
      );
    }

    return true;
  } catch (error) {
    if (
      error instanceof
      ServerBootstrapError
    ) {
      throw error;
    }

    throw new ServerBootstrapError(
      'TITech HTTP readiness validation failed.',
      {
        code:
          'SERVER_READINESS_CHECK_FAILED',

        cause:
          error,
      },
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * TLS
 * -----------------------------------------------------------------------------
 */

function readTlsFile(
  filePath,
  name,
) {
  if (
    !filePath
  ) {
    throw new ServerBootstrapError(
      `TLS ${name} path is not configured.`,
      {
        code:
          'SERVER_TLS_CONFIGURATION_MISSING',

        details: {
          name,
        },
      },
    );
  }

  try {
    return fs.readFileSync(
      filePath,
    );
  } catch (error) {
    throw new ServerBootstrapError(
      `Unable to read TLS ${name} file.`,
      {
        code:
          'SERVER_TLS_FILE_READ_FAILED',

        cause:
          error,

        details: {
          name,
          filePath,
        },
      },
    );
  }
}

function buildTlsOptions(
  tls,
) {
  const key =
    readTlsFile(
      tls.keyPath,
      'key',
    );

  const cert =
    readTlsFile(
      tls.certPath,
      'certificate',
    );

  const result = {
    key,

    cert,

    requestCert:
      tls.requestCert,

    rejectUnauthorized:
      tls.rejectUnauthorized,
  };

  if (
    tls.caPath
  ) {
    result.ca =
      readTlsFile(
        tls.caPath,
        'CA certificate',
      );
  }

  if (
    tls.passphrase
  ) {
    result.passphrase =
      tls.passphrase;
  }

  return result;
}

/**
 * -----------------------------------------------------------------------------
 * HTTP Server Creation
 * -----------------------------------------------------------------------------
 */

function createHttpServer(
  application,
  config,
) {
  const server =
    http.createServer(
      {
        keepAlive:
          config.keepAlive,
      },
      application,
    );

  configureServer(
    server,
    config,
  );

  return server;
}

function createHttpsServer(
  application,
  config,
) {
  const tlsOptions =
    buildTlsOptions(
      config.tls,
    );

  const server =
    https.createServer(
      tlsOptions,
      application,
    );

  configureServer(
    server,
    config,
  );

  return server;
}

/**
 * -----------------------------------------------------------------------------
 * Server Configuration
 * -----------------------------------------------------------------------------
 */

function configureServer(
  server,
  config,
) {
  server.requestTimeout =
    config.requestTimeoutMs;

  server.headersTimeout =
    config.headersTimeoutMs;

  server.keepAliveTimeout =
    config.keepAliveTimeoutMs;

  server.maxConnections =
    config.maxConnections;

  /**
   * Node.js/OS-level socket lifecycle.
   */
  server.on(
    'connection',
    trackSocket,
  );

  server.on(
    'error',
    handleServerError,
  );

  server.on(
    'clientError',
    handleClientError,
  );

  /**
   * Keep the runtime aware that the HTTP layer is accepting traffic.
   */
  server.on(
    'listening',
    () => {
      acceptingConnections =
        true;
    },
  );

  server.on(
    'close',
    () => {
      acceptingConnections =
        false;
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * Server Error Handling
 * -----------------------------------------------------------------------------
 */

function handleServerError(
  error,
) {
  lastError =
    error;

  log(
    'error',
    {
      err:
        error,

      serverType,
    },
    'TITech HTTP server emitted an error.',
  );

  emitObservabilityEvent(
    'server.error',
    {
      serverType,

      error:
        safeError(
          error,
        ),
    },
  );

  /**
   * EADDRINUSE/EACCES during startup is fatal to startup.
   *
   * Runtime shutdown should be initiated by the lifecycle manager rather than
   * calling process.exit() directly from this module.
   */
  if (
    error?.code ===
      'EADDRINUSE' ||
    error?.code ===
      'EACCES'
  ) {
    failed =
      true;
  }
}

function handleClientError(
  error,
  socket,
) {
  /**
   * HTTP parser errors can happen with malformed clients.
   *
   * Never allow one malformed client connection to crash the process.
   */
  log(
    'warn',
    {
      err:
        error,

      remoteAddress:
        socket?.remoteAddress,
    },
    'TITech HTTP client connection error.',
  );

  emitObservabilityEvent(
    'server.client_error',
    {
      code:
        error?.code,
    },
  );

  if (
    socket &&
    !socket.destroyed
  ) {
    socket.end(
      'HTTP/1.1 400 Bad Request\r\n\r\n',
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
     * Server lifecycle must not fail because telemetry is unavailable.
     */
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * Listening
 * -----------------------------------------------------------------------------
 */

function listen(
  server,
  {
    host,
    port,
    reusePort = false,
  },
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      let settled =
        false;

      const cleanup =
        () => {
          server.removeListener(
            'listening',
            onListening,
          );

          server.removeListener(
            'error',
            onError,
          );
        };

      const onListening =
        () => {
          if (
            settled
          ) {
            return;
          }

          settled =
            true;

          cleanup();

          resolve(
            server.address(),
          );
        };

      const onError =
        error => {
          if (
            settled
          ) {
            return;
          }

          settled =
            true;

          cleanup();

          reject(
            error,
          );
        };

      server.once(
        'listening',
        onListening,
      );

      server.once(
        'error',
        onError,
      );

      try {
        server.listen({
          host,

          port,

          reusePort:
            Boolean(
              reusePort,
            ),
        });
      } catch (error) {
        onError(
          error,
        );
      }
    },
  );
}

/**
 * -----------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------
 */

function isReady() {
  return (
    started &&
    acceptingConnections &&
    !stopping &&
    !stopped &&
    !failed
  );
}

function isRunning() {
  return (
    started &&
    !stopping &&
    !stopped
  );
}

/**
 * -----------------------------------------------------------------------------
 * Start
 * -----------------------------------------------------------------------------
 */

async function startServer(
  context = {},
  options = {},
) {
  if (
    started &&
    !stopping
  ) {
    return {
      server:
        activeServer,

      type:
        serverType,

      address:
        listeningAddress,
    };
  }

  if (
    startPromise
  ) {
    return startPromise;
  }

  if (
    stopping
  ) {
    throw new ServerBootstrapError(
      'Cannot start the TITech HTTP server while shutdown is in progress.',
      {
        code:
          'SERVER_START_DURING_SHUTDOWN',
      },
    );
  }

  if (
    stopped
  ) {
    throw new ServerBootstrapError(
      'Cannot restart the TITech HTTP server after shutdown.',
      {
        code:
          'SERVER_ALREADY_STOPPED',
      },
    );
  }

  startPromise =
    (async () => {
      const config =
        resolveServerConfiguration(
          context,
          options,
        );

      configuration =
        config;

      const application =
        resolveApplication(
          context,
          options,
        );

      assertApplication(
        application,
      );

      app =
        application;

      await assertReadyToListen(
        {
          requireReadiness:
            config.requireReadiness,
        },
      );

      try {
        /**
         * ---------------------------------------------------------------------
         * HTTPS preferred when explicitly enabled.
         * ---------------------------------------------------------------------
         */

        if (
          config.httpsEnabled
        ) {
          httpsServer =
            createHttpsServer(
              application,
              config,
            );

          activeServer =
            httpsServer;

          serverType =
            'https';

          listeningAddress =
            await listen(
              httpsServer,
              {
                host:
                  config.host,

                port:
                  config.httpsPort,

                reusePort:
                  config.reusePort,
              },
            );
        } else if (
          config.httpEnabled
        ) {
          httpServer =
            createHttpServer(
              application,
              config,
            );

          activeServer =
            httpServer;

          serverType =
            'http';

          listeningAddress =
            await listen(
              httpServer,
              {
                host:
                  config.host,

                port:
                  config.port,

                reusePort:
                  config.reusePort,
              },
            );
        } else {
          throw new ServerBootstrapError(
            'Neither HTTP nor HTTPS is enabled.',
            {
              code:
                'SERVER_NO_TRANSPORT_ENABLED',
            },
          );
        }

        started =
          true;

        starting =
          false;

        stopping =
          false;

        stopped =
          false;

        failed =
          false;

        acceptingConnections =
          true;

        startedAt =
          new Date();

        lastError =
          null;

        /**
         * Publish server state to the shared context.
         */
        if (
          context &&
          typeof context ===
            'object'
        ) {
          context.server =
            activeServer;

          context.httpServer =
            activeServer;

          context.serverType =
            serverType;

          context.serverAddress =
            listeningAddress;
        }

        emitObservabilityEvent(
          'server.started',
          {
            type:
              serverType,

            address:
              listeningAddress,
          },
        );

        log(
          'info',
          {
            serverType,

            host:
              config.host,

            port:
              listeningAddress?.port,

            address:
              listeningAddress,
          },
          `TITech ${serverType.toUpperCase()} server is listening.`,
        );

        return {
          server:
            activeServer,

          type:
            serverType,

          address:
            listeningAddress,

          config,
        };
      } catch (error) {
        failed =
          true;

        started =
          false;

        acceptingConnections =
          false;

        lastError =
          error;

        /**
         * Close a partially-created server if listen failed.
         */
        await closeServerSilently(
          activeServer,
        );

        throw wrapError(
          error,
          'SERVER_START_FAILED',
          'startup',
          'TITech HTTP server startup failed.',
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
}

/**
 * -----------------------------------------------------------------------------
 * Graceful Shutdown
 * -----------------------------------------------------------------------------
 */

async function stopServer(
  reason =
    'application-request',
  metadata = {},
) {
  if (
    stopPromise
  ) {
    return stopPromise;
  }

  if (
    stopped
  ) {
    return true;
  }

  stopPromise =
    (async () => {
      stopping =
        true;

      started =
        false;

      acceptingConnections =
        false;

      stoppingAt =
        new Date();

      emitObservabilityEvent(
        'server.shutdown_started',
        {
          reason,

          signal:
            metadata.signal ||
            null,

          activeConnections:
            activeConnections.size,
        },
      );

      log(
        'info',
        {
          reason,

          signal:
            metadata.signal,

          activeConnections:
            activeConnections.size,
        },
        'TITech HTTP server graceful shutdown initiated.',
      );

      try {
        await closeServer(
          activeServer,
          {
            timeoutMs:
              configuration
                ?.shutdownTimeoutMs ||
              DEFAULTS
                .shutdownTimeoutMs,

            drainMs:
              configuration
                ?.shutdownDrainMs ||
              DEFAULTS
                .shutdownDrainMs,
          },
        );

        activeServer =
          null;

        httpServer =
          null;

        httpsServer =
          null;

        acceptingConnections =
          false;

        started =
          false;

        stopping =
          false;

        stopped =
          true;

        failed =
          false;

        stoppedAt =
          new Date();

        emitObservabilityEvent(
          'server.shutdown_completed',
          {
            reason,

            signal:
              metadata.signal ||
              null,
          },
        );

        log(
          'info',
          {
            reason,
          },
          'TITech HTTP server stopped.',
        );

        return true;
      } catch (error) {
        lastError =
          error;

        failed =
          true;

        stopping =
          false;

        stopped =
          false;

        emitObservabilityEvent(
          'server.shutdown_failed',
          {
            reason,

            error:
              safeError(
                error,
              ),
          },
        );

        throw wrapError(
          error,
          'SERVER_SHUTDOWN_FAILED',
          'shutdown',
          'TITech HTTP server shutdown failed.',
        );
      }
    })();

  return stopPromise;
}

/**
 * -----------------------------------------------------------------------------
 * Close Server
 * -----------------------------------------------------------------------------
 */

async function closeServer(
  server,
  {
    timeoutMs,
    drainMs,
  },
) {
  if (
    !server
  ) {
    return;
  }

  /**
   * Stop accepting new connections immediately.
   */
  acceptingConnections =
    false;

  /**
   * Graceful server.close() waits for HTTP connections that are still active.
   */
  const closePromise =
    new Promise(
      (
        resolve,
        reject,
      ) => {
        let completed =
          false;

        const finish =
          (error) => {
            if (
              completed
            ) {
              return;
            }

            completed =
              true;

            clearTimeout(
              timeoutTimer,
            );

            clearTimeout(
              drainTimer,
            );

            if (
              error
            ) {
              reject(
                error,
              );
            } else {
              resolve();
            }
          };

        const timeoutTimer =
          setTimeout(
            () => {
              finish(
                new ServerBootstrapError(
                  `TITech HTTP server did not close within ${timeoutMs}ms.`,
                  {
                    code:
                      'SERVER_CLOSE_TIMEOUT',
                  },
                ),
              );
            },
            timeoutMs,
          );

        timeoutTimer.unref?.();

        const drainTimer =
          setTimeout(
            () => {
              /**
               * Destroy remaining sockets after the configured drain period.
               *
               * This is a controlled last-resort mechanism and should only
               * affect connections still open when shutdown is already underway.
               */
              for (
                const socket of
                  activeConnections
              ) {
                try {
                  if (
                    socket &&
                    !socket.destroyed
                  ) {
                    socket.destroy();
                  }
                } catch {
                  // Best effort.
                }
              }
            },
            drainMs,
          );

        drainTimer.unref?.();

        try {
          server.close(
            error => {
              finish(
                error ||
                  undefined,
              );
            },
          );
        } catch (error) {
          finish(
            error,
          );
        }
      },
    );

  await closePromise;

  /**
   * If supported by the Node.js runtime, ensure idle connections are closed.
   */
  if (
    typeof server.closeIdleConnections ===
    'function'
  ) {
    try {
      server.closeIdleConnections();
    } catch {
      // Best effort.
    }
  }

  if (
    typeof server.closeAllConnections ===
    'function' &&
    activeConnections.size > 0
  ) {
    try {
      server.closeAllConnections();
    } catch {
      // Best effort.
    }
  }
}

async function closeServerSilently(
  server,
) {
  if (
    !server
  ) {
    return;
  }

  try {
    server.close();
  } catch {
    // Best effort.
  }
}

/**
 * -----------------------------------------------------------------------------
 * Readiness / Health
 * -----------------------------------------------------------------------------
 */

async function readiness() {
  return {
    ready:
      isReady(),

    status:
      isReady()
        ? 'ready'
        : stopping ||
            stopped ||
            failed
          ? 'not_ready'
          : 'initializing',

    component:
      COMPONENT,

    service:
      SERVICE_NAME,

    serverType,

    address:
      listeningAddress,

    acceptingConnections,

    activeConnections:
      activeConnections.size,

    timestamp:
      new Date().toISOString(),
  };
}

async function health() {
  return {
    status:
      isReady()
        ? 'healthy'
        : failed
          ? 'unhealthy'
          : 'degraded',

    ready:
      isReady(),

    component:
      COMPONENT,

    service:
      SERVICE_NAME,

    serverType,

    address:
      listeningAddress,

    acceptingConnections,

    activeConnections:
      activeConnections.size,

    configuration:
      configuration
        ? {
            host:
              configuration.host,

            port:
              configuration.port,

            httpsPort:
              configuration.httpsPort,

            httpEnabled:
              configuration.httpEnabled,

            httpsEnabled:
              configuration.httpsEnabled,

            gracefulShutdown:
              configuration.gracefulShutdown,

            requireReadiness:
              configuration.requireReadiness,
          }
        : null,

    error:
      safeError(
        lastError,
      ),

    timestamp:
      new Date().toISOString(),
  };
}

/**
 * -----------------------------------------------------------------------------
 * Bootstrap Lifecycle Registration
 * -----------------------------------------------------------------------------
 */

function registerServerHooks(
  context = {},
  options = {},
) {
  if (
    hooks.has(
      COMPONENT,
    )
  ) {
    registered =
      true;

    return hooks.get(
      COMPONENT,
    );
  }

  const dependencies =
    Array.isArray(
      options.dependencies,
    )
      ? [
          ...options.dependencies,
        ]
      : [
          'routes',
          'readiness',
        ];

  const result =
    lifecycle(
      COMPONENT,
      {
        priority:
          options.priority ??
          1_000,

        dependencies,

        timeoutMs:
          options.timeoutMs ||
          DEFAULTS.shutdownTimeoutMs,

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
            'backend/bootstrap/server.js',
        },

        /**
         * ---------------------------------------------------------------------
         * START
         * ---------------------------------------------------------------------
         */

        start:
          async hookContext => {
            return startServer(
              hookContext ||
                context,
              options,
            );
          },

        /**
         * ---------------------------------------------------------------------
         * READY
         * ---------------------------------------------------------------------
         */

        ready:
          async () => {
            if (
              !configuration
                ?.requireReadiness
            ) {
              return isReady();
            }

            return isReady();
          },

        /**
         * ---------------------------------------------------------------------
         * HEALTH
         * ---------------------------------------------------------------------
         */

        health:
          async () =>
            health(),

        /**
         * ---------------------------------------------------------------------
         * STOP
         * ---------------------------------------------------------------------
         */

        stop:
          async hookContext =>
            stopServer(
              hookContext?.reason ||
                'bootstrap-shutdown',
              hookContext,
            ),
      },
    );

  registered =
    true;

  return result;
}

function registerBootstrapHooks(
  context = {},
  options = {},
) {
  return registerServerHooks(
    context,
    options,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Application Injection
 * -----------------------------------------------------------------------------
 */

function setApplication(
  value,
) {
  assertApplication(
    value,
  );

  if (
    started
  ) {
    throw new ServerBootstrapError(
      'Cannot replace the Express application after the server has started.',
      {
        code:
          'SERVER_APPLICATION_LOCKED',
      },
    );
  }

  app =
    value;

  return app;
}

/**
 * -----------------------------------------------------------------------------
 * Explicit Lifecycle API
 * -----------------------------------------------------------------------------
 */

async function initialize(
  context = {},
  options = {},
) {
  return startServer(
    context,
    options,
  );
}

async function start(
  context = {},
  options = {},
) {
  return startServer(
    context,
    options,
  );
}

async function shutdown(
  reason =
    'application-request',
  metadata = {},
) {
  return stopServer(
    reason,
    metadata,
  );
}

async function stop(
  reason =
    'application-request',
  metadata = {},
) {
  return stopServer(
    reason,
    metadata,
  );
}

/**
 * -----------------------------------------------------------------------------
 * Runtime Access
 * -----------------------------------------------------------------------------
 */

function getServer() {
  return activeServer;
}

function getHttpServer() {
  return httpServer;
}

function getHttpsServer() {
  return httpsServer;
}

function getApplication() {
  return app;
}

function getAddress() {
  return listeningAddress;
}

function getServerType() {
  return serverType;
}

function getConnectionCount() {
  return activeConnections.size;
}

/**
 * -----------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------
 */

function getState() {
  return Object.freeze({
    component:
      COMPONENT,

    service:
      SERVICE_NAME,

    registered,

    starting,

    started,

    stopping,

    stopped,

    failed,

    ready:
      isReady(),

    acceptingConnections,

    serverType,

    address:
      listeningAddress,

    connectionCount:
      activeConnections.size,

    startedAt,

    stoppingAt,

    stoppedAt,

    lastError:
      safeError(
        lastError,
      ),
  });
}

/**
 * -----------------------------------------------------------------------------
 * Diagnostics
 * -----------------------------------------------------------------------------
 */

function snapshot() {
  return Object.freeze({
    ...getState(),

    configuration:
      configuration
        ? {
            ...configuration,

            tls: {
              enabled:
                configuration
                  .httpsEnabled,

              keyConfigured:
                Boolean(
                  configuration.tls
                    .keyPath,
                ),

              certificateConfigured:
                Boolean(
                  configuration.tls
                    .certPath,
                ),

              caConfigured:
                Boolean(
                  configuration.tls
                    .caPath,
                ),
            },
          }
        : null,

    applicationAvailable:
      Boolean(
        app,
      ),

    httpServerAvailable:
      Boolean(
        httpServer,
      ),

    httpsServerAvailable:
      Boolean(
        httpsServer,
      ),

    activeSockets:
      activeConnections.size,
  });
}

/**
 * -----------------------------------------------------------------------------
 * Predicates
 * -----------------------------------------------------------------------------
 */

function isRegistered() {
  return registered;
}

function isStarted() {
  return started;
}

function isStopping() {
  return stopping;
}

function isStopped() {
  return stopped;
}

function isFailed() {
  return failed;
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
    started ||
    stopping
  ) {
    throw new ServerBootstrapError(
      'Cannot reset an active TITech HTTP server.',
      {
        code:
          'SERVER_RESET_NOT_ALLOWED',
      },
    );
  }

  app =
    null;

  httpServer =
    null;

  httpsServer =
    null;

  activeServer =
    null;

  serverType =
    null;

  configuration =
    null;

  registered =
    false;

  starting =
    false;

  started =
    false;

  stopping =
    false;

  stopped =
    false;

  failed =
    false;

  acceptingConnections =
    false;

  startPromise =
    null;

  stopPromise =
    null;

  lastError =
    null;

  startedAt =
    null;

  stoppingAt =
    null;

  stoppedAt =
    null;

  listeningAddress =
    null;

  activeConnections =
    new Set();

  connectionCount =
    0;

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
    ServerBootstrapError
  ) {
    return error;
  }

  return new ServerBootstrapError(
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
    registerServerHooks,

    registerBootstrapHooks,

    bootstrap:
      registerBootstrapHooks,

    /**
     * Explicit lifecycle.
     */
    initialize,

    start,

    shutdown,

    stop,

    /**
     * Application injection.
     */
    setApplication,

    /**
     * Server access.
     */
    getServer,

    getHttpServer,

    getHttpsServer,

    getApplication,

    getAddress,

    getServerType,

    getConnectionCount,

    /**
     * Health/readiness.
     */
    readiness,

    health,

    /**
     * State.
     */
    getState,

    snapshot,

    isRegistered,

    isStarted,

    isStopping,

    isStopped,

    isFailed,

    isReady,

    /**
     * Test support.
     */
    reset,

    /**
     * Metadata/errors.
     */
    ServerBootstrapError,

    COMPONENT,

    SERVICE_NAME,
  });