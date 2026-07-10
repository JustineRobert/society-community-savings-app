'use strict';

/**
 * ============================================================================
 * ENTERPRISE LOAN CONTROLLER
 * ============================================================================
 * TITech Community Capital LTD
 * SACCO Core Banking Platform
 *
 * Responsibilities
 * ----------------------------------------------------------------------------
 * ✅ Request Validation
 * ✅ Authentication Validation
 * ✅ Tenant Resolution
 * ✅ Service Orchestration
 * ✅ Response Formatting
 * ✅ Metadata Generation
 * ✅ Error Handling
 *
 * Business Logic Lives In:
 * LoanWorkflowService
 * ============================================================================
 */

const LoanWorkflowService =
    require('../modules/loan/services/loanWorkflowService');

const {
    handleError
} = require('../middlewares/errorMiddleware');

class LoanController {

    static success(
        res,
        data,
        message = 'Success',
        statusCode = 200,
        meta = {}
    ) {

        return res.status(statusCode).json({
            success: true,
            message,
            timestamp:
                new Date().toISOString(),
            meta,
            data
        });
    }

    static buildMeta(
        req,
        startedAt
    ) {

        return {
            requestId:
                req.headers['x-request-id']
                || null,

            tenantId:
                req.tenant_id
                || null,

            executionTimeMs:
                Date.now() - startedAt
        };
    }

    static validateTenant(req) {

        if (!req.tenant_id) {

            const error =
                new Error(
                    'Tenant ID is required'
                );

            error.statusCode = 400;

            throw error;
        }
    }

    /**
     * =========================================================================
     * CREATE LOAN APPLICATION
     * =========================================================================
     */

    static async createLoanApplication(
        req,
        res,
        next
    ) {

        const startedAt =
            Date.now();

        try {

            this.validateTenant(req);

            const result =
                await LoanWorkflowService
                    .createLoanApplication(
                        req.user,
                        req.body,
                        req.tenant_id
                    );

            return this.success(
                res,
                result,
                'Loan application created',
                201,
                this.buildMeta(
                    req,
                    startedAt
                )
            );

        } catch (error) {

            handleError(
                error,
                req,
                res,
                next
            );

        }
    }

    /**
     * =========================================================================
     * REQUEST LOAN
     * =========================================================================
     */

    static async requestLoan(
        req,
        res,
        next
    ) {

        const startedAt =
            Date.now();

        try {

            const result =
                await LoanWorkflowService
                    .requestLoan(
                        req.user,
                        req.body,
                        req.tenant_id
                    );

            return this.success(
                res,
                result,
                'Loan requested successfully',
                201,
                this.buildMeta(
                    req,
                    startedAt
                )
            );

        } catch (error) {

            handleError(
                error,
                req,
                res,
                next
            );

        }
    }

    /**
     * =========================================================================
     * LOAN APPROVAL
     * =========================================================================
     */

    static async approveLoan(
        req,
        res,
        next
    ) {

        const startedAt =
            Date.now();

        try {

            const result =
                await LoanWorkflowService
                    .approveLoan(
                        req.params.loanId,
                        req.body,
                        req.user,
                        req.tenant_id
                    );

            return this.success(
                res,
                result,
                'Loan approved successfully',
                200,
                this.buildMeta(
                    req,
                    startedAt
                )
            );

        } catch (error) {

            handleError(
                error,
                req,
                res,
                next
            );

        }
    }

    /**
     * =========================================================================
     * LOAN REJECTION
     * =========================================================================
     */

    static async rejectLoan(
        req,
        res,
        next
    ) {

        const startedAt =
            Date.now();

        try {

            const result =
                await LoanWorkflowService
                    .rejectLoan(
                        req.params.loanId,
                        req.body,
                        req.user,
                        req.tenant_id
                    );

            return this.success(
                res,
                result,
                'Loan rejected successfully',
                200,
                this.buildMeta(
                    req,
                    startedAt
                )
            );

        } catch (error) {

            handleError(
                error,
                req,
                res,
                next
            );

        }
    }

    /**
     * =========================================================================
     * DISBURSE LOAN
     * =========================================================================
     */

    static async disburseLoan(
        req,
        res,
        next
    ) {

        const startedAt =
            Date.now();

        try {

            const result =
                await LoanWorkflowService
                    .disburseLoan(
                        req.params.loanId,
                        req.body,
                        req.user,
                        req.tenant_id
                    );

            return this.success(
                res,
                result,
                'Loan disbursed successfully',
                200,
                this.buildMeta(
                    req,
                    startedAt
                )
            );

        } catch (error) {

            handleError(
                error,
                req,
                res,
                next
            );

        }
    }

    /**
     * =========================================================================
     * RECORD REPAYMENT
     * =========================================================================
     */

    static async recordRepayment(
        req,
        res,
        next
    ) {

        const startedAt =
            Date.now();

        try {

            const result =
                await LoanWorkflowService
                    .recordRepayment(
                        req.params.loanId,
                        req.body,
                        req.user,
                        req.tenant_id
                    );

            return this.success(
                res,
                result,
                'Repayment recorded successfully',
                200,
                this.buildMeta(
                    req,
                    startedAt
                )
            );

        } catch (error) {

            handleError(
                error,
                req,
                res,
                next
            );

        }
    }

    /**
     * =========================================================================
     * LOAN SUMMARY
     * =========================================================================
     */

    static async getLoanSummary(
        req,
        res,
        next
    ) {

        const startedAt =
            Date.now();

        try {

            const result =
                await LoanWorkflowService
                    .getLoanSummary(
                        req.params.loanId,
                        req.user,
                        req.tenant_id
                    );

            return this.success(
                res,
                result,
                'Loan summary retrieved',
                200,
                this.buildMeta(
                    req,
                    startedAt
                )
            );

        } catch (error) {
            handleError(
                error,
                req,
                res,
                next
            );
        }
    }

    /**
     * =========================================================================
     * PORTFOLIO AT RISK (PAR30/PAR60/PAR90)
     * =========================================================================
     */

    static async getPortfolioAtRisk(
        req,
        res,
        next
    ) {

        const result =
            await LoanWorkflowService
                .getPortfolioMetrics(
                    req.tenant_id
                );

        return this.success(
            res,
            result,
            'Portfolio metrics retrieved'
        );
    }

    /**
     * =========================================================================
     * RISK ANALYTICS
     * =========================================================================
     */

    static async getRiskAssessment(
        req,
        res,
        next
    ) {

        const result =
            await LoanWorkflowService
                .getRiskMetrics(
                    req.tenant_id
                );

        return this.success(
            res,
            result,
            'Risk metrics retrieved'
        );
    }

    /**
     * =========================================================================
     * BOARD REPORT
     * =========================================================================
     */

    static async getBoardLoanReport(
        req,
        res,
        next
    ) {

        const result =
            await LoanWorkflowService
                .getBoardReport(
                    req.tenant_id
                );

        return this.success(
            res,
            result,
            'Board report generated'
        );
    }

    /**
     * =========================================================================
     * FRAUD DASHBOARD
     * =========================================================================
     */

    static async getFraudAlerts(
        req,
        res,
        next
    ) {

        const result =
            await LoanWorkflowService
                .getFraudAlerts(
                    req.tenant_id
                );

        return this.success(
            res,
            result,
            'Fraud alerts retrieved'
        );
    }

    /**
     * =========================================================================
     * COMPLIANCE DASHBOARD
     * =========================================================================
     */

    static async getComplianceAlerts(
        req,
        res,
        next
    ) {

        const result =
            await LoanWorkflowService
                .getComplianceAlerts(
                    req.tenant_id
                );

        return this.success(
            res,
            result,
            'Compliance alerts retrieved'
        );
    }

    /**
     * =========================================================================
     * WRITE OFF
     * =========================================================================
     */

    static async writeOffLoan(
        req,
        res,
        next
    ) {

        const result =
            await LoanWorkflowService
            .writeOffLoan(
                req.params.loanId,
                req.body,
                req.user,
                req.tenant_id
            );

        return this.success(
            res,
            result,
            'Loan written off'
        );
    }

    /**
     * =========================================================================
     * RESTRUCTURE
     * =========================================================================
     */

    static async restructureLoan(
        req,
        res,
        next
    ) {

        const result =
            await LoanWorkflowService
            .restructureLoan(
                req.params.loanId,
                req.body,
                req.user,
                req.tenant_id
            );

        return this.success(
            res,
            result,
            'Loan restructured'
        );
    }
}

module.exports = LoanController;