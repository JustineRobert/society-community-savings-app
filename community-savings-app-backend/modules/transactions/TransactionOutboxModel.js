'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Transaction Outbox Core Model
 * ============================================================================
 *
 * Implements:
 *
 * - Event envelope schema
 * - Outbox record creation
 * - Event metadata
 * - Aggregate identifiers
 * - Tenant isolation
 * - Versioning
 * - Ordering keys
 * - Persistence contract
 *
 * Design goals:
 *
 * - Transactional event reliability
 * - At-least-once delivery
 * - Multi-tenant isolation
 * - Event replay capability
 * - Financial audit traceability
 *
 * ============================================================================
 */


const {

    generateEventId

} = require('./utils/TransactionEventIdUtils');



const {

    generateCorrelationId

} = require('./utils/TransactionCorrelationUtils');



const {

    generateBatchId

} = require('./utils/TransactionPublisherIdentityUtils');



const {

    deepFreeze

} = require('./utils/TransactionObjectUtils');





/**
 * ============================================================================
 * Constants
 * ============================================================================
 */


const OUTBOX_VERSION = 1;



const EventStatus = Object.freeze({

    CREATED:

        'CREATED',


    PENDING:

        'PENDING',


    PROCESSING:

        'PROCESSING',


    PUBLISHED:

        'PUBLISHED',


    FAILED:

        'FAILED',


    DEAD_LETTER:

        'DEAD_LETTER'

});





const EventPriority = Object.freeze({

    LOW:

        'LOW',


    NORMAL:

        'NORMAL',


    HIGH:

        'HIGH',


    CRITICAL:

        'CRITICAL'

});





/**
 * ============================================================================
 * Event Envelope Factory
 * ============================================================================
 *
 * Standard event contract.
 *
 */


function createEventEnvelope(options = {}) {


    const now =

        new Date();



    return deepFreeze({


        eventId:

            options.eventId ||

            generateEventId(),



        eventType:

            options.eventType,



        eventVersion:

            options.eventVersion || 1,



        occurredAt:

            options.occurredAt ||

            now,



        createdAt:

            now,



        correlationId:

            options.correlationId ||

            generateCorrelationId(),



        tenantId:

            options.tenantId,



        aggregate:

            createAggregateIdentity(

                options.aggregate

            ),



        metadata:

            createEventMetadata(

                options.metadata

            ),



        payload:

            options.payload || {},



    });


}





/**
 * ============================================================================
 * Aggregate Identity
 * ============================================================================
 *
 * Identifies the business entity that produced the event.
 *
 * Examples:
 *
 * Loan
 * Savings Account
 * Member
 * Payment
 *
 */


function createAggregateIdentity(
    aggregate = {}
) {


    return {


        type:

            aggregate.type || null,



        id:

            aggregate.id || null,



        version:

            aggregate.version || 1



    };


}





/**
 * ============================================================================
 * Event Metadata
 * ============================================================================
 */


function createEventMetadata(
    metadata = {}
) {


    return {


        source:

            metadata.source ||

            'transaction-service',



        service:

            metadata.service ||

            'transactions',



        environment:

            process.env.NODE_ENV ||

            'development',



        schemaVersion:

            OUTBOX_VERSION,



        priority:

            metadata.priority ||

            EventPriority.NORMAL,



        retryCount:

            0


    };


}





/**
 * ============================================================================
 * Create Outbox Record
 * ============================================================================
 */


function createOutboxRecord(options = {}) {


    const envelope =

        options.event ||

        createEventEnvelope(

            options

        );



    return {


        id:

            envelope.eventId,



        event:

            envelope,



        status:

            EventStatus.PENDING,



        batchId:

            options.batchId ||

            generateBatchId(),



        orderingKey:

            createOrderingKey(

                envelope

            ),



        tenantId:

            envelope.tenantId,



        availableAt:

            new Date(),



        attempts:

            0,



        publishedAt:

            null,



        lockedAt:

            null,



        createdAt:

            envelope.createdAt,



        updatedAt:

            envelope.createdAt


    };


}





/**
 * ============================================================================
 * Ordering Key
 * ============================================================================
 *
 * Guarantees ordering per aggregate.
 *
 */


function createOrderingKey(event) {


    return [

        event.tenantId,

        event.aggregate.type,

        event.aggregate.id

    ]

    .filter(Boolean)

    .join(':');


}





/**
 * ============================================================================
 * Persistence Contract
 * ============================================================================
 *
 * Repository implementations must support this interface.
 *
 */


const OutboxRepositoryContract = Object.freeze({

    create:

        'create(record)',



    findPending:

        'findPending(limit)',



    markProcessing:

        'markProcessing(id)',



    markPublished:

        'markPublished(id)',



    markFailed:

        'markFailed(id,error)',



    remove:

        'remove(id)'


});





/**
 * ============================================================================
 * Validation
 * ============================================================================
 */


function validateOutboxRecord(record) {


    return Boolean(


        record &&


        record.id &&


        record.event &&


        record.event.eventType &&


        record.tenantId


    );


}





/**
 * ============================================================================
 * Exports
 * ============================================================================
 */


module.exports = {


    OUTBOX_VERSION,


    EventStatus,


    EventPriority,


    createEventEnvelope,


    createOutboxRecord,


    createAggregateIdentity,


    createEventMetadata,


    createOrderingKey,


    validateOutboxRecord,


    OutboxRepositoryContract


};