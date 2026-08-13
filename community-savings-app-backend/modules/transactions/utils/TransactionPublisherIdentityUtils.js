'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Batch & Publisher Identity Utilities
 * ============================================================================
 *
 * File:
 * backend/modules/transactions/utils/TransactionPublisherIdentityUtils.js
 *
 * Purpose
 * -------
 * Provides enterprise-grade identity utilities for transaction event
 * publishing infrastructure.
 *
 * Responsibilities
 * ----------------
 * • Generate globally unique batch identifiers
 * • Generate publisher/worker instance identifiers
 * • Build immutable publisher identity snapshots
 * • Build batch processing metadata
 * • Support horizontal worker scaling
 * • Support Kubernetes replicas
 * • Support retry and replay traceability
 * • Support operational debugging
 * • Validate generated identifiers
 * • Prevent unsafe identifier injection
 * • Preserve backward-compatible exports
 *
 * Design Principles
 * -----------------
 * • Cryptographically strong entropy
 * • No Math.random()
 * • No mutable shared identity state
 * • Safe for distributed workers
 * • Log/index friendly identifiers
 * • Deterministic validation
 * • Bounded identifier length
 * • Explicit input normalization
 *
 * ============================================================================
 */

const crypto = require('crypto');
const os = require('os');

/**
 * ============================================================================
 * Constants
 * ============================================================================
 */

const BATCH_PREFIX = 'batch';
const PUBLISHER_PREFIX = 'pub';

const DEFAULT_ENVIRONMENT = 'development';
const DEFAULT_PRIORITY = 'NORMAL';

const MAX_HOSTNAME_LENGTH = 40;
const MAX_PREFIX_LENGTH = 24;
const MAX_PRIORITY_LENGTH = 32;

const DEFAULT_BATCH_SIZE = 0;
const DEFAULT_RETRY_ATTEMPT = 0;

const PROCESS_ID = process.pid;

/**
 * ============================================================================
 * Priority Values
 * ============================================================================
 */

const PRIORITIES = Object.freeze([
    'LOW',
    'NORMAL',
    'HIGH',
    'CRITICAL'
]);

/**
 * ============================================================================
 * Internal Validation Helpers
 * ============================================================================
 */

/**
 * Determine whether a value is a non-empty string.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
    return (
        typeof value === 'string' &&
        value.trim().length > 0
    );
}

/**
 * Normalize a bounded identifier component.
 *
 * @param {*} value
 * @param {string} fallback
 * @param {number} maxLength
 * @returns {string}
 */
function normalizeComponent(
    value,
    fallback,
    maxLength
) {
    const candidate = isNonEmptyString(value)
        ? value.trim()
        : fallback;

    return String(candidate)
        .replace(/[^a-zA-Z0-9.-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^\.+|\.+$/g, '')
        .substring(0, maxLength) || fallback;
}

/**
 * Normalize a numeric value to a safe non-negative integer.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function normalizeNonNegativeInteger(
    value,
    fallback
) {
    const number = Number(value);

    if (
        Number.isSafeInteger(number) &&
        number >= 0
    ) {
        return number;
    }

    return fallback;
}

/**
 * Normalize process ID.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeProcessId(value) {
    const processId = Number(value);

    if (
        Number.isSafeInteger(processId) &&
        processId >= 0
    ) {
        return processId;
    }

    return PROCESS_ID;
}

/**
 * ============================================================================
 * Secure Random Component
 * ============================================================================
 *
 * Uses cryptographically secure randomness.
 *
 * @param {number} bytes
 * @returns {string}
 */
function randomToken(bytes = 12) {
    const normalizedBytes = normalizeNonNegativeInteger(
        bytes,
        12
    );

    if (normalizedBytes <= 0) {
        throw new RangeError(
            'Random token byte length must be greater than zero'
        );
    }

    return crypto
        .randomBytes(normalizedBytes)
        .toString('hex');
}

/**
 * ============================================================================
 * Timestamp Encoding
 * ============================================================================
 *
 * Base36 timestamp keeps identifiers compact while retaining chronological
 * traceability.
 *
 * @param {number|Date} timestamp
 * @returns {string}
 */
function timestampToken(timestamp = Date.now()) {
    const value = timestamp instanceof Date
        ? timestamp.getTime()
        : Number(timestamp);

    if (
        !Number.isFinite(value) ||
        value < 0
    ) {
        throw new TypeError(
            'Invalid timestamp supplied'
        );
    }

    return Math.floor(value)
        .toString(36);
}

/**
 * ============================================================================
 * Generate Batch ID
 * ============================================================================
 *
 * Format:
 *
 * batch_<timestamp>_<entropy>
 *
 * Example:
 *
 * batch_lq9x8m2a_83f91ab82c
 *
 * Characteristics:
 *
 * • Globally unique
 * • Compact
 * • Traceable
 * • Index friendly
 * • Safe for distributed workers
 *
 * @param {Object} options
 * @returns {string}
 */
function generateBatchId(options = {}) {
    const prefix = normalizeComponent(
        options.prefix,
        BATCH_PREFIX,
        MAX_PREFIX_LENGTH
    );

    const timestamp = timestampToken(
        options.timestamp ?? Date.now()
    );

    const entropy = isNonEmptyString(options.entropy)
        ? normalizeComponent(
            options.entropy,
            randomToken(10),
            64
        )
        : randomToken(10);

    return [
        prefix,
        timestamp,
        entropy
    ].join('_');
}

/**
 * ============================================================================
 * Generate Publisher Instance ID
 * ============================================================================
 *
 * Format:
 *
 * pub_<hostname>_<pid>_<timestamp>_<entropy>
 *
 * This identifies one logical publisher process.
 *
 * @param {Object} options
 * @returns {string}
 */
function generatePublisherId(options = {}) {
    const hostname = normalizeComponent(
        options.hostname,
        os.hostname(),
        MAX_HOSTNAME_LENGTH
    );

    const processId = normalizeProcessId(
        options.processId
    );

    const timestamp = timestampToken(
        options.timestamp ?? Date.now()
    );

    const entropy = isNonEmptyString(options.entropy)
        ? normalizeComponent(
            options.entropy,
            randomToken(8),
            64
        )
        : randomToken(8);

    return [
        PUBLISHER_PREFIX,
        hostname,
        processId,
        timestamp,
        entropy
    ].join('_');
}

/**
 * ============================================================================
 * Create Publisher Identity
 * ============================================================================
 *
 * Represents one active publisher instance.
 *
 * The returned object is frozen to prevent accidental runtime mutation.
 *
 * @param {Object} options
 * @returns {Object}
 */
function createPublisherIdentity(options = {}) {
    const hostname = normalizeComponent(
        options.hostname,
        os.hostname(),
        MAX_HOSTNAME_LENGTH
    );

    const processId = normalizeProcessId(
        options.processId
    );

    const createdAt = options.createdAt instanceof Date
        ? new Date(options.createdAt.getTime())
        : new Date();

    const publisherId =
        options.publisherId ||
        generatePublisherId({
            hostname,
            processId,
            timestamp: createdAt.getTime()
        });

    const identity = {
        publisherId,

        hostname,

        processId,

        nodeVersion:
            process.version,

        platform:
            process.platform,

        architecture:
            process.arch,

        environment:
            normalizeComponent(
                options.environment ||
                process.env.NODE_ENV ||
                DEFAULT_ENVIRONMENT,
                DEFAULT_ENVIRONMENT,
                MAX_PRIORITY_LENGTH
            ),

        serviceName:
            normalizeComponent(
                options.serviceName ||
                process.env.SERVICE_NAME ||
                'transaction-event-publisher',
                'transaction-event-publisher',
                MAX_PRIORITY_LENGTH
            ),

        podName:
            normalizeComponent(
                options.podName ||
                process.env.HOSTNAME ||
                hostname,
                hostname,
                MAX_HOSTNAME_LENGTH
            ),

        createdAt,

        instanceToken:
            options.instanceToken ||
            randomToken(16)
    };

    return Object.freeze(identity);
}

/**
 * ============================================================================
 * Build Batch Metadata
 * ============================================================================
 *
 * Metadata attached to a publishing batch.
 *
 * @param {Object} options
 * @returns {Object}
 */
function buildBatchMetadata(options = {}) {
    const size = normalizeNonNegativeInteger(
        options.size,
        DEFAULT_BATCH_SIZE
    );

    const retryAttempt = normalizeNonNegativeInteger(
        options.retryAttempt,
        DEFAULT_RETRY_ATTEMPT
    );

    const priorityCandidate =
        typeof options.priority === 'string'
            ? options.priority.trim().toUpperCase()
            : DEFAULT_PRIORITY;

    const priority = PRIORITIES.includes(
        priorityCandidate
    )
        ? priorityCandidate
        : DEFAULT_PRIORITY;

    const createdAt = options.createdAt instanceof Date
        ? new Date(options.createdAt.getTime())
        : new Date();

    const metadata = {
        batchId:
            options.batchId ||
            generateBatchId(),

        publisherId:
            options.publisherId || null,

        size,

        createdAt,

        priority,

        retryAttempt,

        sequence:
            normalizeNonNegativeInteger(
                options.sequence,
                0
            ),

        partition:
            options.partition ?? null,

        tenantId:
            options.tenantId || null,

        correlationId:
            options.correlationId || null
    };

    return Object.freeze(metadata);
}

/**
 * ============================================================================
 * Validate Publisher Identity
 * ============================================================================
 *
 * @param {*} value
 * @returns {boolean}
 */
function validatePublisherId(value) {
    if (!isNonEmptyString(value)) {
        return false;
    }

    /**
     * Hostname:
     *   alphanumeric / dot / dash
     *
     * PID:
     *   numeric
     *
     * Timestamp:
     *   base36
     *
     * Entropy:
     *   hexadecimal
     */
    return /^pub_[a-z0-9.-]+_\d+_[a-z0-9]+_[a-f0-9]+$/i
        .test(value.trim());
}

/**
 * ============================================================================
 * Validate Batch ID
 * ============================================================================
 *
 * Supports the default "batch" prefix as well as compatible custom prefixes.
 *
 * @param {*} value
 * @returns {boolean}
 */
function validateBatchId(value) {
    if (!isNonEmptyString(value)) {
        return false;
    }

    return /^[a-z0-9.-]+_[a-z0-9]+_[a-f0-9]+$/i
        .test(value.trim());
}

/**
 * ============================================================================
 * Sanitize Hostname
 * ============================================================================
 *
 * @param {*} value
 * @returns {string}
 */
function sanitize(value) {
    return normalizeComponent(
        value,
        'unknown-host',
        MAX_HOSTNAME_LENGTH
    );
}

/**
 * ============================================================================
 * Extract Batch Timestamp
 * ============================================================================
 *
 * @param {string} batchId
 * @returns {number}
 */
function extractBatchTimestamp(batchId) {
    if (!validateBatchId(batchId)) {
        throw new TypeError(
            'Invalid batch ID'
        );
    }

    const parts = batchId.split('_');

    return parseInt(
        parts[1],
        36
    );
}

/**
 * ============================================================================
 * Extract Publisher Metadata
 * ============================================================================
 *
 * @param {string} publisherId
 * @returns {Object}
 */
function parsePublisherId(publisherId) {
    if (!validatePublisherId(publisherId)) {
        throw new TypeError(
            'Invalid publisher ID'
        );
    }

    const parts = publisherId.split('_');

    return Object.freeze({
        prefix: parts[0],
        hostname: parts[1],
        processId: Number(parts[2]),
        timestamp: parseInt(parts[3], 36),
        entropy: parts[4]
    });
}

/**
 * ============================================================================
 * Extract Batch Metadata
 * ============================================================================
 *
 * @param {string} batchId
 * @returns {Object}
 */
function parseBatchId(batchId) {
    if (!validateBatchId(batchId)) {
        throw new TypeError(
            'Invalid batch ID'
        );
    }

    const parts = batchId.split('_');

    return Object.freeze({
        prefix: parts[0],
        timestamp: parseInt(parts[1], 36),
        entropy: parts[2]
    });
}

/**
 * ============================================================================
 * Validate Publisher Identity Object
 * ============================================================================
 *
 * @param {Object} identity
 * @returns {boolean}
 */
function isValidPublisherIdentity(identity) {
    if (
        !identity ||
        typeof identity !== 'object'
    ) {
        return false;
    }

    return (
        validatePublisherId(identity.publisherId) &&
        isNonEmptyString(identity.hostname) &&
        Number.isSafeInteger(identity.processId) &&
        identity.processId >= 0
    );
}

/**
 * ============================================================================
 * Validate Batch Metadata
 * ============================================================================
 *
 * @param {Object} metadata
 * @returns {boolean}
 */
function isValidBatchMetadata(metadata) {
    if (
        !metadata ||
        typeof metadata !== 'object'
    ) {
        return false;
    }

    return (
        validateBatchId(metadata.batchId) &&
        (
            metadata.publisherId === null ||
            metadata.publisherId === undefined ||
            validatePublisherId(metadata.publisherId)
        ) &&
        Number.isSafeInteger(metadata.size) &&
        metadata.size >= 0 &&
        Number.isSafeInteger(metadata.retryAttempt) &&
        metadata.retryAttempt >= 0
    );
}

/**
 * ============================================================================
 * Exports
 * ============================================================================
 */

module.exports = {
    BATCH_PREFIX,
    PUBLISHER_PREFIX,
    PRIORITIES,

    generateBatchId,
    generatePublisherId,

    createPublisherIdentity,
    buildBatchMetadata,

    validatePublisherId,
    validateBatchId,

    extractBatchTimestamp,
    parseBatchId,
    parsePublisherId,

    isValidPublisherIdentity,
    isValidBatchMetadata,

    sanitize,
    randomToken,
    timestampToken
};