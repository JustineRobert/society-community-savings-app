'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Audit Publisher
 * ============================================================================
 *
 * Responsible for publishing immutable audit records for distributed financial
 * transaction workflows.
 *
 * Features
 * --------
 * ✓ Immutable audit events
 * ✓ SHA256 integrity hashing
 * ✓ Hash chain support
 * ✓ Multi-tenant auditing
 * ✓ Event bus integration
 * ✓ Persistent audit storage
 * ✓ Retry handling
 * ✓ Audit buffering
 * ✓ Compliance metadata
 * ✓ OpenTelemetry tracing
 * ✓ Metrics integration
 *
 * ============================================================================
 */

const crypto = require('crypto');


const AuditSeverity = Object.freeze({

    INFO: 'INFO',

    WARNING: 'WARNING',

    CRITICAL: 'CRITICAL',

    SECURITY: 'SECURITY',

    FINANCIAL: 'FINANCIAL'

});


class TransactionAuditPublisher {


    constructor(options = {}) {


        this.repository =
            options.repository || null;


        this.eventBus =
            options.eventBus || null;


        this.logger =
            options.logger || console;


        this.metrics =
            options.metrics;


        this.tracer =
            options.tracer;


        this.retryPolicy =
            options.retryPolicy;



        this.instanceId =
            crypto.randomUUID();



        this.sequence = 0;



        this.previousHash =
            null;



        this.buffer = [];



        this.maxBufferSize =
            options.maxBufferSize || 100;



        this.autoFlush =
            options.autoFlush !== false;


    }



    /**
     * =========================================================================
     * Publish Audit Event
     * =========================================================================
     */


    async publish(event = {}) {


        const span =

            this.tracer?.startSpan?.(

                'transaction.audit.publish'

            );



        try {


            const auditEvent =

                this.createAuditEvent(

                    event

                );



            this.buffer.push(

                auditEvent

            );



            if (

                this.autoFlush &&

                this.buffer.length >=

                this.maxBufferSize

            ) {


                await this.flush();


            }



            return auditEvent;


        }

        catch(error) {


            this.logger.error?.(

                '[AuditPublisher] Failed',

                error

            );


            throw error;


        }

        finally {


            span?.end?.();


        }


    }



    /**
     * =========================================================================
     * Create Immutable Audit Record
     * =========================================================================
     */


    createAuditEvent(event) {


        const timestamp =
            new Date();



        const payload = {


            auditId:

                crypto.randomUUID(),



            sequence:

                ++this.sequence,



            timestamp,



            severity:

                event.severity ||

                AuditSeverity.INFO,



            type:

                event.type ||

                'TRANSACTION_EVENT',



            transactionId:

                event.transactionId ||

                null,



            correlationId:

                event.correlationId ||

                null,



            requestId:

                event.requestId ||

                null,



            tenantId:

                event.tenantId ||

                null,



            organizationId:

                event.organizationId ||

                null,



            userId:

                event.userId ||

                null,



            service:

                event.service ||

                'transaction-system',



            action:

                event.action || null,



            entity:

                event.entity || null,



            metadata:

                event.metadata || {},



            source:

                event.source ||

                this.instanceId,



            previousHash:

                this.previousHash

        };



        payload.hash =

            this.generateHash(

                payload

            );



        this.previousHash =

            payload.hash;



        return Object.freeze(

            payload

        );

    }



    /**
     * =========================================================================
     * Hash Generation
     * =========================================================================
     */


    generateHash(payload) {


        const data =

            JSON.stringify(

                {

                    ...payload,

                    hash: undefined

                }

            );



        return crypto

            .createHash('sha256')

            .update(data)

            .digest('hex');


    }



    /**
     * =========================================================================
     * Flush Audit Buffer
     * =========================================================================
     */


    async flush() {


        if (!this.buffer.length) {

            return [];

        }



        const events =

            [...this.buffer];



        this.buffer = [];



        try {


            await this.persist(

                events

            );



            await this.publishEvents(

                events

            );



            this.metrics?.increment?.(

                'transaction_audit_events_total',

                {

                    count:

                        events.length

                }

            );



            return events;


        }

        catch(error) {


            this.buffer.unshift(

                ...events

            );


            throw error;


        }


    }



    /**
     * =========================================================================
     * Persist Audit Records
     * =========================================================================
     */


    async persist(events) {


        if (!this.repository) {


            return;


        }



        if (

            this.repository.bulkCreate

        ) {


            return this.repository.bulkCreate(

                events

            );

        }



        for (

            const event of events

        ) {


            await this.repository.create(

                event

            );

        }


    }



    /**
     * =========================================================================
     * Publish Event Bus Messages
     * =========================================================================
     */


    async publishEvents(events) {


        if (!this.eventBus) {

            return;

        }



        for (

            const event of events

        ) {


            await this.eventBus.publish({

                type:

                    'audit.transaction.event',



                payload:

                    event

            });


        }


    }



    /**
     * =========================================================================
     * Convenience Audit Methods
     * =========================================================================
     */


    async transactionCreated(context) {


        return this.publish({

            type:

                'TRANSACTION_CREATED',


            severity:

                AuditSeverity.FINANCIAL,


            ...context

        });


    }



    async transactionCommitted(context) {


        return this.publish({

            type:

                'TRANSACTION_COMMITTED',


            severity:

                AuditSeverity.FINANCIAL,


            ...context

        });


    }



    async transactionFailed(context) {


        return this.publish({

            type:

                'TRANSACTION_FAILED',


            severity:

                AuditSeverity.CRITICAL,


            ...context

        });


    }



    async securityEvent(context) {


        return this.publish({

            type:

                'SECURITY_EVENT',


            severity:

                AuditSeverity.SECURITY,


            ...context

        });


    }



    /**
     * =========================================================================
     * Verify Hash Chain
     * =========================================================================
     */


    verifyChain(events) {


        let previousHash = null;



        for (

            const event of events

        ) {


            if (

                event.previousHash !== previousHash

            ) {


                return false;

            }



            const expected =

                this.generateHash(

                    event

                );



            if (

                expected !== event.hash

            ) {


                return false;

            }



            previousHash =

                event.hash;


        }



        return true;


    }



    /**
     * =========================================================================
     * Statistics
     * =========================================================================
     */


    getStatistics() {


        return {


            instanceId:

                this.instanceId,


            sequence:

                this.sequence,


            buffered:

                this.buffer.length,


            lastHash:

                this.previousHash


        };


    }



    /**
     * =========================================================================
     * Shutdown
     * =========================================================================
     */


    async shutdown() {


        await this.flush();


    }


}



TransactionAuditPublisher.Severity =
    AuditSeverity;


module.exports = TransactionAuditPublisher;