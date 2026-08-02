'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise Airtel Money Credential Manager
 * ============================================================================
 *
 * Production-grade credential lifecycle management.
 *
 * Responsibilities
 * ----------------
 * • Multi-tenant credential resolution
 * • Runtime credential overrides
 * • Secret-provider integration
 * • Environment fallback
 * • Configuration fallback
 * • Credential validation
 * • Secure fingerprinting
 * • Credential versioning
 * • Runtime rotation
 * • Cache lifecycle
 * • Health reporting
 * • Metrics
 * • Audit
 * • Diagnostics
 *
 * ============================================================================
 */

const crypto = require('crypto');

const {
    AuthenticationError
} = require('../../../shared/errors');

const PROVIDER = 'AIRTEL';

const DEFAULT_CACHE_TTL = 300000;

class CredentialManager {

    constructor({

        configuration,

        secretProvider = null,

        cacheTTL = DEFAULT_CACHE_TTL,

        logger,

        metrics,

        tracer,

        auditService

    } = {}) {

        if (!configuration) {
            throw new Error(
                'configuration is required'
            );
        }

        this.configuration = configuration;
        this.secretProvider = secretProvider;
        this.cacheTTL = Number(cacheTTL);

        this.logger = logger;
        this.metrics = metrics;
        this.tracer = tracer;
        this.auditService = auditService;

        this.cache = new Map();

        this.runtimeCredentials = new Map();

        this.statistics = {

            resolutions: 0,

            cacheHits: 0,

            cacheMisses: 0,

            rotations: 0,

            validations: 0,

            failures: 0

        };

    }

    /**
     * =====================================================================
     * Resolve Credentials
     * =====================================================================
     */

    async resolve({

        tenantId

    } = {}) {

        const span =
            this.tracer?.startSpan?.(
                'airtel.credentials.resolve'
            );

        const cacheKey =
            tenantId || 'default';

        this.statistics.resolutions++;

        const cached =
            this.cache.get(cacheKey);

        if (

            cached &&

            cached.expiresAt > Date.now()

        ) {

            this.statistics.cacheHits++;

            this.metrics?.counter?.(
                'payment_airtel_credential_cache_hit_total'
            );

            span?.end?.();

            return cached.credentials;

        }

        this.statistics.cacheMisses++;

        this.metrics?.counter?.(
            'payment_airtel_credential_cache_miss_total'
        );

        let credentials;

        let source = 'environment';

        try {

            /**
             * Runtime override
             */

            if (

                this.runtimeCredentials.has(cacheKey)

            ) {

                credentials =
                    this.runtimeCredentials.get(cacheKey);

                source = 'runtime';

            }

            /**
             * Secret provider
             */

            else if (

                this.secretProvider?.getCredentials

            ) {

                credentials =
                    await this.secretProvider.getCredentials({

                        provider: PROVIDER,

                        tenantId

                    });

                source = 'secret-provider';

            }

            /**
             * Configuration
             */

            else if (

                typeof this.configuration.forTenant ===
                'function'

            ) {

                credentials =
                    this.configuration
                        .forTenant({

                            tenantId

                        }).credentials;

                source = 'configuration';

            }

            /**
             * Environment
             */

            else {

                credentials = {

                    clientId:
                        process.env.AIRTEL_CLIENT_ID,

                    clientSecret:
                        process.env.AIRTEL_CLIENT_SECRET,

                    subscriptionKey:
                        process.env.AIRTEL_SUBSCRIPTION_KEY,

                    country:
                        process.env.AIRTEL_COUNTRY,

                    environment:
                        process.env.AIRTEL_ENVIRONMENT

                };

            }

            this.validate(credentials);

            const frozen =
                Object.freeze({

                    ...credentials,

                    provider: PROVIDER,

                    source,

                    fingerprint:
                        this.fingerprint(credentials),

                    resolvedAt:
                        new Date()

                });

            this.cache.set(

                cacheKey,

                {

                    credentials: frozen,

                    expiresAt:
                        Date.now() + this.cacheTTL

                }

            );

            this.auditService?.record?.({

                action:
                    'AIRTEL_CREDENTIAL_RESOLVED',

                provider:
                    PROVIDER,

                tenantId,

                metadata: {

                    source

                }

            });

            return frozen;

        }

        catch (error) {

            this.statistics.failures++;

            throw error;

        }

        finally {

            span?.end?.();

        }

    }

    /**
     * =====================================================================
     * Validate
     * =====================================================================
     */

    validate(credentials = {}) {

        this.statistics.validations++;

        const required = [

            'clientId',

            'clientSecret'

        ];

        const missing =
            required.filter(

                key => !credentials[key]

            );

        if (missing.length) {

            throw new AuthenticationError(

                `Missing Airtel credentials: ${missing.join(', ')}`

            );

        }

        return true;

    }

    /**
     * =====================================================================
     * Rotate
     * =====================================================================
     */

    async rotate({

        tenantId,

        credentials

    }) {

        this.validate(credentials);

        const cacheKey =
            tenantId || 'default';

        this.runtimeCredentials.set(

            cacheKey,

            Object.freeze({

                ...credentials

            })

        );

        this.cache.delete(cacheKey);

        this.statistics.rotations++;

        this.metrics?.counter?.(
            'payment_airtel_credential_rotation_total'
        );

        await this.auditService?.record?.({

            action:
                'AIRTEL_CREDENTIAL_ROTATED',

            provider:
                PROVIDER,

            tenantId,

            correlationId:
                crypto.randomUUID()

        });

        return true;

    }

    /**
     * =====================================================================
     * Remove Override
     * =====================================================================
     */

    async remove({

        tenantId

    }) {

        const cacheKey =
            tenantId || 'default';

        this.runtimeCredentials.delete(cacheKey);

        this.cache.delete(cacheKey);

    }

    /**
     * =====================================================================
     * Cache
     * =====================================================================
     */

    clearCache() {

        this.cache.clear();

    }

    invalidate({

        tenantId

    } = {}) {

        if (tenantId) {

            this.cache.delete(tenantId);

            return;

        }

        this.clearCache();

    }

    /**
     * =====================================================================
     * Helpers
     * =====================================================================
     */

    fingerprint(credentials) {

        return crypto

            .createHash('sha256')

            .update(

                `${credentials.clientId}:${credentials.subscriptionKey || ''}`

            )

            .digest('hex')

            .substring(0, 16);

    }

    /**
     * =====================================================================
     * Health
     * =====================================================================
     */

    async health({

        tenantId = null

    } = {}) {

        try {

            if (tenantId) {

                await this.resolve({

                    tenantId

                });

            }

            return {

                status: 'UP',

                provider: PROVIDER,

                cacheEntries:
                    this.cache.size,

                runtimeOverrides:
                    this.runtimeCredentials.size,

                cacheTTL:
                    this.cacheTTL,

                statistics:
                    this.statistics

            };

        }

        catch (error) {

            return {

                status: 'DOWN',

                provider: PROVIDER,

                error:
                    error.message

            };

        }

    }

    /**
     * =====================================================================
     * Statistics
     * =====================================================================
     */

    stats() {

        return {

            ...this.statistics,

            cacheEntries:
                this.cache.size,

            runtimeOverrides:
                this.runtimeCredentials.size,

            cacheTTL:
                this.cacheTTL

        };

    }

    /**
     * =====================================================================
     * Snapshot
     * =====================================================================
     */

    snapshot() {

        return {

            provider: PROVIDER,

            cacheEntries:
                this.cache.size,

            runtimeOverrides:
                this.runtimeCredentials.size,

            tenants:

                [...this.cache.keys()],

            statistics:

                this.statistics

        };

    }

}

module.exports = CredentialManager;