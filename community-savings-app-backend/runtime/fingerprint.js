"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Runtime Fingerprint Utilities
 * =============================================================================
 *
 * File: backend/runtime/fingerprint.js
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Deterministic SHA-256 fingerprints
 * ✓ Stable object serialization
 * ✓ Financial/event integrity support
 * ✓ Offline event deduplication support
 * ✓ Idempotency support
 * ✓ Domain separation
 * ✓ Explicit input validation
 * ✓ Buffer/string support
 * ✓ Production-safe implementation
 *
 * Design Principles
 * -----------------------------------------------------------------------------
 * - Fingerprints are deterministic.
 * - Object key ordering must not affect the fingerprint.
 * - Fingerprints are integrity identifiers, NOT encryption.
 * - Fingerprints must never replace authorization.
 * - Fingerprints must never be treated as secrets.
 * - Financial events should include immutable canonical data.
 * =============================================================================
 */

const crypto = require("crypto");

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const HASH_ALGORITHM = "sha256";

const DEFAULT_DOMAIN =
    "titech.community-capital";

// -----------------------------------------------------------------------------
// Stable Serialization
// -----------------------------------------------------------------------------
//
// JSON.stringify({ a: 1, b: 2 })
// and
// JSON.stringify({ b: 2, a: 1 })
//
// can produce different strings.
//
// Stable serialization prevents this from producing different fingerprints.
//
// -----------------------------------------------------------------------------

function stableSerialize(value) {

    if (value === undefined) {
        return "undefined";
    }

    if (value === null) {
        return "null";
    }

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return JSON.stringify(value);

    }

    if (typeof value === "bigint") {

        return JSON.stringify(
            `${value.toString()}n`
        );

    }

    if (value instanceof Date) {

        return JSON.stringify(
            value.toISOString()
        );

    }

    if (Buffer.isBuffer(value)) {

        return JSON.stringify(
            value.toString("base64")
        );

    }

    if (Array.isArray(value)) {

        return "[" +
            value
                .map(item =>
                    stableSerialize(item)
                )
                .join(",") +
            "]";

    }

    if (typeof value === "object") {

        const keys =
            Object.keys(value)
                .sort();

        return "{" +
            keys
                .map(key =>
                    JSON.stringify(key) +
                    ":" +
                    stableSerialize(
                        value[key]
                    )
                )
                .join(",") +
            "}";

    }

    throw new TypeError(
        `Unsupported fingerprint value type: ${typeof value}`
    );

}

// -----------------------------------------------------------------------------
// Normalize Domain
// -----------------------------------------------------------------------------

function normalizeDomain(domain) {

    if (
        domain === undefined ||
        domain === null
    ) {

        return DEFAULT_DOMAIN;

    }

    if (
        typeof domain !== "string" ||
        !domain.trim()
    ) {

        throw new TypeError(
            "Fingerprint domain must be a non-empty string."
        );

    }

    return domain.trim();

}

// -----------------------------------------------------------------------------
// Create Fingerprint
// -----------------------------------------------------------------------------
//
// Domain separation prevents unrelated fingerprint domains from accidentally
// producing the same logical digest context.
//
// Example:
//
// createFingerprint(
//     financialEvent,
//     "titech.financial-event"
// );
//
// -----------------------------------------------------------------------------

function createFingerprint(
    payload,
    domain = DEFAULT_DOMAIN
) {

    const normalizedDomain =
        normalizeDomain(domain);

    const canonicalPayload =
        stableSerialize(payload);

    const input =
        [
            normalizedDomain,
            canonicalPayload
        ].join(":");

    return crypto
        .createHash(HASH_ALGORITHM)
        .update(input, "utf8")
        .digest("hex");

}

// -----------------------------------------------------------------------------
// Create Fingerprint From String
// -----------------------------------------------------------------------------

function createStringFingerprint(
    value,
    domain = DEFAULT_DOMAIN
) {

    if (
        typeof value !== "string"
    ) {

        throw new TypeError(
            "Fingerprint input must be a string."
        );

    }

    return createFingerprint(
        value,
        domain
    );

}

// -----------------------------------------------------------------------------
// Create Fingerprint From Buffer
// -----------------------------------------------------------------------------

function createBufferFingerprint(
    value,
    domain = DEFAULT_DOMAIN
) {

    if (!Buffer.isBuffer(value)) {

        throw new TypeError(
            "Fingerprint input must be a Buffer."
        );

    }

    const normalizedDomain =
        normalizeDomain(domain);

    return crypto
        .createHash(HASH_ALGORITHM)
        .update(
            normalizedDomain,
            "utf8"
        )
        .update(":")
        .update(value)
        .digest("hex");

}

// -----------------------------------------------------------------------------
// Verify Fingerprint
// -----------------------------------------------------------------------------
//
// Uses timingSafeEqual to avoid ordinary string-comparison timing differences
// when fingerprints are compared in security-sensitive contexts.
//
// -----------------------------------------------------------------------------

function verifyFingerprint(
    payload,
    expectedFingerprint,
    domain = DEFAULT_DOMAIN
) {

    if (
        typeof expectedFingerprint !==
        "string"
    ) {

        return false;

    }

    const actualFingerprint =
        createFingerprint(
            payload,
            domain
        );

    const actualBuffer =
        Buffer.from(
            actualFingerprint,
            "hex"
        );

    const expectedBuffer =
        Buffer.from(
            expectedFingerprint,
            "hex"
        );

    if (
        actualBuffer.length !==
        expectedBuffer.length
    ) {

        return false;

    }

    return crypto.timingSafeEqual(
        actualBuffer,
        expectedBuffer
    );

}

// -----------------------------------------------------------------------------
// Fingerprint Chain
// -----------------------------------------------------------------------------
//
// Useful for immutable TITech offline events.
//
// Each event can reference the fingerprint of the previous event:
//
// previousFingerprint
//        │
//        ▼
// current event
//        │
//        ▼
// currentFingerprint
//
// This makes unauthorized modification/reordering detectable.
//
// -----------------------------------------------------------------------------

function createChainedFingerprint(
    payload,
    previousFingerprint = null,
    domain = "titech.event"
) {

    return createFingerprint(
        {
            previousFingerprint,
            payload
        },
        domain
    );

}

// -----------------------------------------------------------------------------
// Financial Event Fingerprint
// -----------------------------------------------------------------------------
//
// Financial fingerprints should be generated from immutable business data.
//
// Do NOT include:
//
// - access tokens
// - refresh tokens
// - passwords
// - secrets
// - authorization headers
// - transient UI state
//
// -----------------------------------------------------------------------------

function createFinancialFingerprint(
    event,
    previousFingerprint = null
) {

    if (
        !event ||
        typeof event !== "object" ||
        Array.isArray(event)
    ) {

        throw new TypeError(
            "Financial event must be a plain object."
        );

    }

    return createChainedFingerprint(
        event,
        previousFingerprint,
        "titech.financial-event"
    );

}

// -----------------------------------------------------------------------------
// Event Integrity Record
// -----------------------------------------------------------------------------

function createIntegrityRecord(
    payload,
    previousFingerprint = null,
    domain = "titech.event"
) {

    const fingerprint =
        createChainedFingerprint(
            payload,
            previousFingerprint,
            domain
        );

    return {

        algorithm:
            HASH_ALGORITHM,

        domain:
            normalizeDomain(domain),

        fingerprint,

        previousFingerprint:
            previousFingerprint || null

    };

}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

module.exports = {

    HASH_ALGORITHM,

    DEFAULT_DOMAIN,

    stableSerialize,

    createFingerprint,

    createStringFingerprint,

    createBufferFingerprint,

    verifyFingerprint,

    createChainedFingerprint,

    createFinancialFingerprint,

    createIntegrityRecord

};