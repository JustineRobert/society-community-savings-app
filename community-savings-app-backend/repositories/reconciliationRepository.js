"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 * File: backend/repositories/reconciliationRepository.js
 * Enterprise Reconciliation Repository
 * ============================================================================
 */

const logger =
    require(
        "../src/infrastructure/logging/logger"
    );

class ReconciliationRepository {

    constructor(
        ReconciliationModel
    ) {

        if (!ReconciliationModel) {

            throw new Error(
                "ReconciliationModel is required."
            );
        }

        this.model =
            ReconciliationModel;
    }

    /* ===================================================================== */
    /* CREATE                                                                 */
    /* ===================================================================== */

    async create(
        payload
    ) {

        try {

            return await this.model.create({

                ...payload,

                createdAt:
                    new Date(),

                updatedAt:
                    new Date(),

                deleted:
                    false
            });

        } catch (error) {

            logger.error(

                "Reconciliation create failed",

                {
                    error:
                        error.message
                }
            );

            throw error;
        }
    }

    /* ===================================================================== */
    /* FIND BY ID                                                             */
    /* ===================================================================== */

    async findById(
        tenantId,
        id
    ) {

        return this.model
            .findOne({

                _id: id,

                tenantId,

                deleted:
                    false
            })
            .lean();
    }

    /* ===================================================================== */
    /* FIND ONE                                                               */
    /* ===================================================================== */

    async findOne(
        tenantId,
        query = {}
    ) {

        return this.model
            .findOne({

                ...query,

                tenantId,

                deleted:
                    false
            })
            .lean();
    }

    /* ===================================================================== */
    /* SEARCH                                                                  */
    /* ===================================================================== */

    async search(
        tenantId,
        options = {}
    ) {

        const {

            page = 1,

            limit = 20,

            provider,

            status,

            balanced,

            startDate,

            endDate
        } = options;

        const query = {

            tenantId,

            deleted:
                false
        };

        if (provider) {

            query.provider =
                provider;
        }

        if (status) {

            query.status =
                status;
        }

        if (
            typeof balanced ===
            "boolean"
        ) {

            query.isBalanced =
                balanced;
        }

        if (
            startDate ||
            endDate
        ) {

            query.createdAt = {};

            if (startDate) {

                query.createdAt.$gte =
                    startDate;
            }

            if (endDate) {

                query.createdAt.$lte =
                    endDate;
            }
        }

        const skip =
            (page - 1) * limit;

        const [

            data,

            total

        ] = await Promise.all([

            this.model
                .find(query)
                .skip(skip)
                .limit(limit)
                .sort({

                    createdAt:
                        -1
                })
                .lean(),

            this.model
                .countDocuments(
                    query
                )
        ]);

        return {

            page,

            limit,

            total,

            totalPages:
                Math.ceil(
                    total / limit
                ),

            data
        };
    }

    /* ===================================================================== */
    /* UPDATE                                                                  */
    /* ===================================================================== */

    async updateById(
        tenantId,
        id,
        updates
    ) {

        return this.model
            .findOneAndUpdate(

                {

                    _id: id,

                    tenantId,

                    deleted:
                        false
                },

                {

                    $set: {

                        ...updates,

                        updatedAt:
                            new Date()
                    }
                },

                {
                    new: true
                }
            )

            .lean();
    }

    /* ===================================================================== */
    /* SOFT DELETE                                                            */
    /* ===================================================================== */

    async deleteById(
        tenantId,
        id
    ) {

        return this.model
            .findOneAndUpdate(

                {

                    _id: id,

                    tenantId
                },

                {

                    $set: {

                        deleted:
                            true,

                        deletedAt:
                            new Date(),

                        updatedAt:
                            new Date()
                    }
                },

                {
                    new: true
                }
            )

            .lean();
    }

    /* ===================================================================== */
    /* DAILY REPORTS                                                          */
    /* ===================================================================== */

    async findDailyReports(
        tenantId,
        date = new Date()
    ) {

        const start =
            new Date(date);

        start.setHours(
            0,
            0,
            0,
            0
        );

        const end =
            new Date(date);

        end.setHours(
            23,
            59,
            59,
            999
        );

        return this.model
            .find({

                tenantId,

                deleted:
                    false,

                createdAt: {

                    $gte:
                        start,

                    $lte:
                        end
                }
            })

            .sort({

                createdAt:
                    -1
            })

            .lean();
    }

    /* ===================================================================== */
    /* MONTHLY REPORTS                                                        */
    /* ===================================================================== */

    async findMonthlyReports(
        tenantId,
        year = new Date().getFullYear(),
        month = new Date().getMonth()
    ) {

        const start =
            new Date(
                year,
                month,
                1
            );

        const end =
            new Date(
                year,
                month + 1,
                0,
                23,
                59,
                59,
                999
            );

        return this.model
            .find({

                tenantId,

                deleted:
                    false,

                createdAt: {

                    $gte:
                        start,

                    $lte:
                        end
                }
            })

            .sort({

                createdAt:
                    -1
            })

            .lean();
    }

    /* ===================================================================== */
    /* EXCEPTIONS                                                             */
    /* ===================================================================== */

    async getExceptions(
        tenantId
    ) {

        return this.model
            .find({

                tenantId,

                deleted:
                    false,

                isBalanced:
                    false
            })

            .lean();
    }

    /* ===================================================================== */
    /* SUMMARY                                                                */
    /* ===================================================================== */

    async getSummary(
        tenantId
    ) {

        const [

            totalReports,

            balancedReports,

            exceptionReports

        ] = await Promise.all([

            this.model
                .countDocuments({

                    tenantId,

                    deleted:
                        false
                }),

            this.model
                .countDocuments({

                    tenantId,

                    deleted:
                        false,

                    isBalanced:
                        true
                }),

            this.model
                .countDocuments({

                    tenantId,

                    deleted:
                        false,

                    isBalanced:
                        false
                })
        ]);

        return {

            totalReports,

            balancedReports,

            exceptionReports
        };
    }

    /* ===================================================================== */
    /* PROVIDER REPORTS                                                       */
    /* ===================================================================== */

    async getProviderReports(
        tenantId,
        provider
    ) {

        return this.model
            .find({

                tenantId,

                provider,

                deleted:
                    false
            })

            .sort({

                createdAt:
                    -1
            })

            .lean();
    }

    /* ===================================================================== */
    /* BULK UPDATE                                                            */
    /* ===================================================================== */

    async bulkUpdate(
        tenantId,
        filter,
        updates
    ) {

        return this.model
            .updateMany(

                {

                    ...filter,

                    tenantId,

                    deleted:
                        false
                },

                {

                    $set: {

                        ...updates,

                        updatedAt:
                            new Date()
                    }
                }
            );
    }

    /* ===================================================================== */
    /* EXISTS                                                                 */
    /* ===================================================================== */

    async exists(
        tenantId,
        query
    ) {

        const result =
            await this.model.exists({

                ...query,

                tenantId,

                deleted:
                    false
            });

        return Boolean(
            result
        );
    }

    /* ===================================================================== */
    /* TRANSACTION SUPPORT                                                    */
    /* ===================================================================== */

    async createWithSession(
        payload,
        session
    ) {

        const document =
            new this.model(
                payload
            );

        return document.save({

            session
        });
    }

    /* ===================================================================== */
    /* HEALTH ANALYTICS                                                       */
    /* ===================================================================== */

    async getHealthMetrics(
        tenantId
    ) {

        const summary =
            await this.getSummary(
                tenantId
            );

        return {

            ...summary,

            successRate:

                summary.totalReports === 0

                    ? 100

                    : Number(

                        (
                            summary
                                .balancedReports /

                            summary
                                .totalReports
                        ) * 100

                    ).toFixed(2)
        };
    }
}

module.exports =
    ReconciliationRepository;