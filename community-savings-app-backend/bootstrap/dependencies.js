"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Dependency Registry
 * =============================================================================
 *
 * File: backend/bootstrap/dependencies.js
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Enterprise dependency loading
 * ✓ Required dependency validation
 * ✓ Optional dependency loading
 * ✓ Dependency availability tracking
 * ✓ Dependency health/status metadata
 * ✓ Startup diagnostics
 * ✓ Controlled optional integrations
 * ✓ Safe dependency snapshots
 * ✓ Runtime dependency lookup
 * ✓ Test-friendly registry access
 *
 * Design Principles
 * -----------------------------------------------------------------------------
 * - Required dependencies fail fast.
 * - Optional integrations never silently become required.
 * - Dependency state is observable.
 * - Consumers receive snapshots rather than mutable registry internals.
 * - Runtime code should use this registry instead of repeatedly requiring
 *   infrastructure dependencies.
 * - Dependency loading happens once during bootstrap.
 * - Missing optional packages are observable but non-fatal.
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// Core Dependencies
// -----------------------------------------------------------------------------

const express =
    require("express");

const cors =
    require("cors");

const cookieParser =
    require("cookie-parser");

const helmet =
    require("helmet");

const compression =
    require("compression");

const responseTime =
    require("response-time");

const timeout =
    require("connect-timeout");

const rateLimit =
    require("express-rate-limit");

const hpp =
    require("hpp");

const mongoSanitize =
    require("express-mongo-sanitize");

const xss =
    require("xss-clean");

const mongoose =
    require("mongoose");

const Redis =
    require("ioredis");

const promClient =
    require("prom-client");

const Joi =
    require("joi");

const Ajv =
    require("ajv");

const addFormats =
    require("ajv-formats");

// -----------------------------------------------------------------------------
// Runtime Context
// -----------------------------------------------------------------------------

const {
    packageJson
} = require("../runtime/context");

// -----------------------------------------------------------------------------
// Logger
// -----------------------------------------------------------------------------
//
// Bootstrap should ideally receive the enterprise logger once it exists.
// Until then, console is deliberately used as the bootstrap fallback.
//
// -----------------------------------------------------------------------------

const logger = console;

// -----------------------------------------------------------------------------
// Dependency Categories
// -----------------------------------------------------------------------------

const DEPENDENCY_TYPES =
    Object.freeze({

        REQUIRED:
            "required",

        OPTIONAL:
            "optional"

    });

// -----------------------------------------------------------------------------
// Required Dependency Definitions
// -----------------------------------------------------------------------------
//
// A failure here should prevent the application from entering a partially
// initialized production state.
//
// -----------------------------------------------------------------------------

const REQUIRED_DEPENDENCIES =
    Object.freeze({

        express,
        cors,
        cookieParser,
        helmet,

        compression,
        responseTime,
        timeout,
        rateLimit,

        hpp,
        mongoSanitize,
        xss,

        mongoose,
        Redis,

        promClient,

        Joi,
        Ajv,
        addFormats

    });

// -----------------------------------------------------------------------------
// Optional Dependency Loader
// -----------------------------------------------------------------------------

function optionalRequire(
    moduleName
) {

    const startedAt =
        Date.now();

    try {

        const dependency =
            require(moduleName);

        return {

            dependency,

            available: true,

            error: null,

            loadDurationMs:
                Date.now() - startedAt

        };

    } catch (error) {

        logger.warn(
            `[TITech:OPTIONAL-DEPENDENCY] ` +
            `${moduleName} unavailable: ` +
            `${error.message}`
        );

        return {

            dependency: null,

            available: false,

            error: error.message,

            loadDurationMs:
                Date.now() - startedAt

        };

    }

}

// -----------------------------------------------------------------------------
// Optional Dependencies
// -----------------------------------------------------------------------------

const optionalDependencyModules =
    Object.freeze({

        BullMQ:
            "bullmq",

        swaggerUi:
            "swagger-ui-express",

        swaggerJsDoc:
            "swagger-jsdoc",

        OpenTelemetry:
            "@opentelemetry/api",

        Sentry:
            "@sentry/node",

        Pino:
            "pino",

        Winston:
            "winston"

    });

// -----------------------------------------------------------------------------
// Dependency Registry
// -----------------------------------------------------------------------------

const dependencyRegistry =
    new Map();

// -----------------------------------------------------------------------------
// Register Dependency
// -----------------------------------------------------------------------------

function registerDependency(
    name,
    dependency,
    type,
    metadata = {}
) {

    if (
        typeof name !== "string" ||
        !name.trim()
    ) {

        throw new TypeError(
            "Dependency name must be a non-empty string."
        );

    }

    if (
        dependency === undefined ||
        dependency === null
    ) {

        if (
            type ===
            DEPENDENCY_TYPES.REQUIRED
        ) {

            throw new Error(
                `Required TITech dependency unavailable: ${name}`
            );

        }

    }

    const record = {

        name,

        dependency,

        type,

        available:
            dependency !== null &&
            dependency !== undefined,

        loadedAt:
            new Date(),

        loadDurationMs:
            metadata.loadDurationMs ||
            0,

        error:
            metadata.error ||
            null,

        module:
            metadata.module ||
            null

    };

    dependencyRegistry.set(
        name,
        Object.freeze(record)
    );

    return record;

}

// -----------------------------------------------------------------------------
// Register Required Dependencies
// -----------------------------------------------------------------------------

for (
    const [
        name,
        dependency
    ]
    of Object.entries(
        REQUIRED_DEPENDENCIES
    )
) {

    registerDependency(
        name,
        dependency,
        DEPENDENCY_TYPES.REQUIRED
    );

}

// -----------------------------------------------------------------------------
// Register Optional Dependencies
// -----------------------------------------------------------------------------

for (
    const [
        name,
        moduleName
    ]
    of Object.entries(
        optionalDependencyModules
    )
) {

    const result =
        optionalRequire(
            moduleName
        );

    registerDependency(
        name,
        result.dependency,
        DEPENDENCY_TYPES.OPTIONAL,
        {

            module:
                moduleName,

            loadDurationMs:
                result.loadDurationMs,

            error:
                result.error

        }
    );

}

// -----------------------------------------------------------------------------
// Dependency Access
// -----------------------------------------------------------------------------

function getDependency(
    name
) {

    const record =
        dependencyRegistry.get(
            name
        );

    if (!record) {
        return undefined;
    }

    return record.dependency;

}

// -----------------------------------------------------------------------------
// Dependency Metadata
// -----------------------------------------------------------------------------

function getDependencyRecord(
    name
) {

    return dependencyRegistry.get(
        name
    );

}

// -----------------------------------------------------------------------------
// Dependency Availability
// -----------------------------------------------------------------------------

function hasDependency(
    name
) {

    const record =
        dependencyRegistry.get(
            name
        );

    return Boolean(
        record?.available
    );

}

// -----------------------------------------------------------------------------
// Required Dependency Check
// -----------------------------------------------------------------------------

function hasRequiredDependency(
    name
) {

    const record =
        dependencyRegistry.get(
            name
        );

    return Boolean(
        record &&
        record.type ===
            DEPENDENCY_TYPES.REQUIRED &&
        record.available
    );

}

// -----------------------------------------------------------------------------
// Dependency Names
// -----------------------------------------------------------------------------

function getDependencyNames() {

    return Array.from(
        dependencyRegistry.keys()
    );

}

// -----------------------------------------------------------------------------
// Available Dependencies
// -----------------------------------------------------------------------------

function getAvailableDependencies() {

    return Array.from(
        dependencyRegistry.values()
    )
        .filter(
            item =>
                item.available
        )
        .map(
            item =>
                item.name
        );

}

// -----------------------------------------------------------------------------
// Unavailable Dependencies
// -----------------------------------------------------------------------------

function getUnavailableDependencies() {

    return Array.from(
        dependencyRegistry.values()
    )
        .filter(
            item =>
                !item.available
        )
        .map(
            item =>
                item.name
        );

}

// -----------------------------------------------------------------------------
// Required Dependencies
// -----------------------------------------------------------------------------

function getRequiredDependencies() {

    return Array.from(
        dependencyRegistry.values()
    )
        .filter(
            item =>
                item.type ===
                DEPENDENCY_TYPES.REQUIRED
        )
        .map(
            item =>
                item.name
        );

}

// -----------------------------------------------------------------------------
// Optional Dependencies
// -----------------------------------------------------------------------------

function getOptionalDependencies() {

    return Array.from(
        dependencyRegistry.values()
    )
        .filter(
            item =>
                item.type ===
                DEPENDENCY_TYPES.OPTIONAL
        )
        .map(
            item =>
                item.name
        );

}

// -----------------------------------------------------------------------------
// Missing Required Dependencies
// -----------------------------------------------------------------------------

function getMissingRequiredDependencies() {

    return Array.from(
        dependencyRegistry.values()
    )
        .filter(
            item =>
                item.type ===
                    DEPENDENCY_TYPES.REQUIRED &&
                !item.available
        )
        .map(
            item =>
                item.name
        );

}

// -----------------------------------------------------------------------------
// Validate Dependencies
// -----------------------------------------------------------------------------
//
// This should be executed before the application enters the READY state.
//
// -----------------------------------------------------------------------------

function validateDependencies() {

    const missing =
        getMissingRequiredDependencies();

    if (missing.length > 0) {

        const error =
            new Error(
                "TITech required dependencies are unavailable."
            );

        error.code =
            "REQUIRED_DEPENDENCIES_UNAVAILABLE";

        error.dependencies =
            missing;

        throw error;

    }

    return true;

}

// -----------------------------------------------------------------------------
// Dependency Status
// -----------------------------------------------------------------------------

function getDependencyStatus() {

    const records =
        Array.from(
            dependencyRegistry.values()
        );

    return {

        healthy:
            getMissingRequiredDependencies()
                .length === 0,

        total:
            records.length,

        available:
            records.filter(
                item =>
                    item.available
            ).length,

        unavailable:
            records.filter(
                item =>
                    !item.available
            ).length,

        required:
            records.filter(
                item =>
                    item.type ===
                    DEPENDENCY_TYPES.REQUIRED
            ).length,

        optional:
            records.filter(
                item =>
                    item.type ===
                    DEPENDENCY_TYPES.OPTIONAL
            ).length,

        missingRequired:
            getMissingRequiredDependencies()

    };

}

// -----------------------------------------------------------------------------
// Safe Dependency Snapshot
// -----------------------------------------------------------------------------
//
// Does not expose the actual dependency objects.
//
// This is important because dependency objects can contain internal state,
// configuration, functions, clients, sockets, credentials or other runtime
// information.
//
// -----------------------------------------------------------------------------

function getDependencySnapshot() {

    const dependencies =
        Array.from(
            dependencyRegistry.values()
        )
        .map(
            item => ({

                name:
                    item.name,

                type:
                    item.type,

                available:
                    item.available,

                module:
                    item.module,

                loadedAt:
                    item.loadedAt
                        ?.toISOString() ||
                    null,

                loadDurationMs:
                    item.loadDurationMs,

                error:
                    item.available
                        ? null
                        : item.error

            })
        );

    return {

        application: {

            name:
                packageJson.name,

            version:
                packageJson.version

        },

        status:
            getDependencyStatus(),

        dependencies

    };

}

// -----------------------------------------------------------------------------
// Dependency Snapshot
// -----------------------------------------------------------------------------
//
// Compatibility export for existing bootstrap code.
//
// Unlike the previous implementation, this is a function-backed snapshot
// generator so it does not become stale.
//
// -----------------------------------------------------------------------------

const dependencySnapshot =
    Object.freeze(
        getDependencySnapshot()
    );

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

module.exports = {

    DEPENDENCY_TYPES,

    dependencies: Object.freeze({
        ...REQUIRED_DEPENDENCIES,

        ...Object.fromEntries(
            Array.from(
                dependencyRegistry.entries()
            )
            .filter(
                ([
                    ,
                    record
                ]) =>
                    record.type ===
                    DEPENDENCY_TYPES.OPTIONAL
            )
            .map(
                ([
                    name,
                    record
                ]) => [
                    name,
                    record.dependency
                ]
            )
        )

    }),

    dependencyRegistry,

    dependencySnapshot,

    optionalRequire,

    getDependency,

    getDependencyRecord,

    hasDependency,

    hasRequiredDependency,

    getDependencyNames,

    getAvailableDependencies,

    getUnavailableDependencies,

    getRequiredDependencies,

    getOptionalDependencies,

    getMissingRequiredDependencies,

    validateDependencies,

    getDependencyStatus,

    getDependencySnapshot

};