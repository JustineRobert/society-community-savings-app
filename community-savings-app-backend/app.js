'use strict';

/**
 * =============================================================================
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 * =============================================================================
 *
 * File: backend/app.js
 *
 * SECTION 1.1
 * -----------------------------------------------------------------------------
 * Enterprise Foundation & Runtime Bootstrap
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Strict runtime
 * ✓ Node.js compatibility verification
 * ✓ Environment bootstrap
 * ✓ Package metadata loading
 * ✓ Runtime constants
 * ✓ Enterprise application constants
 * ✓ Immutable bootstrap information
 *
 * This section intentionally DOES NOT:
 * -----------------------------------------------------------------------------
 * ✗ Create Express application
 * ✗ Register middleware
 * ✗ Register routes
 * ✗ Connect MongoDB
 * ✗ Connect Redis
 * ✗ Start Socket.IO
 * ✗ Start HTTP server
 * =============================================================================
 */

/* =============================================================================
 * SECTION 1.1.1 — STRICT RUNTIME
 * ========================================================================== */

const path = require('path');
const fs = require('fs');
const os = require('os');
const process = require('process');
const crypto = require('crypto');

/* =============================================================================
 * OBSERVABILITY
 * ========================================================================== */

const {
    bootstrapResilienceObservability
} = require(
    './observability/resilienceObservabilityBootstrap'
);


/* -----------------------------------------------------------------------------
 * Enterprise Configuration
 * -------------------------------------------------------------------------- */

const configuration = Object.freeze({

    environment:
        process.env.NODE_ENV || 'development',

    port:
        Number(process.env.PORT) || 5000,

    serviceName:
        process.env.SERVICE_NAME ||
        'community-savings-backend',

    version:
        process.env.APP_VERSION ||
        '1.0.0',

    mongoUri:
        process.env.MONGODB_URI || null,

    redisUrl:
        process.env.REDIS_URL || null

});


/**
 * Enterprise-safe defaults.
 * Replace with actual implementations later.
 */

const logger = console;
const prometheus = null;
const tracer = null;

/**
 * Initialize observability.
 */

const resilienceTelemetry =
    bootstrapResilienceObservability({
        prometheus,
        tracer,
        logger
    });

/* =============================================================================
 * EVENT TYPES
 * ========================================================================== */

const EVENTS = require(
    './middleware/resilience/event-bus/resilienceEventTypes'
);

/* =============================================================================
 * OPTIONAL EVENT BUS DEPENDENCIES
 * ========================================================================== */

let factory = null;
let bus = null;

try {

    factory = require(
        './event-bus/resilienceEventFactory'
    );

    bus = require(
        './event-bus/resilienceEventBus'
    );

} catch (error) {

    logger.warn(
        '[RESILIENCE] Event Bus unavailable'
    );

}

/* =============================================================================
 * DEFAULT TENANT
 * ========================================================================== */

const tenantId =
    process.env.DEFAULT_TENANT_ID ||
    'SYSTEM';

/* =============================================================================
 * SAFE EVENT PUBLISHER
 * ========================================================================== */

function publishDependencyFailure() {

    if (!factory || !bus) {

        logger.warn(
            '[RESILIENCE] Event bus not initialized'
        );

        return;
    }

    const event = factory.create(

        EVENTS.FAILURE_DETECTED,

        {

            tenantId,

            dependency: 'MTN_MOMO',

            error: 'TIMEOUT'

        }

    );

    bus.publish(event);

    logger.info?.(
        '[RESILIENCE] Failure event published'
    );
}

/* =============================================================================
 * RESILIENCE BOOTSTRAP
 * ========================================================================== */

const {
    bootstrapResilience
} = require(
    './middleware/resilience/runtime/resilienceBootstrap'
);

/* =============================================================================
 * EXPORTS
 * ========================================================================== */

module.exports = {

    resilienceTelemetry,

    bootstrapResilience,

    publishDependencyFailure

};


/**
 * ============================================================================
 * APP INITIALIZATION
 * ============================================================================
 * Express application only.
 * No startup logic.
 * No database startup.
 * No resilience startup.
 * No Kubernetes startup.
 * No top-level await.
 * ============================================================================
 */

const express = require("express");

const app = express();

/**
 * ============================================================================
 * GLOBAL MIDDLEWARES
 * ============================================================================
 */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

/**
 * ============================================================================
 * APPLICATION ROUTES
 * ============================================================================
 */

/*
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/savings", savingsRoutes);
app.use("/api/loans", loanRoutes);
*/

/**
 * ============================================================================
 * HEALTH CHECK
 * ============================================================================
 */

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * ============================================================================
 * EXPORT APP
 * ============================================================================
 */

module.exports = app;

/* =============================================================================
 * SECTION 1.1.2 — MINIMUM NODE VERSION VALIDATION
 * ========================================================================== */

const MINIMUM_NODE_MAJOR = 20;
const CURRENT_NODE_VERSION = process.versions.node;
const CURRENT_NODE_MAJOR = Number(
    CURRENT_NODE_VERSION.split('.')[0]
);

if (Number.isNaN(CURRENT_NODE_MAJOR)) {
    throw new Error(
        'Unable to determine installed Node.js version.'
    );
}

if (CURRENT_NODE_MAJOR < MINIMUM_NODE_MAJOR) {
    throw new Error(
        [
            '',
            '=====================================================',
            ' Unsupported Node.js Runtime',
            '-----------------------------------------------------',
            ` Installed : ${CURRENT_NODE_VERSION}`,
            ` Required  : >= ${MINIMUM_NODE_MAJOR}.0.0`,
            '=====================================================',
            ''
        ].join('\n')
    );
}

/* =============================================================================
 * SECTION 1.1.3 — ENVIRONMENT BOOTSTRAP
 * ========================================================================== */

const dotenv = require('dotenv');

const ENV_FILE = process.env.ENV_FILE
    ? path.resolve(process.cwd(), process.env.ENV_FILE)
    : path.resolve(process.cwd(), '.env');

dotenv.config({
    path: ENV_FILE,
    override: false
});

/* =============================================================================
 * SECTION 1.1.4 — APPLICATION ROOT
 * ========================================================================== */

const APPLICATION_ROOT = Object.freeze({
    root: process.cwd(),
    backend: __dirname,
    config: path.join(__dirname, 'config'),
    routes: path.join(__dirname, 'routes'),
    middleware: path.join(__dirname, 'middleware'),
    controllers: path.join(__dirname, 'controllers'),
    services: path.join(__dirname, 'services'),
    models: path.join(__dirname, 'models'),
    modules: path.join(__dirname, 'modules'),
    jobs: path.join(__dirname, 'jobs'),
    queues: path.join(__dirname, 'queues'),
    realtime: path.join(__dirname, 'realtime'),
    docs: path.join(process.cwd(), 'docs'),
    logs: path.join(process.cwd(), 'logs'),
    uploads: path.join(process.cwd(), 'uploads')
});

/* =============================================================================
 * SECTION 1.1.5 — PACKAGE METADATA LOADING
 * ========================================================================== */

let packageJson = Object.freeze({
    name: 'titech-community-capital',
    version: '1.0.0',
    description: 'African Community Finance Operating System',
    license: 'Proprietary'
});

try {

    const packagePath = path.resolve(
        process.cwd(),
        'package.json'
    );

    if (fs.existsSync(packagePath)) {

        packageJson = Object.freeze(
            JSON.parse(
                fs.readFileSync(
                    packagePath,
                    'utf8'
                )
            )
        );

    }

} catch (error) {

    console.warn(
        'Unable to load package.json:',
        error.message
    );

}

/* =============================================================================
 * SECTION 1.1.6 — BUILD INFORMATION
 * ========================================================================== */

const BUILD_INFORMATION = Object.freeze({

    application:

        packageJson.name ||

        'titech-community-capital',

    version:

        packageJson.version ||

        '1.0.0',

    description:

        packageJson.description ||

        'African Community Finance Operating System',

    author:

        packageJson.author ||

        'TITech Community Capital LTD',

    license:

        packageJson.license ||

        'Proprietary',

    gitCommit:

        process.env.GIT_COMMIT ||

        process.env.GITHUB_SHA ||

        'unknown',

    gitBranch:

        process.env.GIT_BRANCH ||

        process.env.GITHUB_REF_NAME ||

        'unknown',

    buildNumber:

        process.env.BUILD_NUMBER ||

        'local',

    buildDate:

        process.env.BUILD_DATE ||

        new Date().toISOString()

});

/* =============================================================================
 * SECTION 1.1.7 — RUNTIME CONSTANTS
 * ========================================================================== */

const RUNTIME = Object.freeze({

    nodeVersion:

        process.version,

    nodeMajor:

        CURRENT_NODE_MAJOR,

    platform:

        process.platform,

    architecture:

        process.arch,

    pid:

        process.pid,

    ppid:

        process.ppid,

    hostname:

        os.hostname(),

    cpuCount:

        os.cpus().length,

    totalMemory:

        os.totalmem(),

    freeMemory:

        os.freemem(),

    homeDirectory:

        os.homedir(),

    temporaryDirectory:

        os.tmpdir(),

    timezone:

        Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone,

    locale:

        Intl.DateTimeFormat()
            .resolvedOptions()
            .locale,

    startupTime:

        new Date().toISOString()

});

/* =============================================================================
 * SECTION 1.1.8 — DEPLOYMENT DETECTION
 * ========================================================================== */

const DEPLOYMENT = Object.freeze({

    environment:

        process.env.NODE_ENV ||

        'development',

    isProduction:

        process.env.NODE_ENV === 'production',

    isDevelopment:

        !process.env.NODE_ENV ||

        process.env.NODE_ENV === 'development',

    isTesting:

        process.env.NODE_ENV === 'test',

    isDocker:

        fs.existsSync('/.dockerenv'),

    isPM2:

        Boolean(process.env.pm_id),

    isCI:

        Boolean(process.env.CI),

    isKubernetes:

        Boolean(
            process.env.KUBERNETES_SERVICE_HOST
        ),

    podName:

        process.env.POD_NAME ||

        '',

    namespace:

        process.env.POD_NAMESPACE ||

        '',

    nodeName:

        process.env.NODE_NAME ||

        '',

    region:

        process.env.REGION ||

        'unknown'

});

/* =============================================================================
 * SECTION 1.1.9 — ENTERPRISE APPLICATION CONSTANTS
 * ========================================================================== */

const APPLICATION = Object.freeze({

    company:

        'TITech Community Capital LTD',

    platform:

        'African Community Finance Operating System',

    acronym:

        'TITech',

    apiPrefix:

        '/api',

    apiVersion:

        'v1',

    defaultEncoding:

        'utf8',

    requestIdHeader:

        'x-request-id',

    correlationIdHeader:

        'x-correlation-id',

    transactionIdHeader:

        'x-transaction-id',

    tenantHeader:

        'x-tenant-id',

    userHeader:

        'x-user-id'

});

/* =============================================================================
 * SECTION 1.1.10 — RUNTIME FINGERPRINT
 * ========================================================================== */

const RUNTIME_FINGERPRINT = Object.freeze({

    identifier:

        crypto
            .createHash('sha256')
            .update(
                JSON.stringify({
                    application:
                        BUILD_INFORMATION.application,
                    version:
                        BUILD_INFORMATION.version,
                    node:
                        process.version,
                    platform:
                        process.platform,
                    architecture:
                        process.arch,
                    startup:
                        RUNTIME.startupTime
                })
            )
            .digest('hex'),

    generatedAt:

        new Date().toISOString()

});

/* =============================================================================
 * SECTION 1.1.11 — BOOTSTRAP METADATA
 * ========================================================================== */

const BOOTSTRAP = Object.freeze({

    initializedAt:

        new Date(),

    processStartedAt:

        new Date(Date.now() - process.uptime() * 1000),

    applicationRoot:

        APPLICATION_ROOT.root,

    environmentFile:

        ENV_FILE,

    runtimeFingerprint:

        RUNTIME_FINGERPRINT.identifier

});

/* =============================================================================
 * SECTION 1.1.12 — EXPORTS
 * ========================================================================== */

module.exports.APPLICATION_ROOT = APPLICATION_ROOT;

module.exports.APPLICATION = APPLICATION;

module.exports.RUNTIME = RUNTIME;

module.exports.DEPLOYMENT = DEPLOYMENT;

module.exports.BUILD_INFORMATION = BUILD_INFORMATION;

module.exports.RUNTIME_FINGERPRINT = RUNTIME_FINGERPRINT;

module.exports.BOOTSTRAP = BOOTSTRAP;

module.exports.packageJson = packageJson;

/* =============================================================================
 * SECTION 1.2 — ENTERPRISE IMPORTS & DEPENDENCY LOADING
 * =============================================================================
 *
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Core Node.js dependency loading
 * ✓ Express ecosystem loading
 * ✓ Security libraries
 * ✓ Infrastructure libraries
 * ✓ Observability libraries
 * ✓ Internal framework loading
 * ✓ Optional dependency discovery
 * ✓ Runtime dependency registry
 * ✓ Dependency diagnostics
 * ✓ Immutable dependency container
 *
 * NOT INCLUDED
 * -----------------------------------------------------------------------------
 * ✗ Middleware registration
 * ✗ Route registration
 * ✗ Database initialization
 * ✗ Redis initialization
 * ✗ Queue startup
 * ✗ Socket.IO startup
 * =============================================================================
 */

/* =============================================================================
 * 1.2.1 CORE NODE.JS MODULES
 * =============================================================================
 */

// const fs = require("fs");
// const os = require("os");
// const path = require("path");
const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const dns = require("dns");
const url = require("url");
const util = require("util");
const stream = require("stream");
// const crypto = require("crypto");
// const process = require("process");
const events = require("events");
const cluster = require("cluster");
const zlib = require("zlib");
const childProcess = require("child_process");

const { EventEmitter } = require("events");

/* =============================================================================
 * 1.2.2 EXPRESS ECOSYSTEM
 * =============================================================================
 */

//const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const responseTime = require("response-time");
const timeout = require("connect-timeout");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

/* =============================================================================
 * 1.2.3 SECURITY LIBRARIES
 * =============================================================================
 */

const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

/* =============================================================================
 * 1.2.4 DATABASE & CACHE
 * =============================================================================
 */

const mongoose = require("mongoose");
const Redis = require("ioredis");

/* =============================================================================
 * 1.2.5 OBSERVABILITY
 * =============================================================================
 */

const promClient = require("prom-client");

/* =============================================================================
 * 1.2.6 VALIDATION
 * =============================================================================
 */

const Joi = require("joi");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

/* =============================================================================
 * 1.2.7 CONFIGURATION
 * =============================================================================
 */

// const dotenv = require("dotenv");

dotenv.config({
    path: process.env.ENV_FILE || ".env"
});

/* =============================================================================
 * 1.2.8 INTERNAL FRAMEWORK
 * =============================================================================
 */

const config = require("./config");
//const logger = require("./utils/logger");

const connectDB = require("./config/db");

const redisService =
    require("./services/redis");

const {
    errorHandler
} = require("./middleware/errorHandler");

const apiGateway =
    require("./middleware/apiGateway");

const {
    createSocketServer
} = require("./services/socket");

const initChatSocket =
    require("./realtime/chatSocket");

/* =============================================================================
 * 1.2.9 OPTIONAL DEPENDENCY LOADER
 * =============================================================================
 */

function optionalRequire(moduleName) {

    try {

        return require(moduleName);

    } catch (error) {

        logger.debug({

            event:
                "optional.dependency.unavailable",

            module:
                moduleName,

            message:
                error.message
        });

        return null;
    }
}

/* =============================================================================
 * 1.2.10 OPTIONAL ENTERPRISE MODULES
 * =============================================================================
 */

const BullMQ =
    optionalRequire("bullmq");

const swaggerUi =
    optionalRequire("swagger-ui-express");

const swaggerJsDoc =
    optionalRequire("swagger-jsdoc");

const OpenTelemetry =
    optionalRequire("@opentelemetry/api");

const Sentry =
    optionalRequire("@sentry/node");

const winston =
    optionalRequire("winston");

const pino =
    optionalRequire("pino");

/* =============================================================================
 * 1.2.11 OPTIONAL INTERNAL SERVICES
 * =============================================================================
 */

const QueueService =
    optionalRequire("./services/queueService");

const AuditService =
    optionalRequire("./services/auditService");

const RBACService =
    optionalRequire("./services/rbacService");

const NotificationService =
    optionalRequire("./services/notificationService");

const MetricsService =
    optionalRequire("./services/metricsService");

const LedgerService =
    optionalRequire("./modules/finance/services/ledgerService");

/* =============================================================================
 * 1.2.12 PACKAGE METADATA
 * =============================================================================
 */

// let packageJson = {};

try {

    packageJson = require("../package.json");

} catch {

    packageJson = {

        name:
            "titech-backend",

        version:
            "1.0.0",

        description:
            "African Community Finance Operating System"
    };

}

/* =============================================================================
 * 1.2.13 DEPENDENCY REGISTRY
 * =============================================================================
 */

const dependencyRegistry = new Map();

/* =============================================================================
 * 1.2.14 REGISTER DEPENDENCY
 * =============================================================================
 */

function registerDependency(
    name,
    dependency
) {

    dependencyRegistry.set(name, {

        name,

        dependency,

        available:
            dependency !== null &&
            dependency !== undefined,

        loadedAt:
            new Date(),

        type:
            typeof dependency
    });

    return dependency;
}

/* =============================================================================
 * 1.2.15 REGISTER CORE DEPENDENCIES
 * =============================================================================
 */

[
    ["express", express],
    ["mongoose", mongoose],
    ["redis", Redis],
    ["helmet", helmet],
    ["compression", compression],
    ["cors", cors],
    ["cookieParser", cookieParser],
    ["hpp", hpp],
    ["mongoSanitize", mongoSanitize],
    ["xss", xss],
    ["promClient", promClient],
    ["logger", logger],
    ["config", config],
    ["connectDB", connectDB],
    ["redisService", redisService],
    ["apiGateway", apiGateway],
    ["errorHandler", errorHandler],
    ["socketFactory", createSocketServer]
].forEach(

    ([name, dependency]) =>

        registerDependency(
            name,
            dependency
        )

);

/* =============================================================================
 * 1.2.16 REGISTER OPTIONAL DEPENDENCIES
 * =============================================================================
 */

[
    ["BullMQ", BullMQ],
    ["SwaggerUI", swaggerUi],
    ["SwaggerJSDoc", swaggerJsDoc],
    ["OpenTelemetry", OpenTelemetry],
    ["Sentry", Sentry],
    ["Pino", pino],
    ["Winston", winston],
    ["QueueService", QueueService],
    ["AuditService", AuditService],
    ["RBACService", RBACService],
    ["NotificationService", NotificationService],
    ["MetricsService", MetricsService],
    ["LedgerService", LedgerService]
].forEach(

    ([name, dependency]) =>

        registerDependency(
            name,
            dependency
        )

);

/* =============================================================================
 * 1.2.17 DEPENDENCY HELPERS
 * =============================================================================
 */

function getDependency(name) {

    return dependencyRegistry.get(name);

}

function hasDependency(name) {

    return dependencyRegistry.has(name);

}

function getDependencyNames() {

    return Array.from(
        dependencyRegistry.keys()
    );

}

function getAvailableDependencies() {

    return Array.from(
        dependencyRegistry.values()
    )

    .filter(
        dependency => dependency.available
    )

    .map(
        dependency => dependency.name
    );

}

function getUnavailableDependencies() {

    return Array.from(
        dependencyRegistry.values()
    )

    .filter(
        dependency => !dependency.available
    )

    .map(
        dependency => dependency.name
    );

}

/* =============================================================================
 * 1.2.18 RUNTIME DEPENDENCY SNAPSHOT
 * =============================================================================
 */

const dependencySnapshot = Object.freeze({

    total:
        dependencyRegistry.size,

    available:
        getAvailableDependencies(),

    unavailable:
        getUnavailableDependencies(),

    package:

        packageJson.name,

    version:

        packageJson.version
});

/* =============================================================================
 * 1.2.19 IMMUTABLE DEPENDENCY CONTAINER
 * =============================================================================
 */

const dependencies = Object.freeze({

    express,

    mongoose,

    Redis,

    helmet,

    compression,

    cors,

    cookieParser,

    responseTime,

    timeout,

    rateLimit,

    hpp,

    mongoSanitize,

    xss,

    promClient,

    logger,

    config,

    connectDB,

    redisService,

    apiGateway,

    errorHandler,

    createSocketServer,

    initChatSocket,

    packageJson,

    dependencyRegistry
});

/* =============================================================================
 * 1.2.20 STARTUP DIAGNOSTICS
 * =============================================================================
 */

logger.info({

    section:
        "dependency-bootstrap",

    package:
        packageJson.name,

    version:
        packageJson.version,

    dependencies:
        dependencyRegistry.size,

    available:
        getAvailableDependencies().length,

    optionalMissing:
        getUnavailableDependencies()
});

/* =============================================================================
 * SECTION 1.2 EXPORTS
 * =============================================================================
 */

module.exports.dependencies =
    dependencies;

module.exports.packageJson =
    packageJson;

module.exports.dependencyRegistry =
    dependencyRegistry;

module.exports.dependencySnapshot =
    dependencySnapshot;

module.exports.registerDependency =
    registerDependency;

module.exports.getDependency =
    getDependency;

module.exports.hasDependency =
    hasDependency;

module.exports.getDependencyNames =
    getDependencyNames;

module.exports.getAvailableDependencies =
    getAvailableDependencies;

module.exports.getUnavailableDependencies =
    getUnavailableDependencies;

module.exports.optionalRequire =
    optionalRequire;

/* =============================================================================
 * SECTION 1.3 — APPLICATION METADATA & RUNTIME INFORMATION
 * =============================================================================
 *
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Build metadata
 * ✓ Runtime metadata
 * ✓ Infrastructure discovery
 * ✓ Deployment metadata
 * ✓ Configuration fingerprint
 * ✓ Immutable runtime context
 * ✓ Enterprise event bus
 * ✓ Runtime diagnostics
 *
 * NOT INCLUDED
 * -----------------------------------------------------------------------------
 * ✗ Express middleware
 * ✗ Routes
 * ✗ Database connections
 * ✗ Redis connections
 * ✗ Workers
 * ✗ Socket.IO startup
 * =============================================================================
 */

/* =============================================================================
 * 1.3.1 BUILD METADATA
 * =============================================================================
 */

const buildMetadata = Object.freeze({

    applicationName:
        packageJson.name ||
        "titech-community-capital",

    displayName:
        process.env.APP_NAME ||
        "TITech Community Capital",

    version:
        packageJson.version ||
        "1.0.0",

    description:
        packageJson.description ||
        "African Community Finance Operating System",

    author:
        packageJson.author ||
        "TITech Community Capital LTD",

    license:
        packageJson.license ||
        "Proprietary",

    homepage:
        packageJson.homepage || null,

    repository:
        packageJson.repository || null,

    buildNumber:
        process.env.BUILD_NUMBER ||
        "local",

    buildDate:
        process.env.BUILD_DATE ||
        new Date().toISOString(),

    gitCommit:
        process.env.GIT_COMMIT ||
        process.env.GITHUB_SHA ||
        "unknown",

    gitBranch:
        process.env.GIT_BRANCH ||
        process.env.GITHUB_REF_NAME ||
        "unknown"
});

/* =============================================================================
 * 1.3.2 RUNTIME METADATA
 * =============================================================================
 */

const runtimeMetadata = Object.freeze({

    processId:
        process.pid,

    parentProcessId:
        process.ppid,

    nodeVersion:
        process.version,

    nodeArchitecture:
        process.arch,

    operatingSystem:
        process.platform,

    hostname:
        os.hostname(),

    timezone:
        Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone,

    locale:
        Intl.DateTimeFormat()
            .resolvedOptions()
            .locale,

    cpuCount:
        os.cpus().length,

    totalMemory:
        os.totalmem(),

    freeMemory:
        os.freemem(),

    bootTimestamp:
        new Date().toISOString(),

    startupHrTime:
        process.hrtime.bigint()
});

/* =============================================================================
 * 1.3.3 INFRASTRUCTURE DETECTION
 * =============================================================================
 */

const infrastructure = Object.freeze({

    docker:

        fs.existsSync("/.dockerenv"),

    kubernetes:

        Boolean(
            process.env.KUBERNETES_SERVICE_HOST
        ),

    pm2:

        Boolean(
            process.env.pm_id
        ),

    cluster:

        cluster.isWorker,

    workerId:

        cluster.worker
            ? cluster.worker.id
            : null,

    ci:

        Boolean(
            process.env.CI
        ),

    githubActions:

        Boolean(
            process.env.GITHUB_ACTIONS
        ),

    azure:

        Boolean(
            process.env.WEBSITE_INSTANCE_ID
        ),

    aws:

        Boolean(
            process.env.AWS_REGION
        ),

    gcp:

        Boolean(
            process.env.GOOGLE_CLOUD_PROJECT
        ),

    railway:

        Boolean(
            process.env.RAILWAY_ENVIRONMENT
        ),

    render:

        Boolean(
            process.env.RENDER
        ),

    vercel:

        Boolean(
            process.env.VERCEL
        ),

    fly:

        Boolean(
            process.env.FLY_APP_NAME
        )
});

/* =============================================================================
 * 1.3.4 DEPLOYMENT METADATA
 * =============================================================================
 */

const deploymentMetadata = Object.freeze({

    environment:

        process.env.NODE_ENV ||
        "development",

    deploymentMode:

        process.env.DEPLOYMENT_MODE ||
        "standalone",

    region:

        process.env.REGION ||
        process.env.AWS_REGION ||
        "unknown",

    availabilityZone:

        process.env.AVAILABILITY_ZONE ||
        "unknown",

    cluster:

        process.env.CLUSTER_NAME ||
        "default",

    namespace:

        process.env.K8S_NAMESPACE ||
        process.env.NAMESPACE ||
        "default",

    pod:

        process.env.POD_NAME ||
        null,

    node:

        process.env.NODE_NAME ||
        null,

    instance:

        process.env.INSTANCE_ID ||
        runtimeMetadata.hostname,

    tenantMode:

        process.env.MULTI_TENANT_MODE === "false"
            ? "single"
            : "multi"
});

/* =============================================================================
 * 1.3.5 CONFIGURATION FINGERPRINT
 * =============================================================================
 */

const configurationFingerprint = crypto

    .createHash("sha256")

    .update(

        JSON.stringify({

            application:

                buildMetadata.applicationName,

            version:

                buildMetadata.version,

            environment:

                deploymentMetadata.environment,

            mongodb:

                process.env.MONGODB_URI || "",

            redis:

                process.env.REDIS_HOST || "",

            jwt:

                process.env.JWT_SECRET
                    ? "configured"
                    : "missing",

            generated:

                new Date()
                    .toISOString()
        })

    )

    .digest("hex");

/* =============================================================================
 * 1.3.6 ENTERPRISE EVENT BUS
 * =============================================================================
 */

const runtimeEvents = new EventEmitter({

    captureRejections: true

});

runtimeEvents.setMaxListeners(100);

/* =============================================================================
 * 1.3.7 ENTERPRISE RUNTIME CONTEXT
 * =============================================================================
 */

const runtimeContext = Object.freeze({

    build:
        buildMetadata,

    runtime:
        runtimeMetadata,

    deployment:
        deploymentMetadata,

    infrastructure,

    configurationFingerprint,

    dependencies:
        dependencySnapshot
});

/* =============================================================================
 * 1.3.8 RUNTIME HELPERS
 * =============================================================================
 */

function getRuntimeContext() {

    return runtimeContext;

}

function getBuildMetadata() {

    return buildMetadata;

}

function getRuntimeMetadata() {

    return runtimeMetadata;

}

function getDeploymentMetadata() {

    return deploymentMetadata;

}

function getInfrastructureMetadata() {

    return infrastructure;

}

function getConfigurationFingerprint() {

    return configurationFingerprint;

}

/* =============================================================================
 * 1.3.9 RUNTIME SNAPSHOT
 * =============================================================================
 */

function buildRuntimeSnapshot() {

    return {

        application:

            buildMetadata.applicationName,

        version:

            buildMetadata.version,

        environment:

            deploymentMetadata.environment,

        deployment:

            deploymentMetadata.deploymentMode,

        hostname:

            runtimeMetadata.hostname,

        uptime:

            process.uptime(),

        processId:

            runtimeMetadata.processId,

        memory:

            process.memoryUsage(),

        cpuCount:

            runtimeMetadata.cpuCount,

        fingerprint:

            configurationFingerprint
    };

}

/* =============================================================================
 * 1.3.10 STARTUP DIAGNOSTICS
 * =============================================================================
 */

logger.info({

    section:
        "application-metadata",

    application:
        buildMetadata.applicationName,

    version:
        buildMetadata.version,

    environment:
        deploymentMetadata.environment,

    deployment:
        deploymentMetadata.deploymentMode,

    docker:
        infrastructure.docker,

    kubernetes:
        infrastructure.kubernetes,

    fingerprint:
        configurationFingerprint.substring(0, 16)
});

/* =============================================================================
 * SECTION 1.3 EXPORTS
 * =============================================================================
 */

module.exports.buildMetadata =
    buildMetadata;

module.exports.runtimeMetadata =
    runtimeMetadata;

module.exports.infrastructure =
    infrastructure;

module.exports.deploymentMetadata =
    deploymentMetadata;

module.exports.runtimeContext =
    runtimeContext;

module.exports.runtimeEvents =
    runtimeEvents;

module.exports.configurationFingerprint =
    configurationFingerprint;

module.exports.getRuntimeContext =
    getRuntimeContext;

module.exports.getBuildMetadata =
    getBuildMetadata;

module.exports.getRuntimeMetadata =
    getRuntimeMetadata;

module.exports.getDeploymentMetadata =
    getDeploymentMetadata;

module.exports.getInfrastructureMetadata =
    getInfrastructureMetadata;

module.exports.getConfigurationFingerprint =
    getConfigurationFingerprint;

module.exports.buildRuntimeSnapshot =
    buildRuntimeSnapshot;

/* =============================================================================
 * SECTION 1.4 — ENTERPRISE RUNTIME CONTEXT
 * =============================================================================
 *
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Immutable runtime context
 * ✓ Enterprise event bus
 * ✓ Bootstrap lifecycle
 * ✓ Enterprise application state
 * ✓ Runtime diagnostics
 * ✓ State transitions
 * ✓ Service discovery foundation
 *
 * NOT INCLUDED
 * -----------------------------------------------------------------------------
 * ✗ Middleware registration
 * ✗ Routes
 * ✗ Database initialization
 * ✗ Redis initialization
 * ✗ Queue startup
 * ✗ Socket.IO startup
 * =============================================================================
 */

/* =============================================================================
 * 1.4.1 BOOTSTRAP LIFECYCLE
 * =============================================================================
 */

const BOOTSTRAP_PHASES = Object.freeze({

    CREATED:
        "created",

    CONFIGURATION:
        "configuration",

    DEPENDENCIES:
        "dependencies",

    APPLICATION:
        "application",

    MIDDLEWARE:
        "middleware",

    ROUTES:
        "routes",

    OBSERVABILITY:
        "observability",

    DATABASE:
        "database",

    REDIS:
        "redis",

    QUEUES:
        "queues",

    WEBSOCKET:
        "websocket",

    READY:
        "ready",

    SHUTTING_DOWN:
        "shutting_down",

    STOPPED:
        "stopped"

});

/* =============================================================================
 * 1.4.2 ENTERPRISE EVENT BUS
 * =============================================================================
 */

const applicationEvents = runtimeEvents;

applicationEvents.setMaxListeners(250);

/* =============================================================================
 * 1.4.3 ENTERPRISE APPLICATION STATE
 * =============================================================================
 */

const applicationState = {

    initialized: false,

    started: false,

    healthy: false,

    shuttingDown: false,

    terminated: false,

    bootstrapPhase:
        BOOTSTRAP_PHASES.CREATED,

    startedAt: null,

    readyAt: null,

    shutdownStartedAt: null,

    lastHealthCheck: null,

    requestCount: 0,

    activeRequests: 0,

    websocketConnections: 0,

    services: {

        database: false,

        redis: false,

        queues: false,

        websocket: false,

        metrics: false,

        documentation: false
    }

};

/* =============================================================================
 * 1.4.4 STATE HELPERS
 * =============================================================================
 */

function updateBootstrapPhase(phase) {

    if (!Object.values(BOOTSTRAP_PHASES).includes(phase)) {

        throw new Error(
            `Unknown bootstrap phase: ${phase}`
        );

    }

    applicationState.bootstrapPhase =
        phase;

    applicationEvents.emit(
        "bootstrap.phase.changed",
        {

            phase,

            timestamp:
                new Date().toISOString()

        }
    );

    logger.info({

        section:
            "bootstrap",

        phase

    });

}

function markServiceReady(name) {

    if (!(name in applicationState.services)) {

        applicationState.services[name] = true;

    } else {

        applicationState.services[name] = true;

    }

    applicationEvents.emit(
        "service.ready",
        {

            service: name,

            timestamp:
                new Date().toISOString()

        }
    );

}

function markServiceUnavailable(name) {

    applicationState.services[name] = false;

    applicationEvents.emit(
        "service.unavailable",
        {

            service: name,

            timestamp:
                new Date().toISOString()

        }
    );

}

/* =============================================================================
 * 1.4.5 APPLICATION LIFECYCLE
 * =============================================================================
 */

function markApplicationStarted() {

    applicationState.initialized = true;

    applicationState.started = true;

    applicationState.startedAt = new Date();

    updateBootstrapPhase(
        BOOTSTRAP_PHASES.APPLICATION
    );

}

function markApplicationReady() {

    applicationState.healthy = true;

    applicationState.readyAt =
        new Date();

    updateBootstrapPhase(
        BOOTSTRAP_PHASES.READY
    );

    applicationEvents.emit(
        "application.ready",
        {

            timestamp:
                applicationState.readyAt

        }
    );

}

function markApplicationShutdown() {

    applicationState.shuttingDown = true;

    applicationState.shutdownStartedAt =
        new Date();

    updateBootstrapPhase(
        BOOTSTRAP_PHASES.SHUTTING_DOWN
    );

    applicationEvents.emit(
        "application.shutdown",

        {

            timestamp:
                applicationState.shutdownStartedAt

        }
    );

}

function markApplicationStopped() {

    applicationState.terminated = true;

    applicationState.healthy = false;

    updateBootstrapPhase(
        BOOTSTRAP_PHASES.STOPPED
    );

}

/* =============================================================================
 * 1.4.6 REQUEST STATISTICS
 * =============================================================================
 */

function incrementActiveRequests() {

    applicationState.requestCount++;

    applicationState.activeRequests++;

}

function decrementActiveRequests() {

    applicationState.activeRequests =
        Math.max(
            0,
            applicationState.activeRequests - 1
        );

}

function incrementSocketConnections() {

    applicationState.websocketConnections++;

}

function decrementSocketConnections() {

    applicationState.websocketConnections =
        Math.max(
            0,
            applicationState.websocketConnections - 1
        );

}

/* =============================================================================
 * 1.4.7 RUNTIME SNAPSHOT
 * =============================================================================
 */

function getApplicationState() {

    return {

        initialized:
            applicationState.initialized,

        started:
            applicationState.started,

        healthy:
            applicationState.healthy,

        shuttingDown:
            applicationState.shuttingDown,

        bootstrapPhase:
            applicationState.bootstrapPhase,

        uptime:
            process.uptime(),

        activeRequests:
            applicationState.activeRequests,

        totalRequests:
            applicationState.requestCount,

        websocketConnections:
            applicationState.websocketConnections,

        services:
            { ...applicationState.services }

    };

}

/* =============================================================================
 * 1.4.8 IMMUTABLE RUNTIME CONTEXT
 * =============================================================================
 */

const enterpriseRuntimeContext = Object.freeze({

    build:
        buildMetadata,

    runtime:
        runtimeMetadata,

    deployment:
        deploymentMetadata,

    infrastructure,

    fingerprint:
        configurationFingerprint,

    dependencies,

    applicationState,

    lifecycle:
        BOOTSTRAP_PHASES,

    events:
        applicationEvents

});

/* =============================================================================
 * 1.4.9 BOOTSTRAP INITIALIZATION
 * =============================================================================
 */

markApplicationStarted();

logger.info({

    section:
        "runtime-context",

    bootstrapPhase:
        applicationState.bootstrapPhase,

    environment:
        deploymentMetadata.environment,

    deployment:
        deploymentMetadata.deploymentMode

});

/* =============================================================================
 * SECTION 1.4 EXPORTS
 * =============================================================================
 */

module.exports.applicationEvents =
    applicationEvents;

module.exports.applicationState =
    applicationState;

module.exports.enterpriseRuntimeContext =
    enterpriseRuntimeContext;

module.exports.BOOTSTRAP_PHASES =
    BOOTSTRAP_PHASES;

module.exports.markApplicationStarted =
    markApplicationStarted;

module.exports.markApplicationReady =
    markApplicationReady;

module.exports.markApplicationShutdown =
    markApplicationShutdown;

module.exports.markApplicationStopped =
    markApplicationStopped;

module.exports.updateBootstrapPhase =
    updateBootstrapPhase;

module.exports.markServiceReady =
    markServiceReady;

module.exports.markServiceUnavailable =
    markServiceUnavailable;

module.exports.incrementActiveRequests =
    incrementActiveRequests;

module.exports.decrementActiveRequests =
    decrementActiveRequests;

module.exports.incrementSocketConnections =
    incrementSocketConnections;

module.exports.decrementSocketConnections =
    decrementSocketConnections;

module.exports.getApplicationState =
    getApplicationState;

/* =============================================================================
 * SECTION 1.5 — ENTERPRISE SERVICE REGISTRY
 * =============================================================================
 *
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Dependency container
 * ✓ Service registration
 * ✓ Service discovery
 * ✓ Health registration
 * ✓ Diagnostics helpers
 * ✓ Lifecycle hooks
 * ✓ Shutdown ordering
 * ✓ Enterprise dependency injection
 *
 * NOT INCLUDED
 * -----------------------------------------------------------------------------
 * ✗ Database initialization
 * ✗ Redis startup
 * ✗ Queue startup
 * ✗ Express middleware
 * ✗ Route registration
 * =============================================================================
 */

/* =============================================================================
 * 1.5.1 SERVICE REGISTRY
 * =============================================================================
 */

const serviceRegistry = new Map();

/* =============================================================================
 * 1.5.2 SERVICE HEALTH REGISTRY
 * =============================================================================
 */

const serviceHealthRegistry = new Map();

/* =============================================================================
 * 1.5.3 DEPENDENCY CONTAINER
 * =============================================================================
 */

const dependencyContainer = {

    register: registerService,

    resolve: getService,

    exists: hasService,

    remove: unregisterService,

    list: getRegisteredServices

};

/* =============================================================================
 * 1.5.4 REGISTER SERVICE
 * =============================================================================
 */

function registerService(

    name,

    instance,

    options = {}

) {

    if (!name) {

        throw new Error(
            "Service name is required."
        );

    }

    if (serviceRegistry.has(name)) {

        logger.warn({

            section:
                "service-registry",

            event:
                "duplicate-registration",

            service:
                name

        });

    }

    const service = {

        name,

        instance,

        version:

            options.version ||

            "1.0.0",

        category:

            options.category ||

            "general",

        singleton:

            options.singleton !== false,

        description:

            options.description ||

            "",

        startedAt:

            new Date(),

        registeredAt:

            new Date(),

        shutdownPriority:

            options.shutdownPriority ||

            100,

        tags:

            options.tags ||

            []

    };

    serviceRegistry.set(

        name,

        service

    );

    registerServiceHealth(

        name,

        {

            status: "registered"

        }

    );

    applicationEvents.emit(

        "service.registered",

        {

            service:

                name,

            timestamp:

                new Date().toISOString()

        }

    );

    logger.info({

        section:

            "service-registry",

        registered:

            name

    });

    return instance;

}

/* =============================================================================
 * 1.5.5 UNREGISTER SERVICE
 * =============================================================================
 */

function unregisterService(

    name

) {

    serviceRegistry.delete(name);

    serviceHealthRegistry.delete(name);

    applicationEvents.emit(

        "service.unregistered",

        {

            service:

                name

        }

    );

}

/* =============================================================================
 * 1.5.6 SERVICE DISCOVERY
 * =============================================================================
 */

function getService(name) {

    return serviceRegistry.get(name)?.instance;

}

function hasService(name) {

    return serviceRegistry.has(name);

}

function getRegisteredServices() {

    return Array.from(

        serviceRegistry.keys()

    );

}

function getServiceMetadata(name) {

    return serviceRegistry.get(name);

}

/* =============================================================================
 * 1.5.7 HEALTH REGISTRATION
 * =============================================================================
 */

function registerServiceHealth(

    service,

    health = {}

) {

    serviceHealthRegistry.set(

        service,

        {

            status:

                health.status ||

                "healthy",

            message:

                health.message ||

                null,

            lastCheck:

                new Date(),

            latency:

                health.latency ||

                null,

            metadata:

                health.metadata ||

                {}

        }

    );

}

/* =============================================================================
 * 1.5.8 UPDATE HEALTH
 * =============================================================================
 */

function updateServiceHealth(

    service,

    status,

    message = null

) {

    const current =

        serviceHealthRegistry.get(service)

        ||

        {};

    current.status = status;

    current.message = message;

    current.lastCheck =

        new Date();

    serviceHealthRegistry.set(

        service,

        current

    );

}

/* =============================================================================
 * 1.5.9 SERVICE HEALTH LOOKUP
 * =============================================================================
 */

function getServiceHealth(

    service

) {

    return serviceHealthRegistry.get(

        service

    );

}

function getAllServiceHealth() {

    return Object.fromEntries(

        serviceHealthRegistry

    );

}

/* =============================================================================
 * 1.5.10 DIAGNOSTICS
 * =============================================================================
 */

function getServiceDiagnostics() {

    return {

        totalServices:

            serviceRegistry.size,

        registered:

            getRegisteredServices(),

        healthy:

            Array.from(

                serviceHealthRegistry.values()

            )

            .filter(

                s => s.status === "healthy"

            )

            .length,

        unhealthy:

            Array.from(

                serviceHealthRegistry.values()

            )

            .filter(

                s =>

                s.status !== "healthy"

            )

            .length

    };

}

/* =============================================================================
 * 1.5.11 SHUTDOWN ORDER
 * =============================================================================
 */

function getShutdownOrder() {

    return Array.from(

        serviceRegistry.values()

    )

    .sort(

        (

            a,

            b

        ) =>

            b.shutdownPriority -

            a.shutdownPriority

    )

    .map(

        service =>

            service.name

    );

}

/* =============================================================================
 * 1.5.12 ENTERPRISE CONTAINER
 * =============================================================================
 */

const enterpriseContainer = Object.freeze({

    runtime:

        enterpriseRuntimeContext,

    services:

        dependencyContainer,

    registry:

        serviceRegistry,

    health:

        serviceHealthRegistry

});

/* =============================================================================
 * 1.5.13 REGISTER CORE SERVICES
 * =============================================================================
 */

registerService(

    "logger",

    logger,

    {

        category:

            "core"

    }

);

registerService(

    "config",

    config,

    {

        category:

            "core"

    }

);

registerService(

    "runtimeEvents",

    applicationEvents,

    {

        category:

            "core"

    }

);

registerService(

    "runtimeContext",

    enterpriseRuntimeContext,

    {

        category:

            "core"

    }

);

/* =============================================================================
 * 1.5.14 STARTUP LOGGING
 * =============================================================================
 */

logger.info({

    section:

        "service-registry",

    services:

        serviceRegistry.size,

    registered:

        getRegisteredServices()

});

/* =============================================================================
 * SECTION 1.5 EXPORTS
 * =============================================================================
 */

module.exports.enterpriseContainer =
    enterpriseContainer;

module.exports.dependencyContainer =
    dependencyContainer;

module.exports.serviceRegistry =
    serviceRegistry;

module.exports.serviceHealthRegistry =
    serviceHealthRegistry;

module.exports.registerService =
    registerService;

module.exports.unregisterService =
    unregisterService;

module.exports.getService =
    getService;

module.exports.hasService =
    hasService;

module.exports.getRegisteredServices =
    getRegisteredServices;

module.exports.getServiceMetadata =
    getServiceMetadata;

module.exports.registerServiceHealth =
    registerServiceHealth;

module.exports.updateServiceHealth =
    updateServiceHealth;

module.exports.getServiceHealth =
    getServiceHealth;

module.exports.getAllServiceHealth =
    getAllServiceHealth;

module.exports.getServiceDiagnostics =
    getServiceDiagnostics;

module.exports.getShutdownOrder =
    getShutdownOrder;

/* =============================================================================
 * SECTION 1.6 — ENTERPRISE EXPRESS APPLICATION FACTORY
 * =============================================================================
 *
 * TITech Community Capital LTD
 * African Community Finance Operating System (ACFOS)
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Enterprise Express factory
 * ✓ Immutable application bootstrap
 * ✓ Internal metadata
 * ✓ Runtime container exposure
 * ✓ Enterprise service locator
 * ✓ Application diagnostics API
 * ✓ Runtime helpers
 * ✓ Lifecycle initialization
 * ✓ Dependency injection
 * ✓ Factory export
 *
 * NOT INCLUDED
 * -----------------------------------------------------------------------------
 * ✗ Middleware registration
 * ✗ Security pipeline
 * ✗ Routes
 * ✗ Socket.IO
 * ✗ Database connections
 * ✗ Redis connections
 * ✗ Queue initialization
 * ✗ HTTP server
 * =============================================================================
 */

//  const express = require("express");

/* -----------------------------------------------------------------------------
 * Enterprise Express Application Factory
 * -----------------------------------------------------------------------------
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Create Express application
 * ✓ Configure immutable application metadata
 * ✓ Attach enterprise runtime context
 * ✓ Expose dependency container
 * ✓ Register enterprise helper APIs
 * ✓ Expose diagnostics
 * ✓ Enterprise-safe defaults
 * -----------------------------------------------------------------------------
 */

function createApp() {

    const app = express();

    /* -------------------------------------------------------------------------
     * Express Hardening
     * ---------------------------------------------------------------------- */

    app.disable("x-powered-by");

    app.enable("trust proxy");

    /* -------------------------------------------------------------------------
     * Internal Metadata
     * ---------------------------------------------------------------------- */

    app.set(
        "applicationName",
        BUILD_INFORMATION.application
    );

    app.set(
        "applicationVersion",
        BUILD_INFORMATION.version
    );

    app.set(
        "environment",
        DEPLOYMENT.environment
    );

    app.set(
        "startupTimestamp",
        new Date()
    );

    app.set(
        "runtimeFingerprint",
        RUNTIME_FINGERPRINT.identifier
    );

    /* -------------------------------------------------------------------------
     * Runtime Context
     * ---------------------------------------------------------------------- */

    app.locals.runtime = Object.freeze({

        application: APPLICATION,

        build: BUILD_INFORMATION,

        runtime: RUNTIME,

        deployment: DEPLOYMENT,

        bootstrap: BOOTSTRAP,

        configuration,

        runtimeContext,

        applicationState,

        dependencyRegistry,

        serviceRegistry,

        runtimeEvents,

        logger

    });

    /* -------------------------------------------------------------------------
     * Runtime Helper APIs
     * ---------------------------------------------------------------------- */

    app.getRuntimeContext = () => runtimeContext;

    app.getApplicationState = () => applicationState;

    app.getConfiguration = () => configuration;

    app.getServices = () => serviceRegistry;

    app.getDependencies = () => dependencyRegistry;

    app.getBuildInformation = () => BUILD_INFORMATION;

    app.getDeploymentInformation = () => DEPLOYMENT;

    app.getRuntimeInformation = () => RUNTIME;

    app.getBootstrapInformation = () => BOOTSTRAP;

    /* -------------------------------------------------------------------------
     * Service Registry Helpers
     * ---------------------------------------------------------------------- */

    app.registerService = registerService;

    app.unregisterService = unregisterService;

    app.getService = getService;

    app.hasService = hasService;

    app.getRegisteredServices = getRegisteredServices;

    /* -------------------------------------------------------------------------
     * Runtime Diagnostics
     * ---------------------------------------------------------------------- */

    app.getDiagnostics = () => ({

        application:

            BUILD_INFORMATION.application,

        version:

            BUILD_INFORMATION.version,

        environment:

            DEPLOYMENT.environment,

        uptime:

            process.uptime(),

        pid:

            process.pid,

        memory:

            process.memoryUsage(),

        services:

            getRegisteredServices(),

        activeRequests:

            applicationState.activeRequests,

        totalRequests:

            applicationState.requestCount,

        websocketConnections:

            applicationState.websocketConnections,

        bootstrapPhase:

            applicationState.bootstrapPhase

    });

    app.getHealthSnapshot = () => ({

        status:

            applicationState.healthy
                ? "healthy"
                : "starting",

        initialized:

            applicationState.initialized,

        started:

            applicationState.started,

        ready:

            applicationState.healthy,

        shuttingDown:

            applicationState.shuttingDown,

        services:

            { ...applicationState.services }

    });

    app.getRuntimeSnapshot = () => ({

        runtime:

            RUNTIME,

        deployment:

            DEPLOYMENT,

        build:

            BUILD_INFORMATION,

        uptime:

            process.uptime(),

        fingerprint:

            RUNTIME_FINGERPRINT.identifier

    });

    /* -------------------------------------------------------------------------
     * Environment Helpers
     * ---------------------------------------------------------------------- */

    app.isProduction = () =>
        DEPLOYMENT.isProduction;

    app.isDevelopment = () =>
        DEPLOYMENT.isDevelopment;

    app.isTesting = () =>
        DEPLOYMENT.isTesting;

    app.isDocker = () =>
        DEPLOYMENT.isDocker;

    app.isKubernetes = () =>
        DEPLOYMENT.isKubernetes;

    /* -------------------------------------------------------------------------
     * Enterprise Event API
     * ---------------------------------------------------------------------- */

    app.emitRuntimeEvent = (
        event,
        payload = {}
    ) => {

        runtimeEvents.emit(

            event,

            {

                timestamp:
                    new Date().toISOString(),

                ...payload

            }

        );

    };

    /* -------------------------------------------------------------------------
     * Immutable Enterprise Context
     * ---------------------------------------------------------------------- */

    app.locals.enterprise = Object.freeze({

        application: APPLICATION,

        build: BUILD_INFORMATION,

        runtime: RUNTIME,

        deployment: DEPLOYMENT,

        bootstrap: BOOTSTRAP,

        configuration,

        runtimeContext,

        applicationState,

        dependencyRegistry,

        serviceRegistry,

        runtimeEvents,

        logger

    });

    /* -------------------------------------------------------------------------
     * Lifecycle
     * ---------------------------------------------------------------------- */

    applicationState.initialized = true;

    runtimeEvents.emit(
        "application.factory.created",
        {

            application:
                BUILD_INFORMATION.application,

            version:
                BUILD_INFORMATION.version,

            environment:
                DEPLOYMENT.environment,

            timestamp:
                new Date().toISOString()

        }
    );

    logger.info(

        "[APP]",

        "Enterprise Express application initialized"

    );

    return app;

}
   /* -----------------------------------------------------------------------------
 * Enterprise Bootstrap Context
 * -------------------------------------------------------------------------- */

const bootstrapContext = Object.freeze({

    application: APPLICATION,

    build: BUILD_INFORMATION,

    runtime: RUNTIME,

    deployment: DEPLOYMENT,

    bootstrap: BOOTSTRAP,

    configuration,

    runtimeContext,

    applicationState,

    serviceRegistry,

    dependencyRegistry,

    runtimeEvents

});

/* -----------------------------------------------------------------------------
 * Enterprise Public API
 * -------------------------------------------------------------------------- */

module.exports = Object.freeze({

    /* Express Factory */

    createApp,

    /* Enterprise Context */

    bootstrapContext,

    runtimeContext,

    applicationState,

    runtimeEvents,

    /* Metadata */

    APPLICATION,

    BUILD_INFORMATION,

    RUNTIME,

    DEPLOYMENT,

    BOOTSTRAP,

    RUNTIME_FINGERPRINT,

    configuration,

    /* Registries */

    serviceRegistry,

    dependencyRegistry,

    /* Service APIs */

    registerService,

    unregisterService,

    getService,

    hasService,

    getRegisteredServices

});