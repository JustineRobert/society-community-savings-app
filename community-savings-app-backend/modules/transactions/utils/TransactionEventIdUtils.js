/**
 * ============================================================================
 * Core Event ID Generation Utilities
 * ============================================================================
 *
 * Provides:
 *
 * - generateEventId()
 * - UUID support
 * - Timestamp encoding
 *
 * Design goals:
 *
 * - Globally unique identifiers
 * - Traceable event creation time
 * - Safe for distributed systems
 * - Database/index friendly
 *
 * ============================================================================
 */


const crypto = require('crypto');



/**
 * ============================================================================
 * Constants
 * ============================================================================
 */


const EVENT_ID_PREFIX = 'evt';


const UUID_VERSION = 'v4';


const TIMESTAMP_LENGTH = 13;



/**
 * ============================================================================
 * Validate UUID availability
 * ============================================================================
 */


function hasUUIDSupport() {


    return Boolean(

        crypto.randomUUID

    );


}



/**
 * ============================================================================
 * Generate Secure UUID
 * ============================================================================
 *
 * Uses native Node.js crypto UUID generation.
 *
 * Falls back to random bytes when unavailable.
 *
 */


function generateUUID() {


    if (

        hasUUIDSupport()

    ) {


        return crypto.randomUUID();


    }



    return [

        crypto.randomBytes(4).toString('hex'),

        crypto.randomBytes(2).toString('hex'),

        crypto.randomBytes(2).toString('hex'),

        crypto.randomBytes(2).toString('hex'),

        crypto.randomBytes(6).toString('hex')

    ].join('-');


}



/**
 * ============================================================================
 * Timestamp Encoding
 * ============================================================================
 *
 * Produces millisecond precision timestamp.
 *
 * Example:
 *
 * 1785712334123
 *
 */


function encodeTimestamp(timestamp = Date.now()) {


    if (

        !Number.isFinite(timestamp)

    ) {


        throw new TypeError(

            'Invalid timestamp'

        );


    }



    return String(timestamp)

        .padStart(

            TIMESTAMP_LENGTH,

            '0'

        );


}



/**
 * ============================================================================
 * Generate Event ID
 * ============================================================================
 *
 * Format:
 *
 * evt_<timestamp>_<uuid>
 *
 * Example:
 *
 * evt_1785712334123_550e8400-e29b-41d4-a716-446655440000
 *
 *
 * Properties:
 *
 * - Human traceable
 * - Globally unique
 * - Distributed-safe
 *
 */


function generateEventId(options = {}) {


    const timestamp =

        encodeTimestamp(

            options.timestamp || Date.now()

        );



    const uuid =

        options.uuid ||

        generateUUID();



    return [

        EVENT_ID_PREFIX,

        timestamp,

        uuid

    ].join('_');


}



/**
 * ============================================================================
 * Validate Event ID
 * ============================================================================
 */


function isValidEventId(eventId) {


    if (

        typeof eventId !== 'string'

    ) {


        return false;


    }



    const pattern =

        /^evt_\d{13}_[a-f0-9-]{36}$/i;



    return pattern.test(

        eventId

    );


}



/**
 * ============================================================================
 * Extract Timestamp From Event ID
 * ============================================================================
 */


function extractEventTimestamp(eventId) {


    if (

        !isValidEventId(eventId)

    ) {


        throw new Error(

            'Invalid event ID format'

        );


    }



    const parts =

        eventId.split('_');



    return Number(

        parts[1]

    );


}



/**
 * ============================================================================
 * Export
 * ============================================================================
 */


module.exports = {


    generateEventId,


    generateUUID,


    encodeTimestamp,


    isValidEventId,


    extractEventTimestamp


};