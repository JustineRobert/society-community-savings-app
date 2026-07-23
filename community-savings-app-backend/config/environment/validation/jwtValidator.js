function validateJWT(
    jwt,
    report
) {


    if(
        !jwt.accessSecret
    ) {


        report.error(
            "JWT access secret missing"
        );

    }



    if(
        !jwt.refreshSecret
    ) {


        report.error(
            "JWT refresh secret missing"
        );

    }



    report.addCheck(

        "JWT configuration",

        report.errors.length === 0

    );

}



module.exports = {

    validateJWT

};