'use strict';

/**
 * ============================================================================
 * ENTERPRISE LOAN WORKFLOW SERVICE
 * ============================================================================
 * TITech Community Capital LTD
 * SACCO Core Banking Platform
 *
 * Features
 * ----------------------------------------------------------------------------
 * ✅ Multi-Tenant Lending
 * ✅ Credit Scoring
 * ✅ Eligibility Assessment
 * ✅ Loan Lifecycle Management
 * ✅ Loan Approval Workflow
 * ✅ Manual Review Workflow
 * ✅ Loan Disbursement
 * ✅ Repayment Processing
 * ✅ Fraud Monitoring
 * ✅ Compliance Monitoring
 * ✅ Audit Trail
 * ✅ Portfolio At Risk (PAR)
 * ✅ NPL Monitoring
 * ✅ Board Reporting
 * ✅ BoU Reporting
 * ✅ Write-Off Management
 * ✅ Loan Restructuring
 * ✅ Recovery Management
 * ✅ Bulk Operations
 * ✅ Export Services
 * ============================================================================
 */

const logger = require('../../../utils/logger');

const LoanRepository =
    require('../repositories/loanRepository');

const LoanAuditRepository =
    require('../repositories/loanAuditRepository');

const ScheduleRepository =
    require('../repositories/loanScheduleRepository');

const CreditScoringService =
    require('./creditScoringService');

const RiskEngineService =
    require('../../risk/services/riskEngineService');

const ComplianceService =
    require('../../compliance/services/complianceService');

const {
    validateLoanApplication
} = require('../../../utils/validateInput');

class LoanWorkflowService {

    /* =======================================================================
           LOAN APPLICATIONS
     ======================================================================= */


    static async createLoanApplication(
        user,
        payload,
        tenantId
    ) {

        try {

            validateLoanApplication(
                payload
            );

            logger.info(
                `[LoanWorkflow] Creating Loan Application`,
                {
                    tenantId,
                    memberId: payload.memberId,
                    amount: payload.amount
                }
            );

            const fraudAssessment =
                await RiskEngineService
                    .assessLoanApplication(
                        payload,
                        tenantId
                    );

            const complianceCheck =
                await ComplianceService
                    .validateLoanApplication(
                        payload,
                        tenantId
                    );

            if (
                complianceCheck &&
                complianceCheck.passed === false
            ) {

                throw new Error(
                    complianceCheck.message ||
                    'Compliance validation failed'
                );
            }

            const creditDecision =
                await CreditScoringService
                    .calculateScore(
                        payload.memberId,
                        payload
                    );

            let decision =
                'PENDING';

            if (
                creditDecision.autoApprove === true
            ) {

                decision =
                    'APPROVED';

            } else if (
                creditDecision.manualReview === true
            ) {

                decision =
                    'MANUAL_REVIEW';
            }

            const loan =
                await LoanRepository.create({

                    ...payload,

                    tenantId,

                    status: decision,

                    creditScore:
                        creditDecision.score,

                    riskRating:
                        fraudAssessment?.riskRating ||
                        'LOW',

                    applicationDate:
                        new Date(),

                    createdBy:
                        user?._id || user?.id
                });

            await LoanAuditRepository.create({

                tenantId,

                loanId:
                    loan._id,

                action:
                    'LOAN_APPLICATION_CREATED',

                actor:
                    user?._id || user?.id,

                metadata: {

                    amount:
                        payload.amount,

                    decision,

                    creditScore:
                        creditDecision.score,

                    riskRating:
                        fraudAssessment?.riskRating
                }
            });

            return {

                success: true,

                message:
                    'Loan application submitted successfully',

                loan,

                workflow: {

                    decision,

                    creditScore:
                        creditDecision.score,

                    riskRating:
                        fraudAssessment?.riskRating
                }
            };

        } catch (error) {

            logger.error(
                `[LoanWorkflow] Failed to create loan application`,
                {
                    error:
                        error.message,
                    tenantId
                }
            );

            throw error;
        }
    }

    /* =======================================================================
       APPROVAL WORKFLOW
       ======================================================================= */

    static async approveLoan(
        loanId,
        payload,
        actor,
        tenantId
    ) {

        try {

            const loan =
                await LoanRepository.findById(
                    loanId,
                    tenantId
                );

            if (!loan) {
                throw new Error(
                    'Loan not found'
                );
            }

            if (
                ![
                    'PENDING',
                    'MANUAL_REVIEW',
                    'PENDING_CREDIT_COMMITTEE'
                ].includes(
                    loan.status
                )
            ) {
                throw new Error(
                    `Loan cannot be approved from status ${loan.status}`
                );
            }

            const complianceResult =
                await ComplianceService
                    .validateLoanApproval(
                        loan,
                        tenantId
                    );

            if (
                complianceResult &&
                complianceResult.passed === false
            ) {
                throw new Error(
                    complianceResult.message ||
                    'Compliance approval failed'
                );
            }

            const approvalData = {

                status:
                    'APPROVED',

                approvedAt:
                    new Date(),

                approvedBy:
                    actor?._id ||
                    actor?.id,

                approvedByName:
                    actor?.name,

                approvalNotes:
                    payload?.notes,

                approvalReference:
                    payload?.reference,

                committeeResolution:
                    payload?.committeeResolution,

                finalApprovedAmount:
                    payload?.approvedAmount ||
                    loan.amount
            };

            const updatedLoan =
                await LoanRepository.update(
                    loanId,
                    approvalData,
                    tenantId
                );

            await LoanAuditRepository.create({

                tenantId,

                loanId,

                action:
                    'LOAN_APPROVED',

                actor:
                    actor?._id ||
                    actor?.id,

                metadata:
                    approvalData
            });

            logger.info(
                '[LoanWorkflow] Loan approved',
                {
                    loanId,
                    tenantId
                }
            );

            return {

                success: true,

                loan:
                    updatedLoan,

                status:
                    'APPROVED',

                approvedAt:
                    approvalData.approvedAt
            };

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Approval failed',
                {
                    loanId,
                    tenantId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    static async rejectLoan(
        loanId,
        payload,
        actor,
        tenantId
    ) {

        try {

            const loan =
                await LoanRepository.findById(
                    loanId,
                    tenantId
                );

            if (!loan) {
                throw new Error(
                    'Loan not found'
                );
            }

            const rejectionData = {

                status:
                    'REJECTED',

                rejectedAt:
                    new Date(),

                rejectedBy:
                    actor?._id ||
                    actor?.id,

                rejectedByName:
                    actor?.name,

                rejectionReason:
                    payload?.reason,

                rejectionCode:
                    payload?.code
            };

            const updatedLoan =
                await LoanRepository.update(
                    loanId,
                    rejectionData,
                    tenantId
                );

            await LoanAuditRepository.create({

                tenantId,

                loanId,

                action:
                    'LOAN_REJECTED',

                actor:
                    actor?._id ||
                    actor?.id,

                metadata:
                    rejectionData
            });

            logger.info(
                '[LoanWorkflow] Loan rejected',
                {
                    loanId,
                    tenantId
                }
            );

            return {

                success: true,

                loan:
                    updatedLoan,

                status:
                    'REJECTED'
            };

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Rejection failed',
                {
                    loanId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    static async manualReviewLoan(
        loanId,
        reviewData,
        actor,
        tenantId
    ) {

        try {

            const loan =
                await LoanRepository.findById(
                    loanId,
                    tenantId
                );

            if (!loan) {
                throw new Error(
                    'Loan not found'
                );
            }

            const decision =
                reviewData?.decision ||
                'PENDING_REVIEW';

            const updateData = {

                status:
                    decision === 'APPROVE'
                        ? 'APPROVED'
                        : decision === 'REJECT'
                            ? 'REJECTED'
                            : 'MANUAL_REVIEW',

                reviewedAt:
                    new Date(),

                reviewedBy:
                    actor?._id ||
                    actor?.id,

                reviewedByName:
                    actor?.name,

                reviewNotes:
                    reviewData?.notes,

                reviewReason:
                    reviewData?.reason,

                riskAssessment:
                    reviewData?.riskAssessment,

                recommendation:
                    reviewData?.recommendation,

                escalationRequired:
                    reviewData?.escalationRequired ||
                    false,

                escalatedTo:
                    reviewData?.escalatedTo,

                committeeDecision:
                    reviewData?.committeeDecision
            };

            const updatedLoan =
                await LoanRepository.update(
                    loanId,
                    updateData,
                    tenantId
                );

            await LoanAuditRepository.create({

                tenantId,

                loanId,

                action:
                    'LOAN_MANUAL_REVIEW',

                actor:
                    actor?._id ||
                    actor?.id,

                metadata:
                    updateData
            });

            logger.info(
                '[LoanWorkflow] Manual review completed',
                {
                    loanId,
                    tenantId,
                    decision
                }
            );

            return {

                success: true,

                loan:
                    updatedLoan,

                status:
                    updateData.status,

                reviewDecision:
                    decision
            };

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Manual review failed',
                {
                    loanId,
                    tenantId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    // static async getCreditDecision(

    /* =======================================================================
        DISBURSEMENT
     ======================================================================= */

    static async disburseLoan(
        loanId,
        payload,
        actor,
        tenantId
    ) {

        try {

            const loan =
                await LoanRepository.findById(
                    loanId,
                    tenantId
                );

            if (!loan) {

                throw new Error(
                    'Loan not found'
                );
            }

            if (
                loan.status !==
                'APPROVED'
            ) {

                throw new Error(
                    'Only approved loans can be disbursed'
                );
            }

            if (
                loan.disbursedAt
            ) {

                throw new Error(
                    'Loan has already been disbursed'
                );
            }

            const complianceResult =
                await ComplianceService
                    .validateLoanDisbursement(
                        loan,
                        tenantId
                    );

            if (
                complianceResult &&
                complianceResult.passed === false
            ) {

                throw new Error(
                    complianceResult.message ||
                    'Compliance requirements not met'
                );
            }

            const fraudAssessment =
                await RiskEngineService
                    .assessLoanApplication(
                        loan,
                        tenantId
                    );

            if (
                fraudAssessment &&
                fraudAssessment.blockDisbursement
            ) {

                throw new Error(
                    fraudAssessment.reason ||
                    'Disbursement blocked by fraud engine'
                );
            }

            const disbursementReference =
                payload?.reference ||
                `DIS-${Date.now()}`;

            const disbursementData = {

                status:
                    'DISBURSED',

                disbursedAt:
                    new Date(),

                disbursedBy:
                    actor?._id ||
                    actor?.id,

                disbursedByName:
                    actor?.name,

                disbursementReference,

                disbursementChannel:
                    payload?.channel ||
                    'INTERNAL',

                disbursementAccount:
                    payload?.accountNumber,

                disbursementAmount:
                    payload?.amount ||
                    loan.approvedAmount ||
                    loan.amount,

                transactionReference:
                    payload?.transactionReference,

                valueDate:
                    payload?.valueDate ||
                    new Date()
            };

            const updatedLoan =
                await LoanRepository.update(
                    loanId,
                    disbursementData,
                    tenantId
                );

            /*
             * Generate repayment schedule
             */

            if (
                ScheduleRepository &&
                ScheduleRepository
                    .generateSchedule
            ) {

                await ScheduleRepository
                    .generateSchedule(
                        loanId,
                        tenantId
                    );
            }

            /*
             * Future Integration Point:
             * MTN MoMo
             * Airtel Money
             * Banking APIs
             */

            await LoanAuditRepository.create({

                tenantId,

                loanId,

                action:
                    'LOAN_DISBURSED',

                actor:
                    actor?._id ||
                    actor?.id,

                metadata: {

                    reference:
                        disbursementReference,

                    amount:
                        disbursementData
                            .disbursementAmount,

                    channel:
                        disbursementData
                            .disbursementChannel,

                    transactionReference:
                        disbursementData
                            .transactionReference
                }
            });

            logger.info(
                '[LoanWorkflow] Loan disbursed successfully',
                {
                    tenantId,
                    loanId,
                    reference:
                        disbursementReference
                }
            );

            return {

                success: true,

                loan:
                    updatedLoan,

                status:
                    'DISBURSED',

                reference:
                    disbursementReference,

                amount:
                    disbursementData
                        .disbursementAmount,

                disbursedAt:
                    disbursementData
                        .disbursedAt
            };

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Loan disbursement failed',
                {
                    tenantId,
                    loanId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }
    /* =======================================================================
       REPAYMENT
    ======================================================================= */

    static async recordRepayment(
        loanId,
        repaymentData,
        actor,
        tenantId
    ) {

        try {

            const loan =
                await LoanRepository.findById(
                    loanId,
                    tenantId
                );

            if (!loan) {

                throw new Error(
                    'Loan not found'
                );
            }

            if (
                ![
                    'DISBURSED',
                    'ACTIVE',
                    'OVERDUE'
                ].includes(
                    loan.status
                )
            ) {

                throw new Error(
                    `Loan status ${loan.status} cannot accept repayments`
                );
            }

            const amount =
                Number(
                    repaymentData.amount
                );

            if (
                !amount ||
                amount <= 0
            ) {

                throw new Error(
                    'Invalid repayment amount'
                );
            }

            const outstandingBalance =
                loan.outstandingBalance ||
                loan.totalRepayable;

            let newBalance =
                outstandingBalance -
                amount;

            if (
                newBalance < 0
            ) {

                newBalance = 0;
            }

            let loanStatus =
                loan.status;

            if (
                newBalance === 0
            ) {

                loanStatus =
                    'CLOSED';

            } else if (
                loanStatus ===
                'OVERDUE'
            ) {

                loanStatus =
                    'ACTIVE';
            }

            const paymentReference =
                repaymentData.reference ||
                `PAY-${Date.now()}`;

            const repaymentRecord = {

                amount,

                paymentDate:
                    repaymentData.paymentDate ||
                    new Date(),

                reference:
                    paymentReference,

                paymentChannel:
                    repaymentData.channel ||
                    'CASH',

                transactionReference:
                    repaymentData.transactionReference,

                receivedBy:
                    actor?._id ||
                    actor?.id,

                notes:
                    repaymentData.notes
            };

            if (
                LoanRepository
                    .recordRepayment
            ) {

                await LoanRepository
                    .recordRepayment(
                        loanId,
                        repaymentRecord,
                        tenantId
                    );
            }

            const updatedLoan =
                await LoanRepository.update(
                    loanId,
                    {

                        outstandingBalance:
                            newBalance,

                        lastRepaymentDate:
                            new Date(),

                        lastRepaymentAmount:
                            amount,

                        repaymentCount:
                            (
                                loan.repaymentCount ||
                                0
                            ) + 1,

                        status:
                            loanStatus
                    },
                    tenantId
                );

            if (
                ScheduleRepository
                    .applyRepayment
            ) {

                await ScheduleRepository
                    .applyRepayment(
                        loanId,
                        amount,
                        tenantId
                    );
            }

            await LoanAuditRepository.create({

                tenantId,

                loanId,

                action:
                    'LOAN_REPAYMENT_RECORDED',

                actor:
                    actor?._id ||
                    actor?.id,

                metadata: {

                    amount,

                    balanceBefore:
                        outstandingBalance,

                    balanceAfter:
                        newBalance,

                    paymentReference,

                    channel:
                        repaymentRecord
                            .paymentChannel
                }
            });

            logger.info(
                '[LoanWorkflow] Repayment recorded',
                {
                    tenantId,
                    loanId,
                    amount,
                    balance:
                        newBalance
                }
            );

            return {

                success: true,

                loan:
                    updatedLoan,

                paymentReference,

                amountPaid:
                    amount,

                outstandingBalance:
                    newBalance,

                status:
                    loanStatus
            };

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Repayment failed',
                {
                    tenantId,
                    loanId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    static async repayLoan(
        loanId,
        repaymentData,
        actor,
        tenantId
    ) {

        try {

            return await this
                .recordRepayment(
                    loanId,
                    repaymentData,
                    actor,
                    tenantId
                );

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Repay loan failed',
                {
                    tenantId,
                    loanId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }
    /* =======================================================================
       SCHEDULES
    ======================================================================= */

    static async getLoanSchedule(
        loanId,
        tenantId
    ) {

        const loan =
            await LoanRepository.findById(
                loanId,
                tenantId
            );

        if (!loan) {

            throw new Error(
                'Loan not found'
            );
        }

        return await ScheduleRepository
            .findByLoan(
                loanId,
                tenantId
            );
    }

    static async getLoanSummary(
        loanId,
        user,
        tenantId
    ) {

        try {

            const loan =
                await LoanRepository.findById(
                    loanId,
                    tenantId
                );

            if (!loan) {

                throw new Error(
                    'Loan not found'
                );
            }

            const [
                schedule,
                auditTrail
            ] = await Promise.all([

                ScheduleRepository
                    .findByLoan(
                        loanId,
                        tenantId
                    ),

                LoanAuditRepository
                    .findByLoan(
                        loanId,
                        tenantId
                    )
            ]);

            const totalInstallments =
                schedule.length;

            const paidInstallments =
                schedule.filter(
                    item =>
                        item.status ===
                        'PAID'
                ).length;

            const overdueInstallments =
                schedule.filter(
                    item =>
                        item.status ===
                        'OVERDUE'
                ).length;

            const upcomingInstallment =
                schedule.find(
                    item =>
                        [
                            'PENDING',
                            'DUE'
                        ].includes(
                            item.status
                        )
                );

            const totalPaid =
                schedule.reduce(
                    (
                        total,
                        installment
                    ) =>
                        total +
                        (
                            installment
                                .amountPaid ||
                            0
                        ),
                    0
                );

            const totalOutstanding =
                loan.outstandingBalance ??
                (
                    loan.totalRepayable -
                    totalPaid
                );

            const repaymentProgress =
                loan.totalRepayable > 0

                    ? Number(
                        (
                            (
                                totalPaid /
                                loan.totalRepayable
                            ) * 100
                        ).toFixed(2)
                    )

                    : 0;

            const portfolioCategory =

                totalOutstanding <= 0

                    ? 'CLOSED'

                    : overdueInstallments > 0

                        ? 'AT_RISK'

                        : 'PERFORMING';

            let creditDecision =
                null;

            try {

                creditDecision =
                    await CreditScoringService
                        .calculateScore(
                            loan.member,
                            loan
                        );

            } catch (error) {

                logger.warn(
                    '[LoanWorkflow] Credit score unavailable',
                    {
                        loanId
                    }
                );
            }

            const summary = {

                loanId:
                    loan._id,

                loanNumber:
                    loan.loanNumber,

                tenantId,

                member:
                    loan.member,

                product:
                    loan.loanProduct,

                status:
                    loan.status,

                principal:
                    loan.principal,

                approvedAmount:
                    loan.approvedAmount,

                interestRate:
                    loan.interestRate,

                term:
                    loan.term,

                disbursedAt:
                    loan.disbursedAt,

                maturityDate:
                    loan.maturityDate,

                totalRepayable:
                    loan.totalRepayable,

                totalPaid,

                outstandingBalance:
                    totalOutstanding,

                repaymentProgress,

                scheduleMetrics: {

                    totalInstallments,

                    paidInstallments,

                    overdueInstallments,

                    remainingInstallments:
                        totalInstallments -
                        paidInstallments
                },

                nextInstallment:
                    upcomingInstallment
                    || null,

                creditInformation:
                    creditDecision,

                auditMetrics: {

                    totalAuditRecords:
                        auditTrail.length,

                    latestActivity:
                        auditTrail.length > 0

                            ? auditTrail[
                            auditTrail.length - 1
                            ]

                            : null
                },

                riskClassification:
                    portfolioCategory,

                generatedAt:
                    new Date()
                        .toISOString(),

                generatedFor:
                    user?._id ||
                    user?.id
            };

            logger.info(
                '[LoanWorkflow] Loan summary generated',
                {
                    loanId,
                    tenantId
                }
            );

            return summary;

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Summary generation failed',
                {
                    loanId,
                    tenantId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    /* =======================================================================
        DELINQUENCY
     ======================================================================= */

    static async getOverdueLoans(
        tenantId
    ) {

        try {

            const loans =
                await LoanRepository
                    .getOverdueLoans(
                        tenantId
                    );

            const enhancedLoans =
                loans.map(
                    loan => {

                        const daysPastDue =
                            loan.daysPastDue || 0;

                        let parCategory =
                            'PAR_0';

                        if (
                            daysPastDue >= 90
                        ) {

                            parCategory =
                                'PAR_90';

                        } else if (
                            daysPastDue >= 60
                        ) {

                            parCategory =
                                'PAR_60';

                        } else if (
                            daysPastDue >= 30
                        ) {

                            parCategory =
                                'PAR_30';
                        }

                        return {

                            ...loan,

                            daysPastDue,

                            parCategory,

                            collectionPriority:

                                daysPastDue >= 90
                                    ? 'CRITICAL'

                                    : daysPastDue >= 60
                                        ? 'HIGH'

                                        : daysPastDue >= 30
                                            ? 'MEDIUM'

                                            : 'LOW',

                            riskClassification:

                                daysPastDue >= 90
                                    ? 'SEVERE'

                                    : daysPastDue >= 60
                                        ? 'HIGH'

                                        : 'MODERATE'
                        };
                    }
                );

            logger.info(
                '[LoanWorkflow] Overdue loans retrieved',
                {
                    tenantId,
                    count:
                        enhancedLoans.length
                }
            );

            return {

                count:
                    enhancedLoans.length,

                loans:
                    enhancedLoans,

                generatedAt:
                    new Date()
                        .toISOString()
            };

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Failed to retrieve overdue loans',
                {
                    tenantId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    static async getDefaultedLoans(
        tenantId
    ) {

        try {

            const loans =
                await LoanRepository
                    .getDefaultedLoans(
                        tenantId
                    );

            const enhancedLoans =
                loans.map(
                    loan => ({

                        ...loan,

                        collectionStatus:
                            loan.collectionStatus ||
                            'RECOVERY_REQUIRED',

                        recoveryStage:
                            loan.recoveryStage ||
                            'PRE_LEGAL',

                        writeOffEligible:

                            (
                                loan.daysPastDue ||
                                0
                            ) >= 180,

                        riskClassification:
                            'DEFAULTED'
                    })
                );

            const totalOutstanding =
                enhancedLoans.reduce(
                    (
                        total,
                        loan
                    ) =>
                        total +
                        (
                            loan.outstandingBalance ||
                            0
                        ),
                    0
                );

            logger.info(
                '[LoanWorkflow] Defaulted loans retrieved',
                {
                    tenantId,
                    count:
                        enhancedLoans.length
                }
            );

            return {

                count:
                    enhancedLoans.length,

                totalOutstanding,

                loans:
                    enhancedLoans,

                generatedAt:
                    new Date()
                        .toISOString()
            };

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Failed to retrieve defaulted loans',
                {
                    tenantId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }
    /* =======================================================================
       PORTFOLIO METRICS
    ======================================================================= */

    static async getPortfolioMetrics(
        tenantId
    ) {

        try {

            const [

                par30,

                par60,

                par90,

                portfolioAtRisk,

                averageLoanSize,

                totalPortfolioValue,

                activePortfolioValue,

                activeLoans,

                overdueLoans,

                defaultedLoans,

                closedLoans

            ] = await Promise.all([

                LoanRepository
                    .calculatePAR30(
                        tenantId
                    ),

                LoanRepository
                    .calculatePAR60(
                        tenantId
                    ),

                LoanRepository
                    .calculatePAR90(
                        tenantId
                    ),

                LoanRepository
                    .calculatePortfolioAtRisk(
                        tenantId
                    ),

                LoanRepository
                    .getAverageLoanSize(
                        tenantId
                    ),

                LoanRepository
                    .getTotalPortfolioValue?.(
                        tenantId
                    ) || 0,

                LoanRepository
                    .getActivePortfolioValue?.(
                        tenantId
                    ) || 0,

                LoanRepository
                    .countByStatus?.(
                        'ACTIVE',
                        tenantId
                    ) || 0,

                LoanRepository
                    .countByStatus?.(
                        'OVERDUE',
                        tenantId
                    ) || 0,

                LoanRepository
                    .countByStatus?.(
                        'DEFAULTED',
                        tenantId
                    ) || 0,

                LoanRepository
                    .countByStatus?.(
                        'CLOSED',
                        tenantId
                    ) || 0
            ]);

            const totalLoans =

                activeLoans +
                overdueLoans +
                defaultedLoans +
                closedLoans;

            const portfolioHealthScore =

                par30 <= 5
                    ? 'EXCELLENT'

                    : par30 <= 10
                        ? 'GOOD'

    /* =======================================================================
   RISK METRICS
======================================================================= */

static async getRiskMetrics(
                            tenantId
                        ) {

        try {

            const [

                nplRatio,

                collectionRatio,

                loanRecoveryRate,

                writeOffRate,

                averageDaysPastDue,

                fraudRiskScore,

                overdueLoans,

                defaultedLoans,

                portfolioAtRisk

            ] = await Promise.all([

                LoanRepository
                    .calculateNPLRatio(
                        tenantId
                    ),

                LoanRepository
                    .calculateCollectionRatio(
                        tenantId
                    ),

                LoanRepository
                    .calculateRecoveryRate(
                        tenantId
                    ),

                LoanRepository
                    .calculateWriteOffRate(
                        tenantId
                    ),

                LoanRepository
                    .calculateAverageDaysPastDue(
                        tenantId
                    ),

                RiskEngineService
                    .calculateFraudRiskScore(
                        tenantId
                    ),

                LoanRepository
                    .getOverdueLoans(
                        tenantId
                    ),

                LoanRepository
                    .getDefaultedLoans(
                        tenantId
                    ),

                LoanRepository
                    .calculatePortfolioAtRisk(
                        tenantId
                    )
            ]);

            const delinquencyExposure =
                overdueLoans.reduce(
                    (
                        total,
                        loan
                    ) =>
                        total +
                        (
                            loan.outstandingBalance ||
                            0
                        ),
                    0
                );

            const defaultExposure =
                defaultedLoans.reduce(
                    (
                        total,
                        loan
                    ) =>
                        total +
                        (
                            loan.outstandingBalance ||
                            0
                        ),
                    0
                );

            let portfolioRiskRating =
                'LOW';

            if (
                nplRatio >= 15 ||
                fraudRiskScore >= 80
            ) {

                portfolioRiskRating =
                    'CRITICAL';

            } else if (
                nplRatio >= 10
            ) {

                portfolioRiskRating =
                    'HIGH';

            } else if (
                nplRatio >= 5
            ) {

                portfolioRiskRating =
                    'MODERATE';
            }

            const earlyWarningIndicators = {

                highNPL:
                    nplRatio > 5,

                highFraudRisk:
                    fraudRiskScore > 70,

                highPortfolioRisk:
                    portfolioAtRisk > 10,

                weakCollections:
                    collectionRatio < 85,

                highWriteOffs:
                    writeOffRate > 3
            };

            const expectedCreditLoss = Number(
                (
                    (
                        delinquencyExposure * 0.05
                    ) +
                    (
                        defaultExposure * 0.25
                    )
                ).toFixed(2)
            );

            const riskSummary = {

                tenantId,

                portfolioRiskRating,

                creditRisk: {

                    nplRatio,

                    portfolioAtRisk,

                    averageDaysPastDue,

                    expectedCreditLoss
                },

                operationalRisk: {

                    fraudRiskScore,

                    collectionRatio,

                    loanRecoveryRate,

                    writeOffRate
                },

                exposureMetrics: {

                    overdueLoans:
                        overdueLoans.length,

                    defaultedLoans:
                        defaultedLoans.length,

                    delinquencyExposure,

                    defaultExposure
                },

                earlyWarningIndicators,

                generatedAt:
                    new Date()
                        .toISOString()
            };

            logger.info(
                '[LoanWorkflow] Risk metrics generated',
                {
                    tenantId,
                    portfolioRiskRating
                }
            );

            return riskSummary;

        } catch (error) {

            logger.error(
                '[LoanWorkflow] Risk metrics generation failed',
                {
                    tenantId,
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    /* =======================================================================
    BOARD REPORTING
 ======================================================================= */

    static async getBoardReport(
        tenantId
    ) {

        try {

            const [

                portfolio,

                risk,

                overdueResult,

                defaultedResult,

                fraudAlerts,

                complianceAlerts

            ] = await Promise.all([

                this.getPortfolioMetrics(
                    tenantId
                ),

                this.getRiskMetrics(
                    tenantId
                ),

                this.getOverdueLoans(
                    tenantId
                ),

                this.getDefaultedLoans(
                    tenantId
                ),

                this.getFraudAlerts(
                    tenantId
                ),

                this.getComplianceAlerts(
                    tenantId
                )
            ]);

            const overdueLoans =
                overdueResult?.loans || [];

            const defaultedLoans =
                defaultedResult?.loans || [];

            const totalOverdueExposure =
                overdueLoans.reduce(
                    (
                        total,
                        loan
                    ) =>
                        total +
                        (
                            loan.outstandingBalance ||
                            0
                        ),
                    0
                );

            const totalDefaultExposure =
                defaultedLoans.reduce(
                    (
                        total,
                        loan
                    ) =>
                        total +
                        (
                            loan.outstandingBalance ||
                            0
                        ),
                    0
                );

            const boardReport = {

                /* =======================================================================
               FRAUD & COMPLIANCE
            ======================================================================= */

                static async getFraudAlerts(
                    tenantId
                ) {

                    try {

                        const alerts =
                            await RiskEngineService
                                .getFraudAlerts(
                                    tenantId
                                );

                        const enhancedAlerts =
                            (alerts || []).map(
                                alert => {

                                    let severity =
                                        'LOW';

                                    if (
                                        alert.riskScore >= 90
                                    ) {

                                        severity =
                                            'CRITICAL';

                                    } else if (
                                        alert.riskScore >= 75
                                    ) {

                                        severity =
                                            'HIGH';

                                    } else if (
                                        alert.riskScore >= 50
                                    ) {

                                        severity =
                                            'MEDIUM';
                                    }

                                    return {

                                        ...alert,

                                        severity,

                                        priority:

                                            severity ===
                                                'CRITICAL'

                                                ? 1

                                                : severity ===
                                                    'HIGH'

                                                    ? 2

                                                    : severity ===
                                                        'MEDIUM'

                                                        ? 3

                                                        : 4,

                                        escalationRequired:

                                            severity ===
                                            'CRITICAL' ||
                                            severity ===
                                            'HIGH'
                                    };
                                }
                            );

                        const summary = {

                            totalAlerts:
                                enhancedAlerts.length,

                            criticalAlerts:
                                enhancedAlerts.filter(
                                    item =>
                                        item.severity ===
                                        'CRITICAL'
                                ).length,

                            highRiskAlerts:
                                enhancedAlerts.filter(
                                    item =>
                                        item.severity ===
                                        'HIGH'
                                ).length,

                            mediumRiskAlerts:
                                enhancedAlerts.filter(
                                    item =>
                                        item.severity ===
                                        'MEDIUM'
                                ).length,

                            lowRiskAlerts:
                                enhancedAlerts.filter(
                                    item =>
                                        item.severity ===
                                        'LOW'
                                ).length
                        };

                        logger.info(
                            '[LoanWorkflow] Fraud alerts retrieved',
                            {

                                /* =======================================================================
                                    AUDIT
                                   ======================================================================= */

                                static async getAuditTrail(
                                    loanId,
                                    tenantId
                                ) {

                                    try {

                                        const loan =
                                            await LoanRepository.findById(
                                                loanId,
                                                tenantId
                                            );

                                        if (!loan) {

                                            throw new Error(
                                                'Loan not found'
                                            );
                                        }

                                        const auditRecords =
                                            await LoanAuditRepository
                                                .findByLoan(
                                                    loanId,
                                                    tenantId
                                                );

                                        const timeline =
                                            auditRecords.map(
                                                record => ({

                                                    auditId:
                                                        record._id,

                                                    action:
                                                        record.action,

                                                    actor:
                                                        record.actor,

                                                    actorName:
                                                        record.actorName,

                                                    metadata:
                                                        record.metadata,

                                                    ipAddress:
                                                        record.ipAddress,

                                                    source:
                                                        record.source ||
                                                        'SYSTEM',

                                                    timestamp:
                                                        record.createdAt
                                                })
                                            );

                                        const statistics = {

                                            totalEvents:
                                                timeline.length,

                                            approvals:
                                                timeline.filter(
                                                    item =>
                                                        item.action ===
                                                        'LOAN_APPROVED'
                                                ).length,

                                            rejections:
                                                timeline.filter(
                                                    item =>
                                                        item.action ===
                                                        'LOAN_REJECTED'
                                                ).length,

                                            disbursements:
                                                timeline.filter(
                                                    item =>
                                                        item.action ===
                                                        'LOAN_DISBURSED'
                                                ).length,

                                            repayments:
                                                timeline.filter(
                                                    item =>
                                                        item.action ===
                                                        'LOAN_REPAYMENT_RECORDED'
                                                ).length,

                                            manualReviews:
                                                timeline.filter(
                                                    item =>
                                                        item.action ===
                                                        'LOAN_MANUAL_REVIEW'
                                                ).length
                                        };

                                        const latestActivity =
                                            timeline.length > 0

                                                ? timeline
                                                [

                                                /* =======================================================================
                                                     WRITE OFFS
                                                   ======================================================================= */

                                                static async writeOffLoan(
                                                    loanId,
                                                    payload,
                                                    actor,
                                                    tenantId
                                                ) {

                                                    try {

                                                        const loan =
                                                            await LoanRepository.findById(
                                                                loanId,
                                                                tenantId
                                                            );

                                                        if (!loan) {

                                                            throw new Error(
                                                                'Loan not found'
                                                            );
                                                        }

                                                        if (
                                                            ![
                                                                'DEFAULTED',
                                                                'OVERDUE'
                                                            ].includes(
                                                                loan.status
                                                            )
                                                        ) {

                                                            throw new Error(
                                                                'Only defaulted or overdue loans can be written off'
                                                            );
                                                        }

                                                        const writeOffAmount =
                                                            payload?.amount ||
                                                            loan.outstandingBalance ||
                                                            0;

                                                        const writeOffData = {

                                                            status:
                                                                'WRITTEN_OFF',

                                                            writeOffAmount,

                                                            writeOffReason:
                                                                payload?.reason,

                                                            writeOffReference:
                                                                payload?.reference,

                                                            writeOffApprovedBy:
                                                                actor?._id ||
                                                                actor?.id,

                                                            writeOffApprovedByName:
                                                                actor?.name,

                                                            writeOffDate:
                                                                new Date(),

                                                            provisionReleased:
                                                                payload?.provisionReleased ||
                                                                false,

                                                            boardApprovalReference:
                                                                payload?.boardApprovalReference
                                                        };

                                                        const updatedLoan =
                                                            await LoanRepository.update(
                                                                loanId,
                                                                writeOffData,
                                                                tenantId
                                                            );

                                                        await LoanAuditRepository.create({

                                                            tenantId,

                                                            loanId,

                                                            action:
                                                                'LOAN_WRITTEN_OFF',

                                                            actor:
                                                                actor?._id ||
                                                                actor?.id,

                                                            metadata:
                                                                writeOffData
                                                        });

                                                        logger.info(
                                                            '[LoanWorkflow] Loan written off',
                                                            {
                                                                tenantId,
                                                                loanId,
                                                                amount:
                                                                    writeOffAmount
                                                            }
                                                        );

                                                        return {

                                                            success: true,

                                                            status:
                                                                'WRITTEN_OFF',

                                                            loan:
                                                                updatedLoan,

                                                            writeOffAmount,

                                                            writeOffDate:
                                                                writeOffData.writeOffDate
                                                        };

                                                    } catch (error) {

                                                        logger.error(
                                                            '[LoanWorkflow] Write-off failed',
                                                            {
                                                                loanId,
                                                                tenantId,
                                                                error:
                                                                    error.message
                                                            }
                                                        );

                                                        throw error;
                                                    }
                                                }

static async recoverLoan(
                                                    loanId,
                                                    payload,
                                                    actor,
                                                    tenantId
                                                ) {

                                    try {

                                        const loan =
                                            await LoanRepository.findById(
                                                loanId,
                                                tenantId
                                            );

                                        if (!loan) {

                                            throw new Error(
                                                'Loan not found'
                                            );
                                        }

                                        if (
                                            ![
                                                'WRITTEN_OFF',
                                                'DEFAULTED'
                                            ].includes(
                                                loan.status
                                            )
                                        ) {

                                            throw new Error(
                                                'Loan is not eligible for recovery'
                                            );
                                        }

                                        const recoveryAmount =
                                            Number(
                                                payload?.amount || 0
                                            );

                                        if (
                                            recoveryAmount <= 0
                                        ) {

                                            throw new Error(
                                                'Recovery amount must be greater than zero'
                                            );
                                        }

                                        const previousBalance =
                                            loan.outstandingBalance || 0;

                                        const remainingBalance =
                                            Math.max(
                                                previousBalance -
                                                recoveryAmount,
                                                0
                                            );

                                        const recoveryData = {

                                            recoveredAmount:
                                                recoveryAmount,

                                            recoveryReason:
                                                payload?.reason,

                                            recoveryReference:
                                                payload?.reference ||
                                                `REC-${Date.now()}`,

                                            recoveryChannel:
                                                payload?.channel ||
                                                'MANUAL',

                                            recoveredBy:
                                                actor?._id ||
                                                actor?.id,

                                            recoveredByName:
                                                actor?.name,

                                            recoveredAt:
                                                new Date(),

                                            transactionReference:
                                                payload?.transactionReference
                                        };

                                        if (
                                            LoanRepository
                                                .recordRecovery
                                        ) {

                                            await LoanRepository
                                                .recordRecovery(
                                                    loanId,
                                                    recoveryData,
                                                    tenantId
                                                );
                                        }

                                        const updatePayload = {

                                            outstandingBalance:
                                                remainingBalance,

                                            recoveryStatus:
                                                remainingBalance === 0
                                                    ? 'FULLY_RECOVERED'
                                                    : 'PARTIALLY_RECOVERED',

                                            lastRecoveryDate:
                                                recoveryData.recoveredAt,

                                            totalRecovered:
                                                (
                                                    loan.totalRecovered ||
                                                    0
                                                ) +
                                                recoveryAmount,

                                            status:
                                                remainingBalance === 0
                                                    ? 'RECOVERED'
                                                    : loan.status
                                        };

                                        const updatedLoan =
                                            await LoanRepository.update(
                                                loanId,
                                                updatePayload,
                                                tenantId
                                            );

                                        await LoanAuditRepository.create({

                                            tenantId,

                                            loanId,

                                            action:
                                                'LOAN_RECOVERY',

                                            actor:
                                                actor?._id ||
                                                actor?.id,

                                            metadata: {

                                                recoveryAmount,

                                                previousBalance,

                                                remainingBalance,

                                                reference:
                                                    recoveryData.recoveryReference
                                            }
                                        });

                                        logger.info(
                                            '[LoanWorkflow] Loan recovery processed',
                                            {
                                                tenantId,
                                                loanId,
                                                amount:
                                                    recoveryAmount
                                            }
                                        );

                                        return {

                                            success: true,

                                            loan:
                                                updatedLoan,

                                            recoveredAmount:
                                                recoveryAmount,

                                            remainingBalance,

                                            recoveryStatus:
                                                updatePayload.recoveryStatus,

                                            recoveredAt:
                                                recoveryData.recoveredAt
                                        };

                                    } catch (error) {

                                        logger.error(
                                            '[LoanWorkflow] Loan recovery failed',
                                            {
                                                loanId,
                                                tenantId,
                                                error:
                                                    error.message
                                            }
                                        );

                                        throw error;
                                    }
                                }
/* =======================================================================
   RESTRUCTURING
  ======================================================================= */

static async restructureLoan(
                                    loanId,
                                    payload,
                                    actor,
                                    tenantId
                                ) {

                                    try {

                                        const loan =
                                            await LoanRepository.findById(
                                                loanId,
                                                tenantId
                                            );

                                        if (!loan) {

                                            throw new Error(
                                                'Loan not found'
                                            );
                                        }

                                        if (
                                            ![
                                                'ACTIVE',
                                                'OVERDUE',
                                                'DEFAULTED'
                                            ].includes(
                                                loan.status
                                            )
                                        ) {

                                            throw new Error(
                                                `Loan with status ${loan.status} cannot be restructured`
                                            );
                                        }

                                        const restructuringReference =
                                            payload?.reference ||
                                            `RST-${Date.now()}`;

                                        const restructuringType =
                                            payload?.restructureType ||
                                            'RESCHEDULE';

                                        const oldTerms = {

                                            principal:
                                                loan.principal,

                                            interestRate:
                                                loan.interestRate,

                                            term:
                                                loan.term,

                                            maturityDate:
                                                loan.maturityDate,

                                            outstandingBalance:
                                                loan.outstandingBalance
                                        };

                                        const restructuringData = {

                                            status:
                                                'RESTRUCTURED',

                                            restructureType:
                                                restructuringType,

                                            restructuringReference,

                                            restructuredAt:
                                                new Date(),

                                            restructuredBy:
                                                actor?._id ||
                                                actor?.id,

                                            restructuredByName:
                                                actor?.name,

                                            restructuringReason:
                                                payload?.reason,

                                            originalTerm:
                                                loan.term,

                                            originalInterestRate:
                                                loan.interestRate,

                                            originalMaturityDate:
                                                loan.maturityDate,

                                            revisedTerm:
                                                payload?.term ||
                                                loan.term,

                                            revisedInterestRate:
                                                payload?.interestRate ??
                                                loan.interestRate,

                                            revisedPrincipal:
                                                payload?.principal ??
                                                loan.principal,

                                            revisedMaturityDate:
                                                payload?.maturityDate,

                                            moratoriumMonths:
                                                payload?.moratoriumMonths || 0,

                                            committeeApprovalRef:
                                                payload?.committeeApprovalRef,

                                            restructuringNotes:
                                                payload?.notes
                                        };

                                        const updatedLoan =
                                            await LoanRepository.update(
                                                loanId,
                                                restructuringData,
                                                tenantId
                                            );

                                        /*
                                         * Regenerate repayment schedule
                                         */

                                        if (
                                            ScheduleRepository &&
                                            ScheduleRepository
                                                .regenerateSchedule
                                        ) {

                                            await ScheduleRepository
                                                .regenerateSchedule(
                                                    loanId,
                                                    {
                                                        term:
                                                            restructuringData
                                                                .revisedTerm,

                                                        interestRate:
                                                            restructuringData
                                                                .revisedInterestRate,

                                                        principal:
                                                            restructuringData
                                                                .revisedPrincipal,

                                                        moratoriumMonths:
                                                            restructuringData
                                                                .moratoriumMonths
                                                    },
                                                    tenantId
                                                );
                                        }

                                        /*
                                         * Recalculate risk profile
                                         */

                                        let riskAssessment =
                                            null;

                                        if (
                                            RiskEngineService &&
                                            RiskEngineService
                                                .assessRestructuredLoan
                                        ) {

                                            riskAssessment =
                                                await RiskEngineService
                                                    .assessRestructuredLoan(
                                                        updatedLoan,
                                                        tenantId
                                                    );
                                        }

                                        await LoanAuditRepository.create({

                                            tenantId,

                                            loanId,

                                            action:
                                                'LOAN_RESTRUCTURED',

                                            actor:
                                                actor?._id ||
                                                actor?.id,

                                            metadata: {

                                                restructuringReference,

                                                restructuringType,

                                                reason:
                                                    payload?.reason,

                                                oldTerms,

                                                newTerms: {

                                                    principal:
                                                        restructuringData
                                                            .revisedPrincipal,

                                                    interestRate:
                                                        restructuringData
                                                            .revisedInterestRate,

                                                    term:
                                                        restructuringData
                                                            .revisedTerm,

                                                    maturityDate:
                                                        restructuringData
                                                            .revisedMaturityDate
                                                },

                                                riskAssessment
                                            }
                                        });

                                        logger.info(
                                            '[LoanWorkflow] Loan restructured',
                                            {
                                                tenantId,
                                                loanId,
                                                restructuringReference
                                            }
                                        );

                                        return {

                                            success: true,

                                            status:
                                                'RESTRUCTURED',

                                            loan:
                                                updatedLoan,

                                            restructuringReference,

                                            restructuringType,

                                            previousTerms:
                                                oldTerms,

                                            revisedTerms: {

                                                principal:
                                                    restructuringData
                                                        .revisedPrincipal,

                                                interestRate:
                                                    restructuringData
                                                        .revisedInterestRate,

                                                term:
                                                    restructuringData
                                                        .revisedTerm,

                                                maturityDate:
                                                    restructuringData
                                                        .revisedMaturityDate
                                            },

                                            riskAssessment,

                                            restructuredAt:
                                                restructuringData
                                                    .restructuredAt
                                        };

                                    } catch (error) {

                                        logger.error(
                                            '[LoanWorkflow] Loan restructuring failed',
                                            {
                                                tenantId,
                                                loanId,
                                                error:
                                                    error.message
                                            }
                                        );

                                        throw error;
                                    }
                                }

    /* =======================================================================
     BULK OPERATIONS
     ======================================================================= */

static async bulkApproveLoans(
                                    loanIds,
                                    actor,
                                    tenantId
                                ) {

                                    try {

                                        if (
                                            !Array.isArray(
                                                loanIds
                                            ) ||
                                            loanIds.length === 0
                                        ) {

                                            throw new Error(
                                                'Loan IDs are required'
                                            );
                                        }

                                        const results = {

                                            total:
                                                loanIds.length,

                                            approved: [],

                                            failed: []
                                        };

                                        for (
                                            const loanId of loanIds
                                        ) {

                                            try {

                                                const loan =
                                                    await LoanRepository
                                                        .findById(
                                                            loanId,
                                                            tenantId
                                                        );

                                                if (!loan) {

                                                    results.failed.push({

                                                        loanId,

                                                        reason:
                                                            'Loan not found'
                                                    });

                                                    continue;
                                                }

                                                if (
                                                    ![
                                                        'PENDING',
                                                        'MANUAL_REVIEW',
                                                        'PENDING_CREDIT_COMMITTEE'
                                                    ].includes(
                                                        loan.status
                                                    )
                                                ) {

                                                    results.failed.push({

                                                        loanId,

                                                        reason:
                                                            `Invalid status: ${loan.status}`
                                                    });

                                                    continue;
                                                }

                                                await LoanRepository
                                                    .update(
                                                        loanId,
                                                        {

                                                            status:
                                                                'APPROVED',

                                                            approvedAt:
                                                                new Date(),

                                                            approvedBy:
                                                                actor?._id ||
                                                                actor?.id,

                                                            approvedByName:
                                                                actor?.name
                                                        },
                                                        tenantId
                                                    );

                                                await LoanAuditRepository
                                                    .create({

                                                        tenantId,

                                                        loanId,

                                                        action:
                                                            'LOAN_APPROVED',

                                                        actor:
                                                            actor?._id ||
                                                            actor?.id,

                                                        metadata: {
                                                            bulkOperation:
                                                                true
                                                        }
                                                    });

                                                results.approved.push(
                                                    loanId
                                                );

                                            } catch (error) {

                                                results.failed.push({

                                                    loanId,

                                                    reason:
                                                        error.message
                                                });
                                            }
                                        }

                                        logger.info(
                                            '[LoanWorkflow] Bulk approval completed',
                                            {
                                                tenantId,
                                                approved:
                                                    results.approved.length,
                                                failed:
                                                    results.failed.length
                                            }
                                        );

                                        return {

                                            success: true,

                                            operation:
                                                'BULK_APPROVE',

                                            totalLoans:
                                                results.total,

                                            approvedCount:
                                                results.approved.length,

                                            failedCount:
                                                results.failed.length,

                                            approvedLoans:
                                                results.approved,

                                            failedLoans:
                                                results.failed,

                                            completedAt:
                                                new Date()
                                                    .toISOString()
                                        };

                                    } catch (error) {

                                        logger.error(
                                            '[LoanWorkflow] Bulk approval failed',
                                            {
                                                tenantId,
                                                error:
                                                    error.message
                                            }
                                        );

                                        throw error;
                                    }
                                }

static async bulkRejectLoans(
                                    loanIds,
                                    reason,
                                    actor,
                                    tenantId
                                ) {

                                    try {

                                        if (
                                            !Array.isArray(
                                                loanIds
                                            ) ||
                                            loanIds.length === 0
                                        ) {

/* =======================================================================
   EXPORTS
======================================================================= */

static async exportLoans(
                                            filters,
                                            tenantId
                                        ) {

                                    try {

                                        const exportData =
                                            await LoanRepository
                                                .exportLoans(
                                                    filters,
                                                    tenantId
                                                );

                                        const summary = {

                                            totalRecords:
                                                exportData?.length || 0,

                                            exportType:
                                                filters?.format ||
                                                'JSON',

                                            generatedAt:
                                                new Date()
                                                    .toISOString(),

                                            generatedBy:
                                                filters?.requestedBy,

                                            tenantId
                                        };

                                        const portfolioMetrics =
                                            await this
                                                .getPortfolioMetrics(
                                                    tenantId
                                                );

                                        logger.info(
                                            '[LoanWorkflow] Loan export generated',
                                            {
                                                tenantId,
                                                records:
                                                    summary.totalRecords,
                                                format:
                                                    summary.exportType
                                            }
                                        );

                                        return {

                                            success: true,

                                            exportSummary:
                                                summary,

                                            portfolioSnapshot:
                                                portfolioMetrics,

                                            data:
                                                exportData
                                        };

                                    } catch (error) {

                                        logger.error(
                                            '[LoanWorkflow] Export failed',
                                            {
                                                tenantId,
                                                filters,
                                                error:
                                                    error.message
                                            }
                                        );

                                        throw error;
                                    }
                                }
                            }

module.exports = LoanWorkflowService;