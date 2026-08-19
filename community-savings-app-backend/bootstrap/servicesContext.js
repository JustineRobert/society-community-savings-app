"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * Enterprise Service Context
 * =============================================================================
 *
 * File: backend/bootstrap/servicesContext.js
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Centralized service runtime context
 * ✓ TITech application event access
 * ✓ Safe event-bus abstraction
 * ✓ Service lifecycle observability
 * ✓ No circular dependency with services.js
 * =============================================================================
 */

const applicationEvents =
    require("../runtime/events");


// =============================================================================
// Service Event Context
// =============================================================================

const serviceContext = Object.freeze({

    applicationEvents

});


// =============================================================================
// Export
// =============================================================================

module.exports = {

    applicationEvents,

    serviceContext

};