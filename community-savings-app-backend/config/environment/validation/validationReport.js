class ValidationReport {


    constructor() {


        this.errors = [];

        this.warnings = [];

        this.checks = [];

    }



    addCheck(
        name,
        passed,
        details={}
    ) {


        this.checks.push({

            name,

            passed,

            details

        });


    }



    error(
        message,
        context={}
    ) {


        this.errors.push({

            message,

            context

        });

    }




    warning(
        message,
        context={}
    ) {


        this.warnings.push({

            message,

            context

        });

    }




    isHealthy() {


        return this.errors.length === 0;

    }



    build() {


        return {

            healthy:
                this.isHealthy(),


            errorCount:
                this.errors.length,


            warningCount:
                this.warnings.length,


            checks:
                this.checks,


            errors:
                this.errors,


            warnings:
                this.warnings

        };


    }


}



module.exports =
    ValidationReport;