'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Enterprise Airtel Money Authentication Service
 * ============================================================================
 *
 * Purpose
 * -------
 * Enterprise orchestration layer responsible for the complete Airtel Money
 * OAuth authentication lifecycle.
 *
 * Responsibilities
 * ----------------
 * • Authentication orchestration
 * • Access token acquisition
 * • Token cache coordination
 * • Automatic refresh
 * • Credential resolution
 * • Runtime credential rotation
 * • Multi-tenant support
 * • Correlation ID propagation
 * • OpenTelemetry instrumentation
 * • Prometheus metrics
 * • Structured audit logging
 * • Provider health monitoring
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • HTTP transport implementation
 * • Payment collections
 * • Disbursements
 * • Settlement
 * • Callback processing
 * • Business validation
 *
 * ============================================================================
 */

const crypto = require('crypto');

const {
    normalizeError,
    AuthenticationError
} = require('../../shared/errors');

class AirtelAuthService {

    constructor({

        configuration,

        credentialManager,

        tokenManager,

        oauthClient,

        refreshManager,

        observability,

        auditService,

        logger,

        metrics,

        tracer

    } = {}) {

        if (!configuration) {
            throw new Error(
                'configuration is required'
            );
        }

        if (!credentialManager) {
            throw new Error(
                'credentialManager is required'
            );
        }

        if (!tokenManager) {
            throw new Error(
                'tokenManager is required'
            );
        }

        if (!oauthClient) {
            throw new Error(
                'oauthClient is required'
            );
        }

        this.configuration =
            configuration;

        this.credentialManager =
            credentialManager;

        this.tokenManager =
            tokenManager;

        this.oauthClient =
            oauthClient;

        this.refreshManager =
            refreshManager;

        this.observability =
            observability;

        this.auditService =
            auditService;

        this.logger =
            logger;

        this.metrics =
            metrics;

        this.tracer =
            tracer;

        this.startedAt =
            new Date();

        this.healthState = {

            status: 'UNKNOWN',

            initialized: false,

            lastAuthentication: null,

            lastFailure: null

        };

    }

    /**
     * ------------------------------------------------------------------------
     * Initialize Authentication Subsystem
     * ------------------------------------------------------------------------
     */

    async initialize() {

        this.configuration.validate?.();

        this.healthState.initialized = true;
        this.healthState.status = 'READY';

        this.logger?.info?.({

            message:
                'Airtel authentication initialized'

        });

        this.metrics?.counter?.(
            'payment_airtel_auth_initialize_total'
        );

        return true;

    }

    /**
     * ------------------------------------------------------------------------
     * Authenticate
     * ------------------------------------------------------------------------
     */

    async authenticate({

        tenantId,

        correlationId = crypto.randomUUID()

    }) {

        const span =
            this.tracer?.startSpan?.(
                'airtel.auth.authenticate'
            );

        const started =
            Date.now();

        try {

            this.observability?.authenticationStarted?.({

                tenantId,

                correlationId

            });

            const credentials =
                await this.credentialManager.resolve({

                    tenantId

                });

            if (!credentials) {

                throw new AuthenticationError(
                    'Airtel credentials not found'
                );

            }

            const token =
                await this.oauthClient.authenticate({

                    credentials,

                    correlationId

                });

            await this.tokenManager.store({

                tenantId,

                token,

                correlationId

            });

            this.healthState.status = 'UP';
            this.healthState.lastAuthentication = new Date();

            this.metrics?.counter?.(
                'payment_airtel_auth_success_total'
            );

            this.metrics?.histogram?.(

                'payment_airtel_auth_duration_ms',

                Date.now() - started

            );

            await this.auditService?.record({

                action:
                    'AIRTEL_AUTH_SUCCESS',

                tenantId,

                correlationId

            });

            this.logger?.info?.({

                message:
                    'Airtel authentication successful',

                tenantId,

                correlationId

            });

            this.observability?.authenticationSucceeded?.({

                tenantId,

                correlationId

            });

            return token;

        }

        catch (error) {

            this.healthState.status = 'DOWN';
            this.healthState.lastFailure = new Date();

            this.metrics?.counter?.(
                'payment_airtel_auth_failure_total'
            );

            this.observability?.authenticationFailed?.({

                tenantId,

                correlationId,

                error

            });

            this.logger?.error?.({

                message:
                    'Airtel authentication failed',

                tenantId,

                correlationId,

                error:
                    error.toJSON?.() || error

            });

            throw normalizeError(error);

        }

        finally {

            span?.end?.();

        }

    }

    /**
     * ------------------------------------------------------------------------
     * Retrieve Valid Access Token
     * ------------------------------------------------------------------------
     */

    async getAccessToken({

        tenantId,

        correlationId = crypto.randomUUID()

    }) {

        const cached =
            await this.tokenManager.get({

                tenantId

            });

        if (!cached) {

            this.metrics?.counter?.(
                'payment_airtel_token_cache_miss_total'
            );

            return this.authenticate({

                tenantId,

                correlationId

            });

        }

        this.metrics?.counter?.(
            'payment_airtel_token_cache_hit_total'
        );

        if (

            this.tokenManager.isExpiringSoon(cached)

        ) {

            return this.refreshToken({

                tenantId,

                correlationId

            });

        }

        return cached.accessToken;

    }

    /**
     * ------------------------------------------------------------------------
     * Refresh Access Token
     * ------------------------------------------------------------------------
     */

    async refreshToken({

        tenantId,

        correlationId = crypto.randomUUID()

    }) {

        if (!this.refreshManager) {

            return this.authenticate({

                tenantId,

                correlationId

            });

        }

        return this.refreshManager.execute({

            tenantId,

            correlationId,

            refresh: async () =>

                this.authenticate({

                    tenantId,

                    correlationId

                })

        });

    }

    /**
     * ------------------------------------------------------------------------
     * Invalidate Cached Token
     * ------------------------------------------------------------------------
     */

    async invalidate({

        tenantId

    }) {

        await this.tokenManager.remove({

            tenantId

        });

        await this.auditService?.record({

            action:
                'AIRTEL_TOKEN_INVALIDATED',

            tenantId

        });

        this.logger?.info?.({

            message:
                'Airtel token invalidated',

            tenantId

        });

        return true;

    }

    /**
     * ------------------------------------------------------------------------
     * Rotate Credentials
     * ------------------------------------------------------------------------
     */

    async rotateCredentials({

        tenantId,

        credentials

    }) {

        await this.credentialManager.rotate({

            tenantId,

            credentials

        });

        await this.invalidate({

            tenantId

        });

        return this.authenticate({

            tenantId

        });

    }

    /**
     * ------------------------------------------------------------------------
     * Warm Token Cache
     * ------------------------------------------------------------------------
     */

    async warm({

        tenantId

    }) {

        return this.getAccessToken({

            tenantId

        });

    }

    /**
     * ------------------------------------------------------------------------
     * Health Check
     * ------------------------------------------------------------------------
     */

    async health() {

        return {

            provider: 'AIRTEL',

            module: 'authentication',

            status:
                this.healthState.status,

            initialized:
                this.healthState.initialized,

            startedAt:
                this.startedAt,

            uptimeMs:
                Date.now() -
                this.startedAt.getTime(),

            cacheEntries:
                this.tokenManager.size?.(),

            lastAuthentication:
                this.healthState.lastAuthentication,

            lastFailure:
                this.healthState.lastFailure

        };

    }

    /**
     * ------------------------------------------------------------------------
     * Runtime Capabilities
     * ------------------------------------------------------------------------
     */

    capabilities() {

        return Object.freeze({

            provider: 'AIRTEL',

            oauth: true,

            tokenCaching: true,

            automaticRefresh: !!this.refreshManager,

            credentialRotation: true,

            audit: !!this.auditService,

            tracing: !!this.tracer,

            metrics: !!this.metrics,

            multiTenant: true

        });

    }

}

module.exports = AirtelAuthService;