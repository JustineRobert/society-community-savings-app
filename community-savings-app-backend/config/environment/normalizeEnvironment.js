const {
    buildNamespaces
}
=
require("./namespaceBuilder");


const {
    maskSecrets
}
=
require("./secretMasker");


const {
    parseBoolean
}
=
require("./normalizers/boolean");


const {
    parseInteger
}
=
require("./normalizers/number");


const {
    parseArray
}
=
require("./normalizers/array");




function normalizeEnvironment(raw) {


    const normalized = {


        ...raw,



        PORT:
            parseInteger(
                raw.PORT,
                5000
            ),



        DB_PORT:
            parseInteger(
                raw.DB_PORT,
                27017
            ),



        REDIS_ENABLED:
            parseBoolean(
                raw.REDIS_ENABLED
            ),



        MOBILE_MONEY_PROVIDERS:
            parseArray(
                raw.MOBILE_MONEY_PROVIDERS
            )


    };




    return {


        config:
            buildNamespaces(
                normalized
            ),



        diagnostics:
        {

            safeConfig:
                maskSecrets(
                    normalized
                )

        }


    };


}



module.exports = {

    normalizeEnvironment

};