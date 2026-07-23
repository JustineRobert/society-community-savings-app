"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise Environment Configuration
 * ============================================================================
 *
 * File:
 *      backend/config/environment.js
 *
 * Responsibilities
 * ----------------
 * • Environment bootstrap
 * • Layered dotenv loading
 * • Environment normalization
 * • Runtime environment validation
 * • Configuration fingerprinting
 * • Runtime flags
 * • Immutable configuration
 * • Startup diagnostics
 *
 * NOTE
 * ----
 * This module MUST be initialized before any application modules,
 * infrastructure services, or Express application components.
 *
 * Usage
 * -----
 * const {
 *     bootstrapEnvironment,
 *     ENVIRONMENT
 * } = require("./config/environment");
 *
 * await bootstrapEnvironment();
 *
 * ============================================================================
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const process = require("process");
const { URL } = require("url");

const dotenv = require("dotenv");

/**
 * ============================================================================
 * Enterprise Constants
 * ============================================================================
 */

const ENVIRONMENT_NAMES = Object.freeze({

    DEVELOPMENT: "development",

    TEST: "test",

    STAGING: "staging",

    PRODUCTION: "production"

});

const SUPPORTED_ENVIRONMENTS = Object.freeze([

    ENVIRONMENT_NAMES.DEVELOPMENT,

    ENVIRONMENT_NAMES.TEST,

    ENVIRONMENT_NAMES.STAGING,

    ENVIRONMENT_NAMES.PRODUCTION

]);

const DEFAULT_ENVIRONMENT =

    ENVIRONMENT_NAMES.DEVELOPMENT;

const DEFAULT_TIMEZONE =

    "UTC";

const DEFAULT_LOCALE =

    "en-US";

const DEFAULT_ENCODING =

    "utf8";

const DEFAULT_DOTENV_FILENAMES = Object.freeze([

    ".env",

    ".env.local",

    `.env.${process.env.NODE_ENV || DEFAULT_ENVIRONMENT}`,

    `.env.${process.env.NODE_ENV || DEFAULT_ENVIRONMENT}.local`

]);

const FINGERPRINT_ALGORITHM =

    "sha256";

/**
 * ============================================================================
 * Enterprise Bootstrap Errors
 * ============================================================================
 */

class EnvironmentBootstrapError extends Error {

    constructor(message, details = {}) {

        super(message);

        this.name =
            "EnvironmentBootstrapError";

        this.details =
            details;

        Error.captureStackTrace(
            this,
            this.constructor
        );

    }

}

class EnvironmentValidationError extends EnvironmentBootstrapError {

    constructor(message, details = {}) {

        super(message, details);

        this.name =
            "EnvironmentValidationError";

    }

}

class EnvironmentConfigurationError extends EnvironmentBootstrapError {

    constructor(message, details = {}) {

        super(message, details);

        this.name =
            "EnvironmentConfigurationError";

    }

}

/**
 * ============================================================================
 * Enterprise Utility Functions
 * ============================================================================
 */

/**
 * Returns true if a value is defined.
 */
function isDefined(value) {

    return value !== undefined &&
           value !== null;

}

/**
 * Returns true if value is a non-empty string.
 */
function isNonEmptyString(value) {

    return typeof value === "string" &&
           value.trim().length > 0;

}

/**
 * Convert environment value to boolean.
 */
function toBoolean(value, defaultValue = false) {

    if (!isDefined(value)) {

        return defaultValue;

    }

    switch (String(value).trim().toLowerCase()) {

        case "1":
        case "true":
        case "yes":
        case "on":

            return true;

        case "0":
        case "false":
        case "no":
        case "off":

            return false;

        default:

            return defaultValue;

    }

}

/**
 * Convert environment value to integer.
 */
function toInteger(value, defaultValue = 0) {

    const parsed =
        Number.parseInt(value, 10);

    return Number.isNaN(parsed)

        ? defaultValue

        : parsed;

}

/**
 * Normalize string.
 */
function normalizeString(value) {

    if (!isDefined(value)) {

        return undefined;

    }

    return String(value).trim();

}

/**
 * SHA-256 helper.
 */
function sha256(value) {

    return crypto

        .createHash(FINGERPRINT_ALGORITHM)

        .update(String(value))

        .digest("hex");

}

/**
 * Safely clone plain objects.
 */
function clone(value) {

    return structuredClone(value);

}

/**
 * Deep freeze object graph.
 */
function deepFreeze(object) {

    if (

        object &&

        typeof object === "object" &&

        !Object.isFrozen(object)

    ) {

        Object.freeze(object);

        Object
            .getOwnPropertyNames(object)
            .forEach((property) => {

                deepFreeze(object[property]);

            });

    }

    return object;

}

/**
 * ============================================================================
 * Internal Runtime State
 * ============================================================================
 */

const INTERNAL_STATE = {

    initialized: false,

    bootstrapStartedAt: null,

    bootstrapCompletedAt: null,

    loadedFiles: [],

    validationErrors: [],

    warnings: []

};

/**
 * Immutable environment placeholder.
 * Will be replaced during bootstrap.
 */
let ENVIRONMENT =

    Object.freeze({});

/**
 * ============================================================================
 * Section 2.1
 * Enterprise Environment Discovery
 * ============================================================================
 */

/**
 * Project root directory.
 *
 * backend/
 *   config/
 *     environment.js
 *
 * ../../ => project root
 */
const PROJECT_ROOT = Object.freeze(
    path.resolve(__dirname, "..")
);

/**
 * Environment directory.
 *
 * All .env* files are expected here.
 */
const ENVIRONMENT_DIRECTORY = Object.freeze(
    PROJECT_ROOT
);

/**
 * Discoverable dotenv filenames.
 *
 * Highest precedence files appear later.
 */
function buildDotenvCandidates() {

    const environment =

        normalizeString(
            process.env.NODE_ENV
        ) ||

        DEFAULT_ENVIRONMENT;

    return [

        ".env",

        ".env.local",

        `.env.${environment}`,

        `.env.${environment}.local`

    ];

}

/**
 * Resolve an environment file.
 */
function resolveEnvironmentFile(filename) {

    return path.resolve(

        ENVIRONMENT_DIRECTORY,

        filename

    );

}

/**
 * Determine whether a file exists.
 */
function fileExists(file) {

    try {

        return (

            fs.existsSync(file) &&

            fs.statSync(file).isFile()

        );

    }

    catch {

        return false;

    }

}

/**
 * Discover all available dotenv files.
 *
 * Discovery does NOT load anything.
 */
function discoverEnvironmentFiles() {

    const candidates =

        buildDotenvCandidates();

    const discovered = [];

    const visited =

        new Set();

    for (

        const filename

        of candidates

    ) {

        const absolutePath =

            resolveEnvironmentFile(

                filename

            );

        if (

            visited.has(

                absolutePath

            )

        ) {

            continue;

        }

        visited.add(

            absolutePath

        );

        discovered.push({

            filename,

            path:

                absolutePath,

            exists:

                fileExists(

                    absolutePath

                )

        });

    }

    return Object.freeze(

        discovered.map(

            Object.freeze

        )

    );

}

/**
 * Build the final dotenv load plan.
 *
 * Non-existent files are ignored.
 *
 * Ordering determines precedence.
 *
 * Earlier files are loaded first.
 *
 * Later files override earlier values.
 */
function buildEnvironmentLoadPlan() {

    const files =

        discoverEnvironmentFiles()

        .filter(

            file =>

                file.exists

        );

    return Object.freeze({

        rootDirectory:

            PROJECT_ROOT,

        environmentDirectory:

            ENVIRONMENT_DIRECTORY,

        nodeEnvironment:

            normalizeString(

                process.env.NODE_ENV

            ) ||

            DEFAULT_ENVIRONMENT,

        discoveredFiles:

            files.length,

        files:

            Object.freeze(

                files

            )

    });

}

/**
 * Immutable discovery result.
 */
const ENVIRONMENT_DISCOVERY =

    buildEnvironmentLoadPlan();

/**
 * Update bootstrap state.
 */
INTERNAL_STATE.environmentDirectory =

    ENVIRONMENT_DIRECTORY;

INTERNAL_STATE.projectRoot =

    PROJECT_ROOT;

INTERNAL_STATE.discovery =

    ENVIRONMENT_DISCOVERY;

/**
 * Startup diagnostics.
 */
function getEnvironmentDiscoveryDiagnostics() {

    return Object.freeze({

        projectRoot:

            PROJECT_ROOT,

        environmentDirectory:

            ENVIRONMENT_DIRECTORY,

        nodeEnvironment:

            ENVIRONMENT_DISCOVERY.nodeEnvironment,

        discoveredFiles:

            ENVIRONMENT_DISCOVERY.discoveredFiles,

        files:

            ENVIRONMENT_DISCOVERY.files.map(

                file => ({

                    filename:

                        file.filename,

                    exists:

                        file.exists

                })

            )

    });

}

/**
 * ============================================================================
 * Section 2.2.1
 * Enterprise Dotenv Loader Engine
 * ============================================================================
 *
 * Responsibilities
 * ----------------
 * • Load dotenv files from discovery plan
 * • Parse each file independently
 * • Capture diagnostics
 * • Never partially initialize state
 * • Continue gracefully when optional files fail
 * * This section DOES NOT merge environment variables.
 * It only parses dotenv layers.
 * ============================================================================
 */

/**
 * Dotenv parser result.
 */
class DotenvLoadResult {

    constructor({

        filename,

        path,

        loaded,

        variables = {},

        variableCount = 0,

        durationMs = 0,

        error = null

    }) {

        this.filename = filename;

        this.path = path;

        this.loaded = loaded;

        this.variables = variables;

        this.variableCount = variableCount;

        this.durationMs = durationMs;

        this.error = error;

        Object.freeze(this);

    }

}

/**
 * Parse a dotenv file.
 */
function loadDotenvFile(file) {

    const started = process.hrtime.bigint();

    try {

        const result = dotenv.config({

            path: file.path,

            processEnv: {},

            override: false

        });

        const elapsed =

            Number(

                process.hrtime.bigint() -

                started

            ) / 1e6;

        if (result.error) {

            return new DotenvLoadResult({

                filename: file.filename,

                path: file.path,

                loaded: false,

                durationMs: elapsed,

                error: result.error

            });

        }

        const parsed =

            result.parsed || {};

        return new DotenvLoadResult({

            filename: file.filename,

            path: file.path,

            loaded: true,

            variables: Object.freeze({

                ...parsed

            }),

            variableCount:

                Object.keys(parsed).length,

            durationMs: elapsed

        });

    }

    catch (error) {

        return new DotenvLoadResult({

            filename: file.filename,

            path: file.path,

            loaded: false,

            durationMs:

                Number(

                    process.hrtime.bigint() -

                    started

                ) / 1e6,

            error

        });

    }

}

/**
 * Load every discovered dotenv file.
 *
 * No merging occurs here.
 */
function loadDotenvLayers() {

    const diagnostics = [];

    const loadedLayers = [];

    for (

        const file

        of ENVIRONMENT_DISCOVERY.files

    ) {

        const result =

            loadDotenvFile(file);

        diagnostics.push(result);

        if (result.loaded) {

            loadedLayers.push(result);

        }

    }

    return Object.freeze({

        loadedLayers:

            Object.freeze(

                loadedLayers

            ),

        diagnostics:

            Object.freeze(

                diagnostics

            ),

        successfulLoads:

            loadedLayers.length,

        failedLoads:

            diagnostics.length -

            loadedLayers.length

    });

}

/**
 * Execute dotenv loading.
 */
const DOTENV_LAYERS =

    loadDotenvLayers();

/**
 * Bootstrap diagnostics.
 */
INTERNAL_STATE.dotenv = {

    successfulLoads:

        DOTENV_LAYERS.successfulLoads,

    failedLoads:

        DOTENV_LAYERS.failedLoads,

    diagnostics:

        DOTENV_LAYERS.diagnostics

};

/**
 * Bootstrap warnings.
 */
for (

    const layer

    of DOTENV_LAYERS.diagnostics

) {

    if (!layer.loaded) {

        INTERNAL_STATE.warnings.push({

            type:

                "dotenv-load",

            file:

                layer.filename,

            message:

                layer.error?.message ||

                "Unable to load dotenv file."

        });

    }

}

/**
 * Loader diagnostics helper.
 */
function getDotenvDiagnostics() {

    return Object.freeze({

        successfulLoads:

            DOTENV_LAYERS.successfulLoads,

        failedLoads:

            DOTENV_LAYERS.failedLoads,

        files:

            DOTENV_LAYERS.diagnostics.map(

                layer => ({

                    filename:

                        layer.filename,

                    loaded:

                        layer.loaded,

                    variableCount:

                        layer.variableCount,

                    durationMs:

                        Number(

                            layer.durationMs.toFixed(3)

                        ),

                    error:

                        layer.error

                            ? layer.error.message

                            : null

                })

            )

    });

}