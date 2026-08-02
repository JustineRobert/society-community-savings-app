'use strict';


class FiscalCalendar {


    constructor({

        repository

    }={}){


        this.repository =
            repository;

    }





    async createFiscalYear({

        tenantId,

        year,

        periods

    }) {


        return this.repository
            .create({

                tenantId,

                year,

                periods

            });

    }






    async findPeriod({

        tenantId,

        date

    }) {


        return this.repository
            .findByDate({

                tenantId,

                date

            });

    }





    async getCurrentPeriod({

        tenantId

    }) {


        return this.repository
            .findOpenPeriod({

                tenantId

            });

    }


}



module.exports =
    FiscalCalendar;