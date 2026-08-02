'use strict';

/**
 * ==========================================================
 * TITech Community Capital LTD
 * Airtel Money Enterprise Authentication Module
 * ----------------------------------------------------------
 * Authentication module composition root.
 *
 * Responsibilities
 * ----------------
 * • Export authentication services
 * • Compose OAuth lifecycle components
 * • Provide dependency injection helpers
 * • Expose enterprise authentication API
 * • Support health monitoring
 * • Support operational diagnostics
 *
 * Components
 * ----------
 * • AuthService
 * • OAuthClient
 * • CredentialManager
 * • TokenManager
 * • RefreshManager
 * • HealthMonitor
 * • Observability
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Payment collections
 * • Disbursements
 * • Settlement
 * • Reconciliation
 *
 * ==========================================================
 */



const AuthService =

    require('./authService');



const OAuthClient =

    require('./oauthClient');



const CredentialManager =

    require('./credentialManager');



const TokenManager =

    require('./tokenManager');



const {

    RefreshManager

} = require('./refreshManager');



const HealthMonitor =

    require('./healthMonitor');



const {

    AirtelAuthObservability

} = require('./observability');









/**
 * ----------------------------------------------------------
 * Create Airtel Authentication Stack
 * ----------------------------------------------------------
 */
function createAirtelAuth({

    configuration,

    secretProvider,

    cache,

    httpClient,

    logger,

    metrics,

    tracer,

    eventBus,

    auditService,

    refreshManagerOptions = {}

} = {}) {





    const observability =

        new AirtelAuthObservability({

            logger,

            metrics,

            tracer,

            eventBus,

            auditService

        });









    const credentialManager =

        new CredentialManager({

            configuration,

            secretProvider,

            logger,

            metrics,

            auditService

        });









    const tokenManager =

        new TokenManager({

            cache,

            logger,

            metrics,

            tracer

        });









    const refreshManager =

        new RefreshManager({

            logger,

            metrics,

            tracer,

            ...refreshManagerOptions

        });









    const oauthClient =

        new OAuthClient({

            configuration,

            httpClient,

            logger,

            metrics,

            tracer

        });









    const authService =

        new AuthService({

            configuration,

            tokenManager,

            credentialManager,

            oauthClient,

            refreshManager,

            observability,

            auditService,

            logger,

            metrics,

            tracer

        });









    const healthMonitor =

        new HealthMonitor({

            authService,

            credentialManager,

            tokenManager,

            oauthClient,

            refreshManager,

            logger,

            metrics

        });









    return {


        authService,


        oauthClient,


        credentialManager,


        tokenManager,


        refreshManager,


        healthMonitor,


        observability


    };


}


/**
 * ----------------------------------------------------------
 * Module Exports
 * ----------------------------------------------------------
 */
module.exports = {


    createAirtelAuth,


    AuthService,


    OAuthClient,


    CredentialManager,


    TokenManager,


    RefreshManager,


    HealthMonitor,


    AirtelAuthObservability


};