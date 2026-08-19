"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Service Registry
 * =============================================================================
 *
 * File: backend/bootstrap/services.js
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Central service registration
 * ✓ Dependency container
 * ✓ Service metadata
 * ✓ Service lifecycle management
 * ✓ Service health tracking
 * ✓ Async startup/shutdown support
 * ✓ Dependency-aware startup
 * ✓ Deterministic shutdown ordering
 * ✓ Service replacement protection
 * ✓ Service diagnostics
 * ✓ Runtime observability
 * ✓ Failure isolation
 * ✓ Production-safe error handling
 *
 * Security / Reliability
 * -----------------------------------------------------------------------------
 * ✓ No secrets exposed through diagnostics
 * ✓ Service instances remain in memory
 * ✓ Duplicate registration is rejected by default
 * ✓ Lifecycle failures are isolated
 * ✓ Shutdown is graceful and deterministic
 * ✓ Health state is explicitly tracked
 * ✓ TITech naming is used consistently
 * =============================================================================
 */

const {
    applicationEvents
} = require("./servicesContext");


// =============================================================================
// Constants
// =============================================================================

const DEFAULT_VERSION =
    "1.0.0";

const DEFAULT_CATEGORY =
    "general";

const DEFAULT_SHUTDOWN_PRIORITY =
    100;

const DEFAULT_HEALTH_STATUS =
    "registered";

const VALID_HEALTH_STATUSES =
    new Set([
        "registered",
        "starting",
        "healthy",
        "degraded",
        "unhealthy",
        "stopping",
        "stopped",
        "failed"
    ]);


// =============================================================================
// Registries
// =============================================================================

const serviceRegistry =
    new Map();

const serviceHealthRegistry =
    new Map();


// =============================================================================
// Internal Utilities
// =============================================================================

function now() {
    return new Date();
}

function timestamp() {
    return now().toISOString();
}

function emitEvent(
    event,
    payload = {}
) {

    try {

        applicationEvents.emit(
            event,
            {
                ...payload,

                timestamp:
                    payload.timestamp ||
                    timestamp()
            }
        );

    } catch (error) {

        console.error(
            "[TITECH-SERVICE-EVENT]",
            error
        );

    }
}

function normalizeName(name) {

    if (
        typeof name !==
        "string"
    ) {
        return "";
    }

    return name.trim();
}

function normalizeTags(tags) {

    if (!Array.isArray(tags)) {
        return [];
    }

    return [
        ...new Set(
            tags
                .filter(
                    tag =>
                        typeof tag ===
                        "string"
                )
                .map(
                    tag =>
                        tag.trim()
                )
                .filter(Boolean)
        )
    ];
}

function normalizeDependencies(
    dependencies
) {

    if (
        !Array.isArray(
            dependencies
        )
    ) {
        return [];
    }

    return [
        ...new Set(
            dependencies
                .map(
                    dependency =>
                        normalizeName(
                            dependency
                        )
                )
                .filter(Boolean)
        )
    ];
}

function assertServiceName(
    name
) {

    const normalized =
        normalizeName(name);

    if (!normalized) {

        throw new Error(
            "Service name is required."
        );

    }

    return normalized;
}


// =============================================================================
// Service Health
// =============================================================================

function registerServiceHealth(
    service,
    health = {}
) {

    const name =
        assertServiceName(
            service
        );

    const status =
        VALID_HEALTH_STATUSES.has(
            health.status
        )
            ? health.status
            : DEFAULT_HEALTH_STATUS;

    const record = {

        status,

        message:
            health.message ||
            null,

        lastCheck:
            now(),

        latency:
            Number.isFinite(
                health.latency
            )
                ? health.latency
                : null,

        metadata:
            health.metadata &&
            typeof health.metadata ===
                "object"
                ? {
                    ...health.metadata
                }
                : {},

        failureCount:
            Number.isFinite(
                health.failureCount
            )
                ? health.failureCount
                : 0

    };

    serviceHealthRegistry.set(
        name,
        record
    );

    return record;
}

function updateServiceHealth(
    service,
    status,
    message = null,
    metadata = {}
) {

    const name =
        assertServiceName(
            service
        );

    if (
        !VALID_HEALTH_STATUSES.has(
            status
        )
    ) {

        throw new Error(
            `Invalid health status for service "${name}": ${status}`
        );

    }

    const current =
        serviceHealthRegistry.get(
            name
        ) || {

            failureCount:
                0

        };

    const failure =
        status === "failed" ||
        status === "unhealthy";

    const updated = {

        ...current,

        status,

        message,

        lastCheck:
            now(),

        metadata:
            metadata &&
            typeof metadata ===
                "object"
                ? {
                    ...current.metadata,
                    ...metadata
                }
                : current.metadata,

        failureCount:
            failure
                ? (
                    Number(
                        current.failureCount ||
                        0
                    ) + 1
                )
                : current.failureCount || 0

    };

    serviceHealthRegistry.set(
        name,
        updated
    );

    emitEvent(
        "service.health.changed",
        {
            service: name,
            status,
            message
        }
    );

    return updated;
}

function getServiceHealth(
    name
) {

    return serviceHealthRegistry.get(
        normalizeName(name)
    );
}

function getAllServiceHealth() {

    return Object.fromEntries(
        Array.from(
            serviceHealthRegistry.entries()
        ).map(
            ([name, health]) => [
                name,
                {
                    ...health,
                    metadata: {
                        ...(
                            health.metadata ||
                            {}
                        )
                    }
                }
            ]
        )
    );
}


// =============================================================================
// Service Registration
// =============================================================================

function registerService(
    name,
    instance,
    options = {}
) {

    const serviceName =
        assertServiceName(name);

    if (
        instance ===
        undefined ||
        instance ===
        null
    ) {

        throw new Error(
            `Service instance is required for "${serviceName}".`
        );

    }

    const existing =
        serviceRegistry.get(
            serviceName
        );

    const allowReplace =
        options.replace === true;

    if (
        existing &&
        !allowReplace
    ) {

        throw new Error(
            `Service "${serviceName}" is already registered.`
        );

    }

    const registeredAt =
        now();

    const service = {

        name:
            serviceName,

        instance,

        version:
            options.version ||
            DEFAULT_VERSION,

        category:
            options.category ||
            DEFAULT_CATEGORY,

        singleton:
            options.singleton !== false,

        description:
            options.description ||
            "",

        dependencies:
            normalizeDependencies(
                options.dependencies
            ),

        shutdownPriority:
            Number.isFinite(
                options.shutdownPriority
            )
                ? options.shutdownPriority
                : DEFAULT_SHUTDOWN_PRIORITY,

        tags:
            normalizeTags(
                options.tags
            ),

        critical:
            options.critical === true,

        startedAt:
            null,

        registeredAt,

        status:
            "registered",

        start:
            typeof options.start ===
            "function"
                ? options.start
                : typeof instance.start ===
                    "function"
                    ? instance.start.bind(
                        instance
                    )
                    : null,

        stop:
            typeof options.stop ===
            "function"
                ? options.stop
                : typeof instance.stop ===
                    "function"
                    ? instance.stop.bind(
                        instance
                    )
                    : null,

        healthCheck:
            typeof options.healthCheck ===
            "function"
                ? options.healthCheck
                : typeof instance.healthCheck ===
                    "function"
                    ? instance.healthCheck.bind(
                        instance
                    )
                    : null

    };

    serviceRegistry.set(
        serviceName,
        service
    );

    registerServiceHealth(
        serviceName,
        {
            status:
                "registered"
        }
    );

    emitEvent(
        "service.registered",
        {
            service:
                serviceName,

            version:
                service.version,

            category:
                service.category,

            replaced:
                Boolean(existing)
        }
    );

    return instance;
}


// =============================================================================
// Service Unregistration
// =============================================================================

async function unregisterService(
    name,
    options = {}
) {

    const serviceName =
        assertServiceName(name);

    const service =
        serviceRegistry.get(
            serviceName
        );

    if (!service) {
        return false;
    }

    if (
        options.stop !== false &&
        typeof service.stop ===
        "function"
    ) {

        try {

            updateServiceHealth(
                serviceName,
                "stopping"
            );

            await service.stop();

        } catch (error) {

            updateServiceHealth(
                serviceName,
                "failed",
                error.message
            );

            emitEvent(
                "service.stop.failed",
                {
                    service:
                        serviceName,
                    error:
                        error.message
                }
            );

            if (
                options.throwOnError
            ) {
                throw error;
            }

        }

    }

    serviceRegistry.delete(
        serviceName
    );

    serviceHealthRegistry.delete(
        serviceName
    );

    emitEvent(
        "service.unregistered",
        {
            service:
                serviceName
        }
    );

    return true;
}


// =============================================================================
// Service Resolution
// =============================================================================

function getService(
    name
) {

    return serviceRegistry.get(
        normalizeName(name)
    )?.instance;
}

function hasService(
    name
) {

    return serviceRegistry.has(
        normalizeName(name)
    );
}

function getRegisteredServices() {

    return Array.from(
        serviceRegistry.keys()
    );

}

function getServiceMetadata(
    name
) {

    const service =
        serviceRegistry.get(
            normalizeName(name)
        );

    if (!service) {
        return undefined;
    }

    return {
        ...service,

        instance:
            undefined,

        start:
            undefined,

        stop:
            undefined,

        healthCheck:
            undefined,

        tags:
            [
                ...(service.tags || [])
            ],

        dependencies:
            [
                ...(service.dependencies || [])
            ]

    };
}


// =============================================================================
// Dependency Validation
// =============================================================================

function validateServiceDependencies(
    service
) {

    const missing =
        (
            service.dependencies ||
            []
        ).filter(
            dependency =>
                !hasService(
                    dependency
                )
        );

    if (missing.length) {

        throw new Error(
            `Service "${service.name}" has missing dependencies: ${missing.join(", ")}`
        );

    }

    return true;
}


// =============================================================================
// Service Startup
// =============================================================================

async function startService(
    name
) {

    const service =
        serviceRegistry.get(
            normalizeName(name)
        );

    if (!service) {

        throw new Error(
            `Service "${name}" is not registered.`
        );

    }

    if (
        service.status ===
        "healthy"
    ) {
        return service.instance;
    }

    validateServiceDependencies(
        service
    );

    updateServiceHealth(
        service.name,
        "starting"
    );

    service.status =
        "starting";

    try {

        if (
            typeof service.start ===
            "function"
        ) {

            await service.start();

        }

        service.startedAt =
            now();

        service.status =
            "healthy";

        updateServiceHealth(
            service.name,
            "healthy"
        );

        emitEvent(
            "service.started",
            {
                service:
                    service.name
            }
        );

        return service.instance;

    } catch (error) {

        service.status =
            "failed";

        updateServiceHealth(
            service.name,
            "failed",
            error.message
        );

        emitEvent(
            "service.start.failed",
            {
                service:
                    service.name,

                error:
                    error.message
            }
        );

        throw error;
    }
}


// =============================================================================
// Start All Services
// =============================================================================

async function startAllServices(
    options = {}
) {

    const started = [];
    const failed = [];

    const services =
        Array.from(
            serviceRegistry.values()
        );

    for (
        const service
        of services
    ) {

        try {

            await startService(
                service.name
            );

            started.push(
                service.name
            );

        } catch (error) {

            failed.push({

                service:
                    service.name,

                error:
                    error.message

            });

            if (
                service.critical &&
                options.continueOnCriticalFailure !==
                true
            ) {

                throw error;

            }

            if (
                options.continueOnFailure !==
                true
            ) {

                throw error;

            }

        }

    }

    return {
        started,
        failed
    };
}


// =============================================================================
// Service Shutdown
// =============================================================================

function getShutdownOrder() {

    return Array.from(
        serviceRegistry.values()
    )
        .sort(
            (a, b) => {

                if (
                    b.shutdownPriority !==
                    a.shutdownPriority
                ) {

                    return (
                        b.shutdownPriority -
                        a.shutdownPriority
                    );

                }

                return a.name.localeCompare(
                    b.name
                );

            }
        )
        .map(
            service =>
                service.name
        );
}

async function stopService(
    name
) {

    const service =
        serviceRegistry.get(
            normalizeName(name)
        );

    if (!service) {
        return false;
    }

    if (
        service.status ===
        "stopped"
    ) {
        return true;
    }

    updateServiceHealth(
        service.name,
        "stopping"
    );

    service.status =
        "stopping";

    try {

        if (
            typeof service.stop ===
            "function"
        ) {

            await service.stop();

        }

        service.status =
            "stopped";

        updateServiceHealth(
            service.name,
            "stopped"
        );

        emitEvent(
            "service.stopped",
            {
                service:
                    service.name
            }
        );

        return true;

    } catch (error) {

        service.status =
            "failed";

        updateServiceHealth(
            service.name,
            "failed",
            error.message
        );

        emitEvent(
            "service.stop.failed",
            {
                service:
                    service.name,

                error:
                    error.message
            }
        );

        throw error;
    }
}

async function stopAllServices(
    options = {}
) {

    const order =
        getShutdownOrder();

    const stopped = [];
    const failed = [];

    for (
        const serviceName
        of order
    ) {

        try {

            await stopService(
                serviceName
            );

            stopped.push(
                serviceName
            );

        } catch (error) {

            failed.push({

                service:
                    serviceName,

                error:
                    error.message

            });

            if (
                options.continueOnFailure !==
                false
            ) {
                continue;
            }

            throw error;
        }

    }

    return {
        stopped,
        failed
    };
}


// =============================================================================
// Health Checks
// =============================================================================

async function checkServiceHealth(
    name
) {

    const service =
        serviceRegistry.get(
            normalizeName(name)
        );

    if (!service) {

        throw new Error(
            `Service "${name}" is not registered.`
        );

    }

    if (
        typeof service.healthCheck !==
        "function"
    ) {

        return getServiceHealth(
            service.name
        );

    }

    const startedAt =
        Date.now();

    try {

        const result =
            await service.healthCheck();

        const latency =
            Date.now() -
            startedAt;

        const status =
            result?.status ||
            "healthy";

        const message =
            result?.message ||
            null;

        return updateServiceHealth(
            service.name,
            VALID_HEALTH_STATUSES.has(
                status
            )
                ? status
                : "healthy",
            message,
            {
                ...(result?.metadata ||
                    {}),

                latency
            }
        );

    } catch (error) {

        return updateServiceHealth(
            service.name,
            "unhealthy",
            error.message,
            {
                latency:
                    Date.now() -
                    startedAt
            }
        );

    }
}

async function checkAllServiceHealth() {

    const results = {};

    for (
        const serviceName
        of getRegisteredServices()
    ) {

        results[
            serviceName
        ] =
            await checkServiceHealth(
                serviceName
            );

    }

    return results;
}


// =============================================================================
// Diagnostics
// =============================================================================

function getServiceDiagnostics() {

    const health =
        Array.from(
            serviceHealthRegistry.values()
        );

    const services =
        Array.from(
            serviceRegistry.values()
        );

    return {

        totalServices:
            services.length,

        registered:
            getRegisteredServices(),

        healthy:
            health.filter(
                item =>
                    item.status ===
                    "healthy"
            ).length,

        degraded:
            health.filter(
                item =>
                    item.status ===
                    "degraded"
            ).length,

        unhealthy:
            health.filter(
                item =>
                    item.status ===
                    "unhealthy"
            ).length,

        failed:
            health.filter(
                item =>
                    item.status ===
                    "failed"
            ).length,

        stopped:
            health.filter(
                item =>
                    item.status ===
                    "stopped"
            ).length,

        critical:
            services.filter(
                service =>
                    service.critical
            ).map(
                service =>
                    service.name
            ),

        shutdownOrder:
            getShutdownOrder()

    };
}


// =============================================================================
// Dependency Container
// =============================================================================

const dependencyContainer = {

    register:
        registerService,

    resolve:
        getService,

    exists:
        hasService,

    remove:
        unregisterService,

    list:
        getRegisteredServices,

    start:
        startService,

    startAll:
        startAllServices,

    stop:
        stopService,

    stopAll:
        stopAllServices,

    health:
        checkServiceHealth,

    healthAll:
        checkAllServiceHealth,

    diagnostics:
        getServiceDiagnostics

};


// =============================================================================
// Exports
// =============================================================================

module.exports = {

    serviceRegistry,

    serviceHealthRegistry,

    dependencyContainer,

    registerService,

    unregisterService,

    getService,

    hasService,

    getRegisteredServices,

    getServiceMetadata,

    registerServiceHealth,

    updateServiceHealth,

    getServiceHealth,

    getAllServiceHealth,

    validateServiceDependencies,

    startService,

    startAllServices,

    stopService,

    stopAllServices,

    checkServiceHealth,

    checkAllServiceHealth,

    getServiceDiagnostics,

    getShutdownOrder

};