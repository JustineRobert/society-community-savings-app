"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Runtime Context
 * =============================================================================
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const configuration =
    require("../config");

const {
    file: ENV_FILE
} = require("../config/env");

const {
    createFingerprint
} = require("./fingerprint");

const runtimeEvents =
    require("./events");

const {
    applicationState,
    BOOTSTRAP_PHASES,
    getApplicationState,
    markApplicationStarted,
    markApplicationReady,
    markApplicationShutdown,
    markApplicationStopped,
    updateBootstrapPhase,
    incrementActiveRequests,
    decrementActiveRequests,
    incrementSocketConnections,
    decrementSocketConnections
} = require("./state");

let packageJson = {

    name:
        "titech-community-capital",

    version:
        "1.0.0",

    description:
        "African Community Finance Operating System",

    license:
        "Proprietary"

};

try {

    const packagePath =
        path.resolve(
            process.cwd(),
            "package.json"
        );

    if (fs.existsSync(packagePath)) {

        packageJson =
            JSON.parse(
                fs.readFileSync(
                    packagePath,
                    "utf8"
                )
            );

    }

} catch (error) {

    console.warn(
        "[RUNTIME] Unable to load package.json:",
        error.message
    );

}

const buildMetadata =
    Object.freeze({

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
            packageJson.homepage ||
            null,

        repository:
            packageJson.repository ||
            null,

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

const runtimeMetadata =
    Object.freeze({

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
            new Date().toISOString()

    });

const infrastructure =
    Object.freeze({

        docker:
            fs.existsSync("/.dockerenv"),

        kubernetes:
            Boolean(
                process.env.KUBERNETES_SERVICE_HOST
            ),

        pm2:
            Boolean(process.env.pm_id),

        cluster:
            Boolean(
                process.env.NODE_UNIQUE_ID
            ),

        ci:
            Boolean(process.env.CI),

        githubActions:
            Boolean(
                process.env.GITHUB_ACTIONS
            ),

        azure:
            Boolean(
                process.env.WEBSITE_INSTANCE_ID
            ),

        aws:
            Boolean(process.env.AWS_REGION),

        gcp:
            Boolean(
                process.env.GOOGLE_CLOUD_PROJECT
            ),

        railway:
            Boolean(
                process.env.RAILWAY_ENVIRONMENT
            ),

        render:
            Boolean(process.env.RENDER),

        vercel:
            Boolean(process.env.VERCEL),

        fly:
            Boolean(process.env.FLY_APP_NAME)

    });

const deploymentMetadata =
    Object.freeze({

        environment:
            configuration.environment,

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

const APPLICATION =
    Object.freeze({

        company:
            "TITech Community Capital LTD",

        platform:
            "African Community Finance Operating System",

        acronym:
            "TITech",

        apiPrefix:
            "/api",

        apiVersion:
            "v1",

        defaultEncoding:
            "utf8",

        requestIdHeader:
            "x-request-id",

        correlationIdHeader:
            "x-correlation-id",

        transactionIdHeader:
            "x-transaction-id",

        tenantHeader:
            "x-tenant-id",

        userHeader:
            "x-user-id"

    });

const RUNTIME_FINGERPRINT =
    Object.freeze({

        identifier:
            createFingerprint({

                application:
                    buildMetadata.applicationName,

                version:
                    buildMetadata.version,

                node:
                    runtimeMetadata.nodeVersion,

                platform:
                    runtimeMetadata.operatingSystem,

                architecture:
                    runtimeMetadata.nodeArchitecture

            }),

        generatedAt:
            new Date().toISOString()

    });

const BOOTSTRAP =
    Object.freeze({

        initializedAt:
            new Date(),

        processStartedAt:
            new Date(
                Date.now() -
                process.uptime() * 1000
            ),

        applicationRoot:
            process.cwd(),

        backendRoot:
            __dirname,

        environmentFile:
            ENV_FILE,

        runtimeFingerprint:
            RUNTIME_FINGERPRINT.identifier

    });

const runtimeContext =
    Object.freeze({

        application:
            APPLICATION,

        build:
            buildMetadata,

        runtime:
            runtimeMetadata,

        deployment:
            deploymentMetadata,

        infrastructure,

        bootstrap:
            BOOTSTRAP,

        configuration,

        fingerprint:
            RUNTIME_FINGERPRINT.identifier

    });

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
            RUNTIME_FINGERPRINT.identifier

    };

}

module.exports = {

    APPLICATION,

    buildMetadata,

    runtimeMetadata,

    infrastructure,

    deploymentMetadata,

    BOOTSTRAP,

    RUNTIME_FINGERPRINT,

    runtimeContext,

    runtimeEvents,

    applicationState,

    BOOTSTRAP_PHASES,

    getApplicationState,

    buildRuntimeSnapshot,

    markApplicationStarted,
    markApplicationReady,
    markApplicationShutdown,
    markApplicationStopped,

    updateBootstrapPhase,

    incrementActiveRequests,
    decrementActiveRequests,

    incrementSocketConnections,
    decrementSocketConnections,

    packageJson,

    configuration

};