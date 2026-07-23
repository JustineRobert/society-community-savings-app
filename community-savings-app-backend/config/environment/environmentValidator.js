const ValidationReport =
require("./validation/validationReport");


const {
    validateSchema
}
=
require("./validation/schemaValidator");


const {
    validateRequired
}
=
require("./validation/requiredValidator");


const {
    validateSecurity
}
=
require("./validation/securityValidator");


const {
    validateDatabase
}
=
require("./validation/databaseValidator");


const {
    validateJWT
}
=
require("./validation/jwtValidator");


const {
    validateMobileMoney
}
=
require("./validation/mobileMoneyValidator");



function validateEnvironment(
    config
) {


    const report =
        new ValidationReport();



    const environment =
        config.server.environment;



    validateSchema(
        config,
        report
    );


    validateRequired(
        config,
        environment,
        report
    );


    validateSecurity(
        config,
        environment,
        report
    );


    validateDatabase(
        config.database,
        report
    );


    validateJWT(
        config.jwt,
        report
    );


    validateMobileMoney(
        config,
        report
    );



    return report.build();

}



module.exports = {

    validateEnvironment

};