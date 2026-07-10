'use strict';

/**
 * ============================================================================
 * ENTERPRISE MEMBER SERVICE
 * ============================================================================
 * TITech Community Capital LTD
 * SACCO Core Banking Platform
 *
 * Features
 * ----------------------------------------------------------------------------
 * ✅ Multi-Tenant Support
 * ✅ Member Lifecycle Management
 * ✅ KYC Verification
 * ✅ Member Analytics
 * ✅ Savings & Loan Integration
 * ✅ Pagination & Filtering
 * ✅ Audit Trail Support
 * ✅ Board & CEO Reporting
 * ✅ Production Grade Logging
 * ============================================================================
 */

const logger = require('../../../utils/logger');

const MemberRepository =
    require('../../../repositories/memberRepository');

const AccountRepository =
    require('../../../repositories/accountRepository');

const SavingsRepository =
    require('../../../repositories/savingsRepository');

const LoanRepository =
    require('../../../repositories/loanRepository');

const AuditRepository =
    require('../../../repositories/auditRepository');

const DocumentRepository =
    require('../../../repositories/documentRepository');

const WalletRepository =
    require('../../../repositories/walletRepository');

const CreditScoreService =
    require('../../credit/services/creditScoreService');

const RiskEngineService =
    require('../../risk/services/riskEngineService');

class MemberService {

    /**
     * =========================================================================
     * CREATE MEMBER
     * =========================================================================
     */
    static async createMember(
        tenantId,
        memberData,
        user
    ) {
        try {

            const member =
                await MemberRepository.create({
                    tenantId,
                    ...memberData
                });

            await AuditRepository.create({
                tenantId,
                action: 'MEMBER_CREATED',
                entityType: 'Member',
                entityId: member._id,
                performedBy: user?._id,
                metadata: {
                    memberNumber:
                        member.memberNumber
                }
            });

            return member;

        } catch (error) {

            logger.error(
                'MemberService.createMember failed',
                {
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * GET MEMBER BY ID
     * =========================================================================
     */
    static async getMemberById(
        memberId,
        tenantId
    ) {
        try {

            return await MemberRepository.findById(
                memberId,
                tenantId
            );

        } catch (error) {

            logger.error(
                'MemberService.getMemberById failed',
                {
                    memberId,
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * GET MEMBERS
     * =========================================================================
     */
    static async getMembers(
        tenantId,
        filters = {}
    ) {
        try {

            return await MemberRepository.findAll({
                tenantId,
                ...filters
            });

        } catch (error) {

            logger.error(
                'MemberService.getMembers failed',
                {
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * UPDATE MEMBER
     * =========================================================================
     */
    static async updateMember(
        memberId,
        tenantId,
        updateData,
        user
    ) {
        try {

            const member =
                await MemberRepository.update(
                    memberId,
                    tenantId,
                    updateData
                );

            await AuditRepository.create({
                tenantId,
                action: 'MEMBER_UPDATED',
                entityType: 'Member',
                entityId: memberId,
                performedBy: user?._id
            });

            return member;

        } catch (error) {

            logger.error(
                'MemberService.updateMember failed',
                {
                    memberId,
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * DELETE MEMBER
     * =========================================================================
     */
    static async deleteMember(
        memberId,
        tenantId,
        user
    ) {
        try {

            await MemberRepository.delete(
                memberId,
                tenantId
            );

            await AuditRepository.create({
                tenantId,
                action: 'MEMBER_DELETED',
                entityType: 'Member',
                entityId: memberId,
                performedBy: user?._id
            });

            return true;

        } catch (error) {

            logger.error(
                'MemberService.deleteMember failed',
                {
                    memberId,
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * VERIFY KYC
     * =========================================================================
     */
    static async verifyKYC(
        memberId,
        tenantId,
        user
    ) {
        try {

            const member =
                await MemberRepository.verifyKYC(
                    memberId,
                    tenantId
                );

            await AuditRepository.create({
                tenantId,
                action: 'MEMBER_KYC_VERIFIED',
                entityType: 'Member',
                entityId: memberId,
                performedBy: user?._id
            });

            return member;

        } catch (error) {

            logger.error(
                'MemberService.verifyKYC failed',
                {
                    memberId,
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
 * =========================================================================
 * MEMBER DASHBOARD
 * =========================================================================
 */
static async getMemberDashboard(memberId, tenantId) {
    try {

        const [
            member,
            accounts,
            loans,
            savings
        ] = await Promise.all([
            MemberRepository.findById(memberId, tenantId),
            AccountRepository.findByMember(memberId, tenantId),
            LoanRepository.findByMember(memberId, tenantId),
            SavingsRepository.findByMember(memberId, tenantId)
        ]);

        return {
            member,
            accounts,
            loans,
            savings,
            generatedAt: new Date().toISOString()
        };

    } catch (error) {
        logger.error('getMemberDashboard failed', {
            memberId,
            tenantId,
            error: error.message
        });
        throw error;
    }
}

/**
 * =========================================================================
 * APPROVE MEMBER
 * =========================================================================
 */
static async approveMember(memberId, tenantId, user) {

    const member =
        await MemberRepository.updateStatus(
            memberId,
            tenantId,
            'APPROVED'
        );

    await AuditRepository.create({
        tenantId,
        action: 'MEMBER_APPROVED',
        entityId: memberId,
        performedBy: user?._id
    });

    return member;
}

/**
 * =========================================================================
 * SUSPEND MEMBER
 * =========================================================================
 */
static async suspendMember(memberId, tenantId, reason, user) {

    const member =
        await MemberRepository.updateStatus(
            memberId,
            tenantId,
            'SUSPENDED'
        );

    await AuditRepository.create({
        tenantId,
        action: 'MEMBER_SUSPENDED',
        entityId: memberId,
        performedBy: user?._id,
        metadata: { reason }
    });

    return member;
}

/**
 * =========================================================================
 * ACTIVATE MEMBER
 * =========================================================================
 */
static async activateMember(memberId, tenantId, user) {

    const member =
        await MemberRepository.updateStatus(
            memberId,
            tenantId,
            'ACTIVE'
        );

    await AuditRepository.create({
        tenantId,
        action: 'MEMBER_ACTIVATED',
        entityId: memberId,
        performedBy: user?._id
    });

    return member;
}

/**
 * =========================================================================
 * BULK MEMBER IMPORT
 * =========================================================================
 */
static async bulkImportMembers(
    tenantId,
    members,
    user
) {

    const imported =
        await MemberRepository.bulkCreate(
            tenantId,
            members
        );

    await AuditRepository.create({
        tenantId,
        action: 'MEMBERS_IMPORTED',
        performedBy: user?._id,
        metadata: {
            count:
                imported.length
        }
    });

    return imported;
}

/**
 * =========================================================================
 * EXPORT MEMBERS
 * =========================================================================
 */
static async exportMembers(
    tenantId,
    filters = {}
) {

    return await MemberRepository.export(
        tenantId,
        filters
    );
}

/**
 * =========================================================================
 * MEMBER STATEMENT
 * =========================================================================
 */
static async generateMemberStatement(
    memberId,
    tenantId
) {

    const [
        member,
        loans,
        savings,
        accounts
    ] = await Promise.all([
        MemberRepository.findById(
            memberId,
            tenantId
        ),
        LoanRepository.findByMember(
            memberId,
            tenantId
        ),
        SavingsRepository.findByMember(
            memberId,
            tenantId
        ),
        AccountRepository.findByMember(
            memberId,
            tenantId
        )
    ]);

    return {
        member,
        loans,
        savings,
        accounts,
        generatedAt:
            new Date().toISOString()
    };
}

/**
 * =========================================================================
 * MEMBER RISK PROFILE
 * =========================================================================
 */
static async getMemberRiskProfile(
    memberId,
    tenantId
) {

    return await LoanRepository
        .getRiskProfile(
            memberId,
            tenantId
        );
}

/**
 * =========================================================================
 * MEMBER CREDIT SCORE
 * =========================================================================
 */
static async getMemberCreditScore(
    memberId,
    tenantId
) {

    return await LoanRepository
        .calculateCreditScore(
            memberId,
            tenantId
        );
}

/**
 * =========================================================================
 * MEMBER AUDIT TRAIL
 * =========================================================================
 */
static async getMemberAuditTrail(
    memberId,
    tenantId
) {

    return await AuditRepository
        .findByEntity(
            tenantId,
            'Member',
            memberId
        );
}

/**
 * =========================================================================
 * MEMBER KYC STATUS
 * =========================================================================
 */
static async getMemberKYCStatus(
    memberId,
    tenantId
) {

    const member =
        await MemberRepository.findById(
            memberId,
            tenantId
        );

    return {
        kycStatus:
            member.kycStatus,
        verifiedAt:
            member.verifiedAt,
        nationalIdVerified:
            member.nationalIdVerified,
        phoneVerified:
            member.phoneVerified
    };
}

/**
 * =========================================================================
 * UPLOAD MEMBER DOCUMENTS
 * =========================================================================
 */
static async uploadMemberDocuments(
    memberId,
    tenantId,
    documents
) {

    return await MemberRepository
        .attachDocuments(
            memberId,
            tenantId,
            documents
        );
}

/**
 * =========================================================================
 * VERIFY NATIONAL ID
 * =========================================================================
 */
static async verifyNationalId(
    memberId,
    tenantId,
    nationalId
) {

    const verified =
        await MemberRepository
        .verifyNationalId(
            memberId,
            tenantId,
            nationalId
        );

    return {
        verified
    };
}

/**
 * =========================================================================
 * VERIFY PHONE NUMBER
 * =========================================================================
 */
static async verifyPhoneNumber(
    memberId,
    tenantId,
    otp
) {

    const verified =
        await MemberRepository
        .verifyPhoneOTP(
            memberId,
            tenantId,
            otp
        );

    return {
        verified
    };
}

/**
 * =========================================================================
 * LINK MOBILE MONEY WALLET
 * =========================================================================
 */
static async linkMobileMoneyWallet(
    memberId,
    tenantId,
    walletData
) {

    return await MemberRepository
        .linkWallet(
            memberId,
            tenantId,
            walletData
        );
}

    /**
     * =========================================================================
     * MEMBER ACCOUNTS
     * =========================================================================
     */
    static async getMemberAccounts(
        memberId,
        tenantId
    ) {
        try {

            return await AccountRepository.findByMember(
                memberId,
                tenantId
            );

        } catch (error) {

            logger.error(
                'MemberService.getMemberAccounts failed',
                {
                    memberId,
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * MEMBER LOANS
     * =========================================================================
     */
    static async getMemberLoans(
        memberId,
        tenantId
    ) {
        try {

            return await LoanRepository.findByMember(
                memberId,
                tenantId
            );

        } catch (error) {

            logger.error(
                'MemberService.getMemberLoans failed',
                {
                    memberId,
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * MEMBER SAVINGS
     * =========================================================================
     */
    static async getMemberSavings(
        memberId,
        tenantId
    ) {
        try {

            return await SavingsRepository.findByMember(
                memberId,
                tenantId
            );

        } catch (error) {

            logger.error(
                'MemberService.getMemberSavings failed',
                {
                    memberId,
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * MEMBER ANALYTICS
     * =========================================================================
     */
    static async getAnalytics(
        tenantId
    ) {
        try {

            const [
                totalMembers,
                activeMembers,
                verifiedMembers,
                dormantMembers
            ] = await Promise.all([
                MemberRepository.count({
                    tenantId
                }),
                MemberRepository.countActive({
                    tenantId
                }),
                MemberRepository.countVerified({
                    tenantId
                }),
                MemberRepository.countDormant({
                    tenantId
                })
            ]);

            return {
                totalMembers,
                activeMembers,
                verifiedMembers,
                dormantMembers
            };

        } catch (error) {

            logger.error(
                'MemberService.getAnalytics failed',
                {
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }

    /**
     * =========================================================================
     * MEMBER GROWTH REPORT
     * =========================================================================
     */
    static async getGrowthReport(
        tenantId
    ) {
        try {

            const monthlyGrowth =
                await MemberRepository.getGrowthTrend({
                    tenantId
                });

            const demographics =
                await MemberRepository.getDemographics({
                    tenantId
                });

            const branchDistribution =
                await MemberRepository.getBranchDistribution({
                    tenantId
                });

            return {
                monthlyGrowth,
                demographics,
                branchDistribution,
                generatedAt:
                    new Date().toISOString()
            };

        } catch (error) {

            logger.error(
                'MemberService.getGrowthReport failed',
                {
                    tenantId,
                    error: error.message
                }
            );

            throw error;
        }
    }
}

module.exports = MemberService;