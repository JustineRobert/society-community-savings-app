/**
 * ============================================================================
 * TITech Community Capital
 * Enterprise Backend Process Entry Point
 *
 * File:
 *   backend/server.js
 *
 * Production Grade
 * ----------------------------------------------------------------------------
 * Architecture
 *
 *   server.js
 *       ↓
 *   backend/bootstrap/app.js
 *       ↓
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
 *       ↓
 *   READY
 *
 * IMPORTANT
 * ----------------------------------------------------------------------------
 * `backend/app.js` is the Express application factory.
 *
 * `backend/bootstrap/app.js` is the canonical TITech application lifecycle
 * orchestrator.
 *
 * `server.js` must remain a thin process entry point and MUST NOT duplicate
 * environment, observability, resilience, database or HTTP bootstrap logic.
 * ============================================================================
 */

'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const dotenv = require('dotenv');

/* ============================================================================
 * Environment
 * ========================================================================== */

const ENV_FILE = path.resolve(
  process.cwd(),
  '.env',
);

dotenv.config({
  path: ENV_FILE,
});

/* ============================================================================
 * Constants
 * ========================================================================== */

const MIN_NODE_MAJOR = 20;

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.OTEL_SERVICE_NAME ||
  'titech-community-capital-backend';

const NODE_ENV =
  process.env.NODE_ENV ||
  'development';

const FATAL_EXIT_CODE = 1;

/* ============================================================================
 * Runtime State
 * ========================================================================== */

let bootstrapModule = null;

let logger = console;

let processHandlersInstalled = false;

let fatalHandlingStarted = false;

/* ============================================================================
 * Safe Logging
 * ========================================================================== */

const SENSITIVE_KEY_PATTERN =
  /password|passwd|passcode|pin|otp|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|client[-_]?secret|jwt|mongo(uri)?|mongodb|redis|database|connection|string/i;

function sanitizeMetadata(
  metadata,
) {
  if (
    !metadata ||
    typeof metadata !== 'object'
  ) {
    return {};
  }

  const output = {};

  for (
    const [key, value]
      of Object.entries(
        metadata,
      )
  ) {
    if (
      SENSITIVE_KEY_PATTERN.test(
        String(key),
      )
    ) {
      continue;
    }

    if (
      value instanceof Error
    ) {
      output[key] = {
        name:
          value.name,

        message:
          value.message,

        code:
          value.code,
      };

      continue;
    }

    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      output[key] = value;
      continue;
    }

    try {
      output[key] =
        JSON.parse(
          JSON.stringify(value),
        );
    } catch {
      output[key] =
        '[unserializable]';
    }
  }

  return output;
}

function logInfo(
  message,
  metadata = {},
) {
  try {
    if (
      typeof logger?.info ===
      'function'
    ) {
      logger.info(
        message,
        sanitizeMetadata(
          metadata,
        ),
      );

      return;
    }
  } catch {
    // Fall through.
  }

  console.info(
    message,
    sanitizeMetadata(
      metadata,
    ),
  );
}

function logWarn(
  message,
  metadata = {},
) {
  try {
    if (
      typeof logger?.warn ===
      'function'
    ) {
      logger.warn(
        message,
        sanitizeMetadata(
          metadata,
        ),
      );

      return;
    }
  } catch {
    // Fall through.
  }

  console.warn(
    message,
    sanitizeMetadata(
      metadata,
    ),
  );
}

function logError(
  message,
  metadata = {},
) {
  try {
    if (
      typeof logger?.error ===
      'function'
    ) {
      logger.error(
        message,
        sanitizeMetadata(
          metadata,
        ),
      );

      return;
    }
  } catch {
    // Fall through.
  }

  console.error(
    message,
    sanitizeMetadata(
      metadata,
    ),
  );
}

/* ============================================================================
 * Runtime Validation
 * ========================================================================== */

function validateRuntime() {
  const nodeVersion =
    process.versions?.node ||
    process.version;

  const nodeMajor =
    Number(
      nodeVersion.split('.')[0],
    );

  if (
    !Number.isInteger(
      nodeMajor,
    ) ||
    nodeMajor < MIN_NODE_MAJOR
  ) {
    throw new Error(
      `TITech requires Node.js ${MIN_NODE_MAJOR}+. Current runtime: ${process.version}`,
    );
  }

  const requiredFeatures = {
    randomUUID:
      typeof crypto.randomUUID ===
      'function',

    structuredClone:
      typeof global.structuredClone ===
      'function',

    fetch:
      typeof global.fetch ===
      'function',

    AbortController:
      typeof global.AbortController ===
      'function',

    URL:
      typeof global.URL ===
      'function',

    setTimeout:
      typeof global.setTimeout ===
      'function',
  };

  const missingFeatures =
    Object.entries(
      requiredFeatures,
    )
      .filter(
        ([, available]) =>
          !available,
      )
      .map(
        ([name]) =>
          name,
      );

  if (
    missingFeatures.length > 0
  ) {
    throw new Error(
      `Required TITech runtime features are unavailable: ${missingFeatures.join(
        ', ',
      )}`,
    );
  }

  const supportedPlatforms =
    new Set([
      'win32',
      'linux',
      'darwin',
    ]);

  if (
    !supportedPlatforms.has(
      process.platform,
    )
  ) {
    throw new Error(
      `Unsupported platform: ${process.platform}`,
    );
  }

  const supportedArchitectures =
    new Set([
      'x64',
      'arm64',
    ]);

  if (
    !supportedArchitectures.has(
      process.arch,
    )
  ) {
    throw new Error(
      `Unsupported architecture: ${process.arch}`,
    );
  }

  return {
    nodeVersion,
    nodeMajor,

    platform:
      process.platform,

    architecture:
      process.arch,

    hostname:
      os.hostname(),

    cpuCount:
      os.cpus()?.length || 1,

    pid:
      process.pid,
  };
}

/* ============================================================================
 * Canonical Application Bootstrap Loader
 * ========================================================================== */

function loadBootstrapModule() {
  if (
    bootstrapModule
  ) {
    return bootstrapModule;
  }

  /*
   * IMPORTANT:
   *
   * Do NOT require("./app") here.
   *
   * backend/app.js is the Express application factory.
   *
   * backend/bootstrap/app.js is the enterprise lifecycle orchestrator.
   */
  const loaded =
    require('./bootstrap/app');

  if (
    !loaded ||
    typeof loaded !== 'object'
  ) {
    throw new TypeError(
      'TITech bootstrap/app.js did not export the expected bootstrap object.',
    );
  }

  if (
    typeof loaded.startApplication !==
    'function'
  ) {
    throw new TypeError(
      'TITech bootstrap/app.js does not expose startApplication().',
    );
  }

  bootstrapModule =
    loaded;

  /*
   * Reuse the canonical logger supplied by the bootstrap subsystem.
   */
  if (
    loaded.logger &&
    typeof loaded.logger ===
      'object'
  ) {
    logger =
      loaded.logger;
  }

  return bootstrapModule;
}

/* ============================================================================
 * Process Fatal Error Handling
 * ========================================================================== */

async function handleFatalProcessError(
  type,
  reason,
) {
  if (
    fatalHandlingStarted
  ) {
    return;
  }

  fatalHandlingStarted =
    true;

  const error =
    reason instanceof Error
      ? reason
      : new Error(
          String(reason),
        );

  logError(
    `TITech ${type} detected.`,
    {
      name:
        error.name,

      message:
        error.message,

      code:
        error.code,

      stack:
        NODE_ENV !==
        'production'
          ? error.stack
          : undefined,
    },
  );

  try {
    const bootstrap =
      loadBootstrapModule();

    if (
      typeof bootstrap.shutdownApplication ===
      'function'
    ) {
      await bootstrap.shutdownApplication({
        reason:
          type,

        exit:
          false,

        exitCode:
          FATAL_EXIT_CODE,
      });
    }
  } catch (
    shutdownError
  ) {
    logError(
      'TITech fatal-error shutdown failed.',
      {
        message:
          shutdownError?.message,

        code:
          shutdownError?.code,
      },
    );
  }

  process.exitCode =
    FATAL_EXIT_CODE;

  process.exit(
    FATAL_EXIT_CODE,
  );
}

/* ============================================================================
 * Process Handlers
 * ========================================================================== */

function installProcessHandlers() {
  if (
    processHandlersInstalled
  ) {
    return;
  }

  processHandlersInstalled =
    true;

  process.once(
    'uncaughtException',
    (error) => {
      void handleFatalProcessError(
        'uncaught exception',
        error,
      );
    },
  );

  process.once(
    'unhandledRejection',
    (reason) => {
      void handleFatalProcessError(
        'unhandled promise rejection',
        reason,
      );
    },
  );

  /*
   * SIGINT/SIGTERM intentionally remain owned by backend/bootstrap/app.js.
   *
   * This prevents two independent shutdown controllers from competing.
   */
}

/* ============================================================================
 * Start Server
 * ========================================================================== */

async function startServer() {
  const runtime =
    validateRuntime();

  logInfo(
    'Starting TITech Community Capital backend process.',
    {
      serviceName:
        SERVICE_NAME,

      environment:
        NODE_ENV,

      nodeVersion:
        runtime.nodeVersion,

      nodeMajor:
        runtime.nodeMajor,

      platform:
        runtime.platform,

      architecture:
        runtime.architecture,

      hostname:
        runtime.hostname,

      pid:
        runtime.pid,
    },
  );

  const bootstrap =
    loadBootstrapModule();

  /*
   * Canonical application startup.
   *
   * backend/bootstrap/app.js performs:
   * environment
   * configuration
   * logger
   * observability
   * resilience
   * database
   * middleware
   * routes
   * error handler
   * HTTP server
   */
  const result =
    await bootstrap.startApplication();

  logInfo(
    'TITech Community Capital backend startup completed.',
    {
      serviceName:
        SERVICE_NAME,

      environment:
        NODE_ENV,

      pid:
        process.pid,
    },
  );

  return result;
}

/* ============================================================================
 * Operational State
 * ========================================================================== */

function getServerState() {
  try {
    const bootstrap =
      loadBootstrapModule();

    if (
      typeof bootstrap.getRuntimeState ===
      'function'
    ) {
      return bootstrap.getRuntimeState();
    }

    if (
      typeof bootstrap.getHealthState ===
      'function'
    ) {
      return bootstrap.getHealthState();
    }
  } catch {
    // Diagnostic helper must never crash the process.
  }

  return {
    serviceName:
      SERVICE_NAME,

    environment:
      NODE_ENV,

    running:
      false,
  };
}

/* ============================================================================
 * Process Initialization
 * ========================================================================== */

installProcessHandlers();

/* ============================================================================
 * Direct Execution
 * ========================================================================== */

if (
  require.main ===
  module
) {
  startServer().catch(
    (error) => {
      logError(
        'TITech Community Capital backend startup failed.',
        {
          name:
            error?.name,

          message:
            error?.message,

          code:
            error?.code,

          stack:
            NODE_ENV !==
            'production'
              ? error?.stack
              : undefined,
        },
      );

      process.exit(
        FATAL_EXIT_CODE,
      );
    },
  );
}

/* ============================================================================
 * Public API
 * ========================================================================== */

module.exports =
  Object.freeze({
    startServer,
    validateRuntime,
    getServerState,
    installProcessHandlers,
  });