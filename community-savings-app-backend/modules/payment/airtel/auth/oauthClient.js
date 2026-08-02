'use strict';

/**
 * ==========================================================
 * TITech Community Capital LTD
 * Airtel Money Enterprise OAuth Client
 * ----------------------------------------------------------
 * Enterprise HTTP abstraction layer for Airtel OAuth.
 *
 * Responsibilities
 * ----------------
 * • Airtel OAuth authentication
 * • Access token acquisition
 * • Request signing preparation
 * • HTTP transport orchestration
 * • Response validation
 * • Error normalization
 * • Correlation ID propagation
 * • Retry-aware transport support
 * • Metrics instrumentation
 * • Distributed tracing hooks
 * • Structured logging
 * • Provider health checks
 *
 * Explicitly NOT Responsible For
 * ------------------------------
 * • Token caching
 * • Token refresh lifecycle
 * • Credential storage
 * • Payment execution
 * • Collections
 * • Disbursements
 *
 * ==========================================================
 */


const crypto = require('crypto');


const {
    AuthenticationError,
    ProviderUnavailableError,
    normalizeError
} = require('../../../shared/errors');






const PROVIDER = 'AIRTEL';






class OAuthClient {


    constructor({

        configuration,

        httpClient,

        logger,

        metrics,

        tracer


    } = {}) {



        this.configuration =
            configuration;


        this.httpClient =
            httpClient;


        this.logger =
            logger;


        this.metrics =
            metrics;


        this.tracer =
            tracer;




        this.healthState = {


            status:
                'UNKNOWN',


            lastSuccess:
                null,


            lastFailure:
                null


        };


    }









    /**
     * ------------------------------------------------------
     * Authenticate With Airtel OAuth
     * ------------------------------------------------------
     */
    async authenticate({

        credentials,

        tenantId,

        correlationId =
            crypto.randomUUID()


    }) {



        const span =

            this.tracer?.startSpan?.(

                'airtel.oauth.authenticate'

            );





        const startedAt =

            Date.now();






        try {



            this.validateCredentials(

                credentials

            );






            this.logger?.info?.({

                message:

                    'Airtel OAuth authentication started',


                tenantId,


                correlationId


            });






            this.metrics?.counter?.(

                'payment_airtel_auth_request_total'

            );







            const endpoint =

                this.configuration

                    .getOAuthEndpoint();






            const response =

                await this.httpClient.request({

                    method:

                        'POST',


                    url:

                        endpoint,


                    headers:

                    {

                        'Content-Type':

                            'application/json',


                        Accept:

                            'application/json'

                    },


                    body:

                    {

                        client_id:

                            credentials.clientId,


                        client_secret:

                            credentials.clientSecret,


                        grant_type:

                            'client_credentials'

                    },


                    correlationId


                });







            const token =

                this.validateResponse(

                    response

                );








            this.healthState.status =

                'UP';




            this.healthState.lastSuccess =

                new Date();






            this.metrics?.counter?.(

                'payment_airtel_auth_success_total'

            );






            this.metrics?.histogram?.(

                'payment_airtel_auth_duration_ms',

                Date.now()

                -

                startedAt

            );








            this.logger?.info?.({

                message:

                    'Airtel OAuth authentication successful',


                tenantId,


                correlationId


            });






            return token;



        }


        catch(error){





            this.healthState.status =

                'DOWN';




            this.healthState.lastFailure =

                new Date();






            this.metrics?.counter?.(

                'payment_airtel_auth_failure_total'

            );






            this.logger?.error?.({

                message:

                    'Airtel OAuth authentication failed',


                tenantId,


                correlationId,


                error:

                    error?.toJSON?.()

                    ||

                    error


            });






            throw normalizeError(error);



        }


        finally {



            span?.end?.();


        }



    }









    /**
     * ------------------------------------------------------
     * Validate OAuth Credentials
     * ------------------------------------------------------
     */
    validateCredentials(credentials = {}){



        const required = [


            'clientId',


            'clientSecret'


        ];







        const missing =

            required.filter(

                key =>

                    !credentials[key]

            );






        if(missing.length){



            throw new AuthenticationError(

                `Missing Airtel OAuth credentials: ${missing.join(', ')}`

            );


        }



        return true;


    }









    /**
     * ------------------------------------------------------
     * Validate OAuth Response
     * ------------------------------------------------------
     */
    validateResponse(response){



        if(!response){



            throw new ProviderUnavailableError(

                'Empty response received from Airtel'

            );


        }








        const status =

            response.statusCode

            ||

            response.status;






        if(status >= 500){



            throw new ProviderUnavailableError(

                'Airtel OAuth service unavailable'

            );


        }







        if(status === 401){



            throw new AuthenticationError(

                'Invalid Airtel OAuth credentials'

            );


        }







        if(status >= 400){



            throw new AuthenticationError(

                `Airtel OAuth request failed (${status})`

            );


        }







        const body =

            response.body

            ||

            {};






        const accessToken =

            body.access_token

            ||

            body.accessToken;







        if(!accessToken){



            throw new AuthenticationError(

                'Airtel response missing access token'

            );


        }







        return {


            accessToken,


            tokenType:

                body.token_type

                ||

                'Bearer',



            expiresIn:

                Number(

                    body.expires_in

                    ||

                    3600

                ),



            issuedAt:

                new Date(),



            raw:

                body


        };


    }









    /**
     * ------------------------------------------------------
     * Connectivity Health Check
     * ------------------------------------------------------
     */
    async health(){



        try {



            const endpoint =

                this.configuration

                    .getOAuthEndpoint();






            return {


                provider:

                    PROVIDER,


                status:

                    this.healthState.status,


                oauthEndpoint:

                    endpoint,


                lastSuccess:

                    this.healthState.lastSuccess,


                lastFailure:

                    this.healthState.lastFailure


            };



        }


        catch(error){



            return {


                provider:

                    PROVIDER,


                status:

                    'DOWN',


                error:

                    error.message


            };


        }


    }









    /**
     * ------------------------------------------------------
     * Diagnostics
     * ------------------------------------------------------
     */
    snapshot(){



        return {


            provider:

                PROVIDER,


            health:

                this.healthState


        };


    }



}





module.exports = OAuthClient;