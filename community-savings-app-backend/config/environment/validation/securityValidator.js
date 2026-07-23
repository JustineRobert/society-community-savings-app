function validateSecurity(
    config,
    environment,
    report
) {


    if(
        environment === "production"
    ) {



        if(
            config.jwt.accessSecret.length < 32
        ) {


            report.error(

                "JWT access secret must be at least 32 characters"

            );


        }



        if(
            config.jwt.refreshSecret.length < 32
        ) {


            report.error(

                "JWT refresh secret must be at least 32 characters"

            );


        }


    }



    report.addCheck(

        "Security validation",

        report.errors.length === 0

    );


}



module.exports = {

    validateSecurity

};