function validateSchema(
    config,
    report
) {


    const requiredNamespaces = [

        "server",

        "database",

        "jwt"

    ];



    for(
        const namespace
        of requiredNamespaces
    ) {


        if(
            !config[namespace]
        ) {


            report.error(

                `Missing configuration namespace: ${namespace}`

            );

        }


    }


    report.addCheck(

        "Configuration schema",

        report.errors.length === 0

    );



}



module.exports = {

    validateSchema

};