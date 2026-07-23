/**
 * TITech Community Capital LTD
 * Environment bootstrap errors.
 */


class EnvironmentValidationError
    extends Error {


    constructor(
        message,
        details = {}
    ) {

        super(message);

        this.name =
            "EnvironmentValidationError";


        this.details =
            details;

    }

}



module.exports = {

    EnvironmentValidationError

};