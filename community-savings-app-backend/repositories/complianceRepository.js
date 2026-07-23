"use strict";

/**
 * ============================================================================
 * TITech Community Capital LTD
 *
 * File:
 * backend/repositories/complianceRepository.js
 *
 * Enterprise Compliance Repository
 *
 * Responsibilities:
 *
 *  - Compliance persistence abstraction
 *  - AML case management persistence
 *  - Fraud case persistence
 *  - Sanctions / PEP screening storage
 *  - Tenant isolation
 *  - Transaction/session support
 *
 * Does NOT:
 *
 *  - Perform AML decisions
 *  - Calculate risk scores
 *  - Execute compliance workflows
 *
 * Business logic belongs in:
 *
 *      compliance.service.js
 *
 * ============================================================================
 */


const mongoose = require("mongoose");

const logger =
    require("../infrastructure/logging/logger");


const ComplianceModel =
    require("../models/Compliance");





class ComplianceRepository {


    constructor(
        model = ComplianceModel
    ) {


        if(!model){

            throw new Error(
                "ComplianceModel is required."
            );

        }


        this.model = model;

    }






    /* ===================================================================== */
    /* CREATE                                                                */
    /* ===================================================================== */


    async create(
        tenantId,
        payload,
        options = {}
    ){

        const document = {

            ...payload,

            tenantId,

            deleted:false,

            createdAt:
                new Date(),

            updatedAt:
                new Date()

        };


        try {


            const [
                result
            ] = await this.model.create(

                [
                    document
                ],

                {

                    session:
                        options.session

                }

            );


            return result.toObject();



        } catch(error){


            this.logError(
                "create",
                error,
                {
                    tenantId
                }
            );


            throw error;

        }

    }








    /* ===================================================================== */
    /* FIND BY ID                                                            */
    /* ===================================================================== */


    async findById(
        tenantId,
        id,
        options = {}
    ){


        if(
            !mongoose.Types.ObjectId.isValid(id)
        ){

            return null;

        }


        return this.model

            .findOne({

                _id:id,

                tenantId,

                deleted:false

            })

            .session(
                options.session || null
            )

            .lean();


    }








    /* ===================================================================== */
    /* FIND ONE                                                              */
    /* ===================================================================== */


    async findOne(
        tenantId,
        query = {},
        options = {}
    ){


        return this.model

            .findOne({

                ...query,

                tenantId,

                deleted:false

            })

            .session(
                options.session || null
            )

            .lean();


    }








    /* ===================================================================== */
    /* FIND MANY                                                             */
    /* ===================================================================== */


    async find(
        tenantId,
        filters = {},
        options = {}
    ){


        return this.model

            .find({

                ...filters,

                tenantId,

                deleted:false

            })

            .sort(
                options.sort ||
                {
                    createdAt:-1
                }
            )

            .session(
                options.session || null
            )

            .lean();


    }








    /* ===================================================================== */
    /* SEARCH                                                                */
    /* ===================================================================== */


    async search(
        tenantId,
        options = {}
    ){


        const {

            page = 1,

            limit = 20,

            status,

            category,

            riskLevel,

            type,

            startDate,

            endDate

        } = options;




        const query = {


            tenantId,


            deleted:false


        };



        if(status)
            query.status = status;



        if(category)
            query.category = category;



        if(riskLevel)
            query.riskLevel = riskLevel;



        if(type)
            query.type = type;




        if(
            startDate ||
            endDate
        ){

            query.createdAt = {};


            if(startDate)
                query.createdAt.$gte =
                    startDate;


            if(endDate)
                query.createdAt.$lte =
                    endDate;


        }




        const skip =
            (
                page - 1
            )
            *
            limit;




        const [

            data,

            total

        ] = await Promise.all([


            this.model

                .find(query)

                .skip(skip)

                .limit(limit)

                .sort({

                    createdAt:-1

                })

                .lean(),



            this.model

                .countDocuments(query)


        ]);




        return {


            data,


            pagination:{


                page,


                limit,


                total,


                totalPages:

                    Math.ceil(
                        total / limit
                    )

            }

        };


    }









    /* ===================================================================== */
    /* UPDATE BY ID                                                          */
    /* ===================================================================== */


    async updateById(
        tenantId,
        id,
        updates,
        options={}
    ){


        if(
            !mongoose.Types.ObjectId.isValid(id)
        ){

            return null;

        }



        const blocked = [

            "_id",

            "tenantId",

            "deleted",

            "createdAt"

        ];



        const sanitized =

            Object.keys(
                updates || {}
            )

            .filter(
                key =>
                    !blocked.includes(key)
            )

            .reduce(
                (acc,key)=>{

                    acc[key] =
                        updates[key];

                    return acc;

                },
                {}
            );




        return this.model

            .findOneAndUpdate(

                {


                    _id:id,


                    tenantId,


                    deleted:false


                },


                {


                    $set:{


                        ...sanitized,


                        updatedAt:
                            new Date(),


                        ...(options.updatedBy && {

                            updatedBy:
                                options.updatedBy

                        })


                    }


                },


                {


                    new:true,


                    runValidators:true,


                    session:
                        options.session


                }

            )

            .lean();


    }









    /* ===================================================================== */
    /* CLOSE CASE                                                            */
    /* ===================================================================== */


    async closeById(
        tenantId,
        id,
        data,
        options={}
    ){


        return this.updateById(

            tenantId,

            id,

            {

                ...data,

                status:"CLOSED",

                closedAt:
                    new Date()

            },

            options

        );


    }









    /* ===================================================================== */
    /* DELETE / SOFT DELETE                                                  */
    /* ===================================================================== */


    async deleteById(
        tenantId,
        id,
        options={}
    ){


        return this.model

            .findOneAndUpdate(

                {


                    _id:id,


                    tenantId,


                    deleted:false


                },


                {


                    $set:{


                        deleted:true,


                        deletedAt:
                            new Date(),


                        updatedAt:
                            new Date(),


                        deletedBy:
                            options.deletedBy


                    }


                },


                {


                    new:true,


                    session:
                        options.session


                }

            )

            .lean();


    }









    /* ===================================================================== */
    /* SPECIALIZED COMPLIANCE QUERIES                                        */
    /* ===================================================================== */


    async getAmlCases(
        tenantId
    ){

        return this.find(

            tenantId,

            {

                category:"AML"

            }

        );

    }




    async getFraudCases(
        tenantId
    ){

        return this.find(

            tenantId,

            {

                category:"FRAUD"

            }

        );

    }




    async getHighRiskCases(
        tenantId
    ){

        return this.find(

            tenantId,

            {

                riskLevel:"HIGH"

            }

        );

    }




    async getSanctionsMatches(
        tenantId
    ){

        return this.find(

            tenantId,

            {

                type:
                    "SANCTIONS_MATCH"

            }

        );

    }




    async getPepMatches(
        tenantId
    ){

        return this.find(

            tenantId,

            {

                type:
                    "PEP_MATCH"

            }

        );

    }









    /* ===================================================================== */
    /* METRICS                                                               */
    /* ===================================================================== */


    async getComplianceMetrics(
        tenantId
    ){


        const [

            totalCases,

            amlCases,

            fraudCases,

            highRiskCases,

            openCases

        ] = await Promise.all([


            this.model.countDocuments({

                tenantId,

                deleted:false

            }),



            this.model.countDocuments({

                tenantId,

                category:"AML",

                deleted:false

            }),



            this.model.countDocuments({

                tenantId,

                category:"FRAUD",

                deleted:false

            }),



            this.model.countDocuments({

                tenantId,

                riskLevel:"HIGH",

                deleted:false

            }),



            this.model.countDocuments({

                tenantId,

                status:"OPEN",

                deleted:false

            })


        ]);



        return {

            totalCases,

            amlCases,

            fraudCases,

            highRiskCases,

            openCases

        };


    }









    /* ===================================================================== */
    /* BULK UPDATE                                                           */
    /* ===================================================================== */


    async bulkUpdate(
        tenantId,
        filter,
        updates,
        options={}
    ){


        return this.model.updateMany(

            {

                ...filter,

                tenantId,

                deleted:false

            },


            {


                $set:{


                    ...updates,


                    updatedAt:
                        new Date()


                }


            },


            {

                session:
                    options.session

            }


        );


    }









    /* ===================================================================== */
    /* EXISTS                                                                */
    /* ===================================================================== */


    async exists(
        tenantId,
        query={}
    ){


        return Boolean(

            await this.model.exists({

                ...query,

                tenantId,

                deleted:false

            })

        );


    }









    /* ===================================================================== */
    /* COUNT                                                                  */
    /* ===================================================================== */


    async count(
        tenantId,
        query={}
    ){


        return this.model.countDocuments({

            ...query,

            tenantId,

            deleted:false

        });


    }









    /* ===================================================================== */
    /* SESSION CREATE                                                        */
    /* ===================================================================== */


    async createWithSession(
        payload,
        session
    ){


        const document =
            new this.model(
                payload
            );


        return document.save({

            session

        });


    }









    /* ===================================================================== */
    /* LOGGER                                                                */
    /* ===================================================================== */


    logError(
        method,
        error,
        metadata={}
    ){


        logger.error(

            `ComplianceRepository.${method} failed`,

            {

                ...metadata,

                error:
                    error.message,


                stack:
                    error.stack

            }

        );


    }



}



module.exports =
    ComplianceRepository;