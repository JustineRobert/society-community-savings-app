function validateDatabase(
    database,
    report
) {


    if(!database.host) {


        report.error(
            "Database host missing"
        );

    }



    if(
        !database.port
    ) {


        report.error(
            "Database port missing"
        );

    }



    report.addCheck(

        "Database configuration",

        report.errors.length === 0

    );

}



module.exports = {

    validateDatabase

};