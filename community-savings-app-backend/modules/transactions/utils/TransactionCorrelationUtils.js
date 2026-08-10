/**
 * ============================================================================
 * Correlation Utilities
 * ============================================================================
 *
 * Provides:
 *
 * - generateCorrelationId()
 * - Parent correlation propagation
 * - Request -> Transaction -> Event trace continuity
 *
 * Design goals:
 *
 * - Maintain distributed transaction identity
 * - Preserve upstream context
 * - Support microservice workflows
 * - Enable audit reconstruction
 *
 * ============================================================================
 */



const crypto = require('crypto');



/**
 * ============================================================================
 * Constants
 * ============================================================================
 */


const CORRELATION_PREFIX = 'cor';



const CORRELATION_VERSION = '1';



/**
 * ============================================================================
 * Generate Secure Random Component
 * ============================================================================
 */


function generateEntropy() {


    return crypto

        .randomBytes(12)

        .toString('hex');


}



/**
 * ============================================================================
 * Timestamp Component
 * ============================================================================
 */


function correlationTimestamp() {


    return Date

        .now()

        .toString(36);


}



/**
 * ============================================================================
 * Generate Correlation ID
 * ============================================================================
 *
 * Format:
 *
 * cor_v1_<timestamp>_<entropy>
 *
 *
 * Example:
 *
 * cor_v1_lq8j4k9z_a84f91e7d9c2b7aa91
 *
 *
 * Characteristics:
 *
 * - Globally unique
 * - Trace friendly
 * - Compact
 * - Log searchable
 *
 */


function generateCorrelationId(options = {}) {


    if (

        options.existingCorrelationId

    ) {


        return options.existingCorrelationId;


    }



    return [

        CORRELATION_PREFIX,

        `v${CORRELATION_VERSION}`,

        correlationTimestamp(),

        generateEntropy()

    ].join('_');


}





/**
 * ============================================================================
 * Parent Correlation Propagation
 * ============================================================================
 *
 * Creates child correlation context.
 *
 * Example:
 *
 * API Request
 *      |
 *      |
 *      +-- Transaction
 *              |
 *              +-- Event
 *
 */


function createChildCorrelation(parentCorrelationId, metadata = {}) {


    if (

        !parentCorrelationId

    ) {


        return {


            correlationId:

                generateCorrelationId(),



            parentCorrelationId:

                null,


            metadata


        };


    }



    return {


        correlationId:

            generateCorrelationId(),



        parentCorrelationId,



        metadata


    };


}





/**
 * ============================================================================
 * Resolve Correlation Context
 * ============================================================================
 *
 * Priority:
 *
 * 1. Existing event context
 * 2. Transaction context
 * 3. Request context
 * 4. New correlation
 *
 */


function resolveCorrelationContext(context = {}) {


    return {


        correlationId:


            context.correlationId ||


            context.transactionCorrelationId ||


            context.requestCorrelationId ||


            generateCorrelationId(),



        parentCorrelationId:


            context.parentCorrelationId || null,



        requestId:


            context.requestId || null,



        transactionId:


            context.transactionId || null,


        traceId:


            context.traceId || null


    };


}





/**
 * ============================================================================
 * Validate Correlation ID
 * ============================================================================
 */


function isValidCorrelationId(value) {


    if (

        typeof value !== 'string'

    ) {


        return false;


    }



    return /^cor_v\d+_[a-z0-9]+_[a-f0-9]+$/i

        .test(value);


}





/**
 * ============================================================================
 * Build Event Correlation Metadata
 * ============================================================================
 *
 * Used by TransactionEvents.create()
 *
 */


function buildCorrelationMetadata(context = {}) {


    const resolved =

        resolveCorrelationContext(

            context

        );



    return {


        correlationId:

            resolved.correlationId,



        parentCorrelationId:

            resolved.parentCorrelationId,



        requestId:

            resolved.requestId,



        transactionId:

            resolved.transactionId,



        traceId:

            resolved.traceId


    };


}





/**
 * ============================================================================
 * Exports
 * ============================================================================
 */


module.exports = {


    generateCorrelationId,


    createChildCorrelation,


    resolveCorrelationContext,


    buildCorrelationMetadata,


    isValidCorrelationId


};