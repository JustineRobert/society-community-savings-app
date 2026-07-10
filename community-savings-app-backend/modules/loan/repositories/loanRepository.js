'use strict';

/**
 * ============================================================================
 * ENTERPRISE LOAN REPOSITORY
 * ============================================================================
 * TITech Community Capital LTD
 * SACCO Core Banking Platform
 *
 * Responsibilities:
 * ---------------------------------------------------------------------------
 * ✅ Database Access
 * ✅ Aggregations
 * ✅ Portfolio Metrics
 * ✅ Risk Metrics
 * ✅ Reporting Queries
 * ✅ Multi-Tenant Isolation
 *
 * NO BUSINESS LOGIC HERE
 * ============================================================================
 */

const Loan = require('../../../models/Loan');

class LoanRepository {

    /* =======================================================================
       BASIC CRUD
    ======================================================================= */

    static async create(data) {
        return Loan.create(data);
    }

    static async findById(
        loanId,
        tenantId
    ) {
        return Loan.findOne({
            _id: loanId,
            tenantId
        });
    }

    static async update(
        loanId,
        tenantId,
        updates
    ) {
        return Loan.findOneAndUpdate(
            {
                _id: loanId,
                tenantId
            },
            updates,
            {
                new: true
            }
        );
    }

    static async find(
        filter = {},
        options = {}
    ) {

        return Loan.find(filter)
            .sort(options.sort || {})
            .skip(options.skip || 0)
            .limit(options.limit || 100);
    }

    /* =======================================================================
       PORTFOLIO AT RISK
    ======================================================================= */

    static async calculatePAR30(
        tenantId
    ) {

        const overdue =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId,
                        status: 'active',
                        daysPastDue: {
                            $gte: 30
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$outstandingBalance'
                        }
                    }
                }
            ]);

        const portfolio =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId,
                        status: {
                            $in: [
                                'active',
                                'disbursed'
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$outstandingBalance'
                        }
                    }
                }
            ]);

        return (
            (overdue[0]?.total || 0) /
            (portfolio[0]?.total || 1)
        ) * 100;
    }

    static async calculatePAR60(
        tenantId
    ) {

        return this.calculatePAR(
            tenantId,
            60
        );
    }

    static async calculatePAR90(
        tenantId
    ) {

        return this.calculatePAR(
            tenantId,
            90
        );
    }

    static async calculatePAR(
        tenantId,
        threshold
    ) {

        const overdue =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId,
                        daysPastDue: {
                            $gte:
                            threshold
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$outstandingBalance'
                        }
                    }
                }
            ]);

        const portfolio =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$outstandingBalance'
                        }
                    }
                }
            ]);

        return (
            (overdue[0]?.total || 0) /
            (portfolio[0]?.total || 1)
        ) * 100;
    }

    static async calculatePortfolioAtRisk(
        tenantId
    ) {

        const [
            par30,
            par60,
            par90
        ] = await Promise.all([
            this.calculatePAR30(
                tenantId
            ),
            this.calculatePAR60(
                tenantId
            ),
            this.calculatePAR90(
                tenantId
            )
        ]);

        return {
            par30,
            par60,
            par90,
            generatedAt:
                new Date()
        };
    }

    /* =======================================================================
       RISK METRICS
    ======================================================================= */

    static async calculateNPLRatio(
        tenantId
    ) {

        const npl =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId,
                        daysPastDue:
                        { $gt: 90 }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$outstandingBalance'
                        }
                    }
                }
            ]);

        const portfolio =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$outstandingBalance'
                        }
                    }
                }
            ]);

        return (
            (npl[0]?.total || 0) /
            (portfolio[0]?.total || 1)
        ) * 100;
    }

    static async calculateCollectionRatio(
        tenantId
    ) {

        const collected =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$amountRepaid'
                        }
                    }
                }
            ]);

        const due =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum:
                            '$amountDue'
                        }
                    }
                }
            ]);

        return (
            (collected[0]?.total || 0) /
            (due[0]?.total || 1)
        ) * 100;
    }

    static async calculateRecoveryRate(
        tenantId
    ) {

        const recovered =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId,
                        status:
                        'recovered'
                    }
                },
                {
                    $group: {
                        _id: null,
                        amount: {
                            $sum:
                            '$amountRecovered'
                        }
                    }
                }
            ]);

        const writeOffs =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId,
                        status:
                        'written_off'
                    }
                },
                {
                    $group: {
                        _id: null,
                        amount: {
                            $sum:
                            '$writtenOffAmount'
                        }
                    }
                }
            ]);

        return (
            (recovered[0]?.amount || 0) /
            (writeOffs[0]?.amount || 1)
        ) * 100;
    }

    static async calculateWriteOffRate(
        tenantId
    ) {

        const writeOffs =
            await Loan.countDocuments({
                tenantId,
                status:
                'written_off'
            });

        const total =
            await Loan.countDocuments({
                tenantId
            });

        return total
            ? (writeOffs / total) * 100
            : 0;
    }

    static async calculateAverageDaysPastDue(
        tenantId
    ) {

        const result =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId,
                        daysPastDue:
                        { $gt: 0 }
                    }
                },
                {
                    $group: {
                        _id: null,
                        average: {
                            $avg:
                            '$daysPastDue'
                        }
                    }
                }
            ]);

        return result[0]?.average || 0;
    }

    static async getAverageLoanSize(
        tenantId
    ) {

        const result =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId
                    }
                },
                {
                    $group: {
                        _id: null,
                        average: {
                            $avg:
                            '$amount'
                        }
                    }
                }
            ]);

        return result[0]?.average || 0;
    }

    /* =======================================================================
       DELINQUENCY REPORTING
    ======================================================================= */

    static async getOverdueLoans(
        tenantId
    ) {

        return Loan.find({
            tenantId,
            status: 'active',
            daysPastDue: {
                $gt: 0
            }
        })
        .populate(
            'member',
            'memberNumber firstName lastName phone'
        )
        .lean();
    }

    static async getDefaultedLoans(
        tenantId
    ) {

        return Loan.find({
            tenantId,
            status:
            'defaulted'
        })
        .populate(
            'member',
            'memberNumber firstName lastName phone'
        )
        .lean();
    }

    /* =======================================================================
       EXPORTS
    ======================================================================= */

    static async exportLoans(
        filters = {},
        tenantId
    ) {

        return Loan.find({
            tenantId,
            ...filters
        })
        .populate(
            'member',
            'memberNumber firstName lastName phone'
        )
        .lean();
    }

    /* =======================================================================
       DASHBOARD SUPPORT
    ======================================================================= */

    static async getLoanBookSummary(
        tenantId
    ) {

        const result =
            await Loan.aggregate([
                {
                    $match: {
                        tenantId
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalLoans: {
                            $sum: 1
                        },
                        totalAmount: {
                            $sum:
                            '$amount'
                        },
                        outstandingBalance: {
                            $sum:
                            '$outstandingBalance'
                        },
                        repaidAmount: {
                            $sum:
                            '$amountRepaid'
                        }
                    }
                }
            ]);

        return result[0] || {
            totalLoans: 0,
            totalAmount: 0,
            outstandingBalance: 0,
            repaidAmount: 0
        };
    }

    static async count(
        filter
    ) {
        return Loan.countDocuments(
            filter
        );
    }
}

module.exports = LoanRepository;