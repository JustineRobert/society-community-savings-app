'use strict';


class PeriodValidator {


    validateDates({

        startDate,

        endDate

    }) {


        const errors=[];



        if(
            new Date(startDate)
            >=
            new Date(endDate)
        ){

            errors.push(
                'Start date must be before end date'
            );

        }



        return {

            valid:
                errors.length===0,


            errors

        };

    }


}



module.exports =
    PeriodValidator;