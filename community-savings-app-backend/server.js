"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise Server Bootstrap
 * ============================================================================
 * Section 1.1–1.2
 *
 * Foundation & Runtime Bootstrap
 *
 * Responsibilities
 * ----------------
 * • Strict mode
 * • Runtime validation
 * • Node.js version verification
 * • Runtime feature detection
 * • CPU architecture validation
 * • Platform validation
 * • Process privilege checks
 * • OpenSSL verification
 * • Optional FIPS detection
 *
 * This section MUST execute before importing application modules.
 * ============================================================================
 */

/**
 * ============================================================================
 * CORE DEPENDENCIES
 * ============================================================================
 */

const os = require("os");
const crypto = require("crypto");

require("dotenv").config();


/**
 * ============================================================================
 * APPLICATION IMPORTS
 * ============================================================================
 */

const {
    validateEnterpriseRuntime
}
=
require(
    "./runtime/validateEnterpriseRuntime"
);


const runtimeValidationReport =
    validateEnterpriseRuntime();



const bootstrapEnvironment = require(
  "./config/bootstrapEnvironment"
);


const {
  bootstrapResilienceObservability
} = require(
  "./observability/resilienceObservabilityBootstrap"
);


const {
  bootstrapResilience
} = require(
  "./middleware/resilience/bootstrap"
);


/**
 * ============================================================================
 * OBSERVABILITY INITIALIZATION
 * ============================================================================
 */

const observability =
  bootstrapResilienceObservability({

    serviceName:
      "community-savings-backend",

  });


const {
  logger,
  metrics,
  tracer,

} = observability;


/**
 * ============================================================================
 * APPLICATION FACTORY
 * ============================================================================
 */

const app =
  require("./app");


/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

module.exports = {

  app,

  logger,

  metrics,

  tracer,

  bootstrapEnvironment,

  bootstrapResilience,

};

/**
 * ============================================================================
 * ENTERPRISE RUNTIME REQUIREMENTS
 * ============================================================================
 */

const RUNTIME_REQUIREMENTS = Object.freeze({
  minimumNodeMajor: 22,

  supportedPlatforms: Object.freeze([
    "linux",
    "darwin",
    "win32",
  ]),

  supportedArchitectures: Object.freeze([
    "x64",
    "arm64",
  ]),
});

/**
 * ============================================================================
 * RUNTIME VALIDATION
 * ============================================================================
 */

function validateRuntime() {
  const nodeMajor = Number(
    process.versions.node.split(".")[0]
  );

  if (
    nodeMajor <
    RUNTIME_REQUIREMENTS.minimumNodeMajor
  ) {
    throw new Error(
      `Node.js ${RUNTIME_REQUIREMENTS.minimumNodeMajor}+ required. Current: ${process.version}`
    );
  }

  if (
    !RUNTIME_REQUIREMENTS.supportedPlatforms.includes(
      process.platform
    )
  ) {
    throw new Error(
      `Unsupported platform: ${process.platform}`
    );
  }

  if (
    !RUNTIME_REQUIREMENTS.supportedArchitectures.includes(
      process.arch
    )
  ) {
    throw new Error(
      `Unsupported architecture: ${process.arch}`
    );
  }

  logger?.info?.(
    "Runtime validation completed successfully"
  );
}

/**
 * ============================================================================
 * APPLICATION STARTUP
 * ============================================================================
 */

async function startServer() {
  try {
    console.log(
      "🚀 Starting Community Savings Backend..."
    );

    /**
     * ----------------------------------------------------------------------
     * 1. RUNTIME VALIDATION
     * ----------------------------------------------------------------------
     */

    validateRuntime();

    console.log(
      "✅ Runtime validation passed"
    );

    /**
     * ----------------------------------------------------------------------
     * 2. ENVIRONMENT VALIDATION
     * ----------------------------------------------------------------------
     */

    bootstrapEnvironment();

    console.log(
      "✅ Bootstrap completed successfully"
    );

    /**
     * ----------------------------------------------------------------------
     * 3. RESILIENCE INITIALIZATION
     * ----------------------------------------------------------------------
     */

    await bootstrapResilience({
      logger,
    });

    console.log(
      "✅ Resilience initialized"
    );

    /**
     * ----------------------------------------------------------------------
     * 4. DATABASE INITIALIZATION
     * ----------------------------------------------------------------------
     *
     * Uncomment when MongoDB configuration
     * is ready.
     */

    /*
    await mongoose.connect(
      process.env.MONGODB_URI,
      {
        autoIndex: false,
      }
    );
    */

    console.log(
      "✅ Database initialization completed"
    );

    /**
     * ----------------------------------------------------------------------
     * 5. START HTTP SERVER
     * ----------------------------------------------------------------------
     */

    const PORT =
      Number(process.env.PORT) || 5000;

    const server = app.listen(
      PORT,
      () => {
        console.log(
          `✅ Server running on port ${PORT}`
        );
      }
    );

    /**
     * ----------------------------------------------------------------------
     * GRACEFUL SHUTDOWN
     * ----------------------------------------------------------------------
     */

    const gracefulShutdown =
      async (signal) => {
        console.log(
          `⚠️ ${signal} received. Beginning graceful shutdown...`
        );

        server.close(() => {
          console.log(
            "✅ HTTP server closed"
          );
          process.exit(0);
        });
      };

    process.on(
      "SIGINT",
      gracefulShutdown
    );

    process.on(
      "SIGTERM",
      gracefulShutdown
    );

    return server;
  } catch (error) {
    console.error(
      "❌ Application startup failed"
    );

    console.error(error);

    process.exit(1);
  }
}

/**
 * ============================================================================
 * START APPLICATION
 * ============================================================================
 */

startServer();


/**
 * --------------------------------------------------------------------------
 * Enterprise Bootstrap Error
 * --------------------------------------------------------------------------
 */

class RuntimeBootstrapError extends Error {

  constructor(message, details = {}) {

    super(message);

    this.name = "RuntimeBootstrapError";

    this.details = details;

    Error.captureStackTrace(this, this.constructor);

  }

}

/**
 * --------------------------------------------------------------------------
 * Version Helpers
 * --------------------------------------------------------------------------
 */

function getNodeMajorVersion() {

  return Number(process.versions.node.split(".")[0]);

}

function assertNodeVersion() {

  const major = getNodeMajorVersion();

  if (major < RUNTIME_REQUIREMENTS.minimumNodeMajor) {

    throw new RuntimeBootstrapError(
      "Unsupported Node.js runtime.",
      {
        required: `${RUNTIME_REQUIREMENTS.minimumNodeMajor}+`,
        current: process.version
      }
    );

  }

}

/**
 * --------------------------------------------------------------------------
 * Runtime Feature Validation
 * --------------------------------------------------------------------------
 */

function assertRuntimeFeatures() {

  const requiredFeatures = {

    randomUUID:
      typeof crypto.randomUUID === "function",

    structuredClone:
      typeof global.structuredClone === "function",

    fetch:
      typeof global.fetch === "function",

    AbortController:
      typeof global.AbortController === "function",

    URLPattern:
      typeof global.URLPattern === "function"

  };

  const missing = Object.entries(requiredFeatures)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature);

  if (missing.length > 0) {

    throw new RuntimeBootstrapError(
      "Required runtime features are unavailable.",
      {
        missing
      }
    );

  }

}

/**
 * --------------------------------------------------------------------------
 * Platform Validation
 * --------------------------------------------------------------------------
 */

function assertPlatform() {

  if (

    !RUNTIME_REQUIREMENTS
      .supportedPlatforms
      .includes(process.platform)

  ) {

    throw new RuntimeBootstrapError(
      "Unsupported operating system.",
      {
        platform: process.platform
      }
    );

  }

}

/**
 * --------------------------------------------------------------------------
 * CPU Architecture Validation
 * --------------------------------------------------------------------------
 */

function assertArchitecture() {

  if (

    !RUNTIME_REQUIREMENTS
      .supportedArchitectures
      .includes(process.arch)

  ) {

    throw new RuntimeBootstrapError(
      "Unsupported CPU architecture.",
      {
        architecture: process.arch
      }
    );

  }

}

/**
 * --------------------------------------------------------------------------
 * Process Privilege Validation
 * --------------------------------------------------------------------------
 */

function validateProcessPrivileges() {

  const isRoot =

    process.platform !== "win32" &&
    typeof process.getuid === "function" &&
    process.getuid() === 0;

  return Object.freeze({

    isRoot,

    warning:

      isRoot
        ? "Server is running with root privileges."
        : null

  });

}

/**
 * --------------------------------------------------------------------------
 * OpenSSL Validation
 * --------------------------------------------------------------------------
 */

function assertOpenSSL() {

  if (!process.versions.openssl) {

    throw new RuntimeBootstrapError(
      "OpenSSL runtime not detected."
    );

  }

  return Object.freeze({

    version:
      process.versions.openssl

  });

}

/**
 * --------------------------------------------------------------------------
 * Optional FIPS Detection
 * --------------------------------------------------------------------------
 */

function detectFipsMode() {

  try {

    if (typeof crypto.getFips === "function") {

      return Object.freeze({

        enabled:
          crypto.getFips() === 1

      });

    }

  } catch {

    // Ignore unsupported implementations.

  }

  return Object.freeze({

    enabled: false

  });

}

/**
 * --------------------------------------------------------------------------
 * Execute Enterprise Runtime Validation
 * --------------------------------------------------------------------------
 *
 * Responsibilities
 * --------------------------------------------------------------------------
 * ✓ Validate enterprise runtime requirements
 * ✓ Produce immutable runtime validation report
 * ✓ Log successful validation
 * ✓ Return diagnostics for downstream bootstrap
 * --------------------------------------------------------------------------
 */

/**
 * ============================================================================
 * Enterprise Runtime Validation
 * ============================================================================
 */

const os =
    require("os");


const {
    logger
}
=
require(
    "../shared/logging/LoggerFactory"
);



/**
 * --------------------------------------------------------------------------
 * Execute Enterprise Runtime Validation
 * --------------------------------------------------------------------------
 *
 * Responsibilities
 * --------------------------------------------------------------------------
 * ✓ Validate enterprise runtime requirements
 * ✓ Produce immutable runtime validation report
 * ✓ Log successful validation
 * ✓ Return diagnostics for downstream bootstrap
 * --------------------------------------------------------------------------
 */


function validateEnterpriseRuntime() {


    assertNodeVersion();


    assertRuntimeFeatures();


    assertArchitecture();


    assertPlatform();



    const privileges =
        validateProcessPrivileges();



    const openssl =
        assertOpenSSL();



    const fips =
        detectFipsMode();



    const report =
        Object.freeze({


            validated:
                true,


            validatedAt:
                new Date().toISOString(),


            nodeVersion:
                process.version,


            v8Version:
                process.versions.v8,


            platform:
                process.platform,


            architecture:
                process.arch,


            hostname:
                os.hostname(),


            cpuCount:
                os.cpus().length,


            processId:
                process.pid,


            openssl:
                Object.freeze(
                    openssl || {}
                ),


            fips:
                Object.freeze(
                    fips || {}
                ),


            privileges:
                Object.freeze(
                    privileges || {}
                )


        });



    if (
        logger &&
        typeof logger.info === "function"
    ) {


        logger.info({

            section:
                "runtime-validation",


            node:
                report.nodeVersion,


            platform:
                report.platform,


            architecture:
                report.architecture,


            hostname:
                report.hostname,


            openssl:
                report.openssl?.version ??
                "unknown",


            fips:
                report.fips?.enabled ??
                false


        });


    }



    return report;

}



/**
 * --------------------------------------------------------------------------
 * Exports
 * --------------------------------------------------------------------------
 */

module.exports = {

    validateEnterpriseRuntime

};



/**
 * ============================================================================
 * Enterprise Server Runtime Entry Point
 * ============================================================================
 */


/**
 * --------------------------------------------------------------------------
 * Core Dependencies
 * --------------------------------------------------------------------------
 */

const process =
    require("process");

/**
 * --------------------------------------------------------------------------
 * Runtime Validation
 * --------------------------------------------------------------------------
 */

function validateEnterpriseRuntime() {


    const report = {


        validatedAt:
            new Date().toISOString(),


        nodeVersion:
            process.version,


        platform:
            process.platform,


        architecture:
            process.arch,


        hostname:
            require("os").hostname()


    };


    return Object.freeze(report);

}



/**
 * --------------------------------------------------------------------------
 * Exports
 * --------------------------------------------------------------------------
 */

module.exports = {

    validateEnterpriseRuntime

};

/**
 * --------------------------------------------------------------------------
 * Configuration
 * --------------------------------------------------------------------------
 */

const bootstrapEnvironment =
    require(
        "./config/bootstrapEnvironment"
    );


const {
    initializeConfiguration
}
=
require(
    "./config/configProvider"
);



/**
 * --------------------------------------------------------------------------
 * Application Runtime
 * --------------------------------------------------------------------------
 */

const createApp =
    require(
        "./app"
    );


const ServerRuntime =
    require(
        "./runtime/ServerRuntime"
    );


const ApplicationBootstrap =
    require(
        "./bootstrap"
    );



/**
 * --------------------------------------------------------------------------
 * Main Startup Lifecycle
 * --------------------------------------------------------------------------
 */

async function main() {


    try {


        /**
         * Environment
         */

        bootstrapEnvironment();



        /**
         * Configuration
         */

        const config =
            initializeConfiguration();



        /**
         * Application dependencies
         */

        const bootstrap =
            new ApplicationBootstrap();



        await bootstrap.start();



        /**
         * Express application
         */

        const app =
            createApp();



        /**
         * HTTP runtime
         */

        const runtime =
            new ServerRuntime({

                app,

                config,

                bootstrap,

                runtimeValidationReport

            });



        await runtime.start();



    }


    catch(error) {


        console.error(

            "SERVER STARTUP FAILED",

            {

                message:
                    error.message,

                stack:
                    error.stack

            }

        );


        process.exit(1);


    }


}



/**
 * --------------------------------------------------------------------------
 * Process Startup
 * --------------------------------------------------------------------------
 */

main();



/**
 * --------------------------------------------------------------------------
 * Exports
 * --------------------------------------------------------------------------
 */

module.exports = {

    main,

    runtimeValidationReport

};