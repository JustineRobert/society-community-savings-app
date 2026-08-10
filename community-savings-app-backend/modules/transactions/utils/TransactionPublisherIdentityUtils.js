'use strict';

/**
 * ============================================================================
 * Batch & Publisher Identity Utilities
 * ============================================================================
 *
 * Provides:
 *
 * - generateBatchId()
 * - generatePublisherId()
 * - Publisher instance identity
 * - Batch processing traceability
 *
 * Design goals:
 *
 * - Identify publisher workers uniquely
 * - Trace event batches
 * - Support horizontal scaling
 * - Support Kubernetes replicas
 * - Support operational debugging
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


const PROCESS_ID =

    process.pid;



/**
 * ============================================================================
 * Secure Random Component
 * ============================================================================
 */


function randomToken(length = 12) {


    return crypto

        .randomBytes(length)

        .toString('hex');


}



/**
 * ============================================================================
 * Timestamp Encoding
 * ============================================================================
 */


function timestampToken() {


    return Date

        .now()

        .toString(36);


}



/**
 * ============================================================================
 * Generate Batch ID
 * ============================================================================
 *
 * Identifies a group of events processed together.
 *
 * Format:
 *
 * batch_<timestamp>_<random>
 *
 *
 * Example:
 *
 * batch_lq9x8m2a_83f91ab82c
 *
 *
 * Used for:
 *
 * - Batch publishing
 * - Retry grouping
 * - Metrics aggregation
 * - Failure analysis
 *
 */


function generateBatchId(options = {}) {


    const prefix =

        options.prefix ||

        BATCH_PREFIX;



    return [

        prefix,

        timestampToken(),

        randomToken(10)

    ].join('_');


}





/**
 * ============================================================================
 * Generate Publisher Instance ID
 * ============================================================================
 *
 * Identifies a running publisher worker.
 *
 * Format:
 *
 * pub_<hostname>_<pid>_<timestamp>_<random>
 *
 *
 * Example:
 *
 * pub-node01-4821-lq9x8m2a-a82fd991
 *
 *
 * Useful for:
 *
 * - Kubernetes replicas
 * - Worker ownership
 * - Logs
 * - Metrics
 * - Distributed debugging
 *
 */


function generatePublisherId(options = {}) {


    const hostname =

        options.hostname ||

        os.hostname();



    const processId =

        options.processId ||

        PROCESS_ID;



    return [

        PUBLISHER_PREFIX,

        sanitize(hostname),

        processId,

        timestampToken(),

        randomToken(8)

    ].join('_');


}





/**
 * ============================================================================
 * Publisher Identity Object
 * ============================================================================
 *
 * Represents one active publisher instance.
 *
 */


function createPublisherIdentity(options = {}) {


    return {


        publisherId:

            generatePublisherId(options),



        hostname:

            options.hostname ||

            os.hostname(),



        processId:

            options.processId ||

            PROCESS_ID,



        nodeVersion:

            process.version,



        environment:

            process.env.NODE_ENV ||



            'development',



        createdAt:

            new Date(),



        instanceToken:

            randomToken(16)


    };


}





/**
 * ============================================================================
 * Build Batch Metadata
 * ============================================================================
 *
 * Attached to published batches.
 *
 */


function buildBatchMetadata(options = {}) {


    return {


        batchId:

            options.batchId ||

            generateBatchId(),



        publisherId:

            options.publisherId || null,



        size:

            options.size || 0,



        createdAt:

            new Date(),



        priority:

            options.priority || 'NORMAL',



        retryAttempt:

            options.retryAttempt || 0


    };


}





/**
 * ============================================================================
 * Validate Publisher Identity
 * ============================================================================
 */


function validatePublisherId(value) {


    if (

        typeof value !== 'string'

    ) {


        return false;


    }



    return /^pub_[a-z0-9-]+_\d+_[a-z0-9]+_[a-f0-9]+$/i

        .test(value);


}





/**
 * ============================================================================
 * Validate Batch ID
 * ============================================================================
 */


function validateBatchId(value) {


    if (

        typeof value !== 'string'

    ) {


        return false;


    }



    return /^batch_[a-z0-9]+_[a-f0-9]+$/i

        .test(value);


}





/**
 * ============================================================================
 * Sanitize Hostnames
 * ============================================================================
 */


function sanitize(value) {


    return String(value)

        .replace(

            /[^a-zA-Z0-9-]/g,

            '-'

        )

        .substring(

            0,

            40

        );


}





/**
 * ============================================================================
 * Exports
 * ============================================================================
 */


module.exports = {


    generateBatchId,


    generatePublisherId,


    createPublisherIdentity,


    buildBatchMetadata,


    validatePublisherId,


    validateBatchId


};