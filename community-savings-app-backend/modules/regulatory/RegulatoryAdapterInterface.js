'use strict';

/**
 * ============================================================================
 * TITech Community Capital LTD
 * Regulatory Adapter Interface
 * ============================================================================
 *
 * Purpose:
 * --------
 * Provider/jurisdiction-neutral contract for regulatory reporting.
 *
 * The RegulatoryReportingService MUST NOT contain:
 *
 *   - country-specific thresholds
 *   - regulator-specific schemas
 *   - filing calendars
 *   - submission URLs
 *   - regulator authentication
 *   - acknowledgement parsing
 *   - jurisdiction-specific validation rules
 *   - regulator-specific report transformations
 *
 * Those responsibilities belong to concrete regulatory adapters.
 *
 * Examples:
 *
 *   UgandaRegulatoryAdapter
 *   KenyaRegulatoryAdapter
 *   TanzaniaRegulatoryAdapter
 *   RwandaRegulatoryAdapter
 *   NigeriaRegulatoryAdapter
 *   etc.
 *
 * Design principles:
 * ------------------
 * - Multi-country ready
 * - Multi-tenant safe
 * - No regulator logic in core reporting service
 * - Deterministic transformations
 * - Explicit capability discovery
 * - Idempotent submission support
 * - Validation before submission
 * - Structured acknowledgements
 * - Audit-friendly
 * - Backward compatible
 *
 * ============================================================================
 */

const crypto = require('crypto');

const ADAPTER_VERSION = '1.0.0';

const REPORT_TYPES = Object.freeze({
    CTR: 'CTR',
    STR: 'STR',
    SAR: 'SAR',
    KYC_COMPLIANCE: 'KYC_COMPLIANCE',
    FRAUD: 'FRAUD',
    TRANSACTION: 'TRANSACTION',
});

const SUBMISSION_STATUS = Object.freeze({
    NOT_SUPPORTED: 'NOT_SUPPORTED',
    DRAFT: 'DRAFT',
    VALIDATED: 'VALIDATED',
    READY: 'READY',
    SUBMITTED: 'SUBMITTED',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    FAILED: 'FAILED',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
});

const CAPABILITIES = Object.freeze({
    REPORT_SCHEMA: 'reportSchema',
    VALIDATION: 'validation',
    TRANSFORMATION: 'transformation',
    THRESHOLDS: 'thresholds',
    CALENDAR: 'calendar',
    SUBMISSION: 'submission',
    ACKNOWLEDGEMENT: 'acknowledgement',
    STATUS_QUERY: 'statusQuery',
    AMENDMENT: 'amendment',
    CANCELLATION: 'cancellation',
});

class RegulatoryAdapterInterface {
    /**
     * =========================================================================
     * CONSTRUCTOR
     * =========================================================================
     */

    constructor(config = {}) {
        if (new.target === RegulatoryAdapterInterface) {
            throw new Error(
                'RegulatoryAdapterInterface is abstract and cannot be instantiated directly'
            );
        }

        this.config = config;

        this.adapterName =
            config.adapterName ||
            this.constructor.name ||
            'UNKNOWN_REGULATORY_ADAPTER';

        this.countryCode =
            String(config.countryCode || 'XX').toUpperCase();

        this.jurisdiction =
            config.jurisdiction ||
            this.countryCode;

        this.regulatorCode =
            config.regulatorCode ||
            'UNKNOWN_REGULATOR';

        this.version =
            config.version ||
            ADAPTER_VERSION;
    }

    /**
     * =========================================================================
     * IDENTITY
     * =========================================================================
     */

    getIdentity() {
        return {
            adapterName: this.adapterName,
            countryCode: this.countryCode,
            jurisdiction: this.jurisdiction,
            regulatorCode: this.regulatorCode,
            version: this.version,
        };
    }

    /**
     * =========================================================================
     * CAPABILITIES
     * =========================================================================
     */

    getCapabilities() {
        return {
            [CAPABILITIES.REPORT_SCHEMA]: false,
            [CAPABILITIES.VALIDATION]: false,
            [CAPABILITIES.TRANSFORMATION]: false,
            [CAPABILITIES.THRESHOLDS]: false,
            [CAPABILITIES.CALENDAR]: false,
            [CAPABILITIES.SUBMISSION]: false,
            [CAPABILITIES.ACKNOWLEDGEMENT]: false,
            [CAPABILITIES.STATUS_QUERY]: false,
            [CAPABILITIES.AMENDMENT]: false,
            [CAPABILITIES.CANCELLATION]: false,
        };
    }

    supports(capability) {
        return this.getCapabilities()[capability] === true;
    }

    supportsReportType(type) {
        return Object.values(REPORT_TYPES).includes(type);
    }

    /**
     * =========================================================================
     * REGULATORY CONFIGURATION
     * =========================================================================
     */

    /**
     * Return jurisdiction-specific reporting configuration.
     *
     * Concrete adapters should return:
     *
     * {
     *   currency,
     *   timezone,
     *   thresholds,
     *   reportingPeriods,
     *   submissionChannels,
     *   retentionPolicy
     * }
     */
    getRegulatoryConfig() {
        return {};
    }

    /**
     * =========================================================================
     * REPORT SCHEMAS
     * =========================================================================
     */

    /**
     * Return schema metadata for a report type.
     */
    getReportSchema(reportType) {
        throw new Error(
            `${this.adapterName}: getReportSchema(${reportType}) must be implemented`
        );
    }

    /**
     * =========================================================================
     * THRESHOLDS
     * =========================================================================
     */

    /**
     * Resolve jurisdiction-specific thresholds.
     *
     * Example:
     *
     * {
     *   transactionReportingThreshold: 10000000,
     *   cashReportingThreshold: 5000000
     * }
     */
    getThresholds(context = {}) {
        throw new Error(
            `${this.adapterName}: getThresholds() must be implemented`
        );
    }

    /**
     * =========================================================================
     * REPORT TRANSFORMATION
     * =========================================================================
     */

    /**
     * Convert internal TITech report representation into
     * regulator-specific representation.
     */
    async transformReport(report, context = {}) {
        throw new Error(
            `${this.adapterName}: transformReport() must be implemented`
        );
    }

    /**
     * =========================================================================
     * VALIDATION
     * =========================================================================
     */

    /**
     * Validate a report before submission.
     *
     * Expected response:
     *
     * {
     *   valid: true,
     *   errors: [],
     *   warnings: []
     * }
     */
    async validateReport(report, context = {}) {
        throw new Error(
            `${this.adapterName}: validateReport() must be implemented`
        );
    }

    /**
     * =========================================================================
     * REPORTING CALENDAR
     * =========================================================================
     */

    /**
     * Determine whether a report is currently within
     * an allowed filing window.
     */
    getReportingCalendar(context = {}) {
        throw new Error(
            `${this.adapterName}: getReportingCalendar() must be implemented`
        );
    }

    /**
     * Determine filing deadline.
     */
    getSubmissionDeadline(report, context = {}) {
        throw new Error(
            `${this.adapterName}: getSubmissionDeadline() must be implemented`
        );
    }

    /**
     * Determine whether a report is due.
     */
    isReportDue(report, context = {}) {
        throw new Error(
            `${this.adapterName}: isReportDue() must be implemented`
        );
    }

    /**
     * =========================================================================
     * SUBMISSION
     * =========================================================================
     */

    /**
     * Submit report to regulator.
     *
     * Concrete adapters should NEVER blindly submit.
     * Validation should occur before this method.
     */
    async submitReport(report, context = {}) {
        throw new Error(
            `${this.adapterName}: submitReport() must be implemented`
        );
    }

    /**
     * =========================================================================
     * SUBMISSION STATUS
     * =========================================================================
     */

    async getSubmissionStatus(reference, context = {}) {
        throw new Error(
            `${this.adapterName}: getSubmissionStatus() must be implemented`
        );
    }

    /**
     * =========================================================================
     * ACKNOWLEDGEMENT
     * =========================================================================
     */

    /**
     * Parse regulator acknowledgement.
     *
     * Expected response:
     *
     * {
     *   status,
     *   accepted,
     *   reference,
     *   regulatorReference,
     *   errors,
     *   warnings
     * }
     */
    async parseAcknowledgement(response, context = {}) {
        throw new Error(
            `${this.adapterName}: parseAcknowledgement() must be implemented`
        );
    }

    /**
     * =========================================================================
     * AMENDMENTS
     * =========================================================================
     */

    async amendReport(report, context = {}) {
        throw new Error(
            `${this.adapterName}: amendReport() must be implemented`
        );
    }

    /**
     * =========================================================================
     * CANCELLATION
     * =========================================================================
     */

    async cancelReport(report, context = {}) {
        throw new Error(
            `${this.adapterName}: cancelReport() must be implemented`
        );
    }

    /**
     * =========================================================================
     * HEALTH
     * =========================================================================
     */

    async healthCheck() {
        return {
            healthy: true,
            adapter: this.adapterName,
            countryCode: this.countryCode,
            regulatorCode: this.regulatorCode,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * IDEMPOTENCY
     * =========================================================================
     */

    /**
     * Generate deterministic submission idempotency key.
     *
     * The same report should produce the same key unless
     * its version/content changes.
     */
    createIdempotencyKey(report, context = {}) {
        const material = {
            adapter: this.adapterName,
            countryCode: this.countryCode,
            regulatorCode: this.regulatorCode,
            tenantId: context.tenantId || report.tenantId || null,
            reportId: report.id || null,
            reportType: report.type || null,
            version: report.version || 1,
        };

        return crypto
            .createHash('sha256')
            .update(JSON.stringify(material))
            .digest('hex');
    }

    /**
     * =========================================================================
     * NORMALIZATION
     * =========================================================================
     */

    normalizeSubmissionResponse(response = {}) {
        return {
            success:
                response.success !== false,

            status:
                response.status ||
                SUBMISSION_STATUS.SUBMITTED,

            reference:
                response.reference ||
                response.id ||
                null,

            regulatorReference:
                response.regulatorReference ||
                null,

            submittedAt:
                response.submittedAt ||
                new Date().toISOString(),

            raw:
                response.raw || response,
        };
    }

    normalizeAcknowledgement(response = {}) {
        return {
            accepted:
                response.accepted === true,

            status:
                response.status ||
                SUBMISSION_STATUS.ACKNOWLEDGED,

            reference:
                response.reference ||
                null,

            regulatorReference:
                response.regulatorReference ||
                null,

            errors:
                Array.isArray(response.errors)
                    ? response.errors
                    : [],

            warnings:
                Array.isArray(response.warnings)
                    ? response.warnings
                    : [],

            acknowledgedAt:
                response.acknowledgedAt ||
                new Date().toISOString(),

            raw:
                response.raw || response,
        };
    }

    /**
     * =========================================================================
     * ERROR NORMALIZATION
     * =========================================================================
     */

    normalizeError(error, context = {}) {
        return {
            success: false,

            adapter:
                this.adapterName,

            countryCode:
                this.countryCode,

            regulatorCode:
                this.regulatorCode,

            code:
                error?.code ||
                'REGULATORY_ADAPTER_ERROR',

            message:
                error?.message ||
                'Regulatory adapter operation failed.',

            retryable:
                error?.retryable === true,

            operation:
                context.operation ||
                null,

            reportId:
                context.reportId ||
                null,

            timestamp:
                new Date().toISOString(),
        };
    }

    /**
     * =========================================================================
     * STANDARDIZED SUCCESS / FAILURE
     * =========================================================================
     */

    success(data = {}) {
        return {
            success: true,

            adapter:
                this.adapterName,

            countryCode:
                this.countryCode,

            regulatorCode:
                this.regulatorCode,

            timestamp:
                new Date().toISOString(),

            ...data,
        };
    }

    failure(
        message,
        code = 'REGULATORY_ADAPTER_ERROR',
        data = {}
    ) {
        return {
            success: false,

            adapter:
                this.adapterName,

            countryCode:
                this.countryCode,

            regulatorCode:
                this.regulatorCode,

            code,
            message,

            timestamp:
                new Date().toISOString(),

            ...data,
        };
    }

    /**
     * =========================================================================
     * VALIDATION HELPERS
     * =========================================================================
     */

    assertReport(report) {
        if (!report || typeof report !== 'object') {
            throw new TypeError(
                `${this.adapterName}: report is required`
            );
        }

        if (!report.type) {
            throw new TypeError(
                `${this.adapterName}: report.type is required`
            );
        }

        if (!this.supportsReportType(report.type)) {
            throw new Error(
                `${this.adapterName}: unsupported report type ${report.type}`
            );
        }

        return true;
    }

    /**
     * =========================================================================
     * LIFECYCLE HOOKS
     * =========================================================================
     *
     * Optional hooks that concrete adapters may override.
     */

    async beforeValidation(report, context = {}) {
        return {
            report,
            context,
        };
    }

    async afterValidation(
        report,
        validationResult,
        context = {}
    ) {
        return {
            report,
            validationResult,
            context,
        };
    }

    async beforeSubmission(report, context = {}) {
        return {
            report,
            context,
        };
    }

    async afterSubmission(
        report,
        submissionResult,
        context = {}
    ) {
        return {
            report,
            submissionResult,
            context,
        };
    }

    /**
     * =========================================================================
     * SERIALIZATION
     * =========================================================================
     */

    toJSON() {
        return {
            ...this.getIdentity(),
            capabilities:
                this.getCapabilities(),
            regulatoryConfig:
                this.getRegulatoryConfig(),
        };
    }
}

module.exports = RegulatoryAdapterInterface;

/**
 * ============================================================================
 * STATIC CONSTANTS
 * ============================================================================
 */

module.exports.REPORT_TYPES = REPORT_TYPES;
module.exports.SUBMISSION_STATUS = SUBMISSION_STATUS;
module.exports.CAPABILITIES = CAPABILITIES;
module.exports.ADAPTER_VERSION = ADAPTER_VERSION;